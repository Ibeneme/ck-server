const express = require("express");
const multer = require("multer");
const { OpenAI } = require("openai");
const B2 = require("backblaze-b2");
const verifyToken = require("../utils/verifyToken");
const AIChat = require("../models/AIChat");
const { uploadToBackblaze } = require("../utils/uploadToBackblaze");
const router = express.Router();



/* ───────────────────────────────
   Multer setup
──────────────────────────────── */
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

/* ───────────────────────────────
   OpenAI client
──────────────────────────────── */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* ───────────────────────────────
   Helper: detect costing intent
──────────────────────────────── */
function isCostingMessage(text = "") {
  const keywords = [
    "cost",
    "price",
    "how much",
    "estimate",
    "budget",
    "pricing",
    "amount",
    "naira",
    "₦",
    "worth",
  ];
  return keywords.some((k) => text.toLowerCase().includes(k));
}

router.post(
  "/chat",
  verifyToken,
  upload.array("images", 5),
  async (req, res) => {
    console.log("🚀 [CHAT START] Analyzing Request & Images...");

    try {
      const { message = "" } = req.body;
      const user = req.user;
      const files = req.files || [];
      const imageAttached = files.length > 0;

      // 1. FETCH & CLEAN HISTORY (OpenAI-safe strings)
      let chatHistory = await AIChat.findOne({ user: user._id });
      const previousMessages = chatHistory
        ? chatHistory.messages.slice(-6).map((m) => ({
            role: m.role === "ai" ? "assistant" : "user",
            content:
              m.content && m.content.trim() !== ""
                ? m.content
                : "[Visual context provided]",
          }))
        : [];

      const b2ImageUrls = [];
      const openAIImageContent = [];
      if (imageAttached) {
        console.log(`📸 Uploading ${files.length} images to Backblaze...`);
        for (const file of files) {
          const url = await uploadToBackblaze(
            file.buffer,
            file.originalname,
            "profile-pictures"
          );
          b2ImageUrls.push(url);

          const base64 = file.buffer.toString("base64");
          openAIImageContent.push({
            type: "image_url",
            image_url: {
              url: `data:${file.mimetype};base64,${base64}`,
              detail: "high", // Essential for identifying wood grain and joinery
            },
          });
        }
      }

      /* ───────────────────────────────
             3. SYSTEM PROMPT (Master Carpenter)
        ─────────────────────────────── */
      const systemInstruction = `
          You are CloneKraft AI — a Nigerian Master Carpenter (30+ years experience).
          
          VISION INSTRUCTIONS:
          - Analyze attached images for wood species (Teak, Mahogany, MDF), joinery quality, and style.
          - If an image is present, ALWAYS perform a costing analysis.
          
          JSON STRUCTURE:
          {
            "explanation": "Start by describing the specific details you see in the uploaded image.",
            "costing": true,
            "items": [{ "name": string, "quantity": number, "unitPriceNGN": number, "subtotalNGN": number }],
            "totalCostNGN": number,
            "thoughtProcess": "Mention specific materials or techniques seen."
          }
        `;

      // 4. CONSTRUCT TURN (Ensures Vision sees the images)
      const currentPromptText =
        message.trim() ||
        (imageAttached
          ? "Master, please analyze this furniture image and give me a price."
          : "Hello!");

      const currentUserMessage = {
        role: "user",
        content: [
          { type: "text", text: currentPromptText },
          ...openAIImageContent, // Images MUST be in this content array
        ],
      };

      // 5. CALL GPT-4o
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemInstruction },
          ...previousMessages,
          currentUserMessage,
        ],
        response_format: { type: "json_object" },
      });

      const parsed = JSON.parse(completion.choices[0].message.content);

      /* ───────────────────────────────
             6. SAVE TO DB & RESPOND
        ─────────────────────────────── */
      if (!chatHistory)
        chatHistory = await AIChat.create({ user: user._id, messages: [] });

      // Save User Message
      chatHistory.messages.push({
        role: "user",
        content: currentPromptText,
        imageUrls: b2ImageUrls,
        timestamp: new Date(),
      });

      // Save AI Message (Linking remote B2 images for retrieval later)
      chatHistory.messages.push({
        role: "ai",
        content: parsed.explanation,
        imageUrls: b2ImageUrls, // The AI response is about these images
        isCosting: !!parsed.costing,
        costingData: parsed,
        timestamp: new Date(),
      });

      await chatHistory.save();

      // Return unified payload for the frontend
      return res.status(200).json({
        success: true,
        imageUpload: imageAttached, // Requested flag
        data: {
          ...parsed,
          imageUrls: b2ImageUrls, // Return B2 links for UI gallery
        },
      });
    } catch (error) {
      console.error("🔥 Server Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);
/* ───────────────────────────────
   DELETE /chat/:userId
──────────────────────────────── */
router.delete("/chats/:userId", verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    if (req.user._id.toString() !== userId && !req.user.isAdmin) {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }
    await AIChat.deleteOne({ user: userId });
    return res
      .status(200)
      .json({ success: true, message: "Chat history cleared successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to delete chat" });
  }
});

/* ───────────────────────────────
   GET /chat/history
──────────────────────────────── */
router.get("/chat/history", verifyToken, async (req, res) => {
  try {
    console.warn(req.user._id, "req.user._id");
    const chat = await AIChat.findOne({ user: req.user._id }).lean();
    if (!chat) return res.status(200).json({ success: true, messages: [] });
    return res.status(200).json({
      success: true,
      messages: chat.messages,
      updatedAt: chat.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch history" });
  }
});

module.exports = router;
