const express = require("express");
const { pool } = require("../config/db");
const { protect, adminOnly } = require("../middleware/auth");

const router = express.Router();

// Low stock check - products with stock < 10
router.get("/low-stock", protect, adminOnly, async (req, res) => {
  try {
    const [products] = await pool.query("SELECT id, name, stock FROM products WHERE stock < 10");
    res.json({ success: true, message: products.length > 0 ? `${products.length} low stock items` : "All stock OK", products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
