const User = require("../models/User");
const OTP = require("../models/OTP");
const sendEmail = require("../utils/sendEmail");
const { uploadToBackblaze } = require("../utils/uploadToBackblaze");

/**
 * 🔔 UPDATE PREFERENCES
 */
const generateOTP = () => Math.floor(1000 + Math.random() * 9000).toString();

exports.updatePreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const { preferences } = req.body;
    console.log("🛠️ [Preferences] Update started for User:", userId);
    console.log("🛠️ [Preferences] Incoming data:", preferences);

    const updateData = {};
    if (preferences.notifications) {
      if (preferences.notifications.push !== undefined)
        updateData["preferences.notifications.push"] =
          preferences.notifications.push;
      if (preferences.notifications.email !== undefined)
        updateData["preferences.notifications.email"] =
          preferences.notifications.email;
      if (preferences.notifications.sms !== undefined)
        updateData["preferences.notifications.sms"] =
          preferences.notifications.sms;
    }

    console.log("🛠️ [Preferences] Formatted Update Object:", updateData);

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    console.log("✅ [Preferences] Update Successful");
    res.status(200).json({
      success: true,
      message: "Preferences updated successfully",
      data: user.preferences,
    });
  } catch (error) {
    console.error("❌ [Preferences] Update Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = req.user;
    console.log("👤 [Profile] Fetching profile for:", user?._id);

    if (!user) {
      console.log("⚠️ [Profile] User not found in request");
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        phoneNumber: user.phoneNumber,
        profilePicture: user.profilePicture,
        bio: user.bio,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        address: user.address,
        website: user.website,

        // ✅ Preferences (SAFE DEFAULTS)
        preferences: {
          notifications: {
            push: user.preferences?.notifications?.push ?? true,
            email: user.preferences?.notifications?.email ?? true,
            sms: user.preferences?.notifications?.sms ?? false,
          },
        },
      },
    });
  } catch (err) {
    console.error("🔥 [Profile] getProfile Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const user = req.user;
    console.log("👤 [Profile] Updating profile for:", user?._id);

    if (!user) return res.status(404).json({ message: "User not found" });

    const {
      firstName,
      lastName,
      username,
      bio,
      gender,
      dateOfBirth,
      address,
      website,
      profilePicture,
    } = req.body;

    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (username !== undefined) user.username = username;
    if (bio !== undefined) user.bio = bio;
    if (gender !== undefined) user.gender = gender;
    if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth;
    if (address !== undefined) user.address = address;
    if (website !== undefined) user.website = website;
    if (profilePicture !== undefined) user.profilePicture = profilePicture;

    await user.save();
    console.log("✅ [Profile] Save Successful");

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        phoneNumber: user.phoneNumber,
        profilePicture: user.profilePicture,
        bio: user.bio,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        address: user.address,
        website: user.website,
      },
    });
  } catch (err) {
    console.error("🔥 [Profile] updateProfile Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.requestEmailChangeOTP = async (req, res) => {
  try {
    const { newEmail } = req.body;
    console.log("📧 [Email OTP] Request for:", newEmail);

    console.log("📧 [Email OTP] Cleaning old records for:", newEmail);
    await OTP.deleteMany({ value: newEmail, type: "change-email" });

    const otp = generateOTP();
    console.log("📧 [Email OTP] Generated Code:", otp);

    await OTP.create({
      code: otp,
      type: "change-email",
      value: newEmail,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    await sendEmail({ to: newEmail, otp, purpose: "verification" });
    console.log("✅ [Email OTP] Sent to Email Successfully");

    res.status(200).json({ success: true, message: "OTP sent" });
  } catch (error) {
    console.error("❌ [Email OTP] Request Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.verifyEmailChangeOTP = async (req, res) => {
  try {
    const { otp, newEmail } = req.body;
    console.log(
      "📧 [Email Verify] Attempting Verify. Email:",
      newEmail,
      "OTP:",
      otp
    );

    const record = await OTP.findOne({
      code: otp,
      value: newEmail,
      type: "change-email",
      expiresAt: { $gt: new Date() },
    });

    if (!record) {
      console.log("⚠️ [Email Verify] No matching or valid record found in DB");
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    console.log("📧 [Email Verify] Found record. Updating User:", req.user.id);
    await User.findByIdAndUpdate(req.user.id, { email: record.value });

    console.log("📧 [Email Verify] Cleaning up OTP record:", record._id);
    await OTP.deleteOne({ _id: record._id });

    res.status(200).json({ success: true, message: "Email updated" });
  } catch (error) {
    console.error("❌ [Email Verify] Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.requestPhoneChangeOTP = async (req, res) => {
  try {
    const { newPhoneNumber } = req.body;
    console.log("📱 [Phone OTP] Request for:", newPhoneNumber);

    if (!newPhoneNumber) {
      return res
        .status(400)
        .json({ success: false, message: "Phone number is required" });
    }

    console.log("📱 [Phone OTP] Cleaning old records for:", newPhoneNumber);
    await OTP.deleteMany({ value: newPhoneNumber, type: "change-phone" });

    const otp = generateOTP();
    console.log("📱 [Phone OTP] Generated Code:", otp);

    await OTP.create({
      code: otp,
      type: "change-phone",
      value: newPhoneNumber,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    console.log(
      `📱 [SMS Gateway Simulator] Sending OTP ${otp} to ${newPhoneNumber}`
    );

    res.status(200).json({
      success: true,
      message: "OTP sent to new phone number",
    });
  } catch (error) {
    console.error("❌ [Phone OTP] Request Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.verifyPhoneChangeOTP = async (req, res) => {
  try {
    const { otp, newPhoneNumber } = req.body;
    console.log(
      "📱 [Phone Verify] Attempting Verify. Phone:",
      newPhoneNumber,
      "OTP:",
      otp
    );

    const record = await OTP.findOne({
      code: otp,
      value: newPhoneNumber,
      type: "change-phone",
      expiresAt: { $gt: new Date() },
    });

    if (!record) {
      console.log("⚠️ [Phone Verify] No valid record found");
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    console.log("📱 [Phone Verify] Found record. Updating User:", req.user.id);
    await User.findByIdAndUpdate(req.user.id, {
      phoneNumber: record.value,
    });

    console.log("📱 [Phone Verify] Deleting OTP record:", record._id);
    await OTP.deleteOne({ _id: record._id });

    res.status(200).json({
      success: true,
      message: "Phone number updated successfully",
    });
  } catch (error) {
    console.error("❌ [Phone Verify] Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    console.log("📸 Updating profile picture for user:", userId);

    // Upload to Backblaze
    const imageUrl = await uploadToBackblaze(
      req.file.buffer,
      req.file.originalname,
      "profile-pictures"
    );

    // Save URL to user
    const user = await User.findByIdAndUpdate(
      userId,
      { profilePicture: imageUrl },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Profile picture updated successfully",
      profilePicture: user.profilePicture,
    });
  } catch (error) {
    console.error("🔥 [ProfilePicture] Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update profile picture",
    });
  }
};
