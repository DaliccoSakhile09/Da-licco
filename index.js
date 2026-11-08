const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require("@whiskeysockets/baileys");
const pino = require("pino");
const config = require("./config");

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(config.SESSION_ID);

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        browser: ["DA LICCO ⚡", "Chrome", "1.0.0"]
    });

    // FIXED: Use state.creds, not sock.authState
    if (!state.creds.registered) {
        setTimeout(async () => {
            try {
                let phoneNumber = config.OWNER_NUMBER;
                if (phoneNumber) {
                    let code = await sock.requestPairingCode(phoneNumber);
                    console.log(`\n======================================`);
                    console.log(`🔑 DA LICCO PAIRING CODE: ${code}`);
                    console.log(`======================================\n`);
                } else {
                    console.log("❌ Please configure OWNER_NUMBER");
                }
            } catch (e) {
                console.log("Pairing error:", e.message);
            }
        }, 3000);
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`Connection closed. Reconnect? ${shouldReconnect}`);
            if (shouldReconnect) {
                await delay(5000);
                startBot();
            } else {
                console.log("❌ Logged out. Delete session and pair again.");
            }
        } else if (connection === "open") {
            console.log("✅ DA LICCO ⚡ Connected successfully!");
        }
    });

    // FIXED: Added message handler so commands work
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        const body = m.message.conversation || m.message.extendedTextMessage?.text || "";
        console.log(`📩 Message from ${m.key.remoteJid}: ${body}`);
        // Your plugins / commands go here
        if (body === ".ping") {
            await sock.sendMessage(m.key.remoteJid, { text: "🏓 DA LICCO ⚡ Pong! Bot is Online!" });
        }
    });
}
startBot();
