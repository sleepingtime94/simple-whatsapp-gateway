const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const clients = {}; // Menyimpan semua akun WA

function createClient(sessionId) {
  if (clients[sessionId]) return clients[sessionId];

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: sessionId, // <--- INI KUNCI MULTI AKUN
    }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    },
  });

  client.on("qr", (qr) => {
    console.log(`\n📱 Scan QR untuk akun: ${sessionId}`);
    qrcode.generate(qr, { small: true });
  });

  client.on("ready", () => {
    console.log(`✅ WhatsApp ${sessionId} siap digunakan`);
  });

  client.on("auth_failure", () => {
    console.log(`❌ Auth gagal: ${sessionId}`);
  });

  client.initialize();
  clients[sessionId] = client;

  return client;
}

module.exports = { createClient, clients };
