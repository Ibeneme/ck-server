const mongoose = require("mongoose");

const BespokeItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  images: [{ type: String }], // Array of S3/Cloudinary URLs
  videoUri: { type: String, default: null },
  description: { type: String, required: true },
  duration: { type: String, default: "3 Weeks" },
  links: [{ type: String }], // Lowercase URLs
  quantity: { 
    type: Number, 
    default: 1, 
    min: [1, 'Quantity cannot be less than 1'],
    required: true 
  }
});
const BespokeOrderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  items: [BespokeItemSchema],
  deliveryMode: {
    type: String,
    enum: ["BUNDLE", "INDIVIDUAL"],
    default: "BUNDLE",
  },
  bundleTimeline: { type: String },

  // Status Management
  status: {
    type: String,
    enum: ["pending", "priced", ],
    default: "pending",
  },

  // Admin Controls
  adminPanel: {
    feedback: { type: String, default: "" },
    estimatedCost: { type: Number, default: 0 },
    currency: { type: String, default: "USD" },
    internalNotes: { type: String, default: "" },
    reviewedAt: { type: Date },
  },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("BespokeOrder", BespokeOrderSchema);
