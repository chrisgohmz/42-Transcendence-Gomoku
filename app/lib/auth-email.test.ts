import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

type TransportOptions = {
  auth: {
    pass: string;
    user: string;
  };
  host: string;
  port: number;
  secure: boolean;
};

type MailMessage = {
  from: string;
  html: string;
  replyTo?: string;
  subject: string;
  text: string;
  to: string;
};

const sendMail = mock(async (_message: MailMessage) => ({ messageId: "message-1" }));
const createTransport = mock((_options: TransportOptions) => ({ sendMail }));

await mock.module("server-only", () => ({}));

await mock.module("nodemailer", () => ({
  createTransport,
  default: {
    createTransport,
  },
}));

const { sendEmailVerificationEmail, sendPasswordResetEmail } = await import("./auth-email");

const envKeys = [
  "AUTH_EMAIL_MODE",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "RESEND_REPLY_TO_EMAIL",
  "RESEND_SMTP_HOST",
  "RESEND_SMTP_PORT",
  "RESEND_SMTP_SECURE",
  "RESEND_SMTP_USER",
] as const;

const originalEnv = new Map(envKeys.map((key) => [key, process.env[key]]));

function restoreEnv() {
  for (const key of envKeys) {
    const value = originalEnv.get(key);

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function clearEnv() {
  for (const key of envKeys) {
    delete process.env[key];
  }
}

beforeEach(() => {
  clearEnv();
  createTransport.mockClear();
  sendMail.mockClear();
});

afterEach(() => {
  restoreEnv();
});

describe("sendPasswordResetEmail", () => {
  test("prints reset emails in console mode without creating an SMTP transport", async () => {
    process.env["AUTH_EMAIL_MODE"] = "console";

    const originalConsoleInfo = console.info;
    const consoleInfo = mock((_message: string) => undefined);
    console.info = consoleInfo as typeof console.info;

    try {
      await sendPasswordResetEmail({
        email: "player@example.com",
        resetUrl: "https://app.test/en/reset-password?token=abc123",
      });
    } finally {
      console.info = originalConsoleInfo;
    }

    expect(createTransport).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
    expect(consoleInfo).toHaveBeenCalledTimes(1);
    expect(consoleInfo.mock.calls[0]?.[0]).toContain("player@example.com");
    expect(consoleInfo.mock.calls[0]?.[0]).toContain(
      "https://app.test/en/reset-password?token=abc123",
    );
  });

  test("sends reset emails through Resend SMTP mode", async () => {
    process.env["AUTH_EMAIL_MODE"] = "resend-smtp";
    process.env["RESEND_API_KEY"] = "re_test_key";
    process.env["RESEND_FROM_EMAIL"] = "42 Transcendence Gomoku <passwords@example.com>";
    process.env["RESEND_REPLY_TO_EMAIL"] = "support@example.com";

    const originalConsoleInfo = console.info;
    const consoleInfo = mock((_message: string, _details: unknown) => undefined);
    console.info = consoleInfo as typeof console.info;

    try {
      await sendPasswordResetEmail({
        email: "player@example.com",
        resetUrl: "https://app.test/en/reset-password?token=abc123",
      });
    } finally {
      console.info = originalConsoleInfo;
    }

    expect(createTransport).toHaveBeenCalledWith({
      auth: {
        pass: "re_test_key",
        user: "resend",
      },
      host: "smtp.resend.com",
      port: 465,
      secure: true,
    });

    const message = sendMail.mock.calls[0]?.[0];

    expect(message?.from).toBe("42 Transcendence Gomoku <passwords@example.com>");
    expect(message?.to).toBe("player@example.com");
    expect(message?.replyTo).toBe("support@example.com");
    expect(message?.subject).toBe("Reset your 42 Transcendence Gomoku password");
    expect(message?.text).toContain("https://app.test/en/reset-password?token=abc123");
    expect(message?.text).toContain("This link expires in 1 hour.");
    expect(message?.html).toContain("Reset your password");
    expect(consoleInfo).toHaveBeenCalledWith("[auth-email] Resend SMTP accepted auth email", {
      accepted: undefined,
      messageId: "message-1",
      rejected: undefined,
    });
  });

  test("requires Resend credentials before sending through SMTP", async () => {
    process.env["AUTH_EMAIL_MODE"] = "resend-smtp";
    process.env["RESEND_FROM_EMAIL"] = "42 Transcendence Gomoku <passwords@example.com>";

    let error: unknown;

    try {
      await sendPasswordResetEmail({
        email: "player@example.com",
        resetUrl: "https://app.test/en/reset-password?token=abc123",
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("RESEND_API_KEY");
    expect(createTransport).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe("sendEmailVerificationEmail", () => {
  test("sends verification emails through the shared auth email transport", async () => {
    process.env["AUTH_EMAIL_MODE"] = "resend-smtp";
    process.env["RESEND_API_KEY"] = "re_verify_key";
    process.env["RESEND_FROM_EMAIL"] = "42 Transcendence Gomoku <passwords@example.com>";

    const originalConsoleInfo = console.info;
    const consoleInfo = mock((_message: string, _details: unknown) => undefined);
    console.info = consoleInfo as typeof console.info;

    try {
      await sendEmailVerificationEmail({
        email: "player@example.com",
        verificationUrl: "https://app.test/api/auth/verify-email?token=verify123",
      });
    } finally {
      console.info = originalConsoleInfo;
    }

    const message = sendMail.mock.calls[0]?.[0];

    expect(createTransport).toHaveBeenCalledWith({
      auth: {
        pass: "re_verify_key",
        user: "resend",
      },
      host: "smtp.resend.com",
      port: 465,
      secure: true,
    });
    expect(message?.from).toBe("42 Transcendence Gomoku <passwords@example.com>");
    expect(message?.to).toBe("player@example.com");
    expect(message?.subject).toBe("Verify your 42 Transcendence Gomoku email");
    expect(message?.text).toContain("https://app.test/api/auth/verify-email?token=verify123");
    expect(message?.html).toContain("Verify your email address");
    expect(consoleInfo).toHaveBeenCalledWith("[auth-email] Resend SMTP accepted auth email", {
      accepted: undefined,
      messageId: "message-1",
      rejected: undefined,
    });
  });
});
