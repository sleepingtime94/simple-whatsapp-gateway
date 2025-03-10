const express = require("express");
const cors = require("cors");
const QRCode = require("qrcode");
const { Client, LocalAuth } = require("whatsapp-web.js");
const http = require("http");
const { Server } = require("socket.io");
const dotenv = require("dotenv");
const fs = require("fs");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

let qrCode = null;
let connectionStatus = "disconnected";

const phoneNumberFormatter = (number) => {
  let formatted = number.replace(/\D/g, "");
  if (formatted.startsWith("0")) {
    formatted = "62" + formatted.substr(1);
  }
  return formatted.endsWith("@c.us") ? formatted : formatted + "@c.us";
};

const logMessageToFile = (logData) => {
  const logFilePath = "./logs.json";
  try {
    let logs = [];
    if (fs.existsSync(logFilePath)) {
      const fileContent = fs.readFileSync(logFilePath, "utf8");
      const parsedData = JSON.parse(fileContent);
      if (Array.isArray(parsedData)) {
        logs = parsedData;
      }
    }
    const now = new Date();
    logs.push({
      ...logData,
      date: now.toLocaleDateString() + "/" + now.toLocaleTimeString(),
    });
    fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2), "utf8");
  } catch (error) {
    console.error("Error logging message:", error);
  }
};

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath: "/usr/bin/chromium-browser",
    headless: true,
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

client.on("qr", async (qr) => {
  qrCode = qr;
  try {
    const qrCodeUrl = await QRCode.toDataURL(qr);
    io.emit("qr-code", { qrCode: qrCodeUrl });
    io.emit("connection-status", { status: "waiting-for-scan" });
    console.log(":: Generate QR Code");
  } catch (error) {
    console.error(":: Error generating QR Code:", error);
  }
});

client.on("authenticated", () => {
  connectionStatus = "authenticated";
  io.emit("connection-status", { status: "authenticated" });
  console.log(":: Authenticated");
});

client.on("ready", () => {
  connectionStatus = "ready";
  io.emit("connection-status", { status: "ready" });
  console.log(":: Whatsapp Ready");
});

client.on("auth_failure", () => {
  connectionStatus = "failed";
  io.emit("connection-status", { status: "failed" });
  console.log(":: Authentication Failed");
});

client.on("disconnected", () => {
  connectionStatus = "disconnected";
  io.emit("connection-status", { status: "disconnected" });
  console.log(":: Disconnected");
});

client.initialize();

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.get("/current-status", (req, res) => {
  res.status(200).json({ status: connectionStatus });
});

app.post("/send-message", async (req, res) => {
  const { phone, message } = req.body;
  try {
    const formattedNumber = phoneNumberFormatter(phone);
    const isRegistered = await client.isRegisteredUser(formattedNumber);
    if (!isRegistered) {
      logMessageToFile({
        status: "failed",
        reason: "number_not_registered",
        timestamp: new Date().toISOString(),
      });
      return res.status(404).json({
        status: false,
        message: "The phone number is not registered on WhatsApp",
      });
    }
    const response = await client.sendMessage(formattedNumber, message);
    logMessageToFile({
      status: "sent",
      messageId: response.id._serialized,
    });
    res.status(200).json({
      status: true,
      message: "Message sent successfully",
      response: response.id._serialized,
    });
    console.log(":: Message sent success;", response.id._serialized);
  } catch (error) {
    logMessageToFile({
      phone: phoneNumberFormatter(phone),
      status: "failed",
      error: error.message,
    });
    res.status(500).json({
      status: false,
      message: "Failed to send message",
      error: error.message,
    });
  }
});

app.get("/logs", (req, res) => {
  const logFilePath = "./logs.json";
  try {
    if (fs.existsSync(logFilePath)) {
      const logs = JSON.parse(fs.readFileSync(logFilePath, "utf8"));
      res.status(200).json(logs);
    } else {
      res.status(200).json([]);
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to read logs" });
  }
});

server.listen(port, () => {
  console.log(`:: Running on port ${port}`);
});
