const mongoose = require("mongoose");

// --- Schema 1: The Application (InteriorDesignerSubmission) ---
const InteriorDesignerSubmissionSchema = new mongoose.Schema({
  // Section: Brand Identity
  brandIdentity: {
    contactName: { type: String, required: true },
    brandName: { type: String, required: true },
    isRegistered: { type: Boolean, default: false },
    registrationNumber: { type: String },
    logoUrl: { type: String }, // Provided by Multer/Cloudinary logic
  },

  // Section: Communication & Support
  contact: {
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String, required: true },
    assistant: {
      name: { type: String },
      phone: { type: String },
      email: { type: String, lowercase: true },
    },
  },

  // Section: Physical Presence & Logistics
  logistics: {
    hasPhysicalOffice: { type: Boolean, default: false },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String, default: "Nigeria" },
    operatingCity: { type: String, required: true }, // "Where do you mostly work?"
  },


  onlinePresence: {
    portfolioUrl: { type: String },
    instagram: { type: String, required: true },
    linkedin: { type: String },
  },

  professionalMetrics: {
    experienceYears: { type: String, enum: ["0–2", "3–5", "6–10", "10+"] },
    budgetRange: { type: String },
    projectVolume: { type: String, enum: ["1–2", "3–5", "6–10", "10+"] },
  },

  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  appliedAt: { type: Date, default: Date.now },
});


const InteriorDesignerUserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    brandName: { type: String },
    logoUrl: { type: String },
    contactName: { type: String },
    role: { type: String, default: "INTERIOR_DESIGNER" },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

const Submission = mongoose.model(
  "InteriorDesignerSubmission",
  InteriorDesignerSubmissionSchema
);
const DesignerUser = mongoose.model(
  "InteriorDesignerUser",
  InteriorDesignerUserSchema
);

module.exports = { Submission, DesignerUser };
