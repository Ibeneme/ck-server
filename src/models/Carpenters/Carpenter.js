const mongoose = require("mongoose");

const CarpenterSchema = new mongoose.Schema({
  // Identification
  carpenterId: {
    type: String,
    unique: true,
    default: () => `CRP-${Math.floor(1000 + Math.random() * 9000)}`,
  },
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  whatsappNumber: { type: String, required: true },

  // Location
  location: {
    area: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, default: "Nigeria" },
  },

  // Professional Profile
  expertise: [
    {
      type: String,
      enum: [
        "Upholstery",
        "Cabinet Making",
        "Woodworking (Solid wood)",
        "MDF / Board work",
        "Finishing / Polishing",
      ],
    },
  ],
  experienceYears: {
    type: String,
    enum: ["0-2", "3-5", "6-10", "10+"],
  },
  portfolioPhotos: [{ type: String }], // URLs to Backblaze
  availableForHubWork: { type: Boolean, default: false },

  // Access Control Logic
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  isWhitelisted: { type: Boolean, default: false },
  lastLogin: Date,

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Carpenter", CarpenterSchema);
