const express  = require("express");
const { pool } = require("../config/db");
const { protect } = require("../middleware/auth");

const router = express.Router();

// ── GET /api/wishlist ─────────────────────────────────────────────
router.get("/", protect, async (req, res) => {
  try {
    const [items] = await pool.query(
      `SELECT p.*, c.name AS category FROM wishlist w
       JOIN products p ON w.product_id = p.id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE w.user_id = ?`,
      [req.user.id]
    );
    res.json({ success: true, wishlist: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/wishlist/:productId ─────────────────────────────────
router.post("/:productId", protect, async (req, res) => {
  try {
    const [exists] = await pool.query(
      "SELECT id FROM wishlist WHERE user_id=? AND product_id=?",
      [req.user.id, req.params.productId]
    );
    if (exists.length) {
      await pool.query("DELETE FROM wishlist WHERE user_id=? AND product_id=?", [req.user.id, req.params.productId]);
      return res.json({ success: true, message: "Removed from wishlist", action: "removed" });
    }
    await pool.query("INSERT INTO wishlist (user_id, product_id) VALUES (?,?)", [req.user.id, req.params.productId]);
    res.json({ success: true, message: "Added to wishlist ♥", action: "added" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/coupons/validate ────────────────────────────────────
router.post("/validate-coupon", async (req, res) => {
  try {
    const { code } = req.body;
    const [rows] = await pool.query(
      "SELECT * FROM coupons WHERE code=? AND active=1 AND (expires_at IS NULL OR expires_at > NOW())",
      [code?.toUpperCase()]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Invalid or expired coupon" });
    res.json({ success: true, coupon: { code: rows[0].code, discount: rows[0].discount, label: `${rows[0].discount}% Off` } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
