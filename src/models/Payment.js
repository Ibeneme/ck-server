const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductionOrder",
      required: true,
    },
    amountPaidNGN: {
      type: Number,
      required: true,
    },
    isInstalment: {
      type: Boolean,
      default: false,
    },
    remainingBalanceNGN: {
      type: Number,
      default: 0,
    },
    paymentReference: {
      type: String,
      required: true,
      unique: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "partial", "paid", "failed"],
      default: "pending",
    },
    // To store the full response from Paystack after verification
    paymentDetails: {
      type: Object,
      default: {},
    },
    paidAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster lookups during verification
PaymentSchema.index({ paymentReference: 1 });
PaymentSchema.index({ user: 1 });

module.exports = mongoose.model("Payment", PaymentSchema);
