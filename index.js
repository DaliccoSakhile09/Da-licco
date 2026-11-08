const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require("@whiskeysockets/baileys");
const pino = require("pino");
const config = require("./config");

async function startBot() {
    // Force path alignment with your Render Persistent Disk Mount Point
    const { state, saveCreds } = await useMultiFileAuthState("/app/auth_info_baileys");

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false, // Turn off QR generation
        browser: ["Ubuntu", "Chrome", "20.0.04"] // Standard modern user agent
    });

    // Check if we need to request a Pairing Code (only runs if not logged in)
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            // Put your actual bot mobile number (with country code, no +, no spaces) in your config.js or Render Env variables
            let phoneNumber = config.OWNER_NUMBER; 
            if (phoneNumber) {
                let code = await sock.requestPairingCode(phoneNumber);
                console.log(`\n======================================`);
                console.log(`🔑 YOUR WHATSAPP BOT PAIRING CODE: ${code}`);
                console.log(`======================================\n`);
            } else {
                console.log("❌ Please configure OWNER_NUMBER to request a phone pairing code.");
            }
        }, 3000);
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(`Connection closed. Status Reason Code: ${reason}`);
            
            // Avoid tight crash-loops on unexpected server dropouts
            await delay(5000); 
            startBot();
        } else if (connection === "open") {
            console.log("✅ Bot connected successfully and linked to WhatsApp!");
        }
    });
}
startBot();
