const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userName: { type: String, required: true }, // Cached for quick display
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const ProductionUpdateSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductionOrder",
      required: true,
      index: true,
    },
    adminName: { type: String, required: true, default: "Workshop Lead" },
    title: { type: String, required: true },
    text: { type: String, required: true },
    image: { type: String }, // The Backblaze URL

    // Social features
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [CommentSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProductionUpdate", ProductionUpdateSchema);
