const express  = require("express");
const { pool } = require("../config/db");
const { protect } = require("../middleware/auth");

const router = express.Router();

// ── GET /api/reviews/:productId ───────────────────────────────────
router.get("/:productId", async (req, res) => {
  try {
    const [reviews] = await pool.query(
      `SELECT r.*, u.name AS user_name
       FROM reviews r LEFT JOIN users u ON r.user_id = u.id
       WHERE r.product_id=? ORDER BY r.created_at DESC`,
      [req.params.productId]
    );
    // Get avg rating
    const [[{ avg, total }]] = await pool.query(
      "SELECT AVG(rating) AS avg, COUNT(*) AS total FROM reviews WHERE product_id=?",
      [req.params.productId]
    );
    res.json({ success: true, reviews, avg: avg ? Number(avg).toFixed(1) : 0, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/reviews/:productId ──────────────────────────────────
router.post("/:productId", protect, async (req, res) => {
  try {
    const { rating, comment, title } = req.body;

    // Validate
    if (!rating || rating < 1 || rating > 5)
      return res.status(400).json({ success: false, message: "Rating must be 1-5 stars" });
    if (!comment || comment.trim().length < 10)
      return res.status(400).json({ success: false, message: "Review must be at least 10 characters" });

    // Check if user already reviewed this product
    const [existing] = await pool.query(
      "SELECT id FROM reviews WHERE product_id=? AND user_id=?",
      [req.params.productId, req.user.id]
    );
    if (existing.length)
      return res.status(400).json({ success: false, message: "You already reviewed this product!" });

    // Check if user purchased this product (optional but good practice)
    // We'll allow all logged-in users to review

    // Insert review
    await pool.query(
      "INSERT INTO reviews (product_id, user_id, user_name, rating, comment) VALUES (?,?,?,?,?)",
      [req.params.productId, req.user.id, req.user.name, rating, comment.trim()]
    );

    // Update product avg rating & count
    await pool.query(
      `UPDATE products SET
        rating = (SELECT ROUND(AVG(rating),1) FROM reviews WHERE product_id=?),
        review_count = (SELECT COUNT(*) FROM reviews WHERE product_id=?)
       WHERE id=?`,
      [req.params.productId, req.params.productId, req.params.productId]
    );

    res.status(201).json({ success: true, message: "Review submitted successfully! ✦" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/reviews/:id ── Owner or Admin ─────────────────────
router.delete("/:id", protect, async (req, res) => {
  try {
    const [reviews] = await pool.query("SELECT * FROM reviews WHERE id=?", [req.params.id]);
    if (!reviews.length)
      return res.status(404).json({ success: false, message: "Review not found" });

    if (reviews[0].user_id !== req.user.id && req.user.role !== "admin")
      return res.status(403).json({ success: false, message: "Not authorized" });

    await pool.query("DELETE FROM reviews WHERE id=?", [req.params.id]);

    // Update product rating
    await pool.query(
      `UPDATE products SET
        rating = COALESCE((SELECT ROUND(AVG(rating),1) FROM reviews WHERE product_id=?), 0),
        review_count = (SELECT COUNT(*) FROM reviews WHERE product_id=?)
       WHERE id=?`,
      [reviews[0].product_id, reviews[0].product_id, reviews[0].product_id]
    );

    res.json({ success: true, message: "Review deleted!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
