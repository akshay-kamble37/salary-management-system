import crypto from "node:crypto";
import mongoose from "mongoose";
import {
  Campaign,
  DispatchOutbox,
  ExtractedRecord,
  Upload,
  DeliveryJob,
  Template,
  SystemSetting,
  UsageRecord,
  SiteContent,
} from "../models/index.js";
import { buildMessage } from "./notifications.js";
import { getNotificationQueue } from "./queue.js";
import { getSetting } from "./settings.js";
import { audit } from "../utils/audit.js";

const makeRef = (prefix) =>
  `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

function snapshotHash(payload) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

function httpError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

export async function createCampaignFromUpload(req, uploadId, title, channels) {
  const allowedChannels = ["email", "sms", "whatsapp"];

  if (
    !Array.isArray(channels) ||
    !channels.length ||
    channels.some((channel) => !allowedChannels.includes(channel)) ||
    new Set(channels).size !== channels.length
  ) {
    throw httpError("Select one or more valid notification channels");
  }

  const idempotencyKey = String(req.get?.("idempotency-key") || "")
    .trim()
    .slice(0, 200);
  if (idempotencyKey) {
    const existing = await Campaign.findOne({
      owner: req.user.id,
      idempotencyKey,
    });
    if (existing) return existing;
  }

  const upload = await Upload.findOne({
    _id: uploadId,
    uploadedBy: req.user.id,
    status: "review",
  });

  if (!upload) {
    throw httpError("Upload not found or not ready for submission", 404);
  }

  const linkedCampaign = await Campaign.findOne({
    upload: upload._id,
    status: {
      $in: [
        "draft",
        "awaiting_approval",
        "approved",
        "scheduled",
        "sending",
        "paused",
        "cancelling",
      ],
    },
  })
    .select("_id reference status")
    .lean();

  if (linkedCampaign) {
    throw httpError(
      `This upload is already linked to active campaign ${linkedCampaign.reference}`,
      409,
    );
  }

  const allRecords = await ExtractedRecord.find({
    upload: upload._id,
  }).lean();

  const records = allRecords.filter((record) => !record.excluded);

  if (!records.length) {
    throw httpError("No included recipient records are available");
  }

  const invalid = records.filter(
    (record) =>
      !record.valid ||
      record.errors?.length ||
      !String(record.name || "").trim() ||
      !String(record.email || "").trim(),
  );

  if (invalid.length) {
    throw httpError(
      `${invalid.length} record(s) still need correction or admin exclusion before campaign submission`,
    );
  }

  const emails = records.map((record) =>
    String(record.email || "")
      .trim()
      .toLowerCase(),
  );

  if (emails.some((email, index) => emails.indexOf(email) !== index)) {
    throw httpError(
      "Duplicate email addresses must be resolved before campaign submission",
    );
  }

  const uploadPolicy =
    (await SystemSetting.findOne({ key: "uploadPolicy" }).lean())?.value || {};

  const maxRecipients = Math.min(
    1000,
    Math.max(1, Number(uploadPolicy.maxRecipientsPerCampaign || 1000)),
  );

  const recipients = [];

  for (const record of records) {
    const email = String(record.email || "")
      .trim()
      .toLowerCase();
    const phone = String(record.phone || "").trim();

    if (
      channels.includes("email") &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      throw httpError(
        `A valid email address is required for ${record.name || "each recipient"}`,
      );
    }

    if (
      (channels.includes("sms") || channels.includes("whatsapp")) &&
      !/^\+[1-9]\d{7,14}$/.test(phone)
    ) {
      throw httpError(
        `A valid international-format mobile number is required for ${record.name || email} when SMS or WhatsApp is selected`,
      );
    }

    if (
      record.salaryAmount === undefined ||
      record.salaryAmount === null ||
      String(record.salaryAmount).trim() === ""
    ) {
      throw httpError(`Salary amount missing for ${record.name || email}`);
    }

    recipients.push({
      name: String(record.name).trim(),
      email,
      phone,
      language: record.language || "en",
      salaryAmount: record.salaryAmount,
      salaryPeriod: record.salaryPeriod,
      salaryDetails: record.raw || {},
      sourceRecord: record._id,
      sourceRow: record.sourceRow,
      sourceSheet: record.sourceSheet,
      exceptionApprovedBy: record.exceptionApprovedBy,
    });
  }

  if (!recipients.length) {
    throw httpError(
      "No eligible salary records. Correct the uploaded records and contacts first.",
    );
  }

  if (recipients.length > maxRecipients) {
    throw httpError(`Campaign limit is ${maxRecipients} distinct recipients`);
  }

  const session = await mongoose.startSession();
  let campaign;

  try {
    await session.withTransaction(async () => {
      const claimedUpload = await Upload.findOneAndUpdate(
        {
          _id: upload._id,
          status: "review",
        },
        { $set: { status: "submitted" } },
        { new: true, session },
      );

      if (!claimedUpload) {
        throw httpError(
          "This upload was submitted by another request. Reload the campaign list.",
          409,
        );
      }

      const created = await Campaign.create(
        [
          {
            reference: makeRef("SGGS-CAM"),
            idempotencyKey: idempotencyKey || undefined,
            title: String(title || upload.originalName).slice(0, 160),
            owner: req.user.id,
            ownerRole: req.user.role,
            upload: upload._id,
            channels,
            recipients,
            status: "awaiting_approval",
            counters: {
              total: recipients.length * channels.length,
              queued: 0,
              sent: 0,
              delivered: 0,
              failed: 0,
              bounced: 0,
              unknown: 0,
            },
          },
        ],
        { session },
      );

      [campaign] = created;
    });
  } finally {
    await session.endSession();
  }

  await audit(req, "campaign.submitted", "campaign", campaign._id, "success", {
    reference: campaign.reference,
    recipientCount: recipients.length,
    channels: campaign.channels,
  });

  return campaign;
}

export async function prepareCampaignSnapshot(campaign) {
  const messages = [];
  const versions = {};

  const homeContent = await SiteContent.findOne({
    key: "home",
    status: "published",
  })
    .sort({ version: -1 })
    .lean();

  const headerContent = await SiteContent.findOne({
    key: "header",
    status: "published",
  })
    .sort({ version: -1 })
    .lean();

  const collegeName =
    homeContent?.content?.collegeName ||
    headerContent?.content?.collegeName ||
    "SGGS";

  const languages = [
    ...new Set(
      campaign.recipients.map((recipient) => recipient.language || "en"),
    ),
  ];

  const templateRows = await Template.find({
    key: "salary_notification",
    channel: { $in: campaign.channels },
    language: { $in: languages },
    status: "published",
  })
    .sort({ version: -1 })
    .lean();

  const templateMap = new Map();

  for (const template of templateRows) {
    const key = `${template.channel}:${template.language}`;

    if (!templateMap.has(key)) {
      templateMap.set(key, template);
    }
  }

  for (let i = 0; i < campaign.recipients.length; i++) {
    const recipient = campaign.recipients[i];

    for (const channel of campaign.channels) {
      const language = recipient.language || "en";
      const template = templateMap.get(`${channel}:${language}`);

      if (!template) {
        throw httpError(
          `No published ${channel} template exists for language ${language}. Configure templates before approving this campaign.`,
        );
      }

      if (channel === "whatsapp" && !template.whatsappTemplateName) {
        throw httpError(
          `WhatsApp template for ${language} is missing an approved provider template name`,
        );
      }

      const message = buildMessage(template, recipient, campaign, {
        collegeName,
        channel,
      });

      messages.push({
        recipientIndex: i,
        name: recipient.name,
        email: recipient.email,
        phone: recipient.phone,
        channel,
        language,
        subject: message.subject,
        body: message.body,
        whatsappTemplateName: template.whatsappTemplateName || "",
        whatsappLanguageCode:
          template.whatsappLanguageCode ||
          (language === "en" ? "en_US" : language),
        variables: message.variables,
        templateId: String(template._id),
        templateVersion: template.version,
      });

      versions[`${channel}:${language}`] = {
        id: String(template._id),
        version: template.version,
      };
    }
  }

  const messageSnapshot = { messages };

  const snapshot = {
    reference: campaign.reference,
    version: campaign.version,
    recipients: campaign.recipients.map((recipient) => ({
      email: recipient.email,
      phone: recipient.phone,
      salaryAmount: recipient.salaryAmount?.toString?.(),
      salaryPeriod: recipient.salaryPeriod,
      language: recipient.language,
      sourceRow: recipient.sourceRow,
      sourceSheet: recipient.sourceSheet,
    })),
    channels: campaign.channels,
    templateVersions: versions,
    messageSnapshot,
  };

  return {
    messages,
    versions,
    messageSnapshot,
    snapshot,
    hash: snapshotHash(snapshot),
  };
}

export async function acknowledgeCampaignReview(req, campaignId, expectedHash) {
  const campaign = await Campaign.findById(campaignId);

  if (!campaign) {
    throw httpError("Campaign not found", 404);
  }

  if (campaign.status !== "awaiting_approval") {
    throw httpError("Only campaigns awaiting approval can be reviewed", 409);
  }

  const prepared = await prepareCampaignSnapshot(campaign);

  if (prepared.hash !== expectedHash) {
    throw httpError(
      "The preview changed. Reload and review the current campaign version.",
      409,
    );
  }

  campaign.reviewAcknowledgement = {
    reviewedBy: req.user.id,
    reviewedAt: new Date(),
    snapshotHash: prepared.hash,
  };

  await campaign.save();

  await audit(
    req,
    "campaign.personalized_preview_reviewed",
    "campaign",
    campaign._id,
    "success",
    {
      reference: campaign.reference,
      version: campaign.version,
      hash: prepared.hash,
    },
  );

  return campaign;
}

// =================
// MADE CHNAGES HERE FOR THE Campaign
// =================

export async function approveCampaign(req, campaignId, scheduleAt) {
  const campaign = await Campaign.findById(campaignId);

  if (!campaign) {
    throw httpError("Campaign not found", 404);
  }

  if (campaign.status !== "awaiting_approval") {
    throw httpError("Only campaigns awaiting approval can be approved", 409);
  }

  const uploadPolicy =
    (await SystemSetting.findOne({ key: "uploadPolicy" }).lean())?.value || {};

  const maxRecipients = Math.min(
    1000,
    Math.max(1, Number(uploadPolicy.maxRecipientsPerCampaign || 1000)),
  );

  if (
    !campaign.recipients.length ||
    campaign.recipients.length > maxRecipients
  ) {
    throw httpError(
      `Campaign recipient count must be between 1 and ${maxRecipients}`,
    );
  }

  const notificationPolicy =
    (
      await SystemSetting.findOne({
        key: "notificationPolicy",
      }).lean()
    )?.value || {};

  const enabledChannels = notificationPolicy.enabledChannels || [
    "email",
    "sms",
    "whatsapp",
  ];

  if (campaign.channels.some((channel) => !enabledChannels.includes(channel))) {
    throw httpError(
      "This campaign includes a channel disabled by the administrator",
    );
  }

  for (const channel of campaign.channels) {
    let configured = false;

    if (channel === "email") {
      const emailProvider = String(process.env.EMAIL_PROVIDER || "smtp")
        .trim()
        .toLowerCase();

      if (emailProvider === "gmail-api") {
        configured = Boolean(
          process.env.GMAIL_CLIENT_ID?.trim() &&
          process.env.GMAIL_CLIENT_SECRET?.trim() &&
          process.env.GMAIL_REFRESH_TOKEN?.trim() &&
          (process.env.GMAIL_FROM?.trim() || process.env.GMAIL_USER?.trim()),
        );
      } else if (emailProvider === "smtp") {
        configured = Boolean(
          process.env.SMTP_HOST?.trim() &&
          (process.env.SMTP_FROM?.trim() || process.env.FROM_EMAIL?.trim()),
        );
      }
    } else if (channel === "sms") {
      configured = Boolean(
        process.env.TWILIO_ACCOUNT_SID?.trim() &&
        process.env.TWILIO_AUTH_TOKEN?.trim() &&
        process.env.TWILIO_SMS_FROM?.trim(),
      );
    } else if (channel === "whatsapp") {
      configured = Boolean(
        process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() &&
        process.env.WHATSAPP_ACCESS_TOKEN?.trim() &&
        process.env.WHATSAPP_APP_SECRET?.trim() &&
        process.env.WHATSAPP_GRAPH_VERSION?.trim(),
      );
    }

    if (!configured) {
      throw httpError(
        `The ${channel} provider is not configured. Configure and test it before approving this campaign.`,
      );
    }
  }

  // Scheduling behavior:
  // - No time supplied: dispatch immediately.
  // - Current or past time: dispatch immediately.
  // - Future time: schedule for the selected time.
  let chosenSchedule;

  if (scheduleAt) {
    const requestedSchedule = new Date(scheduleAt);

    if (!Number.isFinite(requestedSchedule.getTime())) {
      throw httpError("Please select a valid campaign schedule time.");
    }

    chosenSchedule =
      requestedSchedule.getTime() > Date.now() ? requestedSchedule : undefined;
  }

  const prepared = await prepareCampaignSnapshot(campaign);
  const pricing = await getSetting("providerPricing", {});

  const estimate = prepared.messages.reduce((sum, message) => {
    if (message.channel === "email") {
      return (
        sum +
        Number(
          pricing.emailCostPerMessage ??
            process.env.EMAIL_COST_PER_MESSAGE ??
            0,
        )
      );
    }

    if (message.channel === "whatsapp") {
      return (
        sum +
        Number(
          pricing.whatsappCostPerMessage ??
            process.env.WHATSAPP_COST_PER_MESSAGE ??
            0,
        )
      );
    }

    const gsm = /^[\x00-\x7F]*$/.test(message.body);
    const length = message.body.length;

    const segments = gsm
      ? length <= 160
        ? 1
        : Math.ceil(length / 153)
      : length <= 70
        ? 1
        : Math.ceil(length / 67);

    return (
      sum +
      segments *
        Number(
          pricing.smsCostPerSegment ?? process.env.SMS_COST_PER_SEGMENT ?? 0,
        )
    );
  }, 0);

  const costSetting = await SystemSetting.findOne({
    key: "costLimits",
  }).lean();

  const limits = costSetting?.value || {};

  if (
    Number(limits.maxCampaignCostINR) > 0 &&
    estimate > Number(limits.maxCampaignCostINR)
  ) {
    throw httpError(
      `Estimated campaign cost ₹${estimate.toFixed(2)} exceeds the configured per-campaign limit`,
    );
  }

  if (Number(limits.monthlyBudgetINR) > 0) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [used, committed] = await Promise.all([
      UsageRecord.aggregate([
        {
          $match: {
            occurredAt: { $gte: monthStart },
            reconciliationStatus: {
              $in: ["estimated", "reconciled"],
            },
          },
        },
        {
          $lookup: {
            from: "campaigns",
            localField: "campaign",
            foreignField: "_id",
            as: "campaignDoc",
          },
        },
        { $unwind: "$campaignDoc" },
        {
          $match: {
            "campaignDoc.status": {
              $in: ["completed", "partial_failure", "failed", "cancelled"],
            },
          },
        },
        {
          $group: {
            _id: null,
            amount: { $sum: "$estimatedCost" },
          },
        },
      ]),
      Campaign.aggregate([
        {
          $match: {
            _id: { $ne: campaign._id },
            $or: [
              {
                status: "approved",
                createdAt: { $gte: monthStart },
              },
              { status: "sending" },
              {
                status: "scheduled",
                scheduleAt: {
                  $gte: monthStart,
                  $lt: nextMonth,
                },
              },
            ],
          },
        },
        {
          $group: {
            _id: null,
            amount: { $sum: "$estimatedCost" },
          },
        },
      ]),
    ]);

    const totalCommitted =
      Number(used[0]?.amount || 0) +
      Number(committed[0]?.amount || 0) +
      estimate;

    if (totalCommitted > Number(limits.monthlyBudgetINR)) {
      throw httpError(
        "Estimated campaign cost would exceed the configured monthly budget",
      );
    }
  }

  if (
    !campaign.reviewAcknowledgement?.snapshotHash ||
    campaign.reviewAcknowledgement.snapshotHash !== prepared.hash ||
    String(campaign.reviewAcknowledgement.reviewedBy) !== String(req.user.id)
  ) {
    throw httpError(
      "Review every page of the personalized message preview and acknowledge it before approval.",
      409,
    );
  }

  const approved = await Campaign.findOneAndUpdate(
    {
      _id: campaign._id,
      status: "awaiting_approval",
      "reviewAcknowledgement.snapshotHash": prepared.hash,
      "reviewAcknowledgement.reviewedBy": req.user.id,
    },
    {
      $set: {
        estimatedCost: Number(estimate.toFixed(4)),
        templateVersions: prepared.versions,
        messageSnapshot: prepared.messageSnapshot,
        approval: {
          approvedBy: req.user.id,
          approvedAt: new Date(),
          snapshotHash: prepared.hash,
        },
        status: chosenSchedule ? "scheduled" : "approved",
        scheduleAt: chosenSchedule,
        dispatchEnqueuedAt: undefined,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!approved) {
    throw httpError(
      "Campaign approval state changed. Reload and review the latest version.",
      409,
    );
  }

  const delay = approved.scheduleAt
    ? Math.max(0, approved.scheduleAt.getTime() - Date.now())
    : 0;

  let queueEnqueued = true;

  await DispatchOutbox.findOneAndUpdate(
    { campaign: approved._id },
    {
      $set: {
        version: approved.version,
        status: "pending",
        attempts: 0,
        nextAttemptAt: new Date(),
        lastError: undefined,
      },
      $setOnInsert: { campaign: approved._id },
    },
    { upsert: true },
  );

  try {
    await getNotificationQueue().add(
      "dispatch-campaign",
      {
        campaignId: String(approved._id),
        version: approved.version,
      },
      {
        jobId: `dispatch-${approved._id}-v${approved.version}`,
        delay,
        removeOnComplete: true,
      },
    );
    await Campaign.updateOne(
      { _id: approved._id, version: approved.version },
      { $set: { dispatchEnqueuedAt: new Date() } },
    );
    await DispatchOutbox.updateOne(
      { campaign: approved._id, version: approved.version },
      {
        $set: {
          status: "enqueued",
          enqueuedAt: new Date(),
          lastError: undefined,
        },
      },
    );
  } catch (error) {
    queueEnqueued = false;
    await DispatchOutbox.updateOne(
      { campaign: approved._id, version: approved.version },
      {
        $set: {
          status: "failed",
          lastError: String(error.message).slice(0, 500),
          nextAttemptAt: new Date(Date.now() + 60000),
        },
        $inc: { attempts: 1 },
      },
    );

    console.error(
      "Approved campaign dispatch enqueue deferred to queue reconciliation:",
      error.message,
    );
  }

  await audit(
    req,
    queueEnqueued ? "campaign.approved" : "campaign.approved.queue_pending",
    "campaign",
    approved._id,
    "success",
    {
      reference: approved.reference,
      version: approved.version,
      scheduleAt: approved.scheduleAt,
      queueEnqueued,
    },
  );

  return approved;
}

export async function createNewCampaignVersion(req, campaignId, updates) {
  const source = await Campaign.findById(campaignId);

  if (
    !source ||
    (req.user.role !== "admin" && String(source.owner) !== String(req.user.id))
  ) {
    throw httpError("Campaign not found", 404);
  }

  const copy = source.toObject();

  delete copy._id;
  delete copy.__v;
  delete copy.id;
  delete copy.createdAt;
  delete copy.updatedAt;
  delete copy.idempotencyKey;

  copy.reference = makeRef("SGGS-CAM");
  copy.version = source.version + 1;
  copy.parentCampaign = source._id;
  copy.owner = req.user.id;
  copy.ownerRole = req.user.role;
  copy.status = "awaiting_approval";
  copy.approval = {};
  copy.reviewAcknowledgement = {};
  copy.cancellationRequest = undefined;
  copy.rejectionReason = undefined;
  copy.dispatchEnqueuedAt = undefined;
  copy.dispatchPreparedAt = undefined;
  copy.scheduleAt = undefined;
  copy.startedAt = undefined;
  copy.completedAt = undefined;
  copy.estimatedCost = 0;
  copy.actualCost = 0;

  copy.counters = {
    total: copy.recipients.length * copy.channels.length,
    queued: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    bounced: 0,
    unknown: 0,
  };

  if (updates.title) {
    copy.title = String(updates.title).slice(0, 160);
  }

  if (updates.channels) {
    const allowed = ["email", "sms", "whatsapp"];

    if (
      !Array.isArray(updates.channels) ||
      !updates.channels.length ||
      updates.channels.some((channel) => !allowed.includes(channel)) ||
      new Set(updates.channels).size !== updates.channels.length
    ) {
      throw httpError("Select valid notification channels");
    }

    copy.channels = updates.channels;
  }

  const newCampaign = await Campaign.create(copy);

  await audit(
    req,
    "campaign.version.created",
    "campaign",
    newCampaign._id,
    "success",
    {
      parent: source._id,
      reference: newCampaign.reference,
    },
  );

  return newCampaign;
}

export async function cancelCampaign(req, campaignId) {
  const campaign = await Campaign.findById(campaignId);

  if (!campaign) {
    throw httpError("Campaign not found", 404);
  }

  if (
    req.user.role !== "admin" &&
    String(campaign.owner) !== String(req.user.id)
  ) {
    throw httpError("Campaign not found", 404);
  }

  if (["completed", "cancelled", "failed"].includes(campaign.status)) {
    throw httpError("Campaign is already finished", 409);
  }

  campaign.status = "cancelling";

  if (campaign.cancellationRequest) {
    campaign.cancellationRequest.status = "approved";
  }

  await campaign.save();

  await DeliveryJob.updateMany(
    {
      campaign: campaign._id,
      status: "queued",
    },
    {
      $set: { status: "cancelled" },
    },
  );

  campaign.status = "cancelled";
  campaign.completedAt = new Date();

  await campaign.save();

  await audit(req, "campaign.cancelled", "campaign", campaign._id);

  return campaign;
}
