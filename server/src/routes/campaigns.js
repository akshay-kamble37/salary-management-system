import { Router } from "express";
import mongoose from "mongoose";
import {
  Campaign,
  DispatchOutbox,
  DeliveryJob,
  UsageRecord,
  Upload,
} from "../models/index.js";
import { requireRole } from "../middleware/auth.js";
import {
  approveCampaign,
  acknowledgeCampaignReview,
  prepareCampaignSnapshot,
  cancelCampaign,
  createNewCampaignVersion,
} from "../services/campaigns.js";
import { getNotificationQueue } from "../services/queue.js";
import { audit } from "../utils/audit.js";

const router = Router();

router.use(requireRole("admin"));

router.param("id", (req, res, next, value) =>
  mongoose.Types.ObjectId.isValid(value)
    ? next()
    : res.status(404).json({ error: "Resource not found" }),
);

router.get("/", async (_req, res, next) => {
  try {
    const items = await Campaign.aggregate([
      {
        $sort: { createdAt: -1 },
      },
      {
        $limit: 200,
      },
      {
        $project: {
          reference: 1,
          title: 1,
          version: 1,
          channels: 1,
          createdAt: 1,
          status: 1,
          counters: 1,

          // Calculate the actual number of unique recipient records.
          recipientCount: {
            $size: {
              $ifNull: ["$recipients", []],
            },
          },
        },
      },
    ]);

    return res.json({ items });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", async (req, res) => {
  const campaign = await Campaign.findOne({
    _id: req.params.id,
  }).lean();

  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  res.json({ campaign });
});

router.delete("/:id", async (req, res) => {
  const campaign = await Campaign.findById(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });
  if (!["draft", "awaiting_approval", "rejected"].includes(campaign.status)) {
    return res.status(409).json({
      error:
        "Campaign history cannot be deleted after dispatch. Archive or retain it for audit.",
    });
  }

  const deliveryCount = await DeliveryJob.countDocuments({
    campaign: campaign._id,
  });

  if (deliveryCount > 0) {
    return res.status(409).json({
      error: "Campaign has delivery history and cannot be deleted",
    });
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await DispatchOutbox.deleteMany({ campaign: campaign._id }, { session });
      await UsageRecord.deleteMany({ campaign: campaign._id }, { session });
      await Campaign.deleteOne({ _id: campaign._id }, { session });
      await Upload.updateOne(
        { _id: campaign.upload, status: "submitted" },
        { $set: { status: "review" } },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  await audit(req, "campaign.deleted", "campaign", campaign._id, "success", {
    reference: campaign.reference,
  });
  return res.json({ ok: true });
});

router.get("/:id/preview", requireRole("admin"), async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    if (campaign.status !== "awaiting_approval") {
      return res.status(409).json({
        error: "Only campaigns awaiting approval can be previewed for approval",
      });
    }

    const prepared = await prepareCampaignSnapshot(campaign);
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 25)));

    const byRecipient = new Map();

    for (const message of prepared.messages) {
      if (!byRecipient.has(message.recipientIndex)) {
        byRecipient.set(message.recipientIndex, []);
      }

      byRecipient.get(message.recipientIndex).push(message);
    }

    const groups = campaign.recipients.map((recipient, recipientIndex) => ({
      name: recipient.name,
      language: recipient.language,
      salaryAmount:
        recipient.salaryAmount?.toString?.() ||
        String(recipient.salaryAmount || ""),
      salaryPeriod: recipient.salaryPeriod,
      sourceRow: recipient.sourceRow,
      sourceSheet: recipient.sourceSheet,
      messages: (byRecipient.get(recipientIndex) || []).map((message) => ({
        channel: message.channel,
        subject: message.subject,
        body: message.body,
        email: message.email,
        phone: message.phone,
        whatsappTemplateName: message.whatsappTemplateName,
        whatsappLanguageCode: message.whatsappLanguageCode,
      })),
    }));

    const total = groups.length;
    const items = groups.slice((page - 1) * limit, page * limit);

    res.json({
      campaign: {
        id: campaign._id,
        reference: campaign.reference,
        title: campaign.title,
        version: campaign.version,
        recipients: campaign.recipients.length,
        channels: campaign.channels,
      },
      snapshotHash: prepared.hash,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      items,
    });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
});

