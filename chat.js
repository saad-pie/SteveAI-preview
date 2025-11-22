// chat.js
// IMPORTANT: This file relies on 'marked.js' being loaded in your HTML for markdown parsing.

// --- Module Imports ---
import config from './config.js'; 
import { generateImage, IMAGE_MODELS } from './image.js'; 

// --- Config Variables from Import ---
const API_BASE = config.API_BASE;
const PROXY = config.PROXY;
const proxiedURL = config.proxiedURL;
const API_KEYS = config.API_KEYS; // Used in fetchAI

// --- DOM Elements ---
const chat = document.getElementById('chat');
const form = document.getElementById('inputForm');
const input = document.getElementById('messageInput');
const themeToggle = document.getElementById('themeToggle');
const clearChatBtn = document.getElementById('clearChat');
const modeSelect = document.getElementById('modeSelect');

// --- Memory / Summary ---
let memory = {};
let turn = 0;
let memorySummary = "";
const TYPE_DELAY = 2;
const TOKEN_BUDGET = 2200;
const approxTokens = s => Math.ceil((s || "").length / 4);

// --- Helpers ---
function memoryString() {
  return Object.keys(memory)
    .map(k => `User: ${memory[k].user}\nBot: ${memory[k].bot}`)
    .join('\n');
}

function lastTurns(n = 6) {
  const keys = Object.keys(memory).map(Number).sort((a,b)=>a-b);
  return keys.slice(-n).map(k => `User: ${memory[k].user}\nBot: ${memory[k].bot}`).join('\n');
}

function shouldSummarize() {
  if (memorySummary) return false;
  return turn >= 6 || approxTokens(memoryString()) > TOKEN_BUDGET;
}

// --- Summarization ---
async function generateSummary() {
  const raw = memoryString();
  const payload = {
    model: "provider-3/gpt-4o-mini",
    messages: [
      { role: "system", content: "You are SteveAI, made by saadpie. Summarize the following chat context clearly." },
      { role: "user", content: raw }
    ]
  };
  try {
    const data = await fetchAI(payload);
    return data?.choices?.[0]?.message?.content?.trim() || "";
  } catch {
    return "Summary: " + lastTurns(2).replace(/\n/g, " ").slice(0, 800);
  }
}

async function buildContext() {
  if (shouldSummarize()) {
    const sum = await generateSummary();
    if (sum) {
      memorySummary = sum;
      const keep = {};
      const keys = Object.keys(memory).map(Number).sort((a,b)=>a-b).slice(-4);
      keys.forEach(k => keep[k] = memory[k]);
      memory = keep;
    }
  }
  return memorySummary
    ? `[SESSION SUMMARY]\n${memorySummary}\n\n[RECENT TURNS]\n${lastTurns(6)}`
    : memoryString();
}

// --- Markdown Parser ---
function markdownToHTML(t) { return marked.parse(t || ""); }

// --- UI: Add Messages (Logic is unchanged, kept for completeness) ---
function addMessage(text, sender) {
  const container = document.createElement('div');
  container.className = 'message-container ' + sender;

  const bubble = document.createElement('div');
  bubble.className = 'bubble ' + sender;
  container.appendChild(bubble);

  const content = document.createElement('div');
  content.className = 'bubble-content';
  bubble.appendChild(content);

  if (sender === 'bot') {
    chat.appendChild(container);
    chat.scrollTop = chat.scrollHeight;

    let i = 0, buf = "";
    (function type() {
      if (i < text.length) {
        buf += text[i++];
        content.innerHTML = markdownToHTML(buf);
        chat.scrollTop = chat.scrollHeight;
        setTimeout(type, TYPE_DELAY);
      } else {
        content.innerHTML = markdownToHTML(text);
        addBotActions(container, bubble, text);
      }
    })();
  } else {
    content.innerHTML = markdownToHTML(text);
    chat.appendChild(container);
    chat.scrollTop = chat.scrollHeight;
    addUserActions(container, bubble, text);
  }
}

// ... (addUserActions and addBotActions remain unchanged)

function addUserActions(container, bubble, text) {
  const actions = document.createElement('div');
  actions.className = 'message-actions';

  const resend = document.createElement('button');
  resend.className = 'action-btn';
  resend.textContent = '🔁';
  resend.title = 'Resend';
  resend.onclick = () => { input.value = text; input.focus(); };

  const copy = document.createElement('button');
  copy.className = 'action-btn';
  copy.textContent = '📋';
  copy.title = 'Copy';
  copy.onclick = () => navigator.clipboard.writeText(text);

  actions.appendChild(resend);
  actions.appendChild(copy);
  container.appendChild(actions);
}

