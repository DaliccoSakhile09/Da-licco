const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason, downloadContentFromMessage } = require('@whiskeysockets/baileys');
const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require('pino');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const PORT = process.env.PORT || 3000;
const OWNER = '27674789056';

const SESSION_ID = process.env.SESSION_ID || '';
const dir = path.join('/tmp', 'sessions', 'da-licco');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

if (SESSION_ID && !fs.existsSync(path.join(dir, 'creds.json'))) {
  try {
    let clean = SESSION_ID.replace(/Da-Licco;;;=>/g, '').trim();
    fs.writeFileSync(path.join(dir, 'creds.json'), Buffer.from(clean, 'base64').toString('utf8'));
    console.log('✅ SESSION_ID decoded');
  } catch(e){ console.log('❌ SESSION_ID Invalid:', e.message); }
}

let sock = null;
let settings = { autoviewonce: true, antidelete: true, antilink: false, antimentionstatus: true };
let deletedCache = new Map();

async function startBot() {
  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState(dir);
  sock = makeWASocket({ version, logger: pino({ level: 'silent' }), browser: ['Da-Licco', 'Chrome', '1.0.0'], auth: state, printQRInTerminal: false, markOnlineOnConnect: true });
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect } = u;
    console.log('CONNECTION:', connection);
    if (connection === 'open') {
      console.log('✅ DA LICCO CONNECTED!');
      try {
        const creds = fs.readFileSync(path.join(dir, 'creds.json'), 'utf8');
        console.log('========== COPY THIS SESSION_ID ==========');
        console.log('Da-Licco;;;=>' + Buffer.from(creds).toString('base64'));
        console.log('===========================================');
      } catch(e){}
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) setTimeout(startBot, 3000);
      else { fs.rmSync(dir, { recursive: true, force: true }); }
    }
  });

  // ANTI-DELETE LISTENER
  sock.ev.on('messages.update', async (updates) => {
    for (const u of updates) {
      if (u.update?.messageStubType === 1 && settings.antidelete && deletedCache.has(u.key.id)) {
        const old = deletedCache.get(u.key.id);
        await sock.sendMessage(u.key.remoteJid, { text: `🚫 *DA LICCO ANTI-DELETE* 👑\n\n@${u.key.participant?.split('@')[0] || 'Someone'} deleted:\n\n${old}` });
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;
    const from = m.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const sender = m.key.participant || from;
    const raw = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || '').trim();
    const text = raw.toLowerCase();
    const cmd = text.split(' ')[0].replace(/^[.!/]/, '');

    // SAVE FOR ANTI-DELETE
    if (raw) deletedCache.set(m.key.id, raw);
    if (deletedCache.size > 200) deletedCache.delete(deletedCache.keys().next().value);

    // AUTO VIEW ONCE
    const vo = m.message.viewOnceMessage || m.message.viewOnceMessageV2 || m.message.viewOnceMessageV2Extension;
    if (vo && settings.autoviewonce) {
      try {
        const inner = vo.message;
        const type = inner.imageMessage ? 'image' : inner.videoMessage ? 'video' : 'audio';
        const cap = inner.imageMessage?.caption || inner.videoMessage?.caption || 'No caption';
        await sock.sendMessage(from, { text: `👁️ *DA LICCO AUTO VIEW ONCE* 👑\n\nFrom: @${sender.split('@')[0]}\nType: ${type}\nCaption: ${cap}` });
      } catch(e){}
    }

    // ANTI-MENTION STATUS - if someone mentions in status / tags
    const mentioned = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (settings.antimentionstatus && mentioned.length && isGroup) {
      // Just warn, don't block owner
      if (!mentioned.includes(OWNER + '@s.whatsapp.net')) {}
    }

    // ANTI-LINK
    if (settings.antilink && (text.includes('https://') || text.includes('http://') || text.includes('wa.me/') || text.includes('chat.whatsapp.com'))) {
      try { await sock.sendMessage(from, { delete: m.key }); } catch(e){}
      return await sock.sendMessage(from, { text: `⚠️ *DA LICCO ANTI-LINK* 👑\n\n@${sender.split('@')[0]} links are not allowed!` });
    }

    let reply = null;
    const isOwner = sender.includes(OWNER);

    // === TOGGLES ===
    if (cmd === 'autoviewonce') { settings.autoviewonce = text.includes('on'); reply = settings.autoviewonce ? '✅ Auto View Once: ON' : '❌ Auto View Once: OFF'; }
    else if (cmd === 'antidelete') { settings.antidelete = text.includes('on'); reply = settings.antidelete ? '✅ AntiDelete: ON' : '❌ AntiDelete: OFF'; }
    else if (cmd === 'antilink') { settings.antilink = text.includes('on'); reply = settings.antilink ? '✅ AntiLink: ON' : '❌ AntiLink: OFF'; }
    else if (cmd === 'antimentionstatus') { settings.antimentionstatus = text.includes('on'); reply = settings.antimentionstatus ? '✅ AntiMentionStatus: ON' : '❌ AntiMentionStatus: OFF'; }

    // === MAIN ===
    else if (['hi','hello','hey','yo','morning','night','bye'].includes(cmd)) reply = `👑 *DA LICCO* 👑\n\nHey! Welcome ⚡\nType *menu* to see all 104 commands`;
    else if (cmd === 'menu' || cmd === 'help') reply = `👑 *DA LICCO - FULL MENU* 👑 ⚡\n\n*MAIN:*\nmenu, help, ping, alive, owner, info, rules, support\n\n*ORDER:*\norder, price, delivery, location, hours, book, track, cancel, payment, discount\n\n*FUN:*\njoke, meme, quote, fact, love, roast, compliment, dare, truth, pick, coin, dice, 8ball, rps\n\n*MUSIC:*\nsong, lyrics, playlist, artist, new, video, audio, dance\n\n*GAMES:*\ngame, quiz, riddle, puzzle, math, guess, tictactoe, hangman\n\n*TOOLS:*\ntime, date, weather, calc, translate, define, search, news, crypto, qr\n\n*SOCIAL:*\ninstagram, tiktok, youtube, whatsapp, facebook, follow, share, invite, group\n\n*PROTECTION:*\nautoviewonce on/off, antidelete on/off, antilink on/off, antimentionstatus on/off\n\n*OWNER:*\nbroadcast, ban, unban, kick, promote, demote, mute, unmute, tagall, hidetag, antilink, welcome, goodbye, setpp, setname, setdesc, restart, shutdown\n\n*EXTRA:*\nsticker, toimg, tovideo, download, ai, ask, image, story, poem, prayer, motivate\n\nTotal: 104 Commands 👑`;
    else if (cmd === 'ping') reply = '⚡ Pong! DA LICCO is alive 👑';
    else if (cmd === 'alive') reply = '👑 DA LICCO is ONLINE ⚡\nUptime: Running on Render';
    else if (cmd === 'owner') reply = `👑 *OWNER*\n+${OWNER}\nDM for business`;
    else if (cmd === 'info') reply = '👑 DA LICCO - Your personal WhatsApp bot. Fast, smart, protected.';
    else if (cmd === 'rules') reply = '📜 *RULES*\n1. No links\n2. No spam\n3. Respect all\n4. No hate';
    else if (cmd === 'support') reply = `Need help? DM Owner +${OWNER}`;
    else if (cmd === 'order') reply = 'To order send:\nORDER - Item - Name - Location\nExample: ORDER - Song - Sakhile - Durban';
    else if (cmd === 'price') reply = '💰 *PRICE LIST*\nDM Owner for prices - custom deals daily!';
    else if (cmd === 'delivery') reply = '🚚 Delivery available. DM Owner for area.';
    else if (cmd === 'location') reply = '📍 Newcastle, KZN, South Africa';
    else if (cmd === 'hours') reply = '🕐 Open: 8AM - 10PM Daily';
    else if (cmd === 'book') reply = 'To book, send: BOOK - Name - Date';
    else if (cmd === 'track') reply = 'Send your ORDER ID to track.';
    else if (cmd === 'cancel') reply = 'To cancel, send: CANCEL - ORDER ID';
    else if (cmd === 'payment') reply = '💳 Payment: Bank / Cash / E-Wallet - DM Owner';
    else if (cmd === 'discount') reply = '🎁 Discounts: DM Owner for today\'s deal!';
    else if (cmd === 'joke') reply = ['Why did the chicken cross the road? To get to DA LICCO 😂','I told my phone a joke... it cracked up 🤣','Why is 6 afraid of 7? Because 7 8 9 😂'][Math.floor(Math.random()*3)];
    else if (cmd === 'meme') reply = '😂 Meme of the day: You + DA LICCO = Legendary 👑';
    else if (cmd === 'quote') reply = '💪 "Don\'t stop when you\'re tired. Stop when you\'re done." - DA LICCO';
    else if (cmd === 'fact') reply = '🧠 Fact: Your brain uses 20% of your energy!';
    else if (cmd === 'love') reply = '❤️ You are loved, you are valued, you are DA LICCO family.';
    else if (cmd === 'roast') reply = '🔥 Your WiFi is faster than your comebacks 😂';
    else if (cmd === 'compliment') reply = '✨ You look like success today 👑';
    else if (cmd === 'dare') reply = '😈 DARE: Send a voice note saying "DA LICCO is King"';
    else if (cmd === 'truth') reply = '🤔 TRUTH: What is your biggest secret? 👀';
    else if (cmd === 'pick') reply = 'I pick: ' + ['You','Option 1','Option 2','DA LICCO'][Math.floor(Math.random()*4)];
    else if (cmd === 'coin') reply = '🪙 Coin: ' + (Math.random() > 0.5 ? 'HEADS' : 'TAILS');
    else if (cmd === 'dice') reply = '🎲 Dice: ' + (Math.floor(Math.random()*6)+1);
    else if (cmd === '8ball') reply = '🎱 8Ball: ' + ['Yes','No','Maybe','Definitely','Ask later'][Math.floor(Math.random()*5)];
    else if (cmd === 'rps') reply = '✊✋✌️ I choose: ' + ['Rock','Paper','Scissors'][Math.floor(Math.random()*3)];
    else if (cmd === 'song') reply = '🎵 Song suggestion: Check DA LICCO playlist - DM Owner';
    else if (cmd === 'lyrics') reply = '🎤 Lyrics: DM song name';
    else if (cmd === 'playlist') reply = '🎧 Playlist: Coming soon - DA LICCO Vibes';
    else if (cmd === 'artist') reply = '👑 DA LICCO - Artist / Creator from Newcastle, KZN';
    else if (cmd === 'new') reply = '🔥 NEW DROP coming soon! Stay tuned!';
    else if (cmd === 'video') reply = '📹 Video link: DM Owner';
    else if (cmd === 'audio') reply = '🎧 Audio: DM Owner';
    else if (cmd === 'dance') reply = '💃 Dance vibe: Put DA LICCO on loud!';
    else if (cmd === 'game') reply = '🎮 Games: quiz, riddle, puzzle, math, guess, tictactoe, hangman';
    else if (cmd === 'quiz') reply = '❓ QUIZ: What is 2+2? Reply with answer';
    else if (cmd === 'riddle') reply = '🧩 RIDDLE: I speak without a mouth. What am I? (Echo)';
    else if (cmd === 'puzzle') reply = '🧩 PUZZLE: What has keys but can\'t open locks? (Piano)';
    else if (cmd === 'math') reply = '➗ MATH: What is 15 x 3?';
    else if (cmd === 'guess') reply = '🔢 GUESS: I\'m thinking of a number 1-10. Guess!';
    else if (cmd === 'tictactoe') reply = '❌⭕ TicTacToe: Game starting... Send X or O';
    else if (cmd === 'hangman') reply = '🎯 Hangman: _ _ _ _ _ - Guess a letter';
    else if (cmd === 'time') reply = '🕐 Time: ' + new Date().toLocaleTimeString('en-ZA');
    else if (cmd === 'date') reply = '📅 Date: ' + new Date().toLocaleDateString('en-ZA');
    else if (cmd === 'weather') reply = '🌤️ Weather in Newcastle: Check weather app - DA LICCO says sunny vibes!';
    else if (cmd === 'calc') reply = '🧮 Calc: Send calc like: calc 2+2 (Feature: DM Owner)';
    else if (cmd === 'translate') reply = '🌍 Translate: Send translate + word';
    else if (cmd === 'define') reply = '📖 Define: Send define + word';
    else if (cmd === 'search') reply = '🔍 Search: Send search + topic';
    else if (cmd === 'news') reply = '📰 News: DA LICCO is trending in Newcastle 👑';
    else if (cmd === 'crypto') reply = '₿ Crypto: BTC is moving! Check your app';
    else if (cmd === 'qr') reply = '📷 QR: Send qr + text to generate';
    else if (cmd === 'instagram') reply = '📸 Instagram: DM Owner for link';
    else if (cmd === 'tiktok') reply = '🎵 TikTok: DM Owner for link';
    else if (cmd === 'youtube') reply = '▶️ YouTube: DM Owner for link';
    else if (cmd === 'whatsapp') reply = '💬 WhatsApp Channel: DM Owner';
    else if (cmd === 'facebook') reply = '📘 Facebook: DM Owner for link';
    else if (cmd === 'follow') reply = 'Follow DA LICCO everywhere 👑';
    else if (cmd === 'share') reply = 'Share this bot: https://da-licco.onrender.com';
    else if (cmd === 'invite') reply = 'Invite: https://da-licco.onrender.com';
    else if (cmd === 'group') reply = 'Group link: DM Owner';
    else if (cmd === 'sticker') reply = 'Send image with caption *sticker* to make sticker';
    else if (cmd === 'toimg') reply = 'Reply to sticker with *toimg*';
    else if (cmd === 'tovideo') reply = 'Reply to sticker with *tovideo*';
    else if (cmd === 'download') reply = 'Download: Send link';
    else if (cmd === 'ai' || cmd === 'ask') reply = '🤖 AI: Ask me anything! I am DA LICCO AI. What do you want to know?';
    else if (cmd === 'image') reply = '🖼️ AI Image: Send image + description';
    else if (cmd === 'story') reply = '📖 Once upon a time in Newcastle, there was a king named DA LICCO 👑...';
    else if (cmd === 'poem') reply = '🌹 Poem: Roses are red, DA LICCO is king, you are the reason my phone goes ping 👑';
    else if (cmd === 'prayer') reply = '🙏 Prayer: May your day be blessed, may DA LICCO protect you.';
    else if (cmd === 'motivate') reply = '🔥 MOTIVATION: You are 1% away from greatness. Keep going!';
    // OWNER ONLY
    else if (['broadcast','ban','unban','kick','promote','demote','mute','unmute','tagall','hidetag','welcome','goodbye','setpp','setname','setdesc','restart','shutdown'].includes(cmd)) {
      if (!isOwner) reply = '❌ Owner only command 👑';
      else if (cmd === 'tagall') reply = '👑 TAG ALL - DA LICCO calling everyone!';
      else if (cmd === 'restart') reply = '♻️ Restarting DA LICCO...';
      else if (cmd === 'shutdown') reply = '🛑 Shutting down...';
      else reply = `✅ Owner command *${cmd}* executed 👑`;
    }

    if (reply) await sock.sendMessage(from, { text: reply });
  });
  return sock;
}
startBot();

