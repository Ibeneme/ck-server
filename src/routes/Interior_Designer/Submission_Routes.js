const express = require("express");
const router = express.Router();
const {
  Submission,
  DesignerUser,
} = require("../../models/Interior_Designer/DesignerUser");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

// [POST] Submit new application
// [POST] Submit new application
router.post("/submit-application", upload.single("logo"), async (req, res) => {
  try {
    const b = req.body; // 'b' represents the flat fields from your React form

    // Manually map flat fields to the nested Schema structure
    const structuredData = {
      brandIdentity: {
        contactName: b.contactName,
        brandName: b.brandName,
        isRegistered: b.registered === "Yes",
        registrationNumber: b.registrationNumber,
        logoUrl: req.file ? req.file.path : null, // Handle the file from Multer
      },
      contact: {
        email: b.email,
        phone: b.phone,
        assistant: {
          name: b.assistantName,
          phone: b.assistantPhone,
          email: b.assistantEmail,
        }
      },
      logistics: {
        hasPhysicalOffice: b.hasPhysicalOffice === "Yes",
        address: b.officeAddress,
        city: b.officeCity,
        state: b.officeState,
        country: b.officeCountry,
        operatingCity: b.operatingCity,
      },
      onlinePresence: {
        portfolioUrl: b.portfolio,
        instagram: b.instagram,
        linkedin: b.linkedin,
      },
      professionalMetrics: {
        experienceYears: b.experience,
        budgetRange: b.budgetRange,
        projectVolume: b.projectVolume,
      }
    };

    // Use the mapped object instead of req.body
    const submission = await Submission.create(structuredData);

    res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      data: submission,
    });
  } catch (err) {
    console.error("❌ DB Validation Error:", err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});
// [PATCH] Approve/Reject Application (Admin Only)
router.patch("/admin/evaluate/:id", async (req, res) => {
  const { decision } = req.body;
  const submissionId = req.params.id;

  console.log(`--- Evaluating Submission: ${submissionId} ---`);
  console.log(`Decision: ${decision}`);

  try {
    const sub = await Submission.findById(submissionId);

    if (!sub) {
      console.warn(`⚠️ Submission ${submissionId} not found in database.`);
      return res.status(404).json({ message: "Submission not found" });
    }

    console.log("Found Submission for:", sub.contact.email);

    sub.status = decision;
    await sub.save();
    console.log(`Status updated to: ${sub.status}`);

    if (decision === "approved") {
      console.log("🚀 Creating/Updating DesignerUser account...");

      const updatedUser = await DesignerUser.findOneAndUpdate(
        { email: sub.contact.email },
        {
          email: sub.contact.email,
          brandName: sub.brandIdentity.brandName,
          logoUrl: sub.brandIdentity.logoUrl,
          isActive: true,
        },
        { upsert: true, new: true }
      );

      console.log("✅ Designer Profile Synced:", updatedUser.email);
    }

    res.json({ success: true, message: `Application ${decision}` });
  } catch (err) {
    console.error("❌ Evaluation Route Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