function addBotActions(container, bubble, text) {
  const actions = document.createElement('div');
  actions.className = 'message-actions';

  const copy = document.createElement('button');
  copy.className = 'action-btn';
  copy.textContent = '📋';
  copy.title = 'Copy';
  copy.onclick = () => navigator.clipboard.writeText(text);

  const speak = document.createElement('button');
  speak.className = 'action-btn';
  speak.textContent = '🔊';
  speak.title = 'Speak';
  speak.onclick = () => {
    let u = new SpeechSynthesisUtterance(text);
    speechSynthesis.speak(u);
  };

  actions.appendChild(copy);
  actions.appendChild(speak);
  container.appendChild(actions);
}

// --- Fetch AI (Chat) ---
async function fetchAI(payload) {
  const url = proxiedURL(API_BASE);
  let lastErrText = "";
  for (const key of API_KEYS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) return await res.json();
      lastErrText = await res.text();
    } catch (e) {
      console.warn("Proxy/network error", e);
    }
  }
  addMessage('⚠️ API unreachable. Check keys or proxy.', 'bot');
  throw new Error(lastErrText || "API error");
}

// --- Commands ---
// ... (The rest of the command functions remain largely unchanged)

function toggleTheme() {
  document.body.classList.toggle('light');
  addMessage('🌓 Theme toggled.', 'bot');
}
function clearChat() {
  chat.innerHTML = '';
  memory = {};
  memorySummary = '';
  turn = 0;
  addMessage('🧹 Chat cleared.', 'bot');
}
function exportChat() {
  const text = memorySummary
    ? `[SUMMARY]\n${memorySummary}\n\n[CHAT LOG]\n${memoryString()}`
    : `[CHAT LOG]\n${memoryString()}`;
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `SteveAI_Chat_${new Date().toISOString().slice(0,19)}.txt`;
  a.click();
  addMessage('💾 Chat exported as text file.', 'bot');
}
function showContact() {
  const info = `
**📬 Contact SteveAI**
- Creator: [@saadpie](https://github.com/saad-pie)
- Website: [steve-ai.netlify.app](https://steve-ai.netlify.app)
- Feedback: Use /export to send logs.
  `;
  addMessage(info, 'bot');
}
async function playSummary() {
  addMessage('🎬 Generating chat summary...', 'bot');
  if (!memorySummary) memorySummary = await generateSummary();
  addMessage(`🧠 **Chat Summary:**\n${memorySummary}`, 'bot');
}

// --- FIX: Updated model names in /about
function showAbout() {
  const text = `
🤖 **About SteveAI**
Built by *saadpie* — the bot from the future.

- Models: GPT-5-Nano, DeepSeek-R1-Distill, Gemini-2.5-Flash, ${IMAGE_MODELS.map(m => m.name).join(', ')}
- Modes: Chat | Reasoning | Fast
- Features: Context memory, Summarization, Commands, Theme toggle, Speech, Export

_Type /help to explore commands._
  `;
  addMessage(text, 'bot');
}

// --- FIX: Include 'general' mode in allowed options (unchanged but correct) ---
function changeMode(arg) {
  if (!arg || !['chat', 'reasoning', 'general'].includes(arg.toLowerCase())) {
    addMessage('⚙️ Usage: /mode chat | reasoning | general', 'bot');
    return;
  }
  if (modeSelect) modeSelect.value = arg.toLowerCase();
  addMessage(`🧭 Switched mode to **${arg}**.`, 'bot');
}
function showTime() {
  const now = new Date();
  addMessage(`⏰ Local time: ${now.toLocaleTimeString()}`, 'bot');
}
function showHelp() {
  const modelNames = IMAGE_MODELS.map(m => m.name).join(', ');
  const helpText = `
**🧭 Available Commands**

- /clear — Clears current chat
- /theme — Toggle dark/light mode
- /help — Show this help
- /image <prompt> [model] [n=1] — Generate image(s)
  - Models: ${modelNames}
  - Max Images: 4
- /export — Export chat as .txt
- /contact — Show contact info
- /play — Summarize / replay conversation
- /about — About SteveAI
- /mode <chat|reasoning|general> — Change mode
- /time — Show local time
  `;
  addMessage(helpText, 'bot');
}

