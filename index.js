const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;
const bots = {}; // number -> { sock, pairCode, isConnected }

async function startBotForNumber(PHONE) {
    if (bots[PHONE]) return bots[PHONE];
    bots[PHONE] = { pairCode: "Loading...", isConnected: false };

    const { state, saveCreds } = await useMultiFileAuthState(`./session-${PHONE}`);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ['Da Licco', 'Chrome', '1.0'],
        syncFullHistory: false,
        markOnlineOnConnect: false,
    });
    bots[PHONE].sock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        console.log(`[${PHONE}] CONNECTION:`, connection);
        if (connection === 'open') {
            bots[PHONE].isConnected = true;
            bots[PHONE].pairCode = "CONNECTED ✅";
            console.log(`✅ [${PHONE}] DA LICCO CONNECTED!`);
        }
        if (connection === 'close') {
            bots[PHONE].isConnected = false;
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                setTimeout(() => { delete bots[PHONE]; startBotForNumber(PHONE); }, 3000);
            } else {
                try { fs.rmSync(`./session-${PHONE}`, { recursive: true, force: true }); } catch(e){}
                delete bots[PHONE];
            }
        }
    });

    // Get pairing code if not registered
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(PHONE);
                bots[PHONE].pairCode = code;
                console.log(`PAIR CODE FOR ${PHONE} : ${code}`);
            } catch (err) {
                console.log(`[${PHONE}] PAIR ERR`, err.message);
                bots[PHONE].pairCode = "Error - Refresh";
            }
        }, 4000);
    }

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        const from = m.key.remoteJid;
        const text = m.message.conversation || m.message.extendedTextMessage?.text || "";
        if (text.toLowerCase() === '.menu' || text.toLowerCase() === '.ping') {
            await sock.sendMessage(from, { text: "👑 *DA LICCO IS ONLINE* 👑\n\nBot by Da Licco\nYour number: " + PHONE });
        }
    });

    return bots[PHONE];
}

// Website - user types their number
app.get('/', (req, res) => {
    res.send(`
    <html><body style="background:#111;color:white;text-align:center;font-family:sans-serif;padding:20px">
    <h1>👑 DA LICCO 👑</h1>
    <p>Link Da Licco to YOUR number</p>
    <form action="/pair" method="GET">
    <input name="number" placeholder="e.g. 27674789056" style="padding:15px;font-size:18px;width:250px;text-align:center" required />
    <br><br>
    <button style="padding:15px 30px;font-size:18px;background:#25D366;border:none;border-radius:10px">GET MY CODE</button>
    </form>
    <p style="color:#888">Enter number without + , no spaces. Example: 27674789056</p>
    </body></html>`);
});

app.get('/pair', async (req, res) => {
    let number = (req.query.number || "").replace(/[^0-9]/g, "");
    if (!number) return res.redirect('/');
    await startBotForNumber(number);
    // Wait a bit for code to generate
    setTimeout(() => {
        const b = bots[number];
        res.send(`
        <html><body style="background:#111;color:white;text-align:center;font-family:sans-serif;padding-top:40px">
        <h1>👑 DA LICCO 👑</h1>
        <p>Number: ${number}</p>
        <h2 style="font-size:45px;letter-spacing:5px;color:#25D366">${b?.pairCode || "Loading..."}</h2>
        <p>${b?.isConnected ? "✅ CONNECTED" : "Go to WhatsApp > Linked Devices > Link with phone number > Type this code FAST"}</p>
        <button onclick="location.reload()" style="padding:15px 30px;font-size:18px">REFRESH CODE</button>
        <br><br><a href="/" style="color:#25D366">Link another number</a>
        </body></html>`);
    }, 6000);
});

app.listen(PORT, () => console.log("Web on", PORT));
