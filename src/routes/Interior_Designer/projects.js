const express = require("express");
const router = express.Router();
const multer = require("multer");
const InteriorDecoratorProject = require("../../models/Interior_Designer/InteriorDecoratorProject");
const { uploadToBackblaze } = require("../../utils/uploadToBackblaze");

const upload = multer({ storage: multer.memoryStorage() });

router.get("/history/:designerId", async (req, res) => {
  try {
    const projects = await InteriorDecoratorProject.find({
      designerId: req.params.designerId,
    }).sort({ createdAt: -1 });

    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/detail/:projectId", async (req, res) => {
  try {
    const project = await InteriorDecoratorProject.findById(
      req.params.projectId
    );
    if (!project)
      return res.status(404).json({ message: "Project record not found." });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/add", upload.array("referenceImages", 10), async (req, res) => {
  console.log("🔹 HIT /add project route");

  try {
    console.log("📦 req.body:", req.body);
    console.log("🖼️ req.files:", req.files);

    const {
      designerId,
      projectName,
      projectType,
      deliveryCity,
      finalSpecifications,
    } = req.body;

    console.log("🧩 Parsed fields:", {
      designerId,
      projectName,
      projectType,
      deliveryCity,
      finalSpecifications,
    });

    const referenceUrls = [];

    if (req.files && req.files.length > 0) {
      console.log(`📸 Uploading ${req.files.length} reference images...`);

      for (const [index, file] of req.files.entries()) {
        console.log(`⬆️ Uploading file ${index + 1}:`, {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        });

        const url = await uploadToBackblaze(
          file.buffer,
          file.originalname,
          "reference-designs"
        );

        console.log(`✅ Uploaded file ${index + 1} URL:`, url);
        referenceUrls.push(url);
      }
    } else {
      console.log("⚠️ No reference images uploaded");
    }

    console.log("🖼️ Final reference image URLs:", referenceUrls);

    const newProject = new InteriorDecoratorProject({
      designerId,
      projectName,
      projectType,
      deliveryCity,
      finalSpecifications,
      referenceImages: referenceUrls,
    });

    console.log("🧱 New project object (before save):", newProject);

    await newProject.save();

    console.log("💾 Project saved successfully:", newProject);

    res.status(201).json(newProject);
  } catch (err) {
    console.error("🔥 ERROR creating project:", err);
    res.status(500).json({ error: err.message });
  }
});
router.put("/edit/:projectId", async (req, res) => {
  try {
    const updatedProject = await InteriorDecoratorProject.findByIdAndUpdate(
      req.params.projectId,
      { $set: req.body },
      { new: true }
    );
    res.json(updatedProject);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  "/:projectId/upload-vault",
  upload.fields([
    { name: "photos", maxCount: 20 },
    { name: "videos", maxCount: 5 },
  ]),
  async (req, res) => {
    try {
      const project = await InteriorDecoratorProject.findById(
        req.params.projectId
      );
      if (!project)
        return res.status(404).json({ message: "Project not found" });

      // Handle Professional Product Photos
      if (req.files["photos"]) {
        for (const file of req.files["photos"]) {
          const url = await uploadToBackblaze(
            file.buffer,
            file.originalname,
            `vault/${project.projectId}/photos`
          );
          project.assetVault.productPhotos.push(url);
        }
      }

      // Handle Branded Production Videos
      if (req.files["videos"]) {
        for (const file of req.files["videos"]) {
          const url = await uploadToBackblaze(
            file.buffer,
            file.originalname,
            `vault/${project.projectId}/videos`
          );
          project.assetVault.productionVideos.push(url);
        }
      }

      await project.save();
      res.json({ success: true, assetVault: project.assetVault });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * 6. DELETE PROJECT
 * DELETE: Remove project history record
 */
router.delete("/delete/:projectId", async (req, res) => {
  try {
    await InteriorDecoratorProject.findByIdAndDelete(req.params.projectId);
    res.json({ success: true, message: "Project history record deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
