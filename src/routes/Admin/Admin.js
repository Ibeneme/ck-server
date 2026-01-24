const router = require("express").Router();
const Admin = require("../../models/Admin/Admin");
const jwt = require("jsonwebtoken");
const sendEmail = require("../../utils/sendEmail");

// Helper function to format Full Name (Title Case after space or hyphen)
const formatFullName = (name) => {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/(^|[\s-])\S/g, (match) => match.toUpperCase());
};

router.post("/send-otp", async (req, res) => {
  const { fullname, email } = req.body;

  // Data Sanitization
  const sanitizedEmail = email.toLowerCase().trim();
  const sanitizedName = formatFullName(fullname);

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    await Admin.findOneAndUpdate(
      { email: sanitizedEmail },
      { fullname: sanitizedName, otp, otpExpires: Date.now() + 600000 },
      { upsert: true, new: true }
    );

    await sendEmail({ to: sanitizedEmail, otp, purpose: "verification" });

    res.status(200).json({ success: true, message: "OTP sent to email!" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  const sanitizedEmail = email.toLowerCase().trim();

  try {
    const admin = await Admin.findOne({ email: sanitizedEmail });

    if (!admin || admin.otp !== otp || admin.otpExpires < Date.now()) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    // Clean up sensitive fields
    admin.otp = undefined;
    admin.otpExpires = undefined;
    admin.isVerified = true;
    await admin.save();

    const token = jwt.sign(
      { id: admin._id, role: "admin" },
      process.env.JWT_SECRET || "your_secret_key",
      { expiresIn: "24h" }
    );

    res.status(200).json({
      success: true,
      message: "Admin authenticated",
      token,
      admin: {
        fullname: admin.fullname,
        email: admin.email,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
