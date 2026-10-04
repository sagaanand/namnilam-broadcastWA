import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const AUTH_DIR = path.join(__dirname, 'wa_session');
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// In-Memory state
let sock = null;
let currentQr = null;
let currentQrImage = null;
let connectionStatus = 'disconnected'; // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
let connectedUser = null;

// Persistent Store Files
const CHATS_FILE = path.join(__dirname, 'chats_store.json');
const MSGS_FILE = path.join(__dirname, 'msgs_store.json');
const AI_SETTINGS_FILE = path.join(__dirname, 'ai_settings.json');
const BROADCASTS_FILE = path.join(__dirname, 'broadcasts_store.json');
const CONTACTS_FILE = path.join(__dirname, 'contacts_store.json');

const loadJson = (file, fallback) => {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    console.error(`Error loading ${file}:`, e.message);
  }
  return fallback;
};

const saveJson = (file, data) => {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(`Error saving ${file}:`, e.message);
  }
};

let chats = loadJson(CHATS_FILE, []);
let messagesMap = loadJson(MSGS_FILE, {});
let broadcastsList = loadJson(BROADCASTS_FILE, []);
let contactsList = loadJson(CONTACTS_FILE, []);
let activeBroadcast = null;

let aiSettings = loadJson(AI_SETTINGS_FILE, {
  enabled: false,
  businessName: 'Nam Nilam Realty',
  instructions: 'Politely answer questions about project details, plot availability, and pricing starting from ₹18.5 Lakhs. Offer free weekend site visits.',
});
aiSettings.enabled = false;

// Helper: Sync chat recency & lastMessage from messagesMap on startup
const syncChatRecencyAndLastMessages = () => {
  for (const c of chats) {
    const msgs = messagesMap[c.id];
    if (Array.isArray(msgs) && msgs.length > 0) {
      const last = msgs[msgs.length - 1];
      if (last && last.text) {
        c.lastMessage = last.text;
        c.lastMessageTime = last.timestamp || c.lastMessageTime;
        c.rawTime = last.rawTime || c.rawTime || 0;
      }
    }
  }

  // Sort chats: chats with recent messages first
  chats.sort((a, b) => (b.rawTime || 0) - (a.rawTime || 0));
  saveJson(CHATS_FILE, chats);
};

syncChatRecencyAndLastMessages();


// Format Indian phone number for display
const formatPhoneNumber = (jid) => {
  if (!jid) return '';
  const num = jid.split('@')[0].split(':')[0];
  if (num.length === 12 && num.startsWith('91')) {
    return `+91 ${num.substring(2, 7)} ${num.substring(7)}`;
  }
  return `+${num}`;
};

