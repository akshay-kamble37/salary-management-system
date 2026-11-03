import "dotenv/config";
import mongoose from "mongoose";
import argon2 from "argon2";
import { Admin } from "./models/index.js";

async function resetAdmin() {
  const currentEmail =
    process.env.RESET_ADMIN_CURRENT_EMAIL?.trim().toLowerCase();
  const newEmail = process.env.RESET_ADMIN_NEW_EMAIL?.trim().toLowerCase();
  const newPassword = process.env.RESET_ADMIN_NEW_PASSWORD;

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing.");
  }

  if (!currentEmail || !newEmail || !newPassword) {
    throw new Error(
      "Set all three RESET_ADMIN variables in your private .env file.",
    );
  }

  if (newPassword.length < 14) {
    throw new Error("New password must contain at least 14 characters.");
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  try {
    const admin = await Admin.findOne({ email: currentEmail });

    if (!admin) {
      throw new Error("Existing admin account not found. No changes made.");
    }

    const duplicate = await Admin.findOne({
      email: newEmail,
      _id: { $ne: admin._id },
    });

    if (duplicate) {
      throw new Error("The new email already belongs to another admin.");
    }

    admin.email = newEmail;
    admin.passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    await admin.save();

    console.log("Admin email and password updated successfully.");
    console.log(`Updated admin email: ${newEmail}`);
  } finally {
    await mongoose.disconnect();
  }
}

resetAdmin().catch((error) => {
  console.error("Admin reset failed:", error.message);
  process.exitCode = 1;
});
