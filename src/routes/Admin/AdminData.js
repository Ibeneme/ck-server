const router = require("express").Router();
const Waitlist = require("../../models/Waitlist");
const { Supplier, Driver } = require("../../models/Partners/Partners");
const { Submission } = require("../../models/Interior_Designer/DesignerUser");
const Carpenter = require("../../models/Carpenters/Carpenter");
const User = require("../../models/User");
const ProductionOrder = require("../../models/ProductionOrder");
const Payment = require("../../models/Payment");
const InteriorDecoratorProject = require("../../models/Interior_Designer/InteriorDecoratorProject");
const { Mongoose } = require("mongoose");
const ProductionUpdate = require("../../models/ProductionUpdate");
const ProductionOrderProgress = require("../../models/ProductionOrderProgress");

// --- 1. FETCH ALL DATA & COUNTS ---
router.get("/all-data", async (req, res) => {
  console.log("🚀 [Admin Dashboard]: Fetching all data and counts...");
  try {
    const [
      waitlist,
      carpenters,
      designers,
      suppliers,
      drivers,
      users,
      orders,
      payments,
      designerProjects,
    ] = await Promise.all([
      Waitlist.find().sort({ joinedAt: -1 }),
      Carpenter.find().sort({ createdAt: -1 }),
      Submission.find().sort({ appliedAt: -1 }),
      Supplier.find().sort({ createdAt: -1 }),
      Driver.find().sort({ createdAt: -1 }),
      User.find().sort({ createdAt: -1 }),
      ProductionOrder.find()
        .populate("user", "firstName lastName email")
        .sort({ createdAt: -1 }),
      Payment.find()
        .populate("user", "firstName lastName")
        .sort({ createdAt: -1 }),
      InteriorDecoratorProject.find()
        .select(
          "designerId projectId projectName projectType deliveryStatus createdAt"
        )
        .sort({ createdAt: -1 }),
    ]);

    console.log("✅ [Admin Dashboard]: Successfully retrieved data.");
    console.log(`📊 Stats Summary: 
      - Waitlist: ${waitlist.length}
      - Carpenters: ${carpenters.length}
      - Designers: ${designers.length}
      - Orders: ${orders.length}
      - Projects: ${designerProjects.length}`);

    res.status(200).json({
      success: true,
      counts: {
        waitlist: waitlist.length,
        carpenters: carpenters.length,
        designers: designers.length,
        suppliers: suppliers.length,
        drivers: drivers.length,
        users: users.length,
        orders: orders.length,
        payments: payments.length,
        designerProjects: designerProjects.length,
      },
      data: {
        waitlist,
        carpenters,
        designers,
        suppliers,
        drivers,
        users,
        orders,
        payments,
        designerProjects,
      },
    });
  } catch (err) {
    console.error("🔥 [Admin Dashboard Error]:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- 2. DYNAMIC FETCH BY ID ---
router.get("/fetch/:collection/:id", async (req, res) => {
  const { collection, id } = req.params;

  const models = {
    waitlist: Waitlist,
    carpenters: Carpenter,
    designers: Submission,
    suppliers: Supplier,
    drivers: Driver,
    users: User,
    orders: ProductionOrder,
    payments: Payment,
    designerProjects: InteriorDecoratorProject,
  };

  try {
    const Model = models[collection];
    if (!Model) {
      return res.status(404).json({
        success: false,
        message: "Invalid collection",
      });
    }

    let query = Model.findById(id);

    // ─── POPULATION LOGIC ───
    if (["payments"].includes(collection)) {
      query = query.populate("user").populate("orderId");
    }

    if (["orders"].includes(collection)) {
      query = query.populate("user");
    }

    if (["designerProjects"].includes(collection)) {
      query = query.populate("designerId");
    }

    const item = await query.lean();

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    // 🚫 BLOCK UNVERIFIED USERS
    if (collection === "users" && item.verified === false) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ─── ATTACH PRODUCTION UPDATES ───
    const targetOrderId =
      collection === "orders" ? item._id : item.orderId?._id;

    if (targetOrderId) {
      const [progress, socialUpdates] = await Promise.all([
        ProductionOrderProgress.findOne({ order: targetOrderId }),
        ProductionUpdate.find({ orderId: targetOrderId }).sort({
          createdAt: -1,
        }),
      ]);

      item.productionProgress = progress;
      item.socialUpdates = socialUpdates;
    }

    return res.status(200).json({
      success: true,
      data: item,
    });
  } catch (err) {
    console.error("🔥 [Fetch Error]:", err.message);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// --- 3. CATEGORY SPECIFIC COUNTS ---
router.get("/counts", async (req, res) => {
  console.log("🔢 [Admin Dashboard]: Calculating category counts...");
  try {
    const counts = {
      waitlist: await Waitlist.countDocuments(),
      carpenters: await Carpenter.countDocuments(),
      activeDesignerProjects: await InteriorDecoratorProject.countDocuments({
        deliveryStatus: { $ne: "delivered" },
      }),
      orders: await ProductionOrder.countDocuments({ status: "pending" }),
    };

    console.log("📉 [Admin Dashboard]: Counts calculated successfully.");
    res.status(200).json({ success: true, counts });
  } catch (err) {
    console.error("🔥 [Admin Counts Error]:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