// Generate AI response based on message text and business knowledge
const generateAiResponse = (text) => {
  const lower = (text || '').toLowerCase().trim();
  const biz = aiSettings.businessName || 'Nam Nilam Realty';

  // 1. Check trained FAQs in knowledge base
  if (Array.isArray(aiSettings.faqs) && aiSettings.faqs.length > 0) {
    for (const faq of aiSettings.faqs) {
      if (!faq.question || !faq.answer) continue;
      const qLower = faq.question.toLowerCase().trim();
      const qWords = qLower.split(/\s+/).filter((w) => w.length > 3);
      const matchCount = qWords.filter((w) => lower.includes(w)).length;
      if (lower.includes(qLower) || (qWords.length > 0 && matchCount >= Math.ceil(qWords.length * 0.5))) {
        return faq.answer;
      }
    }
  }

  // 2. Check trained Products / Services catalog
  if (Array.isArray(aiSettings.products) && aiSettings.products.length > 0) {
    for (const prod of aiSettings.products) {
      if (!prod.name) continue;
      const pNameLower = prod.name.toLowerCase().trim();
      const pWords = pNameLower.split(/\s+/).filter((w) => w.length > 3);
      const matches = lower.includes(pNameLower) || pWords.some((w) => lower.includes(w));
      if (matches) {
        let reply = `Here are the details for ${prod.name}:`;
        if (prod.price) reply += `\n• Price: ${prod.price}`;
        if (prod.specs) reply += `\n• Specs: ${prod.specs}`;
        if (prod.location) reply += `\n• Location: ${prod.location}`;
        if (prod.description) reply += `\n• Details: ${prod.description}`;
        reply += `\n\nWould you like to schedule a free site visit or receive the layout map on WhatsApp?`;
        return reply;
      }
    }
  }

  // 3. Domain pattern matching: Project details & Plots
  if (
    lower.includes('project') ||
    lower.includes('details') ||
    lower.includes('venum') ||
    lower.includes('detail') ||
    lower.includes('plot') ||
    lower.includes('land') ||
    lower.includes('layout') ||
    lower.includes('nilam')
  ) {
    return `Nam Nilam offers premium DTCP & RERA approved residential plots in Abirami Nagar starting from ₹18.5 Lakhs. Plots range from 1,200 to 2,400 sq.ft with 40ft blacktop roads, 24/7 security, and clear titles.\n\nWould you like us to share the project brochure and layout map on WhatsApp?`;
  }

  // 5. Domain pattern matching: Pricing & Cost
  if (
    lower.includes('price') ||
    lower.includes('cost') ||
    lower.includes('rate') ||
    lower.includes('budget') ||
    lower.includes('vilai')
  ) {
    return `Our plots start from ₹18.5 Lakhs (approx ₹1,540 / sq.ft). DTCP and RERA approvals are clear, and bank loans are arranged. Would you like the complete price details?`;
  }

  // 6. Domain pattern matching: Site visits & Location
  if (
    lower.includes('visit') ||
    lower.includes('site') ||
    lower.includes('location') ||
    lower.includes('saturday') ||
    lower.includes('sunday') ||
    lower.includes('paaka')
  ) {
    return `Yes! We arrange free weekend site visits with complimentary cab pickup. Would Saturday or Sunday morning work better for you?`;
  }

  // 7. Domain pattern matching: Bank Loans & EMI
  if (
    lower.includes('loan') ||
    lower.includes('bank') ||
    lower.includes('emi') ||
    lower.includes('interest')
  ) {
    return `Up to 80% bank loan approval is ready with SBI, HDFC, and Indian Bank. Our team assists with all paperwork free of charge.`;
  }

  // 8. Domain pattern matching: Office Location & Consultations
  if (
    lower.includes('office') ||
    lower.includes('address') ||
    lower.includes('chennai') ||
    lower.includes('meet') ||
    lower.includes('timing')
  ) {
    const addr = aiSettings.officeAddress || 'No. 45, Anna Salai, Guindy, Chennai, Tamil Nadu - 600032';
    return `Our office is located at:\n📍 ${addr}\n\nWorking Hours: Monday to Saturday, 9:30 AM to 7:00 PM IST.\nYou are welcome to visit our office or schedule a site visit with our team.`;
  }

  // 9. Greetings (Tamil / English / Tanglish)
  if (lower.includes('hi') || lower.includes('hello') || lower.includes('vanakkam') || lower.includes('hey') || lower.includes('namaste')) {
    return `Vanakkam! Thank you for contacting ${biz}.\n\nHow can I assist you today with our DTCP & RERA approved properties and residential plots?`;
  }

  // 10. General fallback using business knowledge instructions
  if (aiSettings.instructions && aiSettings.instructions.length > 10) {
    return `Thank you for contacting ${biz}! I can help you with project brochures, available plots, pricing, and scheduling free site visits. What information are you looking for?`;
  }

  return `Thank you for contacting ${biz}! How can I help you regarding our property and projects today?`;
};

// -----------------------------------------------------------------
// SAFE ANTI-BAN SEPARATE BROADCAST BOT ENGINE
// -----------------------------------------------------------------

// Helper: Format message with recipient variables & spintax {opt1|opt2}
function formatBroadcastMessage(template, recipient, businessName) {
  let text = template || '';
  const nameVal = recipient.name && recipient.name.trim() ? recipient.name.trim() : 'Friend';
  const phoneVal = recipient.phone || '';
  const bizVal = businessName || 'Nam Nilam Realty';

  // Replace variables
  text = text.replace(/\{\{\s*name\s*\}\}|\{name\}/gi, nameVal);
  text = text.replace(/\{\{\s*phone\s*\}\}|\{phone\}/gi, phoneVal);
  text = text.replace(/\{\{\s*company\s*\}\}|\{company\}|\{\{\s*business\s*\}\}|\{business\}/gi, bizVal);

  // Resolve spintax {option1|option2|option3} to prevent identical message fingerprints
  text = text.replace(/\{([^{}]+)\|([^{}]+)\}/g, (match) => {
    const inner = match.slice(1, -1);
    const parts = inner.split('|');
    return parts[Math.floor(Math.random() * parts.length)].trim();
  });

  return text;
}

