import "server-only";
import nodemailer from "nodemailer";

type AuthEmailMessage = {
  html: string;
  subject: string;
  text: string;
  to: string;
};

type PasswordResetEmail = {
  email: string;
  resetUrl: string;
};

type EmailVerificationEmail = {
  email: string;
  verificationUrl: string;
};

type ResendSmtpConfig = {
  apiKey: string;
  from: string;
  host: string;
  port: number;
  replyTo?: string;
  secure: boolean;
  user: string;
};

type ResendSmtpTransport = ReturnType<typeof nodemailer.createTransport>;

const defaultResendSmtpHost = "smtp.resend.com";
const defaultResendSmtpPort = 465;
const defaultResendSmtpUser = "resend";

let cachedResendTransport:
  | {
      key: string;
      transport: ResendSmtpTransport;
    }
  | undefined;

function getAuthEmailMode() {
  return (
    process.env["AUTH_EMAIL_MODE"] ??
    (process.env.NODE_ENV === "production" ? "disabled" : "console")
  );
}

function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function getRequiredEnv(name: string): string {
  const value = getOptionalEnv(name);
  if (!value) {
    throw new Error(`Auth email delivery requires ${name}.`);
  }
  return value;
}

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid RESEND_SMTP_PORT value: ${value}`);
  }

  return port;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`Invalid RESEND_SMTP_SECURE value: ${value}`);
}

function getResendSmtpConfig(): ResendSmtpConfig {
  return {
    apiKey: getRequiredEnv("RESEND_API_KEY"),
    from: getRequiredEnv("RESEND_FROM_EMAIL"),
    host: getOptionalEnv("RESEND_SMTP_HOST") ?? defaultResendSmtpHost,
    port: parsePort(getOptionalEnv("RESEND_SMTP_PORT"), defaultResendSmtpPort),
    replyTo: getOptionalEnv("RESEND_REPLY_TO_EMAIL"),
    secure: parseBoolean(getOptionalEnv("RESEND_SMTP_SECURE"), true),
    user: getOptionalEnv("RESEND_SMTP_USER") ?? defaultResendSmtpUser,
  };
}

function getResendTransport(config: ResendSmtpConfig): ResendSmtpTransport {
  const key = JSON.stringify({
    apiKey: config.apiKey,
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
  });

  if (cachedResendTransport?.key === key) {
    return cachedResendTransport.transport;
  }

  const transport = nodemailer.createTransport({
    auth: {
      pass: config.apiKey,
      user: config.user,
    },
    host: config.host,
    port: config.port,
    secure: config.secure,
  });

  cachedResendTransport = { key, transport };
  return transport;
}

async function sendResendSmtpEmail(message: AuthEmailMessage): Promise<void> {
  const config = getResendSmtpConfig();
  const transport = getResendTransport(config);

  const result = await transport.sendMail({
    from: config.from,
    html: message.html,
    replyTo: config.replyTo,
    subject: message.subject,
    text: message.text,
    to: message.to,
  });

  console.info("[auth-email] Resend SMTP accepted auth email", {
    accepted: Array.isArray(result.accepted) ? result.accepted.length : undefined,
    messageId: result.messageId,
    rejected: Array.isArray(result.rejected) ? result.rejected.length : undefined,
  });
}

async function sendAuthEmail(message: AuthEmailMessage): Promise<void> {
  const mode = getAuthEmailMode();

  if (mode === "console") {
    console.info(
      [
        "[auth-email] Console email delivery",
        `To: ${message.to}`,
        `Subject: ${message.subject}`,
        message.text,
      ].join("\n"),
    );
    return;
  }

  if (mode === "resend-smtp") {
    await sendResendSmtpEmail(message);
    return;
  }

  if (mode === "disabled") {
    throw new Error("Auth email delivery is disabled.");
  }

  throw new Error(`Unsupported AUTH_EMAIL_MODE: ${mode}`);
}

const htmlEscapePattern = /[&<>"']/g;
const htmlEscapes: Record<string, string> = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&#39;",
  "<": "&lt;",
  ">": "&gt;",
};

function escapeHtml(value: string): string {
  return value.replace(htmlEscapePattern, (character) => htmlEscapes[character] ?? character);
}

export async function sendPasswordResetEmail({
  email,
  resetUrl,
}: PasswordResetEmail): Promise<void> {
  const escapedResetUrl = escapeHtml(resetUrl);

  await sendAuthEmail({
    html: [
      "<p>A password reset was requested for your account.</p>",
      `<p><a href="${escapedResetUrl}">Reset your password</a></p>`,
      "<p>This link expires in 1 hour.</p>",
      "<p>If you did not request this, you can ignore this email.</p>",
    ].join("\n"),
    to: email,
    subject: "Reset your 42 Transcendence Gomoku password",
    text: [
      "A password reset was requested for your account.",
      "",
      `Reset your password here: ${resetUrl}`,
      "",
      "This link expires in 1 hour.",
      "",
      "If you did not request this, you can ignore this message.",
    ].join("\n"),
  });
}

export async function sendEmailVerificationEmail({
  email,
  verificationUrl,
}: EmailVerificationEmail): Promise<void> {
  const escapedVerificationUrl = escapeHtml(verificationUrl);

  await sendAuthEmail({
    html: [
      "<p>Welcome to 42 Transcendence Gomoku.</p>",
      `<p><a href="${escapedVerificationUrl}">Verify your email address</a></p>`,
      "<p>This link expires in 1 hour.</p>",
      "<p>If you did not create this account, you can ignore this email.</p>",
    ].join("\n"),
    to: email,
    subject: "Verify your 42 Transcendence Gomoku email",
    text: [
      "Welcome to 42 Transcendence Gomoku.",
      "",
      `Verify your email address here: ${verificationUrl}`,
      "",
      "This link expires in 1 hour.",
      "",
      "If you did not create this account, you can ignore this message.",
    ].join("\n"),
  });
}
