const express = require("express");
const { pool } = require("../config/db");
const { protect, adminOnly } = require("../middleware/auth");

const router = express.Router();

router.get("/low-stock", protect, adminOnly, async (req, res) => {
  try {
    const [lowStockProducts] = await pool.query(
      "SELECT id, name, stock FROM products WHERE stock < 10 ORDER BY stock ASC"
    );

    if (lowStockProducts.length === 0) {
      return res.json({
        success: true,
        message: "✅ All products have sufficient stock!",
        lowStockProducts: [],
      });
    }

    res.json({
      success: true,
      message: `⚠️ ${lowStockProducts.length} product(s) have low stock!`,
      lowStockProducts,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
