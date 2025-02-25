const express = require("express");
const cors = require("cors");
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");
const { uid } = require("uid");
const fs = require("fs");
const jsondb = require("simple-json-db");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const db = new jsondb("./logs.json");
const wwebVersion = process.env.WWEB_VERSION;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Function untuk membuat log
const createLogs = (phone, status) => {
  const msgID = uid();
  const timestamp = Date.now();
  const date = new Date(timestamp);
  const formatter = new Intl.DateTimeFormat("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
    timeZone: "Asia/Makassar",
  });

  try {
    db.set(msgID, { date: formatter.format(date), phone, status });
    console.log(`(${msgID}) logs created`);
  } catch (error) {
    console.error(error);
  }
};

// Format nomor telepon
const phoneNumberFormatter = (number) => {
  let formatted = number.replace(/\D/g, "");
  if (formatted.startsWith("0")) {
    formatted = "62" + formatted.substr(1);
  }
  return formatted.endsWith("@c.us") ? formatted : formatted + "@c.us";
};

// Membaca file JSON
const readJsonFileSync = (filepath, encoding = "utf8") => {
  const file = fs.readFileSync(filepath, encoding);
  return JSON.parse(file);
};

// Mengambil konfigurasi dari file
const getConfig = (file) => readJsonFileSync(`${__dirname}/${file}`);

// Inisialisasi client WhatsApp
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: "/usr/bin/chromium-browser",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu",
    ],
  },
  webVersionCache: {
    type: "remote",
    remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${wwebVersion}.html`,
  },
});

// Event handler untuk client WhatsApp
client.on("qr", (qr) => qrcode.generate(qr, { small: true }));
client.on("authenticated", () => console.log("Authenticated!"));
client.on("auth_failure", (msg) => console.error("Auth Failure!", msg));
client.on("ready", () => console.log("WhatsApp Ready!"));

client.initialize();

// Routing
app.get("/", (req, res) => res.send("WhatsApp Gateway"));

app.post("/send-message", async (req, res) => {
  const number = phoneNumberFormatter(req.body.phone);
  const message = req.body.message;

  try {
    const response = await client.sendMessage(number, message);
    res.status(200).json(response);
    createLogs(number, "success");
  } catch (err) {
    res.status(500).json(err);
    createLogs(number, "failed");
  }
});

app.get("/logs", (req, res) => res.json(getConfig("logs.json")));

// Menjalankan server
app.listen(port, () => console.log(`Server running on port ${port}`));
