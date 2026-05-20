type AuthEmailMessage = {
  subject: string;
  text: string;
  to: string;
};

type PasswordResetEmail = {
  email: string;
  resetUrl: string;
};

function getAuthEmailMode() {
  return (
    process.env["AUTH_EMAIL_MODE"] ??
    (process.env.NODE_ENV === "production" ? "disabled" : "console")
  );
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

  throw new Error("Auth email delivery is not configured.");
}

export async function sendPasswordResetEmail({
  email,
  resetUrl,
}: PasswordResetEmail): Promise<void> {
  await sendAuthEmail({
    to: email,
    subject: "Reset your 42 Transcendence Gomoku password",
    text: [
      "A password reset was requested for your account.",
      "",
      `Reset your password here: ${resetUrl}`,
      "",
      "If you did not request this, you can ignore this message.",
    ].join("\n"),
  });
}
