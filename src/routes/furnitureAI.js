const express = require("express");
const multer = require("multer");
const fs = require("fs");
const OpenAI = require("openai");
const path = require("path");
const { uploadToBackblaze } = require("../utils/uploadToBackblaze");
const FurnitureRequest = require("../models/FurnitureRequest");
const verifyToken = require("../utils/verifyToken");

const router = express.Router();

/* ───────────────── UPLOAD SETUP ───────────────── */
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/* ───────────────── MAIN ROUTE: SAVAGE CLONEKRAFT AI CHAT ───────────────── */
router.post(
  "/analyze-furniture",
  verifyToken,
  upload.single("image"),
  async (req, res) => {
    try {
      console.log("[clonekraft-ai] Message received");
      console.log("   User:", req.user?.id);
      console.log("   Text:", req.body?.text || "(no text)");
      console.log("   File:", req.file ? req.file.originalname : "no file");

      const userId = req.user.id;
      const userText = req.body?.text?.trim() || "";

      let b2ImageUrl = null;

      if (req.file) {
        console.log("[clonekraft-ai] Uploading image...");
        const fileBuffer = fs.readFileSync(req.file.path);
        b2ImageUrl = await uploadToBackblaze(
          fileBuffer,
          req.file.originalname,
          "furniture-ai"
        );
        console.log("   → Backblaze URL:", b2ImageUrl);
        fs.unlinkSync(req.file.path);
      }

      // ────────────────────── SAVAGE GEN Z PROMPT ──────────────────────
      const systemPrompt = `
You are CloneKraft AI — savage, Gen Z Nigerian carpenter from PH/Lagos.
Talk like real street youth: short, vibe, roast small, use "bruv", "fam", "no cap", "chai", "mad o", "😂", "😭", "abeg", "wetin be this".

Rules:
1. First message or new chat: greet savage → "Yo fam what's good? Send pic of that chair/table/wardrobe wey you wan make or describe am, I dey reason am sharp 😈"
2. Accept ANY text or image — always reply, describe wetin you see with vibe.
3. NEVER give price, cost, quote, timeline, or JSON UNLESS user clearly says "cost am", "quote me", "how much", "price", "estimate", "wetin be the cost".
4. If user asks to cost → analyze ONLY furniture, return valid JSON (see below), then add savage comment.
5. If no furniture OR non-furniture content → reply savage roast like:
   "CloneKraft AI only dey cost furniture bruv, this no be chair or table 😭 send correct vibes abeg"
6. When pricing: use realistic 2026 PH/Lagos prices.
   Timeline: "16–21 working days" normal.
   If many/large items: "maybe more o, pending size and quantity"
7. Keep chat energy high, funny, direct — no boring talk.

If user asks to cost/quote/price:
Return ONLY this JSON — nothing else before/after:
{
  "items": [
    {
      "name": "specific name e.g Wooden dining chair",
      "quality": "Standard"|"Premium"|"Luxury",
      "description": "short 1-2 sentence",
      "estimatedPriceNGN": number
    }
  ],
  "totalEstimatedCostNGN": number,
  "estimatedTimeline": "16–21 working days" or "maybe more if e big project"
}

If NOT asking for cost → reply normal chat text (NO JSON).
      `;

      console.log("[clonekraft-ai] Sending to GPT-4o-mini...");

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userText || "Just check this pic" },
              ...(b2ImageUrl
                ? [{ type: "image_url", image_url: { url: b2ImageUrl } }]
                : []),
            ],
          },
        ],
      });

      const aiReply =
        aiResponse.choices[0].message.content?.trim() ||
        "AI dey sleep, try again fam 😭";

      console.log(
        "[clonekraft-ai] AI reply:",
        aiReply.substring(0, 200) + (aiReply.length > 200 ? "..." : "")
      );

      // ─── Detect if this is pricing response (contains valid JSON) ───────
      let isPricingResponse = false;
      let parsed = null;

      try {
        parsed = JSON.parse(aiReply);
        if (parsed.items && Array.isArray(parsed.items)) {
          isPricingResponse = true;
        }
      } catch (e) {
        // normal chat reply
      }

      // ─── ALWAYS SAVE to FurnitureRequest ────────────────────────────────
      const items = isPricingResponse ? parsed?.items || [] : [];
      const total = isPricingResponse
        ? parsed?.totalEstimatedCostNGN ||
          items.reduce(
            (sum, it) => sum + (Number(it.estimatedPriceNGN) || 0),
            0
          )
        : 0;
      const timeline = isPricingResponse ? parsed?.estimatedTimeline : null;

      const savedRequest = new FurnitureRequest({
        user: userId,
        userText:
          userText || (b2ImageUrl ? "Just checked this pic" : "Text message"),
        imageUrl: b2ImageUrl,
        detectedItems: items,
        totalEstimatedCostNGN: total,
        // estimatedTimeline: timeline,   // ← uncomment if you add this field to schema
      });

      await savedRequest.save();
      console.log(
        "   → Saved to FurnitureRequest → ID:",
        savedRequest._id.toString()
      );

      // ─── Response to frontend ──────────────────────────────────────────
      res.json({
        success: true,
        message: aiReply,
        isPricingResponse,
        requestId: savedRequest._id.toString(), // always return ID
        ...(isPricingResponse && {
          detectedItems: parsed.items,
          totalEstimatedCostNGN: parsed.totalEstimatedCostNGN,
          estimatedTimeline: parsed.estimatedTimeline || "16–21 working days",
          imageUrl: b2ImageUrl,
        }),
      });
    } catch (err) {
      console.error("[clonekraft-ai] ERROR:", err.message);
      console.error(err.stack);
      res.status(500).json({
        success: false,
        message: "AI dey vex, try again later fam 😭",
        error: err.message,
      });
    }
  }
);

/* ───────────────── GET USER'S PREVIOUS FURNITURE REQUESTS ───────────────── */
router.get("/my-requests", verifyToken, async (req, res) => {
  try {
    const requests = await FurnitureRequest.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({
      success: true,
      count: requests.length,
      requests,
    });
  } catch (err) {
    console.error("[my-requests] ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Could not load your old furniture designs",
    });
  }
});

module.exports = router;
