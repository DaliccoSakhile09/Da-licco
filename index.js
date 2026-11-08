const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const config = require('./config');
const { saveMsg, getMsg } = require('./lib/database');
const { getSender, getText } = require('./lib/client');
const general = require('./plugins/general');
const downloadPlugin = require('./plugins/download');

const app = express();
const PORT = config.PORT;
const OWNER = config.OWNER;
const LOGO = config.LOGO;
let settings = config.settings;
let sock = null;

async function startBot() {
  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  sock = makeWASocket({ version, logger: pino({ level: 'silent' }), browser: ['Da-Licco', 'Chrome', '1.0.0'], auth: state, printQRInTerminal: false, markOnlineOnConnect: true });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (u) => {
    console.log('CONNECTION:', u.connection);
    if (u.connection === 'open') console.log('✅ DA LICCO CONNECTED!');
    if (u.connection === 'close') {
      const code = u.lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) setTimeout(startBot, 3000);
    }
  });
  sock.ev.on('messages.update', async (updates) => {
    for (const u of updates) {
      if (u.update?.messageStubType === 1 && settings.antidelete && getMsg(u.key.id)) {
        await sock.sendMessage(u.key.remoteJid, { text: `🚫 *DA LICCO ANTI-DELETE* 👑\n\n@${u.key.participant?.split('@')[0] || 'Someone'} deleted:\n\n${getMsg(u.key.id)}` });
      }
    }
  });
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;
    const from = m.key.remoteJid;
    const sender = getSender(m);
    const raw = getText(m);
    const text = raw.toLowerCase();
    const cmd = text.split(' ')[0].replace(/^[.!/]/, '');
    saveMsg(m.key.id, raw);
    const vo = m.message.viewOnceMessage || m.message.viewOnceMessageV2 || m.message.viewOnceMessageV2Extension;
    if (vo && settings.autoviewonce) {
      try {
        const inner = vo.message;
        const type = inner.imageMessage ? 'image' : inner.videoMessage ? 'video' : 'audio';
        const cap = inner.imageMessage?.caption || inner.videoMessage?.caption || 'No caption';
        await sock.sendMessage(from, { text: `👁️ *DA LICCO AUTO VIEW ONCE* 👑\n\nFrom: @${sender.split('@')[0]}\nType: ${type}\nCaption: ${cap}` });
      } catch(e){}
    }
    if (settings.antilink && (text.includes('https://') || text.includes('http://') || text.includes('wa.me/') || text.includes('chat.whatsapp.com'))) {
      try { await sock.sendMessage(from, { delete: m.key }); } catch(e){}
      return await sock.sendMessage(from, { text: `⚠️ *DA LICCO ANTI-LINK* 👑\n\n@${sender.split('@')[0]} links are not allowed!` });
    }
    const isOwner = sender.includes(OWNER);
    let reply = null;
    if (cmd === 'autoviewonce') { settings.autoviewonce = text.includes('on'); reply = settings.autoviewonce ? '✅ Auto View Once: ON' : '❌ Auto View Once: OFF'; }
    else if (cmd === 'antidelete') { settings.antidelete = text.includes('on'); reply = settings.antidelete ? '✅ AntiDelete: ON' : '❌ AntiDelete: OFF'; }
    else if (cmd === 'antilink') { settings.antilink = text.includes('on'); reply = settings.antilink ? '✅ AntiLink: ON' : '❌ AntiLink: OFF'; }
    else if (cmd === 'antimentionstatus') { settings.antimentionstatus = text.includes('on'); reply = settings.antimentionstatus ? '✅ AntiMentionStatus: ON' : '❌ AntiMentionStatus: OFF'; }
    else {
      reply = await general(cmd, text, sender, isOwner);
      if (!reply) reply = await downloadPlugin(cmd, text);
    }
    if (reply) await sock.sendMessage(from, { text: reply });
  });
}
startBot();
app.get('/', (req, res) => {
  res.send(`<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{background:#050510;color:white;font-family:Arial;text-align:center;padding:20px;margin:0}h1{font-size:34px;font-weight:900;background:linear-gradient(90deg,#a855f7,#3b82f6,#22d3ee);-webkit-background-clip:text;-webkit-text-fill-color:transparent}input{padding:14px;font-size:18px;border-radius:12px;border:2px solid #a855f7;background:#111126;color:white;width:220px;text-align:center}button{padding:14px 20px;font-size:16px;font-weight:bold;background:linear-gradient(90deg,#a855f7,#3b82f6);color:white;border:none;border-radius:12px;margin-top:12px}p{color:#b0b0d0}.box{max-width:380px;margin:auto;background:#0d0d22;padding:25px 20px;border-radius:20px;border:1px solid #2a2a4a}.logo{width:100%;max-width:340px;border-radius:18px;border:2px solid #a855f7}</style></head><body><div class="box"><img class="logo" src="${LOGO}"><h1>DA LICCO ⚡</h1><p>Enter number to get pairing code</p><form action="/pair" method="GET"><input name="num" placeholder="27674789056" required /><br><button>GET PAIRING CODE</button></form><p>104 Commands | Auto View Once | AntiDelete | AntiLink | AntiMentionStatus</p></div></body></html>`);
});
app.get('/pair', async (req, res) => {
  const num = (req.query.num || '').replace(/[^0-9]/g, '');
  if (!num) return res.send('Enter number');
  if (!sock) return res.send('Bot starting, wait 10 sec and retry');
  try {
    const code = await sock.requestPairingCode(num);
    res.send(`<html><head><style>body{background:#050510;color:white;font-family:Arial;text-align:center;padding:50px}h1{font-size:40px;color:#a855f7}.box{max-width:380px;margin:auto;background:#0d0d22;padding:30px;border-radius:20px}.logo{width:100%;max-width:340px;border-radius:18px}</style></head><body><div class="box"><img class="logo" src="${LOGO}"><h1>Your Code: ${code}</h1><p>Enter in WhatsApp > Linked Devices > Link with phone number - FAST!</p></div></body></html>`);
  } catch(e){ res.send('Pair Error: ' + e.message); }
});
app.listen(PORT, () => console.log('Server on ' + PORT));
