const express = require("express");
const Waitlist = require("../models/Waitlist"); // Path to your schema

const router = express.Router();

// ─────────────────────────────────────────────
// JOIN WAITLIST
// ─────────────────────────────────────────────
router.post("/join", async (req, res) => {
  try {
    console.log("📥 Incoming waitlist request:", req.body);

    const { name, email, interests } = req.body;

    // 1. Basic Validation
    if (!name || !email) {
      console.log("❌ Missing name or email");
      return res.status(400).json({
        message: "Name and email are required",
      });
    }

    const newEntry = new Waitlist({
      name,
      email,
      interests,
    });

    console.log("🧱 New waitlist entry (before save):", newEntry);

    await newEntry.save();

    console.log(`✅ New Waitlist Entry saved: ${email}`);

    return res.status(201).json({
      success: true,
      message: "Successfully joined the waitlist",
    });
  } catch (error) {
    if (error.code === 11000) {
      console.log(`⚠️ Duplicate waitlist attempt: ${req.body.email}`);
      return res.status(409).json({
        code: 11000,
        message: "Email already exists in our waitlist",
      });
    }

    console.error("❌ Waitlist Server Error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

// ─────────────────────────────────────────────
// GET ALL WAITLIST ENTRIES
// ─────────────────────────────────────────────
router.get("/all", async (req, res) => {
  try {
    console.log("📤 Fetching all waitlist entries");

    const waitlist = await Waitlist.find().sort({ createdAt: -1 });

    console.log(`📊 Total waitlist entries: ${waitlist.length}`);

    return res.status(200).json({
      success: true,
      count: waitlist.length,
      data: waitlist,
    });
  } catch (error) {
    console.error("❌ Error fetching waitlist:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

module.exports = router;
