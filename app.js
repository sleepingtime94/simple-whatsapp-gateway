const express = require("express");
const cors = require("cors");
const QRCode = require("qrcode");
const { Client, LocalAuth } = require("whatsapp-web.js");
const http = require("http");
const { Server } = require("socket.io");
const dotenv = require("dotenv");
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Inisialisasi server HTTP dan Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Izinkan semua domain untuk mengakses Socket.IO
    methods: ["GET", "POST"],
  },
});

// Variabel global untuk QR Code dan status koneksi
let qrCode = null;

// Format nomor telepon
const phoneNumberFormatter = (number) => {
  let formatted = number.replace(/\D/g, "");
  if (formatted.startsWith("0")) {
    formatted = "62" + formatted.substr(1);
  }
  return formatted.endsWith("@c.us") ? formatted : formatted + "@c.us";
};

// Inisialisasi client WhatsApp
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    // executablePath: "/usr/bin/chromium-browser",
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
    remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${process.env.WWEB_VERSION}.html`,
  },
});

// Event handler untuk client WhatsApp
let connectionStatus = "disconnected"; // Variabel global untuk status koneksi

client.on("qr", (qr) => {
  qrCode = qr;
  console.log("QR Code generated, scan it to continue.");
  io.emit("connection-status", { status: "waiting-for-scan" }); // Kirim status menunggu scan
});

client.on("authenticated", () => {
  connectionStatus = "authenticated";
  console.log("Authenticated!");
  io.emit("connection-status", { status: "authenticated" });
});

client.on("ready", () => {
  connectionStatus = "ready";
  console.log("WhatsApp Ready!");
  io.emit("connection-status", { status: "ready" });
});

client.on("auth_failure", () => {
  connectionStatus = "failed";
  console.error("Auth Failure!");
  io.emit("connection-status", { status: "failed" });
});

client.on("disconnected", () => {
  connectionStatus = "disconnected";
  console.log("Disconnected!");
  io.emit("connection-status", { status: "disconnected" });
});

client.initialize();

// Routing
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.get("/current-status", (req, res) => {
  res.status(200).json({ status: connectionStatus });
});

app.post("/send-message", async (req, res) => {
  const number = phoneNumberFormatter(req.body.phone);
  const message = req.body.message;
  try {
    const response = await client.sendMessage(number, message);
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json(err);
  }
});

// Menjalankan server
server.listen(port, () => console.log(`Server running on port ${port}`));
