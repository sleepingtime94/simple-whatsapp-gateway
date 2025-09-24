require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Client, LocalAuth } = require("whatsapp-web.js");
const app = express();
const { authenticateUser, phoneNumberFormatter } = require("./helpers");
const { logMessage } = require("./database");
const qrcode = require("qrcode-terminal");

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

app.post("/send-message", authenticateUser, async (req, res) => {
  const { number, message } = req.body;

  if (!number || !message) {
    return res.status(400).send({ error: "Number and message are required" });
  }

  const formattedNumber = phoneNumberFormatter(number);

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

app.listen(3000);
