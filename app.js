require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const app = express();
const { authenticateUser, phoneNumberFormatter } = require("./helpers");
const { logMessage } = require("./database");
const qrcode = require("qrcode-terminal");
const port = process.env.PORT || 9000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const client = new Client({
  authStrategy: new LocalAuth(),
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
  webVersion: "2.2410.10",
  webVersionCache: {
    type: "remote",
    remotePath:
      "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2410.10.html",
  },
});

client.initialize();

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true }, function (qrcode) {
    console.log(qrcode);
  });
});

client.on("authenticated", () => {
  console.log("Authenticated!");
});

client.on("auth_failure", (msg) => {
  console.log("Auth Failure!", msg);
});

client.on("ready", () => {
  console.log("Whatsapp Ready!");
});

// * Kirim pesan teks biasa
app.post("/send-message", authenticateUser, async (req, res) => {
  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).send({ error: "Number and message are required" });
  }

  const formattedNumber = phoneNumberFormatter(phone);

  try {
    const response = await client.sendMessage(formattedNumber, message);
    logMessage(formattedNumber, message, "success");
    res.send(response);
  } catch (error) {
    console.error(error);
    logMessage(formattedNumber, message, "failed");
    res.status(500).send({ error: "Failed to send message" });
  }
});

//* Kirim file menggunakan url
app.post("/send-media", authenticateUser, async (req, res) => {
  const { phone, mediaPath, caption } = req.body;

  if (!phone || !mediaPath) {
    return res.status(400).send({ error: "Number and mediaPath are required" });
  }

  const formattedNumber = phoneNumberFormatter(phone);

  try {
    let media;

    // Jika URL dimulai dengan http atau https → download dulu
    if (mediaPath.startsWith("http")) {
      const response = await axios.get(mediaPath, {
        responseType: "arraybuffer",
      });
      const mimeType = response.headers["content-type"];
      const base64 = Buffer.from(response.data, "binary").toString("base64");
      media = new MessageMedia(
        mimeType,
        base64,
        "file." + mimeType.split("/")[1]
      );
    } else {
      // Kalau path lokal
      media = MessageMedia.fromFilePath(mediaPath);
    }

    const sendResponse = await client.sendMessage(formattedNumber, media, {
      caption,
    });
    logMessage(formattedNumber, mediaPath, "success");
    res.send(sendResponse);
  } catch (error) {
    console.error("Send media error:", error);
    logMessage(formattedNumber, mediaPath, "failed");
    res
      .status(500)
      .send({ error: "Failed to send media", detail: error.message });
  }
});

// ** Kirim file media menggunakan base64
// * {
// *   "phone": "08123456789",
// *   "caption": "Tes kirim file dengan base64",
// *   "key": "key123",
// *   "filename": "formulir.pdf",
// *   "mimetype": "application/pdf",
// *   "fileData": "JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9UeXBlIC9QYWdlL..."
// * }
app.post("/send-media-base64", authenticateUser, async (req, res) => {
  const { phone, caption, fileData, filename, mimetype } = req.body;

  if (!phone || !fileData) {
    return res.status(400).send({ error: "Number and fileData required" });
  }

  const formattedNumber = phoneNumberFormatter(phone);

  try {
    const media = new MessageMedia(mimetype, fileData, filename);
    const response = await client.sendMessage(formattedNumber, media, {
      caption,
    });
    logMessage(formattedNumber, filename, "success");
    res.send(response);
  } catch (error) {
    console.error("Send media error:", error);
    logMessage(formattedNumber, filename, "failed");
    res.status(500).send({ error: "Failed to send media" });
  }
});

app.listen(
  port,
  console.log(() => `Server running on port ${port}`)
);
