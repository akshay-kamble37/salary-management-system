import "dotenv/config";
import mongoose from "mongoose";
import { Admin } from "./models/index.js";

async function checkAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("Connected database:", mongoose.connection.name);

    const admins = await Admin.find({}).select("email active role").lean();

    console.log("Total admin accounts:", admins.length);
    console.log("Admin accounts:", admins);
  } catch (error) {
    console.error(error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkAdmin();
