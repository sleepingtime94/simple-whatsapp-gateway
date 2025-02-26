// Import dependencies
const express = require("express");
const cors = require("cors");
const QRCode = require("qrcode");
const { Client, LocalAuth } = require("whatsapp-web.js");
const http = require("http");
const { Server } = require("socket.io");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize HTTP server and Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all domains to access Socket.IO
    methods: ["GET", "POST"],
  },
});

// Global variables
let qrCode = null;
let connectionStatus = "disconnected"; // Tracks the WhatsApp connection status

/**
 * Format phone number to WhatsApp format.
 * @param {string} number - The phone number to format.
 * @returns {string} - Formatted phone number.
 */
const phoneNumberFormatter = (number) => {
  let formatted = number.replace(/\D/g, ""); // Remove non-numeric characters
  if (formatted.startsWith("0")) {
    formatted = "62" + formatted.substr(1); // Replace leading '0' with '62'
  }
  return formatted.endsWith("@c.us") ? formatted : formatted + "@c.us";
};

// Initialize WhatsApp client
const client = new Client({
  authStrategy: new LocalAuth(),
  executablePath: "/usr/bin/chromium-browser",
  puppeteer: {
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

// Event handlers for WhatsApp client
client.on("qr", async (qr) => {
  qrCode = qr;
  console.log("QR Code generated, scan it to continue.");

  try {
    const qrCodeUrl = await QRCode.toDataURL(qr); // Convert QR code to base64 image
    io.emit("qr-code", { qrCode: qrCodeUrl }); // Send QR code to clients
    io.emit("connection-status", { status: "waiting-for-scan" }); // Update connection status
  } catch (error) {
    console.error("Error generating QR Code:", error);
  }
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
  console.error("Authentication failed!");
  io.emit("connection-status", { status: "failed" });
});

client.on("disconnected", () => {
  connectionStatus = "disconnected";
  console.log("Disconnected!");
  io.emit("connection-status", { status: "disconnected" });
});

// Initialize WhatsApp client
client.initialize();

// Routes
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html"); // Serve the main HTML page
});

app.get("/current-status", (req, res) => {
  res.status(200).json({ status: connectionStatus }); // Return current connection status
});

app.post("/send-message", async (req, res) => {
  const { phone, message } = req.body;

  try {
    const formattedNumber = phoneNumberFormatter(phone);
    const response = await client.sendMessage(formattedNumber, message);
    res.status(200).json(response); // Return success response
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" }); // Return error response
  }
});

// Start the server
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
