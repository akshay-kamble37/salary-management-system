import { google } from "googleapis";

function required(name) {
  const value = process.env[name];

  if (!value || !String(value).trim()) {
    throw new Error(`Gmail provider not configured: ${name}`);
  }

  return String(value).trim();
}

function getGmailClient() {
  const oauth2Client = new google.auth.OAuth2(
    required("GMAIL_CLIENT_ID"),
    required("GMAIL_CLIENT_SECRET"),
  );

  oauth2Client.setCredentials({
    refresh_token: required("GMAIL_REFRESH_TOKEN"),
  });

  return google.gmail({
    version: "v1",
    auth: oauth2Client,
  });
}

function encodeBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createRawMessage({ from, to, subject, text, html }) {
  const safeSubject = String(subject || "Salary Notification").replace(
    /[\r\n]/g,
    " ",
  );

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${safeSubject}`,
    "MIME-Version: 1.0",
  ];

  if (html) {
    const boundary = `gmail_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const message = [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(text || "").toString("base64"),
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(html).toString("base64"),
      `--${boundary}--`,
    ].join("\r\n");

    return encodeBase64Url(message);
  }

  const message = [
    ...headers,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(text || "").toString("base64"),
  ].join("\r\n");

  return encodeBase64Url(message);
}

export async function testGmailProvider() {
  const oauth2Client = new google.auth.OAuth2(
    required("GMAIL_CLIENT_ID"),
    required("GMAIL_CLIENT_SECRET"),
  );

  oauth2Client.setCredentials({
    refresh_token: required("GMAIL_REFRESH_TOKEN"),
  });

  const response = await oauth2Client.getAccessToken();

  if (!response.token) {
    throw new Error("Gmail OAuth authentication failed.");
  }

  return {
    connected: true,
    provider: "gmail-api",
  };
}

export async function sendGmailMessage({ to, subject, text = "", html }) {
  if (!to || !String(to).trim()) {
    throw new Error("A recipient email address is required.");
  }

  const from = process.env.GMAIL_FROM || required("GMAIL_USER");

  const gmail = getGmailClient();

  const raw = createRawMessage({
    from,
    to: String(to).trim(),
    subject,
    text,
    html,
  });

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  return {
    provider: "gmail-api",
    providerMessageId: response.data.id,
    accepted: Boolean(response.data.id),
  };
}
