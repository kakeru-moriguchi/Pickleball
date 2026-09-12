type AdminNotification = {
  subject: string;
  text: string;
  replyTo?: string;
};

export async function notifyAdmin({ subject, text, replyTo }: AdminNotification) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_NOTIFICATION_EMAIL;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !to || !from) {
    console.warn("Admin email notification skipped: Resend environment variables are missing");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `【みんなでピックル！！】${subject}`,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.error("Admin email notification failed", { status: response.status });
      return false;
    }
    return true;
  } catch (error) {
    console.error("Admin email notification failed", {
      message: error instanceof Error ? error.message : "unknown error",
    });
    return false;
  }
}
