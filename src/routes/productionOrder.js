const express = require("express");
const verifyToken = require("../utils/verifyToken");
const ProductionOrder = require("../models/ProductionOrder");
const Notification = require("../models/Notification"); // Added Notification Model
const notifyUser = require("../utils/notifyUser");
const router = express.Router();

/* ───────────────────────────────
   POST /production-order
──────────────────────────────── */
router.post("/", verifyToken, async (req, res) => {
  console.log(
    "[POST /production-order] Incoming Request Body:",
    JSON.stringify(req.body, null, 2)
  );

  try {
    const {
      deliveryAddress,
      items,
      totalCostNGN,
      duration,
      explanation,
      imageUrls, // ✅ multiple images
      isInstalment,
    } = req.body;

    const user = req.user;
    console.log("[POST /production-order] Authenticated User ID:", user._id);

    /* ───────── BASIC VALIDATIONS ───────── */

    if (!deliveryAddress || typeof deliveryAddress !== "string") {
      return res.status(400).json({
        success: false,
        error: "Delivery address is required.",
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: "At least one item is required.",
      });
    }

    if (!totalCostNGN || totalCostNGN <= 0) {
      return res.status(400).json({
        success: false,
        error: "Total cost must be a positive number.",
      });
    }

    /* ───────── IMAGE VALIDATION ───────── */

    let validatedImages = [];

    if (imageUrls !== undefined) {
      if (!Array.isArray(imageUrls)) {
        return res.status(400).json({
          success: false,
          error: "imageUrls must be an array of strings.",
        });
      }

      // Remove non-strings & empty values
      validatedImages = imageUrls
        .filter((url) => typeof url === "string" && url.trim() !== "")
        .slice(0, 5);
    }

    /* ───────── CREATE ORDER ───────── */

    console.log("[POST /production-order] Creating record in DB...");

    const newOrder = await ProductionOrder.create({
      user: user._id,
      deliveryAddress,
      items,
      totalCostNGN,
      duration: duration || "N/A",
      explanation: explanation || "CloneKraft AI estimated pricing",

      imageUrls: validatedImages,

      status: "pending",
      paymentStatus: "pending",
      isInstalment: !!isInstalment,
      amountPaid: 0,
      balanceRemaining: totalCostNGN,
      isInstalmentPaid: false,
      isFullPaid: false,
    });

    console.log("[POST /production-order] Order Created:", newOrder._id);

    /* ───────── NOTIFICATION ───────── */

    await Notification.create({
      user: user._id,
      title: "Order Placed! 📦",
      description: `We've received your request for ${items.length} item(s).`,
      orderId: newOrder._id,
      type: "ORDER_PLACED",
    });

    await notifyUser({
      userId: user._id,
      title: "Order Placed! 📦",
      description: `We've received your request for ${items.length} item(s).`,
      orderId: newOrder._id,
      type: "ORDER_PLACED",
    });

    return res.status(201).json({
      success: true,
      message: "Production order created successfully",
      data: newOrder,
    });
  } catch (error) {
    console.error("[POST /production-order] FATAL ERROR:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create production order",
    });
  }
});

/* ───────────────────────────────
   GET /production-order
──────────────────────────────── */
router.get("/", verifyToken, async (req, res) => {
  console.log(
    "[GET /production-order] Fetching all orders for user:",
    req.user._id
  );
  try {
    const orders = await ProductionOrder.find({ user: req.user._id }).sort({
      createdAt: -1,
    });
    console.log(`[GET /production-order] Found ${orders.length} orders.`);
    return res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error("[GET /production-order] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch production orders",
    });
  }
});

/* ───────────────────────────────
   GET /production-order/:id
──────────────────────────────── */
router.get("/:id", verifyToken, async (req, res) => {
  console.log("[GET /production-order/:id] Param ID:", req.params.id);
  try {
    const order = await ProductionOrder.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!order) {
      console.warn("[GET /:id] Order not found for this user.");
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    console.log("[GET /:id] Order data found.");
    return res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error("[GET /:id] Error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch order" });
  }
});

/* ───────────────────────────────
   PUT /production-order/:id
──────────────────────────────── */
router.put("/:id", verifyToken, async (req, res) => {
  console.log(`[PUT /:id] Update request for ID: ${req.params.id}`);
  try {
    const user = req.user;
    const updateData = req.body;

    const oldOrder = await ProductionOrder.findOne({
      _id: req.params.id,
      user: user._id,
    });

    if (!oldOrder) {
      console.warn("[PUT /:id] Order not found.");
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    console.log(
      "[PUT /:id] Current Status:",
      oldOrder.status,
      "-> Requested Status:",
      updateData.status
    );

    const updatedOrder = await ProductionOrder.findOneAndUpdate(
      { _id: req.params.id, user: user._id },
      { $set: updateData },
      { new: true }
    );

    // 🚀 NOTIFICATION LOGIC
    if (updateData.status && updateData.status !== oldOrder.status) {
      console.log(
        "[PUT /:id] Status change detected. Processing notification..."
      );

      let statusMsg = `Your order status has been updated to: ${updatedOrder.status}.`;
      if (updatedOrder.status === "shipped")
        statusMsg =
          "Great news! Your items have been shipped and are on the way.";
      if (updatedOrder.status === "completed")
        statusMsg =
          "Production complete! We hope you love your CloneKraft masterpiece.";

      // Save to Notification DB
      await Notification.create({
        user: user._id,
        title: "Order Status Update 🔄",
        description: statusMsg,
        orderId: updatedOrder._id,
        type: "ORDER_UPDATE",
      });

      // Send Real-time notification
      await notifyUser({
        userId: user._id,
        title: "Order Status Update 🔄",
        description: statusMsg,
        orderId: updatedOrder._id,
        type: "ORDER_UPDATE",
      });
      console.log("[PUT /:id] Notification sent successfully.");
    }

    return res.status(200).json({
      success: true,
      message: "Production order updated successfully",
      data: updatedOrder,
    });
  } catch (error) {
    console.error("[PUT /:id] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to update production order",
    });
  }
});

module.exports = router;