// Helper: Normalize to valid WhatsApp JID (Supports Singapore +65, India +91, and international)
function normalizeWhatsAppJid(raw) {
  if (!raw) return null;
  let clean = raw.toString().replace(/[^0-9]/g, '');
  if (!clean) return null;

  // 1. Singapore 8-digit mobile/landline (starts with 8, 9, 6) -> 65XXXXXXXX
  if (clean.length === 8 && /^[689]/.test(clean)) {
    clean = '65' + clean;
  }
  // 2. Already Singapore number with country code 65 (e.g. 6581234567, 6591234567) -> Keep it
  else if (clean.length === 10 && clean.startsWith('65')) {
    // Keep 65XXXXXXXX
  }
  // 3. Indian 10-digit mobile (starts with 6, 7, 8, 9) -> 91XXXXXXXXXX
  else if (clean.length === 10 && /^[6-9]/.test(clean)) {
    clean = '91' + clean;
  }
  // 4. 11 digits starting with 0 -> replace with 91
  else if (clean.length === 11 && clean.startsWith('0')) {
    clean = '91' + clean.slice(1);
  }

  if (clean.length < 8 || clean.length > 15) return null;
  return `${clean}@s.whatsapp.net`;
}

// Background Dispatcher Loop
async function runBroadcastWorker(broadcastId) {
  const bc = activeBroadcast;
  if (!bc || bc.id !== broadcastId) return;

  console.log(`[Broadcast Bot] Starting campaign: "${bc.name}" (${bc.recipients.length} recipients)`);

  let sentInCurrentBatch = 0;

  while (bc.currentIndex < bc.recipients.length) {
    if (bc.status === 'cancelled') {
      console.log(`[Broadcast Bot] Campaign "${bc.name}" cancelled.`);
      saveJson(BROADCASTS_FILE, broadcastsList);
      break;
    }

    if (bc.status === 'paused') {
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }

    // Anti-ban Batch Cooldown
    if (bc.batchSize > 0 && sentInCurrentBatch >= bc.batchSize && bc.currentIndex < bc.recipients.length) {
      const pauseSec = bc.batchPauseSeconds || 180;
      bc.isBatchPaused = true;
      bc.batchPauseRemaining = pauseSec;
      bc.logs.unshift({
        timestamp: new Date().toLocaleTimeString(),
        type: 'system',
        message: `🛡️ Anti-ban cooldown: Resting for ${pauseSec}s to protect WhatsApp number...`,
      });

      console.log(`[Broadcast Bot] Batch pause: Resting for ${pauseSec}s...`);

      for (let s = pauseSec; s > 0; s--) {
        if (bc.status === 'cancelled') break;
        bc.batchPauseRemaining = s;
        await new Promise((r) => setTimeout(r, 1000));
      }
      bc.isBatchPaused = false;
      bc.batchPauseRemaining = 0;
      sentInCurrentBatch = 0;

      if (bc.status === 'cancelled') break;
    }

    const current = bc.recipients[bc.currentIndex];
    bc.currentRecipient = current;
    const jid = normalizeWhatsAppJid(current.phone);

    if (!jid) {
      bc.failedCount++;
      bc.logs.unshift({
        timestamp: new Date().toLocaleTimeString(),
        type: 'error',
        phone: current.phone,
        name: current.name,
        message: 'Invalid phone number format',
      });
      bc.currentIndex++;
      continue;
    }

    if (connectionStatus !== 'connected' || !sock) {
      bc.logs.unshift({
        timestamp: new Date().toLocaleTimeString(),
        type: 'warning',
        message: 'WhatsApp disconnected. Waiting 5s for reconnection...',
      });
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }

    // Anti-Ban Random Jitter Delay
    const minD = Math.max(1, bc.delaySecondsMin || 15);
    const maxD = Math.max(minD, bc.delaySecondsMax || 30);
    const delaySec = Math.floor(Math.random() * (maxD - minD + 1)) + minD;

    for (let c = delaySec; c > 0; c--) {
      if (bc.status === 'cancelled') break;
      while (bc.status === 'paused') {
        await new Promise((r) => setTimeout(r, 1000));
        if (bc.status === 'cancelled') break;
      }
      bc.nextCountdown = c;
      await new Promise((r) => setTimeout(r, 1000));
    }
    bc.nextCountdown = 0;
    if (bc.status === 'cancelled') break;

    // Simulate Human Typing Presence
    if (bc.simulateTyping && sock) {
      try {
        await sock.sendPresenceUpdate('composing', jid);
        const typingDuration = Math.floor(Math.random() * 2000) + 2000;
        await new Promise((r) => setTimeout(r, typingDuration));
        await sock.sendPresenceUpdate('paused', jid);
      } catch (e) {}
    }

    // Format Personalized & Spintax Message
    const customizedText = formatBroadcastMessage(bc.template, current, aiSettings.businessName);

    // ── Send with Retry (up to 3 attempts, waits for reconnect on Connection Closed) ──
    let sendSuccess = false;
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      // Wait if WhatsApp is not connected yet (max 30s per attempt)
      let waitedSec = 0;
      while ((connectionStatus !== 'connected' || !sock) && waitedSec < 30) {
        if (bc.status === 'cancelled') break;
        bc.logs.unshift({
          timestamp: new Date().toLocaleTimeString(),
          type: 'warning',
          message: `⏳ Waiting for WhatsApp reconnect... (${waitedSec}s) Attempt ${attempt}/${MAX_RETRIES}`,
        });
        await new Promise((r) => setTimeout(r, 3000));
        waitedSec += 3;
      }

      if (bc.status === 'cancelled') break;

      if (connectionStatus !== 'connected' || !sock) {
        // Still not connected after waiting — try next attempt
        if (attempt < MAX_RETRIES) {
          bc.logs.unshift({
            timestamp: new Date().toLocaleTimeString(),
            type: 'warning',
            message: `🔄 Retrying ${current.phone}... (Attempt ${attempt}/${MAX_RETRIES})`,
          });
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }
        break;
      }

      try {
        await sock.sendMessage(jid, { text: customizedText });
        sendSuccess = true;
        bc.sentCount++;
        sentInCurrentBatch++;

        bc.logs.unshift({
          timestamp: new Date().toLocaleTimeString(),
          type: 'success',
          phone: current.phone,
          name: current.name || 'Friend',
          message: `✅ Sent to ${current.phone}${attempt > 1 ? ` (retry ${attempt})` : ''}`,
          preview: customizedText.substring(0, 50) + (customizedText.length > 50 ? '...' : ''),
        });

        if (bc.logs.length > 100) bc.logs.pop();

        // Record in local messages store and chat lists
        const msgObj = {
          id: `bc_msg_${Date.now()}`,
          conversationId: jid,
          sender: 'human',
          text: customizedText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'sent',
        };
        if (!messagesMap[jid]) messagesMap[jid] = [];
        messagesMap[jid].push(msgObj);
        saveJson(MSGS_FILE, messagesMap);

        let chatEntry = chats.find((c) => c.id === jid);
        if (!chatEntry) {
          chatEntry = {
            id: jid,
            contactName: current.name || formatPhoneNumber(jid),
            contactPhone: formatPhoneNumber(jid),
            lastMessage: customizedText,
            lastMessageTime: msgObj.timestamp,
            rawTime: Math.floor(Date.now() / 1000),
            unreadCount: 0,
            isAiMode: true,
          };
          chats.unshift(chatEntry);
        } else {
          chatEntry.lastMessage = customizedText;
          chatEntry.lastMessageTime = msgObj.timestamp;
          chatEntry.rawTime = Math.floor(Date.now() / 1000);
        }
        saveJson(CHATS_FILE, chats);
        break; // Success — exit retry loop

      } catch (sendErr) {
        console.error(`[Broadcast Bot] Send attempt ${attempt}/${MAX_RETRIES} failed for ${jid}:`, sendErr.message);

        if (attempt < MAX_RETRIES) {
          bc.logs.unshift({
            timestamp: new Date().toLocaleTimeString(),
            type: 'warning',
            phone: current.phone,
            name: current.name,
            message: `🔄 Send failed (${sendErr.message}). Retrying in 8s... (${attempt}/${MAX_RETRIES})`,
          });
          await new Promise((r) => setTimeout(r, 8000)); // Wait 8s before retry
        } else {
          // All retries exhausted
          bc.failedCount++;
          bc.logs.unshift({
            timestamp: new Date().toLocaleTimeString(),
            type: 'error',
            phone: current.phone,
            name: current.name,
            message: `❌ Failed after ${MAX_RETRIES} attempts: ${sendErr.message || 'Send failed'}`,
          });
        }
      }
    }

    bc.currentIndex++;

    const histIdx = broadcastsList.findIndex((b) => b.id === bc.id);
    if (histIdx >= 0) {
      broadcastsList[histIdx] = { ...bc };
      saveJson(BROADCASTS_FILE, broadcastsList);
    }
  }

  if (bc.status !== 'cancelled') {
    bc.status = 'completed';
    bc.logs.unshift({
      timestamp: new Date().toLocaleTimeString(),
      type: 'system',
      message: `🎉 Campaign finished! Delivered: ${bc.sentCount}, Failed: ${bc.failedCount}, Total: ${bc.recipients.length}`,
    });
  }

  const histIdx = broadcastsList.findIndex((b) => b.id === bc.id);
  if (histIdx >= 0) {
    broadcastsList[histIdx] = { ...bc };
    saveJson(BROADCASTS_FILE, broadcastsList);
  }
}