router.post("/:id/preview-ack", requireRole("admin"), async (req, res) => {
  try {
    const campaign = await acknowledgeCampaignReview(
      req,
      req.params.id,
      String(req.body?.snapshotHash || ""),
    );

    res.json({
      ok: true,
      campaign: {
        id: campaign._id,
        reviewAcknowledgement: campaign.reviewAcknowledgement,
      },
    });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
});

router.post("/:id/new-version", async (req, res) => {
  try {
    const campaign = await createNewCampaignVersion(
      req,
      req.params.id,
      req.body || {},
    );

    res.status(201).json({ campaign });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
});

router.post("/:id/cancellation-request", async (req, res) => {
  const campaign = await Campaign.findById(req.params.id);

  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  if (["completed", "cancelled", "failed"].includes(campaign.status)) {
    return res.status(409).json({ error: "Campaign is already finished" });
  }

  campaign.cancellationRequest = {
    requestedBy: req.user.id,
    requestedAt: new Date(),
    reason: String(req.body?.reason || "").slice(0, 500),
    status: "pending",
  };

  await campaign.save();

  await audit(
    req,
    "campaign.cancellation_requested",
    "campaign",
    campaign._id,
    "success",
    { reference: campaign.reference },
  );

  res.json({
    ok: true,
    cancellationRequest: campaign.cancellationRequest,
    message: "Cancellation request recorded. An administrator must review it.",
  });
});

router.get("/:id/deliveries", async (req, res) => {
  const campaign = await Campaign.findOne({
    _id: req.params.id,
  })
    .select("_id")
    .lean();

  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  const items = await DeliveryJob.find({
    campaign: campaign._id,
  })
    .sort({ createdAt: -1 })
    .limit(5000)
    .lean();

  res.json({
    items: items.map((item) => ({
      id: item._id,
      contact: item.destination
        ? `${item.destination.slice(0, 2)}••••${item.destination.slice(-3)}`
        : "",
      channel: item.channel,
      status: item.status,
      attempts: item.attempts,
      providerMessageId: item.providerMessageId,
      lastErrorCode: item.lastErrorCode,
      createdAt: item.createdAt,
      deliveredAt: item.deliveredAt,
      cost: item.cost,
    })),
  });
});

router.post("/:id/approve", requireRole("admin"), async (req, res) => {
  try {
    const campaign = await approveCampaign(
      req,
      req.params.id,
      req.body?.scheduleAt,
    );

    res.json({ campaign });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
});

router.post("/:id/reject", requireRole("admin"), async (req, res) => {
  const campaign = await Campaign.findById(req.params.id);

  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  if (campaign.status !== "awaiting_approval") {
    return res.status(409).json({
      error: "Only campaigns awaiting approval can be rejected",
    });
  }

  campaign.status = "rejected";
  campaign.approval = {
    rejectedBy: req.user.id,
    rejectionReason: String(req.body?.reason || "No reason supplied").slice(
      0,
      500,
    ),
  };

  await campaign.save();

  await audit(req, "campaign.rejected", "campaign", campaign._id, "success", {
    reason: campaign.approval.rejectionReason,
  });

  res.json({ campaign });
});

router.post("/:id/pause", requireRole("admin"), async (req, res) => {
  const campaign = await Campaign.findById(req.params.id);

  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  if (!["sending", "approved", "scheduled"].includes(campaign.status)) {
    return res.status(409).json({
      error: "Campaign cannot be paused in its current state",
    });
  }

  campaign.status = "paused";
  await campaign.save();

  await audit(req, "campaign.paused", "campaign", campaign._id);

  res.json({ campaign });
});

router.post("/:id/resume", requireRole("admin"), async (req, res) => {
  const campaign = await Campaign.findById(req.params.id);

  if (!campaign || campaign.status !== "paused") {
    return res.status(409).json({ error: "Campaign is not paused" });
  }

  if (!campaign.dispatchPreparedAt) {
    const future = campaign.scheduleAt && campaign.scheduleAt > new Date();

    campaign.status = future ? "scheduled" : "approved";
    await campaign.save();

    const delay = future ? campaign.scheduleAt.getTime() - Date.now() : 0;

    await getNotificationQueue().add(
      "dispatch-campaign",
      {
        campaignId: String(campaign._id),
        version: campaign.version,
      },
      {
        jobId: `dispatch-resume-${campaign._id}-v${campaign.version}-${Date.now()}`,
        delay,
        attempts: 5,
        backoff: { type: "exponential", delay: 5000 },
      },
    );

    await audit(req, "campaign.resumed", "campaign", campaign._id, "success", {
      requeued: "dispatch",
    });

    return res.json({ campaign, requeued: "dispatch" });
  }

  campaign.status = "sending";
  await campaign.save();

  const queued = await DeliveryJob.find({
    campaign: campaign._id,
    status: "queued",
  })
    .select("_id")
    .lean();

  for (const delivery of queued) {
    await getNotificationQueue().add(
      "send-delivery",
      { deliveryJobId: String(delivery._id) },
      {
        jobId: `delivery-${delivery._id}-resume-${Date.now()}`,
        attempts: 5,
        backoff: { type: "exponential", delay: 30000 },
      },
    );
  }

  await audit(req, "campaign.resumed", "campaign", campaign._id);

  res.json({ campaign, requeued: queued.length });
});

router.post("/:id/cancel", requireRole("admin"), async (req, res) => {
  try {
    const campaign = await cancelCampaign(req, req.params.id);
    res.json({ campaign });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
});

router.post("/:id/retry-failed", requireRole("admin"), async (req, res) => {
  const campaign = await Campaign.findById(req.params.id);

  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  if (!["partial_failure", "failed", "completed"].includes(campaign.status)) {
    return res.status(409).json({
      error: "Campaign is not in a retryable state",
    });
  }

  const jobs = await DeliveryJob.find({
    campaign: campaign._id,
    status: "failed",
    attempts: { $lt: 8 },
  });

  if (!jobs.length) {
    return res.status(409).json({
      error:
        "No safely retryable failed delivery jobs. Reconcile unknown jobs or create a new campaign version.",
    });
  }

  for (const delivery of jobs) {
    delivery.status = "queued";
    delivery.nextAttemptAt = new Date();
    delivery.lastError = undefined;
    delivery.lastErrorCode = undefined;

    await delivery.save();

    await getNotificationQueue().add(
      "send-delivery",
      { deliveryJobId: String(delivery._id) },
      {
        jobId: `delivery-${delivery._id}-manual-${Date.now()}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 30000 },
      },
    );
  }

  campaign.status = "sending";
  campaign.completedAt = undefined;

  await campaign.save();

  await audit(
    req,
    "campaign.failed_deliveries_retried",
    "campaign",
    campaign._id,
    "success",
    { count: jobs.length },
  );

  res.json({ ok: true, retried: jobs.length });
});

export default router;
