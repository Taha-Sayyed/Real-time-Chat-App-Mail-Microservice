import amqp from "amqplib";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { startSendOtpConsumer } from "./consumer.js";

dotenv.config();

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
      user: process.env.USER,
      pass: process.env.PASSWORD,
    },
  });

  await startSendOtpConsumer(
    { rabbitConnection, emailTransporter },
    { queueName: "send-otp", fromAddress: "Chat app" }
  );
}

startMailConsumer();