// Start Baileys Connection
async function startWhatsAppSocket() {
  try {
    connectionStatus = 'connecting';
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
      logger: pino({ level: 'silent' }),
      browser: Browsers.macOS('Desktop'),
      // Broadcast-Only Mode: disable full history sync to prevent WhatsApp conflict errors
      syncFullHistory: false,
      getMessage: async () => undefined,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQr = qr;
        connectionStatus = 'qr_ready';
        try {
          currentQrImage = await QRCode.toDataURL(qr, {
            width: 280,
            margin: 1,
            color: { dark: '#111B21', light: '#FFFFFF' },
            errorCorrectionLevel: 'M',
          });
        } catch (e) {
          console.error('[QR generation error]:', e.message);
        }
        console.log('[WhatsApp] New QR code generated & image ready. Ready for scanning from phone.');
      }

      if (connection === 'close') {
        const shouldReconnect =
          lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log(
          `[WhatsApp] Connection closed. Reason: ${lastDisconnect?.error?.message}. Reconnecting: ${shouldReconnect}`
        );
        connectionStatus = 'disconnected';
        currentQr = null;
        currentQrImage = null;

        if (shouldReconnect) {
          setTimeout(startWhatsAppSocket, 3000);
        } else {
          try {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          } catch (e) {}
          setTimeout(startWhatsAppSocket, 3000);
        }
      } else if (connection === 'open') {
        console.log('[WhatsApp] Connection established successfully!');
        connectionStatus = 'connected';
        currentQr = null;
        currentQrImage = null;
        connectedUser = {
          id: sock.user?.id ? formatPhoneNumber(sock.user.id) : '',
          name: sock.user?.name || 'Nam Nilam Broadcast',
        };
      }
    });

    // Broadcast-Only Mode: History sync DISABLED — we don't need to pull chat history
    sock.ev.on('messaging-history.set', () => {
      console.log('[WhatsApp] History sync skipped — Broadcast-Only mode active.');
      return; // Do nothing
      
      // 1. Build contact phonebook name map
      const contactNamesMap = {};
      if (Array.isArray(historyContacts)) {
        for (const ct of historyContacts) {
          if (!ct.id) continue;
          const name = ct.name || ct.notify || ct.verifiedName;
          if (name) contactNamesMap[ct.id] = name;
        }
      }

      // 2. Process and Store Historical Messages
      if (Array.isArray(historyMessages)) {
        for (const m of historyMessages) {
          if (!m.message) continue;
          const remoteJid = m.key?.remoteJid;
          if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') continue;

          const text =
            m.message.conversation ||
            m.message.extendedTextMessage?.text ||
            m.message.imageMessage?.caption ||
            '';
          if (!text.trim()) continue;

          const isFromMe = Boolean(m.key?.fromMe);
          const tsSeconds = typeof m.messageTimestamp === 'number'
            ? m.messageTimestamp
            : (m.messageTimestamp?.low || Math.floor(Date.now() / 1000));
          const timeString = new Date(tsSeconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          const msgObj = {
            id: m.key.id || `hist_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            conversationId: remoteJid,
            sender: isFromMe ? 'human' : 'customer',
            text: text.trim(),
            timestamp: timeString,
            rawTime: tsSeconds,
            status: 'read',
          };

          if (!messagesMap[remoteJid]) messagesMap[remoteJid] = [];
          if (!messagesMap[remoteJid].some((x) => x.id === msgObj.id)) {
            messagesMap[remoteJid].push(msgObj);
          }
        }

        // Sort messages inside each chat chronologically
        for (const jid in messagesMap) {
          messagesMap[jid].sort((a, b) => (a.rawTime || 0) - (b.rawTime || 0));
        }
        saveJson(MSGS_FILE, messagesMap);
      }

      // 3. Process Chats and link lastMessage + contactName
      if (Array.isArray(historyChats)) {
        for (const c of historyChats) {
          if (!c.id || c.id.endsWith('@g.us') || c.id === 'status@broadcast') continue;
          const contactPhone = formatPhoneNumber(c.id);
          const contactName = contactNamesMap[c.id] || c.name || contactPhone;
          const chatMsgs = messagesMap[c.id];
          const lastMsg = Array.isArray(chatMsgs) && chatMsgs.length > 0 ? chatMsgs[chatMsgs.length - 1] : null;

          const convTs = c.conversationTimestamp?.low || c.conversationTimestamp || lastMsg?.rawTime || 0;
          const existingIdx = chats.findIndex((x) => x.id === c.id);

          const chatEntry = {
            id: c.id,
            contactName,
            contactPhone,
            lastMessage: lastMsg ? lastMsg.text : '',
            lastMessageTime: lastMsg ? lastMsg.timestamp : '',
            rawTime: convTs,
            unreadCount: c.unreadCount || 0,
            isAiMode: true,
          };

          if (existingIdx === -1) {
            chats.push(chatEntry);
          } else {
            chats[existingIdx] = {
              ...chats[existingIdx],
              contactName: contactNamesMap[c.id] || chats[existingIdx].contactName || contactName,
              lastMessage: lastMsg ? lastMsg.text : chats[existingIdx].lastMessage,
              lastMessageTime: lastMsg ? lastMsg.timestamp : chats[existingIdx].lastMessageTime,
              rawTime: Math.max(chats[existingIdx].rawTime || 0, convTs),
              unreadCount: c.unreadCount !== undefined ? c.unreadCount : chats[existingIdx].unreadCount,
            };
          }
        }

        // Sort chats by most recent message/activity
        chats.sort((a, b) => (b.rawTime || 0) - (a.rawTime || 0));
        saveJson(CHATS_FILE, chats);
      }
    });

    // Broadcast-Only Mode: Chats upsert DISABLED
    sock.ev.on('chats.upsert', () => { /* Broadcast-only: ignore incoming chat updates */ });

    // Broadcast-Only Mode: Incoming messages DISABLED — only SEND, never receive/store
    sock.ev.on('messages.upsert', () => { /* Broadcast-only: ignore all incoming messages */ });
  } catch (err) {
    console.error('[WhatsApp] Initialization error:', err.message);
    connectionStatus = 'disconnected';
  }
}

// -------------------------------------------------------------
// REST API ENDPOINTS
// -------------------------------------------------------------

// 1. WhatsApp status & user details
app.get('/api/status', (req, res) => {
  res.json({
    status: connectionStatus,
    phoneNumber: connectedUser?.id || null,
    name: connectedUser?.name || null,
    qr: currentQr,
    qrImage: currentQrImage,
    aiEnabled: aiSettings.enabled,
    aiSettings,
  });
});

// 2. Real-time QR Code
app.get('/api/qr', (req, res) => {
  res.json({
    qr: currentQr,
    qrImage: currentQrImage,
    status: connectionStatus,
  });
});

// 2.1 Refresh QR Code
app.post('/api/refresh-qr', async (req, res) => {
  console.log('[WhatsApp] User requested manual QR refresh. Restarting Baileys socket...');
  try {
    if (sock) {
      try {
        sock.end();
      } catch (e) {}
    }
  } catch (e) {}
  currentQr = null;
  currentQrImage = null;
  connectionStatus = 'connecting';
  setTimeout(startWhatsAppSocket, 500);
  res.json({ success: true, message: 'Restarting session bridge...' });
});

// 3. Chats list
app.get('/api/chats', (req, res) => {
  res.json({
    chats,
  });
});

// 3b. Contacts list
app.get('/api/contacts', (req, res) => {
  res.json({
    success: true,
    contacts: contactsList,
  });
});

app.post('/api/contacts', (req, res) => {
  const { contacts } = req.body;
  if (Array.isArray(contacts)) {
    contactsList = contacts;
    saveJson(CONTACTS_FILE, contactsList);
    return res.json({ success: true, count: contactsList.length });
  }
  res.status(400).json({ success: false, error: 'contacts array required' });
});

// 4. Messages for specific chat
app.get('/api/messages/:chatId', (req, res) => {
  const { chatId } = req.params;
  const msgs = messagesMap[chatId] || [];
  res.json({ messages: msgs });
});

// 5. Send message from Web UI
app.post('/api/send-message', async (req, res) => {
  const { chatId, text } = req.body;
  if (!chatId || !text || !text.trim()) {
    return res.status(400).json({ error: 'chatId and text required' });
  }

  if (connectionStatus !== 'connected' || !sock) {
    return res.status(503).json({ error: 'WhatsApp is not connected. Please scan QR first.' });
  }

  try {
    await sock.sendMessage(chatId, { text: text.trim() });

    const msgObj = {
      id: `manual_${Date.now()}`,
      conversationId: chatId,
      sender: 'human',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sent',
    };

    if (!messagesMap[chatId]) messagesMap[chatId] = [];
    messagesMap[chatId].push(msgObj);
    saveJson(MSGS_FILE, messagesMap);

    const cIdx = chats.findIndex((c) => c.id === chatId);
    if (cIdx >= 0) {
      const c = chats.splice(cIdx, 1)[0];
      c.lastMessage = text.trim();
      c.lastMessageTime = msgObj.timestamp;
      c.rawTime = Math.floor(Date.now() / 1000);
      chats.unshift(c);
      saveJson(CHATS_FILE, chats);
    }

    res.json({ success: true, message: msgObj });
  } catch (err) {
    console.error('Error sending message:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 6. Toggle AI Assistant ON/OFF
app.post('/api/ai-toggle', (req, res) => {
  const { enabled, chatId } = req.body;

  if (chatId) {
    const cIdx = chats.findIndex((c) => c.id === chatId);
    if (cIdx >= 0) {
      chats[cIdx].isAiMode = Boolean(enabled);
      saveJson(CHATS_FILE, chats);
    }
  } else {
    aiSettings.enabled = Boolean(enabled);
    saveJson(AI_SETTINGS_FILE, aiSettings);
  }

  res.json({ success: true, aiEnabled: aiSettings.enabled });
});

// 7. Update AI Settings & Knowledge (Full Training Engine)
app.post('/api/ai-settings', (req, res) => {
  const {
    businessName,
    instructions,
    enabled,
    description,
    location,
    contactDetails,
    products,
    faqs,
    industry,
    officeAddress,
    websiteUrl,
    languageStyle,
    alwaysRules,
    neverRules,
    freeformDocument,
    responseStyle,
  } = req.body;

  if (businessName !== undefined) aiSettings.businessName = businessName;
  if (instructions !== undefined) aiSettings.instructions = instructions;
  if (enabled !== undefined) aiSettings.enabled = Boolean(enabled);
  if (description !== undefined) aiSettings.description = description;
  if (location !== undefined) aiSettings.location = location;
  if (contactDetails !== undefined) aiSettings.contactDetails = contactDetails;
  if (products !== undefined) aiSettings.products = products;
  if (faqs !== undefined) aiSettings.faqs = faqs;
  if (industry !== undefined) aiSettings.industry = industry;
  if (officeAddress !== undefined) aiSettings.officeAddress = officeAddress;
  if (websiteUrl !== undefined) aiSettings.websiteUrl = websiteUrl;
  if (languageStyle !== undefined) aiSettings.languageStyle = languageStyle;
  if (alwaysRules !== undefined) aiSettings.alwaysRules = alwaysRules;
  if (neverRules !== undefined) aiSettings.neverRules = neverRules;
  if (freeformDocument !== undefined) aiSettings.freeformDocument = freeformDocument;
  if (responseStyle !== undefined) aiSettings.responseStyle = responseStyle;

  saveJson(AI_SETTINGS_FILE, aiSettings);
  console.log('[AI Knowledge] Successfully updated AI training parameters.');
  res.json({ success: true, aiSettings });
});

// 7.1 Test AI Response Simulator
app.post('/api/ai-test', (req, res) => {
  const { text } = req.body;
  const reply = generateAiResponse(text || '');
  res.json({ success: true, reply });
});

// 8. Disconnect WhatsApp Session
app.post('/api/disconnect', async (req, res) => {
  try {
    if (sock) {
      await sock.logout();
      sock.end();
    }
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    connectionStatus = 'disconnected';
    currentQr = null;
    connectedUser = null;
    setTimeout(startWhatsAppSocket, 1000);
    res.json({ success: true, message: 'WhatsApp disconnected. Restarting QR...' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 9. Anti-Ban Broadcast API Endpoints

// 9.1 Start Broadcast Campaign
app.post('/api/broadcasts/start', (req, res) => {
  const {
    name,
    template,
    recipients,
    delaySecondsMin,
    delaySecondsMax,
    simulateTyping,
    batchSize,
    batchPauseSeconds,
  } = req.body;

  if (!template || !template.trim()) {
    return res.status(400).json({ error: 'Message template is required.' });
  }

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'Recipients list is empty.' });
  }

  if (activeBroadcast && (activeBroadcast.status === 'running' || activeBroadcast.status === 'paused')) {
    return res.status(400).json({
      error: 'Another broadcast campaign is currently in progress. Please pause or cancel it first.',
    });
  }

  const campaignId = `bc_${Date.now()}`;
  activeBroadcast = {
    id: campaignId,
    name: name?.trim() || `Campaign ${new Date().toLocaleDateString()}`,
    template: template.trim(),
    recipients,
    delaySecondsMin: Number(delaySecondsMin) || 15,
    delaySecondsMax: Number(delaySecondsMax) || 30,
    simulateTyping: simulateTyping !== false,
    batchSize: Number(batchSize) || 15,
    batchPauseSeconds: Number(batchPauseSeconds) || 180,
    status: 'running',
    sentCount: 0,
    failedCount: 0,
    totalCount: recipients.length,
    currentIndex: 0,
    currentRecipient: null,
    nextCountdown: 0,
    isBatchPaused: false,
    batchPauseRemaining: 0,
    logs: [
      {
        timestamp: new Date().toLocaleTimeString(),
        type: 'system',
        message: `Campaign initialized with ${recipients.length} recipients. Safe anti-ban mode active.`,
      },
    ],
    createdAt: new Date().toISOString(),
  };

  broadcastsList.unshift(activeBroadcast);
  saveJson(BROADCASTS_FILE, broadcastsList);

  runBroadcastWorker(campaignId);

  res.json({ success: true, broadcast: activeBroadcast });
});

// 9.2 Get Active Broadcast Status & Campaign History
app.get('/api/broadcasts/status', (req, res) => {
  res.json({
    active: activeBroadcast,
    history: broadcastsList,
  });
});

// 9.3 Pause Campaign
app.post('/api/broadcasts/:id/pause', (req, res) => {
  const { id } = req.params;
  if (activeBroadcast && activeBroadcast.id === id) {
    activeBroadcast.status = 'paused';
    activeBroadcast.logs.unshift({
      timestamp: new Date().toLocaleTimeString(),
      type: 'warning',
      message: 'Campaign paused by operator.',
    });
    saveJson(BROADCASTS_FILE, broadcastsList);
    return res.json({ success: true, active: activeBroadcast });
  }
  res.status(404).json({ error: 'Active broadcast not found.' });
});

// 9.4 Resume Campaign
app.post('/api/broadcasts/:id/resume', (req, res) => {
  const { id } = req.params;
  if (activeBroadcast && activeBroadcast.id === id) {
    activeBroadcast.status = 'running';
    activeBroadcast.logs.unshift({
      timestamp: new Date().toLocaleTimeString(),
      type: 'system',
      message: 'Campaign resumed by operator.',
    });
    saveJson(BROADCASTS_FILE, broadcastsList);
    return res.json({ success: true, active: activeBroadcast });
  }
  res.status(404).json({ error: 'Active broadcast not found.' });
});

// 9.5 Cancel Campaign
app.post('/api/broadcasts/:id/cancel', (req, res) => {
  const { id } = req.params;
  if (activeBroadcast && activeBroadcast.id === id) {
    activeBroadcast.status = 'cancelled';
    activeBroadcast.logs.unshift({
      timestamp: new Date().toLocaleTimeString(),
      type: 'error',
      message: 'Campaign stopped by operator.',
    });
    saveJson(BROADCASTS_FILE, broadcastsList);
    return res.json({ success: true, active: activeBroadcast });
  }
  res.status(404).json({ error: 'Active broadcast not found.' });
});

// Start Express Server and WhatsApp socket
app.listen(PORT, () => {
  console.log(`[Server] Nam Nilam WhatsApp Bridge listening on http://localhost:${PORT}`);
  startWhatsAppSocket();
});
