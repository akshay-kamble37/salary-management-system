import nodemailer from "nodemailer";
import twilio from "twilio";
import { getSetting } from "./settings.js";

let cachedEmailTransport;
let cachedTwilioClient;

function required(name) {
  const value = process.env[name];

  if (!value || !String(value).trim()) {
    throw new Error(`Provider not configured: ${name}`);
  }

  return String(value).trim();
}

function render(template, vars) {
  return String(template || "")
    .replace(/\\n/g, "\n")
    .replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
      const value = vars[key];
      return value === undefined || value === null ? "" : String(value);
    });
}

function emailProviderEnabled() {
  return String(process.env.EMAIL_PROVIDER || "").toLowerCase() === "smtp";
}

function getEmailTransport() {
  if (!emailProviderEnabled()) {
    throw new Error(
      "Email provider is not set to SMTP. Set EMAIL_PROVIDER=smtp.",
    );
  }

  if (!cachedEmailTransport) {
    const host = required("SMTP_HOST");
    const port = Number(process.env.SMTP_PORT || 587);

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("Invalid SMTP_PORT. Use a valid port number.");
    }

    const username = process.env.SMTP_USER || process.env.SMTP_USERNAME;

    const password = process.env.SMTP_PASSWORD;

    if (username && !password) {
      throw new Error("Provider not configured: SMTP_PASSWORD");
    }

    const secure =
      String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";

    cachedEmailTransport = nodemailer.createTransport({
      host,
      port,
      secure,
      ...(username
        ? {
            auth: {
              user: username,
              pass: password,
            },
          }
        : {}),
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      connectionTimeout: 15000,
      socketTimeout: 20000,
    });
  }

  return cachedEmailTransport;
}

export async function testEmailProvider() {
  const from = process.env.SMTP_FROM || process.env.FROM_EMAIL;

  if (!from) {
    throw new Error("Provider not configured: SMTP_FROM");
  }

  const transport = getEmailTransport();
  return transport.verify();
}

export async function testSmsProvider() {
  if (!cachedTwilioClient) {
    cachedTwilioClient = twilio(
      required("TWILIO_ACCOUNT_SID"),
      required("TWILIO_AUTH_TOKEN"),
    );
  }

  return cachedTwilioClient.api
    .accounts(process.env.TWILIO_ACCOUNT_SID)
    .fetch();
}

export async function testWhatsAppProvider() {
  const version = required("WHATSAPP_GRAPH_VERSION");
  const phoneId = required("WHATSAPP_PHONE_NUMBER_ID");
  const token = required("WHATSAPP_ACCESS_TOKEN");

  const response = await fetch(
    `https://graph.facebook.com/${version}/${phoneId}?fields=display_phone_number,verified_name`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(15000),
    },
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error?.message || `WhatsApp test failed (${response.status})`,
    );
  }

  return data;
}

export async function sendEmail({ to, subject, body }) {
  if (!emailProviderEnabled()) {
    throw new Error(
      "Email provider is not set to SMTP. Set EMAIL_PROVIDER=smtp.",
    );
  }

  const from = process.env.SMTP_FROM || process.env.FROM_EMAIL;

  if (!from) {
    throw new Error("Provider not configured: SMTP_FROM");
  }

  if (!to || !String(to).trim()) {
    throw new Error("A recipient email address is required.");
  }

  const transport = getEmailTransport();

  const result = await transport.sendMail({
    from,
    to,
    subject: subject || "Salary Notification",
    text: body || "",
  });

  const pricing = await getSetting("providerPricing", {});

  return {
    provider: "smtp",
    providerMessageId: result.messageId,
    accepted: (result.accepted || []).length > 0,
    cost: Number(
      pricing.emailCostPerMessage ?? process.env.EMAIL_COST_PER_MESSAGE ?? 0,
    ),
    units: 1,
  };
}

export async function sendSms({ to, body }) {
  if (!cachedTwilioClient) {
    cachedTwilioClient = twilio(
      required("TWILIO_ACCOUNT_SID"),
      required("TWILIO_AUTH_TOKEN"),
    );
  }

  const client = cachedTwilioClient;
  const from = required("TWILIO_SMS_FROM");

  const result = await client.messages.create({
    to,
    from,
    body,
  });

  const gsm = /^[\x00-\x7F]*$/.test(body);
  const length = String(body || "").length;

  const units = gsm
    ? length <= 160
      ? 1
      : Math.ceil(length / 153)
    : length <= 70
      ? 1
      : Math.ceil(length / 67);

  const pricing = await getSetting("providerPricing", {});

  return {
    provider: "twilio",
    providerMessageId: result.sid,
    accepted: Boolean(result.sid),
    units,
    cost:
      Number(
        pricing.smsCostPerSegment ?? process.env.SMS_COST_PER_SEGMENT ?? 0,
      ) * units,
    providerStatus: result.status,
  };
}

export async function sendWhatsApp({
  to,
  body,
  templateName,
  language = "en",
  languageCode,
  variables = [],
}) {
  const version = required("WHATSAPP_GRAPH_VERSION");
  const phoneId = required("WHATSAPP_PHONE_NUMBER_ID");
  const token = required("WHATSAPP_ACCESS_TOKEN");

  if (!templateName) {
    throw new Error(
      "An approved WhatsApp template name is required for production messages",
    );
  }

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: String(to).replace(/\D/g, ""),
    type: "template",
    template: {
      name: templateName,
      language: {
        code:
          languageCode ||
          (language === "mr" ? "mr" : language === "hi" ? "hi" : "en_US"),
      },
      components: variables.length
        ? [
            {
              type: "body",
              parameters: variables.map((text) => ({
                type: "text",
                text: String(text),
              })),
            },
          ]
        : [],
    },
  };

  const response = await fetch(
    `https://graph.facebook.com/${version}/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    },
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `WhatsApp provider error ${response.status}: ${
        data.error?.message || "Unknown error"
      }`,
    );
  }

  const pricing = await getSetting("providerPricing", {});
  const messageId = data.messages?.[0]?.id;

  return {
    provider: "whatsapp-cloud-api",
    providerMessageId: messageId,
    accepted: Boolean(messageId),
    cost: Number(
      pricing.whatsappCostPerMessage ??
        process.env.WHATSAPP_COST_PER_MESSAGE ??
        0,
    ),
    units: 1,
  };
}

export function buildMessage(template, recipient, campaign, options = {}) {
  const vars = {
    employee_name: recipient.name || "",
    salary_amount: recipient.salaryAmount?.toString?.() || "",
    salary_period: recipient.salaryPeriod || "",
    campaign_title: campaign.title || "",
    salary_details: Object.entries(recipient.salaryDetails || {})
      .filter(
        ([key, value]) =>
          value !== "" &&
          value !== null &&
          value !== undefined &&
          !/pan|employee|name|abbr|sl\\.?/i.test(key),
      )
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join("\n"),
    college_name: options.collegeName || "SGGS",
    notification_date: new Date(
      campaign.scheduleAt || campaign.createdAt || Date.now(),
    ).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
    }),
  };

  const bodyTemplate = String(template?.body || "").replace(/\\n/g, "\n");

  const variableKeys = [
    ...bodyTemplate.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g),
  ].map((match) => match[1]);

  const variables = variableKeys.map((key) => vars[key] ?? "");

  return {
    subject: render(template?.subject || campaign.title, vars),
    body:
      render(bodyTemplate, vars) +
      (options.channel === "email" && vars.salary_details
        ? `\n\nSalary breakdown:\n${vars.salary_details}`
        : ""),
    variables,
  };
}
