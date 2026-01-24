const mongoose = require("mongoose");

const InteriorDecoratorProjectSchema = new mongoose.Schema({
  designerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "InteriorDesignerUser",
    required: true,
  },

  projectId: {
    type: String,
    unique: true,
    default: () => `PRJ-${Math.floor(1000 + Math.random() * 9000)}`,
  },
  projectName: { type: String, required: true }, // Internal reference
  projectType: { type: String, required: true }, // e.g., Residential, Commercial
  startDate: { type: Date, default: Date.now },
  completionDate: { type: Date },
  deliveryStatus: {
    type: String,
    enum: ["pending", "in-production", "completed", "delivered"],
    default: "pending",
  },
  deliveryCity: { type: String, required: true },

  // PROJECT DETAIL (CLICK VIEW)
  referenceImages: [{ type: String }], // Array of submitted design URLs
  finalSpecifications: { type: String },
  productionStartDate: { type: Date },
  deliveryConfirmation: [{ type: String }], // Array for delivery proof photos/docs

  assetVault: {
    productPhotos: [{ type: String }], // Array for Professional photos
    productionVideos: [{ type: String }], // Array for Branded videos (unique to designer)
  },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model(
  "InteriorDecoratorProject",
  InteriorDecoratorProjectSchema
);
