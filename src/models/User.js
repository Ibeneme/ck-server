const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
  street: { type: String, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  country: { type: String, trim: true },
  zipCode: { type: String, trim: true },
});

// 🔔 Notification Preferences
const notificationPreferencesSchema = new mongoose.Schema(
  {
    push: {
      type: Boolean,
      default: true,
    },
    email: {
      type: Boolean,
      default: true,
    },
    sms: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

// ⚙️ User Preferences
const preferencesSchema = new mongoose.Schema(
  {
    notifications: notificationPreferencesSchema,
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    verified: { type: Boolean, default: false },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    username: { type: String, trim: true, unique: true, sparse: true },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    phoneNumber: { type: String, unique: true, sparse: true, trim: true },
    profilePicture: { type: String, trim: true },
    bio: { type: String, trim: true },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: "other",
    },
    dateOfBirth: { type: Date },
    address: addressSchema,
    website: { type: String, trim: true },
    // ✅ correct
    expoPushToken: { type: String },
    // ✅ Preferences
    preferences: {
      type: preferencesSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
