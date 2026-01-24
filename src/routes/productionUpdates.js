const express = require("express");
const router = express.Router();
const multer = require("multer");
const ProductionUpdate = require("../models/ProductionUpdate");
const ProductionOrder = require("../models/ProductionOrder");
const Notification = require("../models/Notification"); // 👈 Added for schema storage
const { uploadToBackblaze } = require("../utils/uploadToBackblaze");
const verifyToken = require("../utils/verifyToken");
const notifyUser = require("../utils/notifyUser");
const mongoose = require("mongoose");

const upload = multer({ storage: multer.memoryStorage() });


router.post(
  "/upload-progress/:orderId",
  verifyToken,
  upload.single("image"),
  async (req, res) => {
    console.log(
      `[ADMIN] Upload Progress triggered for Order: ${req.params.orderId}`
    );
    try {
      const { title, text, adminName } = req.body;
      let imageUrl = null;

      if (req.file) {
        console.log(
          `[Upload] Image detected: ${req.file.originalname}. Uploading to Backblaze...`
        );
        imageUrl = await uploadToBackblaze(
          req.file.buffer,
          req.file.originalname,
          "progress"
        );
        console.log("[Upload] Success. Image URL:", imageUrl);
      }

      console.log("[DB] Creating ProductionUpdate record...");
      const newUpdate = await ProductionUpdate.create({
        orderId: req.params.orderId,
        title,
        text,
        adminName: adminName || "Senior Craftsman",
        image: imageUrl,
      });

      console.log("[DB] Finding Order to identify customer...");
      const order = await ProductionOrder.findById(req.params.orderId);

      if (order) {
        console.log(
          `[Notification] Creating history record for user: ${order.user}`
        );
        // 💾 Store in Notification Schema
        await Notification.create({
          user: order.user,
          title: "New Workshop Update!",
          description: `Progress update on your order: "${title}". View the latest photos in the app.`,
          orderId: order._id,
          type: "PRODUCTION_UPDATE",
          metadata: { updateId: newUpdate._id, image: imageUrl },
        });

        // 🚀 Trigger Real-time Notification
        console.log("[Notification] Sending real-time push/socket alert...");
        await notifyUser({
          userId: order.user,
          title: "New Workshop Update!",
          description: `Progress update on your order: "${title}". View the latest photos in the app.`,
          orderId: order._id,
          type: "PRODUCTION_UPDATE",
        });
      } else {
        console.warn("[Notification] Order not found. Notification skipped.");
      }

      console.log("[Route] Upload Progress completed successfully.");
      res.status(201).json({ success: true, data: newUpdate });
    } catch (error) {
      console.error("[FATAL ERROR] Upload Progress:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 2. USER: Get all updates for a specific order
router.get("/:orderId", verifyToken, async (req, res) => {
  console.log(
    `[GET] Fetching workshop updates for order: ${req.params.orderId}`
  );
  try {
    let updates = await ProductionUpdate.find({
      orderId: req.params.orderId,
    }).sort({ createdAt: -1 });

    console.log(`[GET] Found ${updates.length} updates.`);
    res.json({ success: true, data: updates });
  } catch (error) {
    console.error("[GET] Error fetching updates:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3. USER: Like / Unlike an update
router.post("/:updateId/like", verifyToken, async (req, res) => {
  console.log(
    `[POST] Like toggle for Update ID: ${req.params.updateId} by User: ${req.user._id}`
  );
  try {
    const { updateId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(updateId)) {
      console.warn("[Like] Invalid ID - sample update detected.");
      return res.status(400).json({
        error: "Actions are disabled for sample updates.",
      });
    }

    const update = await ProductionUpdate.findById(updateId);
    if (!update) {
      console.error("[Like] Update not found in DB.");
      return res.status(404).json({ error: "Update not found" });
    }

    const userId = req.user._id;
    const isLiked = update.likes.includes(userId);

    if (isLiked) {
      console.log("[Like] User already liked. Removing like (Unlike).");
      update.likes = update.likes.filter(
        (id) => id.toString() !== userId.toString()
      );
    } else {
      console.log("[Like] Adding like to array...");
      update.likes.push(userId);

      // 💾 Store in Notification Schema
      console.log("[Notification] Storing interaction in history...");
      await Notification.create({
        user: userId,
        title: "Update Liked",
        description: `You liked the workshop update: "${update.title}"`,
        orderId: update.orderId,
        type: "INTERACTION",
        metadata: { updateId: update._id },
      });

      // 🚀 Trigger Real-time Notification
      await notifyUser({
        userId: userId,
        title: "Update Liked",
        description: `You liked the workshop update: "${update.title}"`,
        orderId: update.orderId,
        type: "INTERACTION",
      });
    }

    console.log("[DB] Saving like changes...");
    await update.save();
    res.json({
      success: true,
      likesCount: update.likes.length,
      isLiked: !isLiked,
    });
  } catch (error) {
    console.error("[Like] Fatal error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 4. USER: Comment on an update
router.post("/:updateId/comment", verifyToken, async (req, res) => {
  console.log(`[POST] Commenting on Update ID: ${req.params.updateId}`);
  try {
    const { updateId } = req.params;
    const { text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(updateId)) {
      console.warn("[Comment] Invalid ID - sample update detected.");
      return res.status(400).json({
        error: "Commenting is disabled for sample updates.",
      });
    }

    const update = await ProductionUpdate.findById(updateId);
    if (!update) {
      console.error("[Comment] Update not found.");
      return res.status(404).json({ error: "Update not found" });
    }

    console.log(
      `[DB] Pushing comment by ${req.user.firstName || "Customer"}...`
    );
    update.comments.push({
      user: req.user._id,
      userName: req.user.firstName || "Customer",
      text,
    });

    console.log("[DB] Saving comment...");
    await update.save();

    // 💾 Store in Notification Schema
    console.log("[Notification] Recording comment in history...");
    await Notification.create({
      user: req.user._id,
      title: "Comment Posted",
      description: `Your comment has been added to the production timeline.`,
      orderId: update.orderId,
      type: "COMMENT_ADDED",
      metadata: { text, updateId: update._id },
    });

    // 🚀 Trigger Real-time Notification
    await notifyUser({
      userId: req.user._id,
      title: "Comment Posted",
      description: `Your comment has been added to the production timeline.`,
      orderId: update.orderId,
      type: "COMMENT_ADDED",
    });

    console.log("[Comment] Process completed.");
    res.json({ success: true, data: update.comments });
  } catch (error) {
    console.error("[Comment] Fatal error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
