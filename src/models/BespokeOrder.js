const mongoose = require("mongoose");

const MeasurementSchema = new mongoose.Schema({
  label: { type: String, required: true },
  value: { type: String, required: true },
  unit: { type: String, enum: ["ft", "inches"], required: true },
});

const BespokeItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  images: [{ type: String }],
  videoUri: { type: String, default: null },
  description: { type: String, required: true },
  duration: { type: String },
  links: [{ type: String }],
  quantity: { type: Number, default: 1, required: true },
  measurements: [MeasurementSchema],
});

const BespokeOrderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  items: [BespokeItemSchema],
  deliveryMode: {
    type: String,
    enum: ["BUNDLE", "INDIVIDUAL", null], 
    default: "BUNDLE",
  },
  bundleTimeline: { type: String },
  status: {
    type: String,
    enum: ["pending", "priced", "approved", "rejected"],
    default: "pending",
  },
  adminPanel: {
    feedback: { type: String, default: "" },
    estimatedCost: { type: Number, default: 0 },
    currency: { type: String, default: "NGN" },
    internalNotes: { type: String, default: "" },
    reviewedAt: { type: Date },
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("BespokeOrder", BespokeOrderSchema);