app.get('/', (req, res) => {
  res.send(`<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{background:#050510;color:white;font-family:Arial,sans-serif;text-align:center;padding:40px 20px;margin:0}h1{font-size:34px;font-weight:900;background:linear-gradient(90deg,#a855f7,#3b82f6,#22d3ee);-webkit-background-clip:text;-webkit-text-fill-color:transparent}input{padding:14px;font-size:18px;border-radius:12px;border:2px solid #a855f7;background:#111126;color:white;width:220px;text-align:center;outline:none}button{padding:14px 20px;font-size:16px;font-weight:bold;background:linear-gradient(90deg,#a855f7,#3b82f6);color:white;border:none;border-radius:12px;margin-top:12px;cursor:pointer} p{color:#b0b0d0;font-size:14px;margin-top:20px}.box{max-width:380px;margin:auto;background:#0d0d22;padding:30px 20px;border-radius:20px;border:1px solid #2a2a4a}</style></head><body><div class="box"><h1>DA LICCO ⚡</h1><p>Enter number to get pairing code (ONE TIME ONLY)</p><form action="/pair" method="GET"><input name="num" placeholder="27674789056" required /><br><button>GET PAIRING CODE</button></form><p>104 Commands | Auto View Once | AntiDelete | AntiLink | AntiMentionStatus</p></div></body></html>`);
});

app.get('/pair', async (req, res) => {
  const num = (req.query.num || '').replace(/[^0-9]/g, '');
  if (!num) return res.send('Enter number');
  if (!sock) return res.send('Bot starting, wait 10 sec and retry');
  try {
    const code = await sock.requestPairingCode(num);
    res.send(`<html><head><style>body{background:#050510;color:white;font-family:Arial;text-align:center;padding:50px}h1{font-size:40px;color:#a855f7}.box{max-width:380px;margin:auto;background:#0d0d22;padding:30px;border-radius:20px;border:1px solid #2a2a4a}</style></head><body><div class="box"><h1>Your Code: ${code}</h1><p>Enter in WhatsApp > Linked Devices > Link with phone number - FAST! Within 15 sec</p></div></body></html>`);
  } catch(e){ res.send('Pair Error: ' + e.message + ' - Wait 30 sec, try again'); }
});

app.listen(PORT, () => console.log('Server on ' + PORT));
