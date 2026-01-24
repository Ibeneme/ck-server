const mongoose = require("mongoose");

const ProductionItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceNGN: { type: Number, required: true, min: 0 },
    subtotalNGN: { type: Number, required: true, min: 0 },
    selectedColor: { type: String, default: "Default" },
  },
  { _id: false }
);

const ProductionOrderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    deliveryAddress: { type: String, required: true },

    // 🔽 Images
    originalImageUri: { type: String },
    imageUrls: [{ type: String }], // 👈 array of image URLs

    orderDate: { type: Date, default: Date.now },

    items: { type: [ProductionItemSchema], required: true },
    totalCostNGN: { type: Number, required: true, min: 0 },
    duration: { type: String },

    status: {
      type: String,
      enum: [
        "pending",
        "in_progress",
        "completed",
        "delivered",
        "dispatched",
        "cancelled",
      ],
      default: "pending",
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "partial", "failed"],
      default: "pending",
    },

    explanation: { type: String },
    currency: { type: String, default: "NGN" },

    // ───── INSTALLMENT FIELDS ─────
    isInstalment: { type: Boolean, default: false },
    amountPaid: { type: Number, default: 0 },
    balanceRemaining: { type: Number, default: 0 },
    isInstalmentPaid: { type: Boolean, default: false },
    isFullPaid: { type: Boolean, default: false },
    paymentReference: { type: String },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProductionOrder", ProductionOrderSchema);
