import { startSendOtpConsumer } from "../consumer.js";
import type { SendOtpConsumerDeps, SendOtpConsumerOptions } from "../consumer.js";
import type { Channel, Message, ChannelModel } from "amqplib";
import type { Transporter } from "nodemailer";
import { describe, it, expect, jest, beforeEach, afterEach, afterAll } from "@jest/globals";


describe("startSendOtpConsumer", () => {
  let mockChannel: Channel;
  let mockConnection: ChannelModel;
  let mockTransporter: Transporter;
  let deps: SendOtpConsumerDeps;
  let consumeCallback: ((msg: Message | null) => Promise<void>) | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    consumeCallback = undefined;

    // ─── Mock Channel ───
    mockChannel = {
      assertQueue: jest.fn<() => Promise<any>>().mockResolvedValue({ queue: "send-otp", messageCount: 0, consumerCount: 0 }),
      consume: jest.fn().mockImplementation((_queue, callback) => {
        consumeCallback = callback as (msg: Message | null) => Promise<void>;
        return Promise.resolve({ consumerTag: "test-consumer-tag" });
      }),
      ack: jest.fn(),
      nack: jest.fn(),
    } as unknown as Channel;

    // ─── Mock Connection ───
    mockConnection = {
      createChannel: jest.fn<() => Promise<any>>().mockResolvedValue(mockChannel),
    } as unknown as ChannelModel;

    // ─── Mock Transporter ───
    mockTransporter = {
      sendMail: jest.fn<() => Promise<any>>().mockResolvedValue({ messageId: "test-msg-id" }),
    } as unknown as Transporter;

    deps = {
      rabbitConnection: mockConnection,
      emailTransporter: mockTransporter,
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── Edge Case 1: Happy Path ───
  it("should send email and ack message on valid OTP message", async () => {
    await startSendOtpConsumer(deps);

    const msg = {
      content: Buffer.from(
        JSON.stringify({
          to: "user@example.com",
          subject: "Your OTP Code",
          body: "123456",
        })
      ),
    } as Message;

    await consumeCallback!(msg);

    expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
    expect(mockTransporter.sendMail).toHaveBeenCalledWith({
      from: "Chat app",
      to: "user@example.com",
      subject: "Your OTP Code",
      text: "123456",
    });
    expect(mockChannel.ack).toHaveBeenCalledTimes(1);
    expect(mockChannel.ack).toHaveBeenCalledWith(msg);
  });

  // ─── Edge Case 2: Null Message ───
  it("should not process or ack when message is null", async () => {
    await startSendOtpConsumer(deps);

    await consumeCallback!(null);

    expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    expect(mockChannel.ack).not.toHaveBeenCalled();
    expect(mockChannel.nack).not.toHaveBeenCalled();
  });

  // ─── Edge Case 3: Invalid JSON in Message Body ───
  it("should log error and not ack when message content is invalid JSON", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    await startSendOtpConsumer(deps);

    const msg = {
      content: Buffer.from("this is not json"),
    } as Message;

    await consumeCallback!(msg);

    expect(consoleSpy).toHaveBeenCalledWith(
      "❌ Failed to send otp",
      expect.any(SyntaxError)
    );
    expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    expect(mockChannel.ack).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  // ─── Edge Case 4: sendMail Failure ───
  it("should log error and not ack when email sending fails", async () => {
    const smtpError = new Error("SMTP connection refused");
    (mockTransporter.sendMail as jest.MockedFunction<any>).mockRejectedValueOnce(smtpError);

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    await startSendOtpConsumer(deps);

    const msg = {
      content: Buffer.from(
        JSON.stringify({
          to: "user@example.com",
          subject: "Your OTP Code",
          body: "123456",
        })
      ),
    } as Message;

    await consumeCallback!(msg);

    expect(consoleSpy).toHaveBeenCalledWith("❌ Failed to send otp", smtpError);
    expect(mockChannel.ack).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  // ─── Edge Case 5: Custom Options (queueName & fromAddress) ───
  it("should use custom queueName and fromAddress when provided", async () => {
    const options: SendOtpConsumerOptions = {
      queueName: "priority-otp",
      fromAddress: "MyApp Security",
    };

    await startSendOtpConsumer(deps, options);

    expect(mockConnection.createChannel).toHaveBeenCalledTimes(1);
    expect(mockChannel.assertQueue).toHaveBeenCalledWith("priority-otp", {
      durable: true,
    });
    expect(mockChannel.consume).toHaveBeenCalledWith(
      "priority-otp",
      expect.any(Function)
    );

    const msg = {
      content: Buffer.from(
        JSON.stringify({
          to: "admin@example.com",
          subject: "Admin OTP",
          body: "999999",
        })
      ),
    } as Message;

    await consumeCallback!(msg);

    expect(mockTransporter.sendMail).toHaveBeenCalledWith({
      from: "MyApp Security",
      to: "admin@example.com",
      subject: "Admin OTP",
      text: "999999",
    });
  });

  // ─── Edge Case 6: Default Options Verification ───
  it("should assert default queue and return the channel", async () => {
    const result = await startSendOtpConsumer(deps);

    expect(mockConnection.createChannel).toHaveBeenCalledTimes(1);
    expect(mockChannel.assertQueue).toHaveBeenCalledWith("send-otp", {
      durable: true,
    });
    expect(mockChannel.consume).toHaveBeenCalledWith(
      "send-otp",
      expect.any(Function)
    );
    expect(result).toBe(mockChannel);
  });
});