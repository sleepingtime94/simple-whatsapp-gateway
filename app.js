require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Client, LocalAuth } = require("whatsapp-web.js");
const { createClient, clients } = require("./clientManager");
const app = express();
const { authenticateUser, phoneNumberFormatter } = require("./helpers");
const { logMessage } = require("./database");
const qrcode = require("qrcode-terminal");
const port = process.env.PORT;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post("/send-message", authenticateUser, async (req, res) => {
  const { session, phone, message } = req.body;

  if (!session || !phone || !message) {
    return res
      .status(400)
      .send({ error: "Session, number and message are required" });
  }

  const formattedNumber = phoneNumberFormatter(phone);

  try {
    const client = createClient(session);
    const response = await client.sendMessage(formattedNumber, message);

    logMessage(formattedNumber, message, "success", session);
    res.send(response);
  } catch (error) {
    logMessage(formattedNumber, message, "failed", session);
    res
      .status(500)
      .send({ error: "Failed to send message", details: error.message });
    console.error(error);
  }
});

app.listen(
  port,
  console.log(() => `Listen on port ${port}`)
);
