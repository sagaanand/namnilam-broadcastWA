export const SITE_URL = 'https://vyjoyconsultancy.com';
export const WHATSAPP_NUMBER = '+91 98424 00000';
export const WHATSAPP_RAW_NUMBER = '919842400000';
export const WHATSAPP_PREFILLED_TEXT = 'Hi VYJOY Consultancy, I want to know more about Overseas Jobs, Visas, and Tour Packages.';
export const WHATSAPP_CHAT_URL = `https://wa.me/${WHATSAPP_RAW_NUMBER}?text=${encodeURIComponent(WHATSAPP_PREFILLED_TEXT)}`;

export const SOCIAL_LINKS = [
  { name: 'Instagram', url: '#', isPlaceholder: true },
  { name: 'Facebook', url: '#', isPlaceholder: true },
  { name: 'LinkedIn', url: '#', isPlaceholder: true },
  { name: 'YouTube', url: '#', isPlaceholder: true },
  { name: 'X', url: '#', isPlaceholder: true },
];

export interface FAQItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'What is VYJOY WhatsApp AI?',
    answer:
      'VYJOY WhatsApp AI is an intelligent assistant that helps handle client inquiries 24/7 on WhatsApp. It automatically provides accurate details on overseas job openings, tourist/visit visa requirements, tour packages, passport services, and document attestation.',
  },
  {
    question: 'How does the WhatsApp AI bot work?',
    answer:
      'When a client messages your WhatsApp number, the AI reads their intent, matches it with VYJOY Consultancy verified guidelines, and responds promptly in English or Tamil/Tanglish. You remain in control and can take over the chat at any point.',
  },
  {
    question: 'Can the bot send separate broadcasts without getting blocked?',
    answer:
      'Yes! The platform includes a Safe Anti-Ban Broadcast Engine with randomized jitter delays (15–30s), typing simulation, spintax variations, and batch rest cooldowns to ensure full compliance with WhatsApp delivery patterns.',
  },
  {
    question: 'Can I use my existing WhatsApp business number?',
    answer:
      'Yes. You connect your existing WhatsApp account directly using standard WhatsApp QR device linking, without changing your phone number.',
  },
  {
    question: 'What services does the AI guide clients on?',
    answer:
      'The AI is trained on Overseas Job Recruitment (Gulf, Singapore, Malaysia, Europe), Tourist & Visit Visas (Dubai, Singapore, Schengen, etc.), International Tour Packages, and MEA / Embassy Certificate Attestation.',
  },
  {
    question: 'Can clients apply or submit documents on WhatsApp?',
    answer:
      'Yes. Clients can share their CVs, passport copies, and queries directly on WhatsApp, and the AI guides them on next steps while logging the lead for your counseling team.',
  },
  {
    question: 'Can a human counselor take over any conversation?',
    answer:
      'Yes. You retain 100% control. Counselors can view live incoming messages in the Inbox and type replies directly from the dashboard or their linked phone whenever personal attention is required.',
  },
  {
    question: 'Is the bot available 24/7?',
    answer:
      'Yes. The AI operates continuously around the clock, greeting late-night inquiries and overseas applicants instantly.',
  },
];

export interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  h1: string;
}

export const PAGES_METADATA: Record<string, PageMeta> = {
  '/': {
    title: 'VYJOY Consultancy | WhatsApp AI & Automation Platform',
    description:
      'Automate your client conversations, overseas job inquiries, visa consultations, and anti-ban WhatsApp broadcasts with VYJOY Consultancy AI.',
    canonical: `${SITE_URL}/`,
    h1: 'AI-Powered WhatsApp Automation for VYJOY Consultancy',
  },
  '/whatsapp-ai': {
    title: 'What Is WhatsApp AI? | VYJOY Consultancy',
    description:
      'Learn how WhatsApp AI automates client consultations for overseas recruitment, visa processing, and tourism packages.',
    canonical: `${SITE_URL}/whatsapp-ai`,
    h1: 'What Is WhatsApp AI for Consultancies?',
  },
  '/whatsapp-ai-for-business': {
    title: 'WhatsApp AI for Global Mobility & Consultancies | VYJOY',
    description:
      'Discover how WhatsApp AI helps consultancies handle high enquiry volume, qualify candidates, and manage safe client broadcasts.',
    canonical: `${SITE_URL}/whatsapp-ai-for-business`,
    h1: 'WhatsApp AI for Global Mobility Consultancies',
  },
  '/how-it-works': {
    title: 'How It Works | VYJOY WhatsApp AI',
    description:
      'Explore how to link your WhatsApp, train the AI on visas and overseas vacancies, and run safe separate broadcasts.',
    canonical: `${SITE_URL}/how-it-works`,
    h1: 'How Does VYJOY WhatsApp AI Work?',
  },
  '/features': {
    title: 'Platform Features | VYJOY WhatsApp AI',
    description:
      'Explore 24/7 AI chat replies, candidate qualification, anti-ban broadcast bot, and live web inbox.',
    canonical: `${SITE_URL}/features`,
    h1: 'All-In-One WhatsApp Automation & Safe Broadcast Platform',
  },
  '/use-cases': {
    title: 'Use Cases | VYJOY WhatsApp AI',
    description:
      'Practical WhatsApp automation use cases for overseas recruitment, tourist visas, tour booking, and document attestation.',
    canonical: `${SITE_URL}/use-cases`,
    h1: 'What Can You Automate with VYJOY WhatsApp AI?',
  },
  '/whatsapp-ai-for-real-estate': {
    title: 'Visa & Tourism Services | VYJOY Consultancy',
    description:
      'Automate visa inquiries, tourist visa checklists, travel packages, and client follow-ups on WhatsApp.',
    canonical: `${SITE_URL}/whatsapp-ai-for-real-estate`,
    h1: 'WhatsApp Automation for Visas & International Tourism',
  },
  '/whatsapp-ai-for-small-business': {
    title: 'Overseas Recruitment Automation | VYJOY Consultancy',
    description:
      'Manage overseas job seekers, candidate CV collection, and interview announcements via WhatsApp.',
    canonical: `${SITE_URL}/whatsapp-ai-for-small-business`,
    h1: 'WhatsApp AI for Overseas Manpower & Recruitment',
  },
  '/whatsapp-ai-for-customer-support': {
    title: 'Client Support on WhatsApp | VYJOY Consultancy',
    description:
      'Provide instant, accurate client support for passport appointments, embassy attestation, and travel updates.',
    canonical: `${SITE_URL}/whatsapp-ai-for-customer-support`,
    h1: '24/7 Client Support on WhatsApp',
  },
  '/faq': {
    title: 'FAQ | VYJOY WhatsApp AI',
    description:
      'Frequently asked questions about linking WhatsApp, anti-ban broadcasts, and AI consultancy training.',
    canonical: `${SITE_URL}/faq`,
    h1: 'Frequently Asked Questions',
  },
  '/about': {
    title: 'About VYJOY International Tourism & Consultancy',
    description:
      'Premier consultancy in Trichy, Tamil Nadu specializing in overseas jobs, tourist visas, tour packages, and passport attestation.',
    canonical: `${SITE_URL}/about`,
    h1: 'VYJOY International Tourism & Consultancy',
  },
  '/contact': {
    title: 'Contact VYJOY Consultancy | Trichy, Tamil Nadu',
    description:
      'Get in touch with VYJOY Consultancy in Trichy or chat directly on WhatsApp for visa, recruitment, and tour package guidance.',
    canonical: `${SITE_URL}/contact`,
    h1: 'Contact VYJOY Consultancy',
  },
};
