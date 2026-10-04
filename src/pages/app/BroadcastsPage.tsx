import React, { useState, useId } from 'react';
import { Link } from 'react-router-dom';
import {
  Radio,
  Plus,
  ShieldCheck,
  Play,
  Pause,
  Square,
  Upload,
  FileSpreadsheet,
  Clock,
  Sparkles,
  CheckCircle2,
  Terminal,
  RefreshCw,
  Zap,
  MessageSquare,
  Smartphone,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { SEOHead } from '../../components/SEOHead';
import { BroadcastRecipient } from '../../types/app';

export const BroadcastsPage: React.FC = () => {
  const {
    broadcasts,
    activeBroadcast,
    startRealBroadcast,
    pauseBroadcast,
    resumeBroadcast,
    cancelBroadcast,
    templates,
    contacts,
    addToast,
  } = useWorkspace();

  const fileInputId = useId();

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [templateText, setTemplateText] = useState(
    `🏡 ✨ NAM NILAM PROPERTIES - EXCLUSIVE PLOT LAUNCH ✨ 🏡

📍 LOCATION: ABIRAMI NAGAR, NEAR NH HIGHWAY
📐 PLOT SIZES: 1200 - 2400 SQ.FT
📜 APPROVAL: 100% DTCP & RERA APPROVED

💰 PRICE: Starting from just ₹18.5 Lakhs (₹1,540 / sq.ft)
🏦 BANK LOAN: Up to 80% pre-approved (SBI, HDFC, Indian Bank)

🌟 HIGHLIGHTS:
✅ 40ft & 30ft Blacktop Roads
✅ 24/7 Gated Security & LED Street Lights
✅ Clear Title & Immediate Registration
✅ Free Cab Pickup for Saturday & Sunday Site Visits

📞 CONTACT US: +91 97876 00221
👉 Reply 'VISIT' to schedule your free weekend site visit!`
  );
  const [recipientTab, setRecipientTab] = useState<'paste' | 'csv' | 'crm'>('paste');

  // Paste Tab State
  const [pastedText, setPastedText] = useState('');

  // CSV Tab State
  const [csvFileName, setCsvFileName] = useState('');
  const [csvRecipients, setCsvRecipients] = useState<BroadcastRecipient[]>([]);
  const [csvStats, setCsvStats] = useState<{ totalRows: number; duplicates: number; detectedColumn: string } | null>(null);

  // CRM Tab State
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  // Anti-Ban Safeguards State
  const [safetyMode, setSafetyMode] = useState<'safe' | 'balanced' | 'custom'>('safe');
  const [delayMin, setDelayMin] = useState(15);
  const [delayMax, setDelayMax] = useState(30);
  const [simulateTyping, setSimulateTyping] = useState(true);
  const [batchSize, setBatchSize] = useState(15);
  const [batchPauseSeconds, setBatchPauseSeconds] = useState(180);

  // Spintax Preview Test
  const [spintaxPreview, setSpintaxPreview] = useState('');

  // Handle Mode Change
  const handleModeChange = (mode: 'safe' | 'balanced' | 'custom') => {
    setSafetyMode(mode);
    if (mode === 'safe') {
      setDelayMin(15);
      setDelayMax(30);
      setSimulateTyping(true);
      setBatchSize(15);
      setBatchPauseSeconds(180);
    } else if (mode === 'balanced') {
      setDelayMin(6);
      setDelayMax(15);
      setSimulateTyping(true);
      setBatchSize(25);
      setBatchPauseSeconds(120);
    }
  };

  // Helper to extract a clean valid phone number
  const extractValidPhone = (val: unknown): string | null => {
    if (!val) return null;
    let str = String(val).trim();
    if (!str) return null;

    // Handle Excel scientific notation: e.g. 9.18221E+11, 9842408741E+09
    if (/^[0-9]+(\.[0-9]+)?[eE]\+[0-9]+$/i.test(str)) {
      try {
        const num = Number(str);
        if (!isNaN(num) && isFinite(num) && num > 1e9) {
          str = BigInt(Math.round(num)).toString();
        }
      } catch {
        // ignore
      }
    }

    // Strip non-digits
    let digits = str.replace(/[^0-9]/g, '');
    if (!digits) return null;

    // 1. Singapore 8-digit mobile/landline (starts with 8, 9, 6) -> 65XXXXXXXX
    if (digits.length === 8 && /^[689]/.test(digits)) {
      return '65' + digits;
    }
    // 2. Already Singapore number with 65 country code (e.g. 6581234567, 6591234567) -> keep 65XXXXXXXX
    if (digits.length === 10 && digits.startsWith('65')) {
      return digits;
    }
    // 3. Indian 10-digit mobile (starts with 6, 7, 8, 9) -> convert to 91XXXXXXXXXX
    if (digits.length === 10 && /^[6-9]/.test(digits)) {
      return '91' + digits;
    }
    // 4. 11 digits starting with 0 (e.g. 09842487411) -> convert to 91XXXXXXXXXX
    if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits.slice(1))) {
      return '91' + digits.slice(1);
    }
    // 5. Standard international numbers (8 to 15 digits)
    if (digits.length >= 8 && digits.length <= 15) {
      return digits;
    }

    return null;
  };

  // Helper to parse pasted numbers
  const parsePastedNumbers = (): BroadcastRecipient[] => {
    if (!pastedText.trim()) return [];
    const lines = pastedText.split(/[\r\n,;]+/);
    const result: BroadcastRecipient[] = [];
    const seen = new Set<string>();

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      let name = 'Friend';
      let phoneStr = line;

      // Check if format is "Name: Phone" or "Name - Phone" or "Name Phone"
      if (line.includes(':') || line.includes('-') || line.includes('\t')) {
        const parts = line.split(/[:\-\t]+/);
        if (parts.length >= 2) {
          name = parts[0].trim().replace(/['"]/g, '') || 'Friend';
          phoneStr = parts[1].trim();
        }
      }

      const validPhone = extractValidPhone(phoneStr);
      if (validPhone && !seen.has(validPhone)) {
        seen.add(validPhone);
        result.push({ phone: validPhone, name });
      }
    }
    return result;
  };

  // Robust CSV parser supporting quotes, commas, newlines, tabs, semicolons
  const parseCsvContent = (text: string): { rows: string[][]; delimiter: string } => {
    const sample = text.slice(0, 5000);
    const commaCount = (sample.match(/,/g) || []).length;
    const semiCount = (sample.match(/;/g) || []).length;
    const tabCount = (sample.match(/\t/g) || []).length;
    const pipeCount = (sample.match(/\|/g) || []).length;

    let delimiter = ',';
    if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';
    else if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';
    else if (pipeCount > commaCount && pipeCount > semiCount) delimiter = '|';

    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (insideQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            currentField += '"';
            i++; // skip escaped quote
          } else {
            insideQuotes = false;
          }
        } else {
          currentField += char;
        }
      } else {
        if (char === '"') {
          insideQuotes = true;
        } else if (char === delimiter) {
          currentRow.push(currentField.trim());
          currentField = '';
        } else if (char === '\r') {
          if (nextChar === '\n') i++;
          currentRow.push(currentField.trim());
          if (currentRow.some((c) => c.length > 0)) rows.push(currentRow);
          currentRow = [];
          currentField = '';
        } else if (char === '\n') {
          currentRow.push(currentField.trim());
          if (currentRow.some((c) => c.length > 0)) rows.push(currentRow);
          currentRow = [];
          currentField = '';
        } else {
          currentField += char;
        }
      }
    }

    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some((c) => c.length > 0)) rows.push(currentRow);
    }

    return { rows, delimiter };
  };

  // Handle CSV file upload
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const { rows } = parseCsvContent(content);
      if (rows.length === 0) {
        addToast('warning', 'CSV file appears to be empty.');
        return;
      }

      // Check if Row 0 has actual phone numbers (meaning NO header row exists)
      const firstRow = rows[0] || [];
      const firstRowHasPhone = firstRow.some((col) => extractValidPhone(col) !== null);

      let headerRow: string[] = [];
      let dataRows: string[][] = [];

      if (firstRowHasPhone) {
        dataRows = rows;
      } else {
        headerRow = firstRow.map((h) => h.toLowerCase().trim().replace(/['"]/g, ''));
        dataRows = rows.slice(1);
      }

      // 1. Identify candidate header columns
      let headerPhoneCol = -1;
      let headerNameCol = -1;

      if (headerRow.length > 0) {
        headerPhoneCol = headerRow.findIndex(
          (h) =>
            (h.includes('phone') || h.includes('mobile') || h.includes('whatsapp') || h.includes('contact')) &&
            !h.includes('type') &&
            !h.includes('label') &&
            !h.includes('status') &&
            !h.includes('id') &&
            !h.includes('sr')
        );

        if (headerPhoneCol === -1) {
          headerPhoneCol = headerRow.findIndex(
            (h) => h.includes('phone') || h.includes('mobile') || h.includes('number') || h.includes('contact')
          );
        }

        headerNameCol = headerRow.findIndex(
          (h) => (h.includes('name') || h.includes('candidate') || h.includes('customer') || h.includes('client')) && !h.includes('file')
        );
      }

      // 2. Data-driven scoring: check up to first 100 rows to see which column contains the most valid phones
      const colPhoneCounts: Record<number, number> = {};
      const sampleSize = Math.min(100, dataRows.length);

      for (let r = 0; r < sampleSize; r++) {
        const row = dataRows[r];
        for (let c = 0; c < row.length; c++) {
          if (extractValidPhone(row[c])) {
            colPhoneCounts[c] = (colPhoneCounts[c] || 0) + 1;
          }
        }
      }

      let dataPhoneCol = -1;
      let maxPhoneCount = 0;
      for (const [colStr, count] of Object.entries(colPhoneCounts)) {
        const colIdx = Number(colStr);
        if (count > maxPhoneCount) {
          maxPhoneCount = count;
          dataPhoneCol = colIdx;
        }
      }

      // Select best column
      const bestPhoneCol = dataPhoneCol !== -1 ? dataPhoneCol : (headerPhoneCol !== -1 ? headerPhoneCol : 0);
      const bestNameCol = headerNameCol !== -1 ? headerNameCol : (bestPhoneCol === 0 ? 1 : 0);

      const parsed: BroadcastRecipient[] = [];
      const seen = new Set<string>();
      let skippedDuplicates = 0;

      for (const row of dataRows) {
        if (!row || row.length === 0 || row.every((c) => !c.trim())) continue;

        // 1. Try bestPhoneCol
        let detectedPhone = extractValidPhone(row[bestPhoneCol]);

        // 2. If bestPhoneCol is empty or invalid, scan ALL other columns in this row
        if (!detectedPhone) {
          for (let c = 0; c < row.length; c++) {
            if (c === bestPhoneCol) continue;
            const maybePhone = extractValidPhone(row[c]);
            if (maybePhone) {
              detectedPhone = maybePhone;
              break;
            }
          }
        }

        // 3. Check for multiple numbers in a single cell (e.g. "9842400000 / 8220874118")
        if (!detectedPhone) {
          for (let c = 0; c < row.length; c++) {
            const parts = (row[c] || '').split(/[\/,;|\s]+/);
            for (const p of parts) {
              const maybe = extractValidPhone(p);
              if (maybe) {
                detectedPhone = maybe;
                break;
              }
            }
            if (detectedPhone) break;
          }
        }

        if (!detectedPhone) continue;

        // Deduplication
        if (seen.has(detectedPhone)) {
          skippedDuplicates++;
          continue;
        }
        seen.add(detectedPhone);

        // Extract Name
        let name = 'Friend';
        if (bestNameCol >= 0 && row[bestNameCol] && row[bestNameCol].trim()) {
          const rawName = row[bestNameCol].trim().replace(/['"]/g, '');
          if (!/^[0-9+() -]+$/.test(rawName) && !rawName.includes('@')) {
            name = rawName;
          }
        } else {
          // Fallback: look for a text cell that looks like a name
          for (let c = 0; c < row.length; c++) {
            if (c === bestPhoneCol) continue;
            const val = row[c]?.trim().replace(/['"]/g, '');
            if (val && val.length >= 2 && val.length <= 40 && !/^[0-9+() -]+$/.test(val) && !val.includes('@') && !val.includes('http')) {
              name = val;
              break;
            }
          }
        }

        parsed.push({ phone: detectedPhone, name });
      }

      const detectedColLabel = headerRow[bestPhoneCol] ? `Column: "${headerRow[bestPhoneCol]}"` : `Column #${bestPhoneCol + 1}`;
      setCsvRecipients(parsed);
      setCsvStats({
        totalRows: dataRows.length,
        duplicates: skippedDuplicates,
        detectedColumn: detectedColLabel,
      });

      if (parsed.length > 0) {
        addToast('success', `Found ${parsed.length} recipients ready for broadcast!`);
      } else {
        addToast('warning', `No valid phone numbers found in ${dataRows.length} rows.`);
      }
    };
    reader.readAsText(file);
  };

  // Compute final recipients to send
  const getSelectedRecipients = (): BroadcastRecipient[] => {
    if (recipientTab === 'paste') return parsePastedNumbers();
    if (recipientTab === 'csv') return csvRecipients;
    if (recipientTab === 'crm') {
      return contacts
        .filter((c) => selectedContactIds.includes(c.id))
        .map((c) => ({
          phone: c.phone,
          name: c.name,
        }));
    }
    return [];
  };

  const finalRecipients = getSelectedRecipients();

  // Test Spintax Variation
  const generatePreview = () => {
    let text = templateText;
    text = text.replace(/\{\{\s*name\s*\}\}|\{name\}/gi, 'Ramesh');
    text = text.replace(/\{\{\s*phone\s*\}\}|\{phone\}/gi, '+91 98424 12345');
    text = text.replace(/\{\{\s*company\s*\}\}|\{company\}|\{\{\s*business\s*\}\}|\{business\}/gi, 'Nam Nilam Realty');

    // Resolve spintax
    text = text.replace(/\{([^{}]+)\|([^{}]+)\}/g, (match) => {
      const inner = match.slice(1, -1);
      const parts = inner.split('|');
      return parts[Math.floor(Math.random() * parts.length)].trim();
    });

    setSpintaxPreview(text);
  };

  // Launch Broadcast
  const handleLaunchBroadcast = async () => {
    if (!templateText.trim()) {
      addToast('warning', 'Please provide a message template.');
      return;
    }

    if (finalRecipients.length === 0) {
      addToast('warning', 'Please add at least 1 valid recipient phone number.');
      return;
    }


    const ok = await startRealBroadcast({
      name: campaignName.trim() || `Nam Nilam Campaign ${new Date().toLocaleDateString()}`,
      template: templateText.trim(),
      recipients: finalRecipients,
      delaySecondsMin: delayMin,
      delaySecondsMax: delayMax,
      simulateTyping,
      batchSize,
      batchPauseSeconds,
    });

    if (ok) {
      setShowModal(false);
      setCampaignName('');
      setPastedText('');
      setCsvRecipients([]);
      setSelectedContactIds([]);
    }
  };

  return (
    <>
      <SEOHead
        title="Safe WhatsApp Broadcast Bot | Nam Nilam"
        description="Send separate, anti-ban WhatsApp messages individually to client lists with humanized typing simulation and jitter pacing."
        canonicalUrl="https://wa.namnilam.com/app/broadcasts"
      />

      <div className="h-full flex flex-col bg-[#F8FAFC] p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto w-full space-y-6">

          {/* Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
                  <Radio className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    Separate Broadcast Bot
                    <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Anti-Ban Engine Active
                    </span>
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Dispatches personalized WhatsApp messages individually with humanized random pacing, typing simulation & spintax.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/app/inbox"
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold shadow-2xs transition active:scale-95"
                title="View incoming messages & replies"
              >
                <MessageSquare className="w-4 h-4 text-slate-500" />
                <span className="hidden sm:inline">Live WhatsApp Inbox</span>
              </Link>

              <Link
                to="/app/connect"
                className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold shadow-2xs transition active:scale-95"
                title="WhatsApp Device Connection"
              >
                <Smartphone className="w-4 h-4 text-slate-500" />
                <span className="hidden sm:inline">Device</span>
              </Link>

              <button
                onClick={() => {
                  setShowModal(true);
                  generatePreview();
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/25 transition active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Launch Safe Broadcast</span>
              </button>
            </div>
          </div>

          {/* ACTIVE RUNNING CAMPAIGN MONITOR */}
          {activeBroadcast && (activeBroadcast.status === 'running' || activeBroadcast.status === 'paused') && (
            <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white rounded-3xl p-6 shadow-xl border border-slate-800 space-y-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    {activeBroadcast.status === 'running' ? (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </>
                    ) : (
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                    )}
                  </span>
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                      {activeBroadcast.name}
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          activeBroadcast.status === 'running'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {activeBroadcast.status}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Anti-ban delay: {activeBroadcast.delaySecondsMin}s–{activeBroadcast.delaySecondsMax}s jitter · Typing simulation:{' '}
                      {activeBroadcast.simulateTyping ? 'ON' : 'OFF'}
                    </p>
                  </div>
                </div>

                {/* Campaign Controls */}
                <div className="flex items-center gap-2">
                  {activeBroadcast.status === 'running' ? (
                    <button
                      onClick={() => pauseBroadcast(activeBroadcast.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-semibold transition"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause Campaign</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => resumeBroadcast(activeBroadcast.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold transition"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Resume Campaign</span>
                    </button>
                  )}

                  <button
                    onClick={() => cancelBroadcast(activeBroadcast.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-semibold transition"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Stop / Cancel</span>
                  </button>
                </div>
              </div>

              {/* Progress Bar & Key Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-800/60 rounded-2xl p-3.5 border border-slate-700/50">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sent / Total</span>
                  <div className="text-xl font-extrabold text-white mt-1">
                    {activeBroadcast.sentCount} <span className="text-xs text-slate-400 font-medium">/ {activeBroadcast.totalCount}</span>
                  </div>
                </div>

                <div className="bg-slate-800/60 rounded-2xl p-3.5 border border-slate-700/50">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Failed</span>
                  <div className="text-xl font-extrabold text-rose-400 mt-1">
                    {activeBroadcast.failedCount}
                  </div>
                </div>

                <div className="bg-slate-800/60 rounded-2xl p-3.5 border border-slate-700/50">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Current Contact</span>
                  <div className="text-xs font-bold text-sky-300 truncate mt-1.5">
                    {activeBroadcast.currentRecipient ? (
                      `${activeBroadcast.currentRecipient.name || 'Friend'} (+${activeBroadcast.currentRecipient.phone})`
                    ) : (
                      'Preparing...'
                    )}
                  </div>
                </div>

                <div className="bg-slate-800/60 rounded-2xl p-3.5 border border-slate-700/50">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pacing Status</span>
                  <div className="text-xs font-bold text-emerald-400 mt-1.5 flex items-center gap-1.5">
                    {activeBroadcast.isBatchPaused ? (
                      <span className="text-amber-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 animate-spin" />
                        Batch rest: {activeBroadcast.batchPauseRemaining}s
                      </span>
                    ) : activeBroadcast.nextCountdown && activeBroadcast.nextCountdown > 0 ? (
                      <span className="text-sky-300 flex items-center gap-1">
                        <Clock className="w-3 h-3 animate-pulse" />
                        Next in {activeBroadcast.nextCountdown}s
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-emerald-400" />
                        Transmitting...
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress bar line */}
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                  <span>Delivery Completion</span>
                  <span className="font-bold text-sky-400">
                    {Math.round(((activeBroadcast.sentCount + activeBroadcast.failedCount) / (activeBroadcast.totalCount || 1)) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-sky-500 to-emerald-400 h-full transition-all duration-500 rounded-full"
                    style={{
                      width: `${Math.round(
                        ((activeBroadcast.sentCount + activeBroadcast.failedCount) / (activeBroadcast.totalCount || 1)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Real-time Dispatch Console */}
              <div className="bg-slate-950/80 rounded-2xl p-3 border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1 max-h-44 overflow-y-auto">
                <div className="flex items-center gap-1.5 text-slate-500 text-[10px] pb-1 border-b border-slate-800/80">
                  <Terminal className="w-3 h-3 text-sky-400" />
                  <span>LIVE WHATSAPP DISPATCH CONSOLE</span>
                </div>
                {activeBroadcast.logs.slice(0, 20).map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2 py-0.5">
                    <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                    {log.type === 'success' && <span className="text-emerald-400 font-semibold">✔ {log.message}</span>}
                    {log.type === 'error' && <span className="text-rose-400 font-semibold">✖ {log.message}</span>}
                    {log.type === 'warning' && <span className="text-amber-300 font-semibold">⚠ {log.message}</span>}
                    {log.type === 'system' && <span className="text-sky-400">{log.message}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Anti-Ban Safety Explainer Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-2">
              <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center text-sky-700">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-900">Randomized Jitter Delays</h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Prevents bot pattern detection by spacing each message 15 to 30 seconds apart, mimicking genuine human typing speed.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-2">
              <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-900">Spintax & Dynamic Variations</h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Alternate greetings and sentences like <code className="bg-slate-100 text-purple-700 px-1 py-0.5 rounded text-[10px]">&#123;Hello|Vanakkam&#125;</code> so every message has a unique hash.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-900">Batch Cooldown & Typing</h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Automatically shows the real <span className="italic">"typing..."</span> presence status and pauses for 3 minutes after every 15 messages to safeguard your WhatsApp number.
              </p>
            </div>
          </div>

          {/* Broadcasts History List */}
          <div className="bg-white rounded-3xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Broadcast Campaigns History</h3>
                <p className="text-xs text-slate-500">Track delivery rates and previous campaign performances.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-5">Campaign</th>
                    <th className="py-3.5 px-4">Recipients</th>
                    <th className="py-3.5 px-4">Delivered</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-5">Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {broadcasts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No previous broadcast campaigns found. Click "Launch Safe Broadcast" to start your first run.
                      </td>
                    </tr>
                  ) : (
                    broadcasts.map((bc) => (
                      <tr key={bc.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-4 px-5">
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                            <Radio className="w-3.5 h-3.5 text-sky-600" />
                            <span>{bc.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 truncate block max-w-xs">{bc.templateName}</span>
                        </td>

                        <td className="py-4 px-4 font-bold text-slate-800">{bc.recipientCount}</td>

                        <td className="py-4 px-4 text-emerald-700 font-bold">
                          {bc.deliveredCount} ({Math.round((bc.deliveredCount / (bc.recipientCount || 1)) * 100)}%)
                        </td>

                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                              bc.status === 'Sent' || bc.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : bc.status === 'running'
                                ? 'bg-sky-100 text-sky-800 animate-pulse'
                                : bc.status === 'paused'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            <CheckCircle2 className="w-3 h-3 text-current" />
                            {bc.status}
                          </span>
                        </td>

                        <td className="py-4 px-5 text-slate-400">
                          {bc.createdAt.includes('T')
                            ? new Date(bc.createdAt).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : bc.createdAt}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {/* LAUNCH BROADCAST MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-5 my-8 max-h-[90vh] overflow-y-auto">

            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600">
                  <ShieldCheck className="w-5 h-5 text-sky-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">New Anti-Ban WhatsApp Broadcast</h2>
                  <p className="text-xs text-slate-500">Configure separate delivery pacing and safe recipients</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                ✕
              </button>
            </div>

            {/* Campaign Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Campaign Name</label>
              <input
                type="text"
                placeholder="e.g. Dubai Jobs & Tourist Visa Alert"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition"
              />
            </div>

            {/* Message Template & Spintax Composer */}
            <div>
              {templates.length > 0 && (
                <div className="mb-2.5">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Load Saved Template (Optional)</label>
                  <select
                    onChange={(e) => {
                      const tmpl = templates.find((t) => t.id === e.target.value);
                      if (tmpl) {
                        setTemplateText(tmpl.content);
                        setSpintaxPreview('');
                      }
                    }}
                    defaultValue=""
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700"
                  >
                    <option value="" disabled>-- Pick from existing Nam Nilam templates --</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.category})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Message Content (with Variables & Spintax)</label>
                <button
                  type="button"
                  onClick={generatePreview}
                  className="text-[11px] font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Test Random Variation
                </button>
              </div>

              {/* Template quick pills */}
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                <span className="text-[10px] text-slate-400 font-medium">Insert:</span>
                <button
                  type="button"
                  onClick={() => setTemplateText((prev) => prev + ' {{name}}')}
                  className="px-2 py-0.5 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded text-[10px] font-semibold transition"
                >
                  &#123;&#123;name&#125;&#125;
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateText((prev) => prev + ' {{phone}}')}
                  className="px-2 py-0.5 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded text-[10px] font-semibold transition"
                >
                  &#123;&#123;phone&#125;&#125;
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateText((prev) => prev + ' {Hello|Vanakkam|Hi}')}
                  className="px-2 py-0.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded text-[10px] font-semibold transition"
                >
                  &#123;Hello|Vanakkam|Hi&#125;
                </button>
              </div>

              <textarea
                rows={4}
                value={templateText}
                onChange={(e) => {
                  setTemplateText(e.target.value);
                  setSpintaxPreview('');
                }}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition leading-relaxed font-sans"
              />

              {/* Spintax Test Preview Card */}
              {spintaxPreview && (
                <div className="mt-2 p-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs text-emerald-950">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    <span>Sample Individual Variation:</span>
                  </div>
                  <p className="italic text-slate-700 whitespace-pre-wrap">{spintaxPreview}</p>
                </div>
              )}
            </div>

            {/* Recipient Source Tabs */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">Select Recipients List</label>
              
              <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-semibold text-slate-600">
                <button
                  type="button"
                  onClick={() => setRecipientTab('paste')}
                  className={`flex-1 py-1.5 rounded-lg transition ${
                    recipientTab === 'paste' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                  }`}
                >
                  Direct Paste Box
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientTab('csv')}
                  className={`flex-1 py-1.5 rounded-lg transition ${
                    recipientTab === 'csv' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                  }`}
                >
                  Upload CSV / Excel
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientTab('crm')}
                  className={`flex-1 py-1.5 rounded-lg transition ${
                    recipientTab === 'crm' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                  }`}
                >
                  CRM Contacts ({contacts.length})
                </button>
              </div>

              {/* Tab 1: Paste Textarea */}
              {recipientTab === 'paste' && (
                <div className="space-y-2">
                  <textarea
                    rows={4}
                    placeholder={'Paste numbers or "Name, Number" (one per line):\n9842412345\nRamesh: 9787600221\n+91 94433 11223'}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition"
                  />
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Separators supported: New line, comma, or colon</span>
                    <span className="font-bold text-sky-700">
                      Parsed: {parsePastedNumbers().length} valid phone numbers
                    </span>
                  </div>
                </div>
              )}

              {/* Tab 2: CSV Upload */}
              {recipientTab === 'csv' && (
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-sky-400 transition bg-slate-50">
                  <FileSpreadsheet className="w-8 h-8 text-sky-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-800">
                    {csvFileName ? `Loaded: ${csvFileName}` : 'Choose or drop a CSV file'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Should contain columns for Phone / Mobile and optional Name
                  </p>

                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleCsvUpload}
                    className="hidden"
                    id={fileInputId}
                  />
                  <label
                    htmlFor={fileInputId}
                    className="inline-flex items-center gap-1.5 mt-3 px-4 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer shadow-2xs transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Select CSV</span>
                  </label>

                  {csvRecipients.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs font-bold text-emerald-600">
                        ✔ {csvRecipients.length} recipients ready for delivery
                      </div>
                      {csvStats && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Detected {csvStats.totalRows} rows using {csvStats.detectedColumn}
                          {csvStats.duplicates > 0 ? ` (${csvStats.duplicates} duplicates removed)` : ''}
                        </div>
                      )}
                      <div className="mt-2.5 text-left bg-white rounded-xl border border-slate-200 p-2.5 max-h-36 overflow-y-auto">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                          <span>Preview (First {Math.min(4, csvRecipients.length)})</span>
                          <span className="text-sky-600 font-semibold">{csvStats?.detectedColumn}</span>
                        </div>
                        <div className="space-y-1">
                          {csvRecipients.slice(0, 4).map((r, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-50 border border-slate-100">
                              <span className="font-semibold text-slate-800 truncate max-w-[130px]">{r.name}</span>
                              <span className="font-mono text-emerald-700 font-bold">+{r.phone}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: CRM Contacts */}
              {recipientTab === 'crm' && (
                <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50 max-h-48 overflow-y-auto space-y-1.5">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 px-1">
                    <span className="text-xs font-bold text-slate-700">
                      Selected: {selectedContactIds.length} / {contacts.length}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedContactIds(
                          selectedContactIds.length === contacts.length ? [] : contacts.map((c) => c.id)
                        )
                      }
                      className="text-[11px] text-sky-600 hover:text-sky-700 font-bold"
                    >
                      {selectedContactIds.length === contacts.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  {contacts.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-white hover:bg-slate-100/70 border border-slate-100 cursor-pointer text-xs transition"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedContactIds.includes(c.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedContactIds((prev) => [...prev, c.id]);
                            } else {
                              setSelectedContactIds((prev) => prev.filter((id) => id !== c.id));
                            }
                          }}
                          className="rounded text-sky-600 focus:ring-sky-500"
                        />
                        <span className="font-semibold text-slate-900">{c.name}</span>
                      </div>
                      <span className="text-slate-400 font-mono text-[11px]">{c.phone}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Anti-Ban Safeguards Panel */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Anti-Ban Delivery Safeguards
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Recommended Mode
                </span>
              </div>

              {/* Mode Pills */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleModeChange('safe')}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    safetyMode === 'safe'
                      ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 font-bold ring-1 ring-emerald-500'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="text-xs font-bold text-emerald-700">Safe Humanized</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">15–30s delay + cooldown</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleModeChange('balanced')}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    safetyMode === 'balanced'
                      ? 'border-sky-500 bg-sky-50/70 text-sky-950 font-bold ring-1 ring-sky-500'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="text-xs font-bold text-sky-700">Balanced</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">6–15s delay</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleModeChange('custom')}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    safetyMode === 'custom'
                      ? 'border-purple-500 bg-purple-50/70 text-purple-950 font-bold ring-1 ring-purple-500'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="text-xs font-bold text-purple-700">Custom Timing</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Configure values</div>
                </button>
              </div>

              {/* Advanced Timing Inputs (if custom) */}
              {safetyMode === 'custom' && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600">Min Delay (sec)</label>
                    <input
                      type="number"
                      min={2}
                      value={delayMin}
                      onChange={(e) => setDelayMin(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600">Max Delay (sec)</label>
                    <input
                      type="number"
                      min={delayMin}
                      value={delayMax}
                      onChange={(e) => setDelayMax(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Toggles */}
              <div className="space-y-2 pt-1 border-t border-slate-200/80">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simulateTyping}
                    onChange={(e) => setSimulateTyping(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>Simulate real WhatsApp "typing..." presence before each message</span>
                </label>

                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Batch Rest Cooldown: Pause 3 mins after every {batchSize} messages</span>
                  <input
                    type="number"
                    min={5}
                    max={50}
                    value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    className="w-16 px-2 py-1 bg-white border border-slate-200 rounded text-center text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-600">
                Total Queue: <span className="text-sky-700 font-extrabold">{finalRecipients.length} recipients</span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleLaunchBroadcast}
                  disabled={finalRecipients.length === 0}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/25 transition active:scale-95"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start Safe Broadcast ({finalRecipients.length})</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
