const express = require("express");
const nodemailer = require("nodemailer");
const {
  DesignerUser,
  Submission,
} = require("../../models/Interior_Designer/DesignerUser");
const OTP = require("../../models/OTP");
const jwt = require("jsonwebtoken");

JWT_SECRET = "clonekraft_super_secret_2026";

const authRouter = express.Router();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "clonekraft@gmail.com",
    pass: "pzkj bcvk phri ysbu",
  },
});

const getOtpEmailTemplate = (otp, purpose = "verification") => {
  const isReset = purpose === "reset";
  const title = isReset ? "Reset Password" : "Login Verification";
  const accentColor = "#D4AF37";
  const leadText = isReset
    ? "A password reset was requested for your account."
    : "Use the code below to log into your CloneKraft Designer portal.";

  return {
    subject: `[CloneKraft] ${title} - ${otp}`,
    text: `${leadText} Your code is: ${otp}`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: sans-serif; background-color: #f9f9f9; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 12px; border: 1px solid #eee;">
          <h2 style="color: #1a1a1a;">Clone<span style="color: ${accentColor};">Kraft</span></h2>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <h3 style="color: #1a1a1a;">${title}</h3>
          <p style="color: #444; font-size: 16px;">${leadText}</p>
          <div style="background: #f4f4f4; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0;">
            <h1 style="letter-spacing: 8px; font-size: 32px; margin: 0;">${otp}</h1>
          </div>
          <p style="color: #888; font-size: 12px;">This code expires in 10 minutes. If you didn't request this, please ignore this email.</p>
        </div>
      </body>
      </html>
    `,
  };
};

const sendEmail = async ({ to, otp, purpose }) => {
  try {
    const template = getOtpEmailTemplate(otp, purpose);
    await transporter.sendMail({
      from: `"CloneKraft" <clonekraft@gmail.com>`,
      to,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
    console.log(`✨ [Email Sent] Target: ${to}`);
  } catch (error) {
    console.error("🔥 [Email Error]:", error.message);
    throw new Error("Could not deliver OTP email.");
  }
};

// --- ROUTES ---

// 1. Request OTP (Initial Login)
authRouter.post("/login/request-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  const userEmail = email.toLowerCase();

  try {
    const submission = await Submission.findOne({ "contact.email": userEmail });

    if (!submission) {
      return res
        .status(404)
        .json({ message: "No application found for this email." });
    }

    if (submission.status !== "approved") {
      return res.status(403).json({
        message: `Login denied. Status: ${submission.status}`,
      });
    }

    let designer = await DesignerUser.findOne({ email: userEmail });
    if (!designer) {
      designer = await DesignerUser.create({
        email: userEmail,
        brandName: submission.brandIdentity.brandName,
        logoUrl: submission.brandIdentity.logoUrl,
        contactName: submission.brandIdentity.contactName,
      });
    }

    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    await OTP.findOneAndUpdate(
      { type: "DESIGNER_LOGIN", value: userEmail },
      { code: generatedOtp, createdAt: new Date() },
      { upsert: true, new: true }
    );

    // SEND THE EMAIL
    await sendEmail({ to: userEmail, otp: generatedOtp, purpose: "login" });

    res.status(200).json({ success: true, message: "OTP sent to your email." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Resend OTP (New Endpoint)
authRouter.post("/login/resend-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  const userEmail = email.toLowerCase();

  try {
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();

    const otpRecord = await OTP.findOneAndUpdate(
      { type: "DESIGNER_LOGIN", value: userEmail },
      { code: newOtp, createdAt: new Date() },
      { upsert: true, new: true }
    );

    await sendEmail({ to: userEmail, otp: newOtp, purpose: "login" });

    res
      .status(200)
      .json({ success: true, message: "A new OTP has been sent." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

authRouter.post("/login/verify-otp", async (req, res) => {
  const { email, code } = req.body;
  const userEmail = email.toLowerCase();

  console.log("🔹 Incoming request body:", req.body);
  console.log("🔹 Normalized email:", userEmail);

  try {
    const otpRecord = await OTP.findOne({
      type: "DESIGNER_LOGIN",
      value: userEmail,
      code,
    });

    console.log("🔹 OTP record found:", otpRecord);

    if (!otpRecord) {
      console.log("❌ OTP invalid or expired for:", userEmail);
      return res
        .status(401)
        .json({ message: "Invalid or expired login code." });
    }

    const designer = await DesignerUser.findOne({ email: userEmail });

    if (!designer) {
      return res.status(404).json({ message: "Designer not found" });
    }

    // Fetch submission
    const submission = await Submission.findOne({
      "contact.email": userEmail,
    });

    designer.lastLogin = new Date();
    await designer.save();

    const token = jwt.sign(
      { id: designer._id, email: designer.email, role: "DESIGNER" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Cleanup
    const designerObj = designer.toObject();
    delete designerObj.password;
    delete designerObj.__v;

    const submissionObj = submission
      ? (() => {
          const s = submission.toObject();
          delete s.__v;
          return s;
        })()
      : null;

    res.json({
      success: true,
      message: "Login successful",
      token,
      designer: {
        ...designerObj,
        submission: submissionObj, // 👈 included here
      },
    });
  } catch (err) {
    console.error("🔥 VERIFY OTP ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = authRouter;
