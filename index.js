const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const config = require("./config");

// ===== LOAD COMMANDS FILE =====
let commands = {};
const commandsPath = path.join(__dirname, "commands");
const commandsFile = path.join(__dirname, "commands.js");

if (fs.existsSync(commandsFile)) {
    // If you have single commands.js file
    commands = require(commandsFile);
    console.log("✅ Loaded commands.js file");
} else if (fs.existsSync(commandsPath)) {
    // If you have commands folder with many files
    fs.readdirSync(commandsPath).forEach(file => {
        if (file.endsWith(".js")) {
            try {
                const cmd = require(path.join(commandsPath, file));
                const name = cmd.name || file.replace(".js", "");
                commands[name] = cmd;
                console.log(`✅ Loaded command: ${name}`);
            } catch (e) {
                console.log(`❌ Failed command ${file}:`, e.message);
            }
        }
    });
} else {
    console.log("⚠️ No commands file/folder found - bot will still connect");
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(config.SESSION_ID);

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        browser: ["DA LICCO ⚡", "Chrome", "1.0.0"]
    });

    // Pairing Code
    if (!state.creds.registered) {
        setTimeout(async () => {
            try {
                const phoneNumber = config.OWNER_NUMBER;
                if (phoneNumber) {
                    const code = await sock.requestPairingCode(phoneNumber);
                    console.log(`\n======================================`);
                    console.log(`🔑 DA LICCO PAIRING CODE: ${code}`);
                    console.log(`======================================\n`);
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
            console.log("✅ DA LICCO ⚡ Connected!");
            console.log(`✅ Loaded ${Object.keys(commands).length} commands`);
        }
    });

    // ===== RUN COMMANDS FROM YOUR COMMANDS FILE =====
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const from = m.key.remoteJid;
        const body = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || "";
        const prefix = config.PREFIX || ".";

        if (!body.startsWith(prefix)) return;

        const args = body.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        // Find command in your commands file
        const cmd = commands[commandName];

        if (!cmd) return; // Not a command, ignore

        try {
            // Supports both styles: module.exports = async (sock, m, args) OR { run: async() }
            if (typeof cmd === "function") {
                await cmd(sock, m, args, config);
            } else if (typeof cmd.run === "function") {
                await cmd.run(sock, m, args, config);
            } else if (typeof cmd.execute === "function") {
                await cmd.execute(sock, m, args, config);
            }
        } catch (e) {
            console.log(`Command ${commandName} error:`, e.message);
            await sock.sendMessage(from, { text: `❌ Error in ${commandName}: ${e.message}` });
        }
    });
}

startBot();
