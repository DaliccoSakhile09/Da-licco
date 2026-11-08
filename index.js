const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const app = express();
const PORT = process.env.PORT || 3000;
const OWNER = '27674789056';
const dir = '/tmp/da-licco-session';
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
let sock = null;
let pairCode = '';
let isConnected = false;
let startTime = Date.now();

async function startBot(){
  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState(dir);
  sock = makeWASocket({ version, logger: pino({level:'silent'}), browser:['Da-Licco','Chrome','1.0.0'], auth: state, printQRInTerminal:false });
  sock.ev.on('creds.update', saveCreds);
  if(!state.creds.registered){
    setTimeout(async ()=>{
      try{
        let code = await sock.requestPairingCode(OWNER);
        pairCode = code;
        console.log('PAIR CODE: '+code);
      }catch(e){ console.log('PAIR ERR', e.message); }
    }, 5000);
  }
  sock.ev.on('connection.update', async (u)=>{
    const { connection, lastDisconnect } = u;
    console.log('CONNECTION:', connection);
    if(connection==='open'){ isConnected=true; pairCode=''; try{ const creds=fs.readFileSync(path.join(dir,'creds.json'),'utf8'); console.log('Da-Licco;;;=>'+Buffer.from(creds).toString('base64')); }catch(e){} }
    if(connection==='close'){ isConnected=false; const code=lastDisconnect?.error?.output?.statusCode; if(code!==DisconnectReason.loggedOut) setTimeout(startBot,3000); }
  });
  sock.ev.on('messages.upsert', async ({messages}) => {
    try{
      const m = messages[0];
      if(!m.message) return;
      const from = m.key.remoteJid;
      const text = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || '';
      if(!text.startsWith('.')) return;
      const cmd = text.slice(1).split(' ')[0].toLowerCase().trim();
      const arg = text.slice(1).split(' ').slice(1).join(' ');
      if(cmd==='menu' || cmd==='help') return sock.sendMessage(from,{text:'DA LICCO - MENU\n\n.ping .alive .owner .info .time .date .joke .quote .advice .love .hug .kiss .waifu .neko .ai .gpt .play .song .tiktok .yt .tagall .kick .promote .sticker .qr .weather .vv .alwaysonline .uptime'});
      if(cmd==='ping') return sock.sendMessage(from,{text:'Pong! Da Licco is fast'});
      if(cmd==='alive') return sock.sendMessage(from,{text:'DA LICCO IS ALIVE 👑\nOwner: Sakhile'});
      if(cmd==='owner') return sock.sendMessage(from,{text:'Owner: Da Licco\n+27674789056'});
      if(cmd==='info') return sock.sendMessage(from,{text:'DA LICCO BOT\nOwner: Sakhile\nType .menu'});
      if(cmd==='time') return sock.sendMessage(from,{text:'Time: '+new Date().toLocaleTimeString('en-ZA',{timeZone:'Africa/Johannesburg'})});
      if(cmd==='date') return sock.sendMessage(from,{text:'Date: '+new Date().toLocaleDateString('en-ZA',{timeZone:'Africa/Johannesburg'})});
      if(cmd==='joke') return sock.sendMessage(from,{text:'Why did chicken cross road? To get to Da Licco'});
      if(cmd==='quote') return sock.sendMessage(from,{text:"Don't wait for opportunity. Create it."});
      if(cmd==='advice') return sock.sendMessage(from,{text:'Drink water, mind your business.'});
      if(cmd==='love') return sock.sendMessage(from,{text:'Love: You + Da Licco = 100%'});
      if(cmd==='hug') return sock.sendMessage(from,{text:'*hugs you*'});
      if(cmd==='kiss') return sock.sendMessage(from,{text:'*kiss*'});
      if(cmd==='waifu') return sock.sendMessage(from,{text:'Your Waifu: Da Licco-chan says hi!'});
      if(cmd==='neko') return sock.sendMessage(from,{text:'Neko! Meow~'});
      if(cmd==='ai' || cmd==='gpt') return sock.sendMessage(from,{text:'Da Licco AI: '+(arg||'Ask me anything!')});
      if(cmd==='play' || cmd==='song') return sock.sendMessage(from,{text:'Play: Type .play + song name'});
      if(cmd==='vv') return sock.sendMessage(from,{text:'VV ON. Reply to a View Once with .vv'});
      if(cmd==='alwaysonline') return sock.sendMessage(from,{text:'AlwaysOnline: ON'});
      if(cmd==='uptime') return sock.sendMessage(from,{text:'Uptime: '+Math.floor((Date.now()-startTime)/60000)+' mins'});
      if(cmd==='weather') return sock.sendMessage(from,{text:'Weather: Sunny 28C in Durban'});
      if(cmd==='qr') return sock.sendMessage(from,{text:'QR: '+arg});
    }catch(e){ console.log('MSG ERR', e.message); }
  });
}
app.get('/', (req,res)=>{
  if(isConnected) return res.send('<h1>DA LICCO IS CONNECTED 👑</h1><p>Send .ping on WhatsApp</p>');
  if(pairCode) return res.send('<h1>DA LICCO PAIR CODE</h1><h1 style="font-size:50px;">'+pairCode+'</h1><p>Number: 27674789056</p><p>WhatsApp > Linked devices > Link with phone number > Enter code</p>');
  return res.send('<h1>DA LICCO IS STARTING...</h1><p>Wait 10 sec then refresh</p>');
});
app.listen(PORT, ()=> console.log('Da Licco on '+PORT));
startBot().catch(()=>{});
