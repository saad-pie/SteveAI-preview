// --- API Config ---
const API_BASE = "https://api.a4f.co/v1/chat/completions";
const PROXY = "https://corsproxy.io/?url=";
const proxiedURL = (base) => PROXY + encodeURIComponent(base);

// Two API keys as fallback
const API_KEYS = [
  "ddc-a4f-d61cbe09b0f945ea93403a420dba8155",
  "ddc-a4f-93af1cce14774a6f831d244f4df3eb9e"
];

export default config;
