const express = require("express");
const app = express();
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");
const { uid } = require("uid");
const fs = require("fs");
const jsondb = require("simple-json-db");
const db = new jsondb("./logs.json");

require("dotenv").config();

const cors = require("cors");
const port = process.env.PORT;

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
    db.set(msgID, {
      date: formatter.format(date),
      phone,
      status,
    });
    console.log(`(${msgID}) logs created`);
  } catch (error) {
    console.log(error);
  }
};

const phoneNumberFormatter = (number) => {
  let formatted = number.replace(/\D/g, "");
  if (formatted.startsWith("0")) {
    formatted = "62" + formatted.substr(1);
  }

  if (!formatted.endsWith("@c.us")) {
    formatted += "@c.us";
  }
  return formatted;
};

function readJsonFileSync(filepath, encoding) {
  if (typeof encoding == "undefined") {
    encoding = "utf8";
  }
  var file = fs.readFileSync(filepath, encoding);
  return JSON.parse(file);
}

function getConfig(file) {
  var filepath = __dirname + "/" + file;
  return readJsonFileSync(filepath);
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const wwebVersion = "2.2412.54";

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

app.get("/", (req, res) => {
  res.send("Whatsapp Gateway");
});

app.post("/send-message", async (req, res) => {
  const number = phoneNumberFormatter(req.body.phone);
  const message = req.body.message;
  await client
    .sendMessage(number, message)
    .then((resp) => {
      res.status(200).json(resp);
      createLogs(number, "success");
    })
    .catch((err) => {
      res.status(500).json(err);
      createLogs(number, "failed");
    });
});

app.get("/logs", (req, res) => {
  const logs = getConfig("logs.json");
  res.json(logs);
});

app.listen(port, () => console.log("Port: *", port));
