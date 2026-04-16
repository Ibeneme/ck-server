const mongoose = require("mongoose");

const ProductionItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    images: [{ type: String }], // Array of S3/Cloudinary URLs
    videoUri: { type: String, default: null },
    description: { type: String, },
    duration: { type: String, default: "3 Weeks" },
    links: [{ type: String }], // Lowercase URLs
    quantity: {
      type: Number,
      default: 1,
      min: [1, "Quantity cannot be less than 1"],
      required: true,
    },
  },
  { _id: false }
);

const ProductionOrderSchema = new mongoose.Schema(
  {
    assignedCarpenters: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Carpenter",
      },
    ],

    assignedDrivers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Driver",
      },
    ],
    assignedSuppliers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Supplier",
      },
    ],
    assignedDesigners: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "InteriorDesigner",
      },
    ],
    orderId: {
      type: String,
      unique: true,
      sparse: true, // Allows nulls for existing records until updated
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    deliveryAddress: { type: String, required: true },
    BespokeOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BespokeOrder",
      // required: true,
    },

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
