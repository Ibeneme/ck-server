const User = require("../models/User");
const OTP = require("../models/OTP");
const jwt = require("jsonwebtoken");
const sendEmail = require("../utils/sendEmail");
const notifyUser = require("../utils/notifyUser");

// ── Helpers ──
const generateOTP = () => Math.floor(1000 + Math.random() * 9000).toString();

const generateToken = (user) => {
  console.log(`🔑 [Auth] Generating JWT for User: ${user._id}`);
  return jwt.sign(
    { id: user._id, email: user.email, phoneNumber: user.phoneNumber },
    process.env.JWT_SECRET || "supersecretkey",
    { expiresIn: "7d" }
  );
};

// ── Send OTP ──
exports.sendOTP = async (req, res) => {
  try {
    let { type, value } = req.body;

    // Normalize email to lowercase
    if (type === "email" && value) value = value.toLowerCase().trim();

    console.log(`📩 [OTP Request] Type: ${type}, Value: ${value}`);

    if (!value || !type || !["email", "phone"].includes(type)) {
      return res.status(400).json({ message: "Invalid input" });
    }

    // 1. Cleanup existing OTPs
    await OTP.deleteMany({ type, value });

    // 2. Generate and Store OTP
    const otpCode = generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
    await OTP.create({ type, value, code: otpCode, expiresAt: otpExpiry });

    // 3. Send via Email
    if (type === "email") {
      await sendEmail({ to: value, otp: otpCode, purpose: "verification" });
    }

    // 4. Ensure User Placeholder exists
    let user = await User.findOne(
      type === "email" ? { email: value } : { phoneNumber: value }
    );

    if (!user) {
      const userData =
        type === "email" ? { email: value } : { phoneNumber: value };
      await User.create(userData);
    }

    res.json({ message: `OTP sent successfully to ${value}`, otpCode });
  } catch (err) {
    console.error("🔥 [Critical Error] sendOTP:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ── Resend OTP ──
exports.resendOTP = async (req, res) => {
  try {
    let { type, value } = req.body;
    if (type === "email" && value) value = value.toLowerCase().trim();

    if (!value || !type)
      return res.status(400).json({ message: "Missing required fields" });

    await OTP.deleteMany({ type, value });
    const otpCode = generateOTP();
    await OTP.create({
      type,
      value,
      code: otpCode,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    if (type === "email") {
      await sendEmail({ to: value, otp: otpCode, purpose: "verification" });
    }

    res.json({ message: "New OTP sent successfully", otpCode });
  } catch (err) {
    res.status(500).json({ message: "Failed to resend OTP" });
  }
};

// ── Verify OTP ──
exports.verifyOTP = async (req, res) => {
  try {
    let { type, value, otp } = req.body;
    if (type === "email" && value) value = value.toLowerCase().trim();

    console.log(`🧪 [Verification] Attempting: ${value} with code: ${otp}`);

    if (!value || !otp)
      return res.status(400).json({ message: "Invalid input" });

    // 1. MASTER BYPASS LOGIC
    const isMasterLogin =
      value === "ikennaibenemee@gmail.com" && otp === "1234";

    if (!isMasterLogin) {
      const otpRecord = await OTP.findOne({ type, value, code: otp });

      if (!otpRecord) return res.status(400).json({ message: "Invalid OTP" });
      if (otpRecord.expiresAt < new Date())
        return res.status(400).json({ message: "OTP expired" });

      await OTP.deleteMany({ type, value });
    }

    // 2. USER RESOLUTION
    const user = await User.findOne(
      type === "email" ? { email: value } : { phoneNumber: value }
    );

    if (!user) return res.status(400).json({ message: "User not found" });

    const token = generateToken(user);

    // 3. SECURITY NOTIFICATION
    if (user.firstName) {
      const loginTime = new Date().toLocaleString("en-NG", {
        timeZone: "Africa/Lagos",
      });
      await notifyUser({
        userId: user._id,
        title: "New Login Detected 🛡️",
        description: `Your CloneKraft account was accessed on ${loginTime}. If this wasn't you, please contact support immediately.`,
        type: "INTERACTION",
      });
    }

    res.json({
      message: "OTP verified successfully",
      user: {
        id: user._id,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email,
        phoneNumber: user.phoneNumber,
      },
      token,
    });
  } catch (err) {
    console.error("🔥 [Critical Error] verifyOTP:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ── Update Profile ──
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, userId } = req.body;
    if (!firstName || !lastName)
      return res
        .status(400)
        .json({ message: "First and Last names are required" });

    const user = await User.findByIdAndUpdate(
      userId,
      { firstName, lastName },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ── Update Profile Extended ──
exports.updateProfileNew = async (req, res) => {
  try {
    const userId = req.params.id;
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

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

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
    res.json({ message: "Profile updated successfully", user });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ── Get Profile ──
exports.getProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

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
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
