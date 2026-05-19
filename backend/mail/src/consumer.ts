import type { Channel, Message, ChannelModel } from "amqplib";
import type { Transporter } from "nodemailer";

// ─── Interfaces for Injected Dependencies ───

export interface SendOtpConsumerDeps {
  rabbitConnection: ChannelModel;
  emailTransporter: Transporter;
}

export interface SendOtpConsumerOptions {
  queueName?: string;
  fromAddress?: string;
}

export interface OtpMessage {
  to: string;
  subject: string;
  body: string;
}

// ─── Refactored Function ───

export const startSendOtpConsumer = async (
  deps: SendOtpConsumerDeps,
  options: SendOtpConsumerOptions = {}
): Promise<Channel> => {
  const { rabbitConnection, emailTransporter } = deps;
  const { queueName = "send-otp", fromAddress = "Chat app" } = options;

  const channel = await rabbitConnection.createChannel();
  await channel.assertQueue(queueName, { durable: true });

  console.log("✅ Mail Service consumer started, listening for otp emails");

  channel.consume(queueName, async (msg: Message | null) => {
    if (!msg) return;

    try {
      const { to, subject, body } = JSON.parse(
        msg.content.toString()
      ) as OtpMessage;

      await emailTransporter.sendMail({
        from: fromAddress,
        to,
        subject,
        text: body,
      });

      console.log(`✅ OTP mail sent to ${to}`);
      channel.ack(msg);
    } catch (error) {
      console.error("❌ Failed to send otp", error);
      // Do not ack — allow RabbitMQ to requeue or dead-letter the message
    }
  });

  return channel;
};