// --- Command Router (Unchanged from previous version) ---
async function handleCommand(cmd) {
  const parts = cmd.trim().split(' ');
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (command) {
    case '/clear': return clearChat();
    case '/theme': return toggleTheme();
    case '/help': return showHelp();

    case '/image': {
      // 1. Parse arguments: /image <prompt> [model] [n=1]
      let prompt = args.join(' ');
      let numImages = 1;
      let model = IMAGE_MODELS[5].id; // Default to Imagen 4

      // Look for a number at the end (e.g., "dragon 3")
      const lastArg = args[args.length - 1];
      if (!isNaN(parseInt(lastArg, 10)) && parseInt(lastArg, 10) > 0) {
        numImages = Math.min(4, parseInt(lastArg, 10));
        prompt = args.slice(0, -1).join(' '); // Remove number from prompt
      }
      
      // Basic model detection (requires exact match, could be improved)
      const modelMatch = IMAGE_MODELS.find(m => prompt.toLowerCase().includes(m.id.split('/').pop().toLowerCase()));
      if (modelMatch) {
          model = modelMatch.id;
          // Simple removal of model name from prompt (for better results)
          prompt = prompt.replace(new RegExp(model.split('/').pop(), 'gi'), '').trim();
      }
      
      if (!prompt) {
        addMessage('⚠️ Usage: /image <prompt> [model name snippet] [n=1-4]', 'bot');
        return;
      }

      const modelName = IMAGE_MODELS.find(m => m.id === model)?.name || model.split('/').pop();
      addMessage(`🎨 Generating **${numImages}** image(s) with **${modelName}** for: *${prompt}* ...`, 'bot');

      try {
        const imageUrls = await generateImage(prompt, model, numImages);

        if (!imageUrls || imageUrls.length === 0) {
          addMessage('⚠️ No images were returned from the server.', 'bot');
          return;
        }

        const imageHTML = imageUrls.map((url, index) => {
            return `
<figure style="margin:5px 0;">
    <img src="${url}" alt="AI Image ${index + 1}" style="max-width:90%;border-radius:10px;margin-top:10px;display:block;margin-left:auto;margin-right:auto;" />
    <figcaption style="font-size:0.8em;text-align:center;">
        🔗 <a href="${url}" target="_blank">${modelName} Image ${index + 1}</a>
    </figcaption>
</figure>
            `;
        }).join('');

        const finalHTML = `
**🖼️ Generated Images:** "${prompt}"
${imageHTML}
        `;

        const container = document.createElement('div');
        container.className = 'message-container bot';

        const bubble = document.createElement('div');
        bubble.className = 'bubble bot';
        container.appendChild(bubble);

        const content = document.createElement('div');
        content.className = 'bubble-content';
        content.innerHTML = markdownToHTML(finalHTML);
        bubble.appendChild(content);

        chat.appendChild(container);
        chat.scrollTop = chat.scrollHeight;

        addBotActions(container, bubble, finalHTML);
      } catch (err) {
        addMessage(`⚠️ Image generation failed: ${err.message}`, 'bot');
      }
      return;
    }

    case '/export': return exportChat();
    case '/contact': return showContact();
    case '/play': return playSummary();
    case '/about': return showAbout();
    case '/mode': return changeMode(args[0]);
    case '/time': return showTime();
    default: return addMessage(`❓ Unknown command: ${command}`, 'bot');
  }
}

// --- Chat Flow ---
// --- FIX: Logic updated to map models and bot names exactly as per user's latest structure ---
async function getChatReply(msg) {
  const context = await buildContext();
  const mode = (modeSelect?.value || 'chat').toLowerCase();
  
  let model;
  let botName;

  switch (mode) {
    case 'reasoning':
      model = "provider-2/deepseek-r1-distill-qwen-1.5b";
      botName = "SteveAI-reasoning";
      break;
    case 'general': 
      model = "provider-2/gemini-2.5-flash"; 
      botName = "SteveAI-fast"; // Synchronized with HTML
      break;
    case 'chat':
    default:
      model = "provider-5/gpt-5-nano";
      botName = "SteveAI-chat";
      break;
  }

  const payload = {
    model,
    messages: [
      { role: "system", content: `You are ${botName}, made by saadpie.` },
      { role: "user", content: `${context}\n\nUser: ${msg}` }
    ]
  };
  const data = await fetchAI(payload);
  const reply = data?.choices?.[0]?.message?.content || "No response.";
  memory[++turn] = { user: msg, bot: reply };
  return reply;
}

// --- Form Submit (Unchanged) ---
form.onsubmit = async e => {
  e.preventDefault();
  const msg = input.value.trim();
  if (!msg) return;
  if (msg.startsWith('/')) {
    await handleCommand(msg);
    input.value = '';
    input.style.height = 'auto';
    return;
  }
  addMessage(msg, 'user');
  input.value = '';
  input.style.height = 'auto';
  try {
    const r = await getChatReply(msg);
    addMessage(r, 'bot');
  } catch {
    addMessage('⚠️ Request failed. Check console.', 'bot');
  }
};

// --- Input Auto Resize (Unchanged) ---
input.oninput = () => {
  input.style.height = 'auto';
  input.style.height = input.scrollHeight + 'px';
};

// --- Theme Toggle (Unchanged) ---
themeToggle.onclick = () => toggleTheme();

// --- Clear Chat (Unchanged) ---
clearChatBtn.onclick = () => clearChat();
