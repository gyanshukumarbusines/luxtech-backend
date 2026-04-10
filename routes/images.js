const express  = require("express");
const { pool } = require("../config/db");
const { protect, adminOnly } = require("../middleware/auth");

const router = express.Router();

// ── Create product_images table ───────────────────────────────────
const initProductImages = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_images (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NOT NULL,
      url        VARCHAR(500) NOT NULL,
      label      VARCHAR(50) DEFAULT 'View',
      sort_order INT DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);
};
initProductImages();

// ── GET /api/images/:productId ────────────────────────────────────
router.get("/:productId", async (req, res) => {
  try {
    const [images] = await pool.query(
      "SELECT * FROM product_images WHERE product_id=? ORDER BY sort_order ASC",
      [req.params.productId]
    );
    res.json({ success: true, images });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/images/:productId ── Admin only ─────────────────────
// Add image URL to a product
router.post("/:productId", protect, adminOnly, async (req, res) => {
  try {
    const { url, label, sort_order } = req.body;
    if (!url) return res.status(400).json({ success: false, message: "Image URL required" });

    const [result] = await pool.query(
      "INSERT INTO product_images (product_id, url, label, sort_order) VALUES (?,?,?,?)",
      [req.params.productId, url, label || "View", sort_order || 0]
    );
    res.status(201).json({ success: true, message: "Image added!", id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/images/:id ── Admin only ──────────────────────────
router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    await pool.query("DELETE FROM product_images WHERE id=?", [req.params.id]);
    res.json({ success: true, message: "Image deleted!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
