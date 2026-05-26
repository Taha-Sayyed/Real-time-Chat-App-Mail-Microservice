import amqp from "amqplib";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { startSendOtpConsumer } from "./consumer.js";
import express from "express";

dotenv.config();

const app = express();
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.status(200).json({
    message: "Service is Healthy ✅"
  });
});

async function startMailConsumer() {
  const rabbitConnection = await amqp.connect({
    protocol: "amqp",
    hostname: process.env.Rabbitmq_Host,
    port: 5672,
    username: process.env.Rabbitmq_Username,
    password: process.env.Rabbitmq_Password,
  });

  const emailTransporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await startSendOtpConsumer(
    { rabbitConnection, emailTransporter },
    { queueName: "send-otp", fromAddress: "Chat app" }
  );
}

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Health server running on port ${PORT}`);
});

startMailConsumer().catch((err) => {
  console.error("❌ Failed to start mail consumer:", err);
  process.exit(1);
});