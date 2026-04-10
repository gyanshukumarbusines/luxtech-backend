const express  = require("express");
const { pool } = require("../config/db");
const { protect, adminOnly } = require("../middleware/auth");

const router = express.Router();

// ── GET /api/products ─────────────────────────────────────────────
// Query params: category, minPrice, maxPrice, minRating, sort, page, limit, search
router.get("/", async (req, res) => {
  try {
    const { category, minPrice, maxPrice, minRating, sort, page=1, limit=12, search, featured, isNew } = req.query;
    let where = ["1=1"];
    let params = [];

    if (search) {
      where.push("(p.name LIKE ? OR p.description LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category) {
      where.push("c.name = ?");
      params.push(category);
    }
    if (minPrice) { where.push("p.price >= ?"); params.push(minPrice); }
    if (maxPrice) { where.push("p.price <= ?"); params.push(maxPrice); }
    if (minRating) { where.push("p.rating >= ?"); params.push(minRating); }
    if (featured === "true") { where.push("p.is_featured = 1"); }
    if (isNew === "true") { where.push("p.is_new = 1"); }

    let orderBy = "p.created_at DESC";
    if (sort === "low")    orderBy = "p.price ASC";
    if (sort === "high")   orderBy = "p.price DESC";
    if (sort === "rating") orderBy = "p.rating DESC";

    const offset = (page - 1) * limit;

    const [products] = await pool.query(
      `SELECT p.*, c.name AS category FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE ${where.join(" AND ")}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [...params, +limit, +offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE ${where.join(" AND ")}`,
      params
    );

    res.json({ success: true, products, total, page: +page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/products/:id ─────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, c.name AS category FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Product not found" });

    // Get reviews
    const [reviews] = await pool.query(
      "SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC",
      [req.params.id]
    );

    res.json({ success: true, product: { ...rows[0], reviews } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/products ── Admin only ──────────────────────────────
router.post("/", protect, adminOnly, async (req, res) => {
  try {
    const { name, description, price, orig_price, category_id, stock, badge, image, is_featured, is_new } = req.body;
    if (!name || !price) return res.status(400).json({ success: false, message: "Name and price required" });

    const [result] = await pool.query(
      `INSERT INTO products (name, description, price, orig_price, category_id, stock, badge, image, is_featured, is_new)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description, price, orig_price, category_id, stock||0, badge, image, is_featured||0, is_new||0]
    );
    res.status(201).json({ success: true, message: "Product created!", id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/products/:id ── Admin only ───────────────────────────
router.put("/:id", protect, adminOnly, async (req, res) => {
  try {
    const { name, description, price, orig_price, category_id, stock, badge, image, is_featured, is_new } = req.body;
    await pool.query(
      `UPDATE products SET name=?, description=?, price=?, orig_price=?, category_id=?,
       stock=?, badge=?, image=?, is_featured=?, is_new=? WHERE id=?`,
      [name, description, price, orig_price, category_id, stock, badge, image, is_featured, is_new, req.params.id]
    );
    res.json({ success: true, message: "Product updated!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/products/:id ── Admin only ────────────────────────
router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    await pool.query("DELETE FROM products WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "Product deleted!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/products/:id/reviews ────────────────────────────────
router.post("/:id/reviews", protect, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5)
      return res.status(400).json({ success: false, message: "Rating must be 1–5" });

    await pool.query(
      "INSERT INTO reviews (product_id, user_id, user_name, rating, comment) VALUES (?, ?, ?, ?, ?)",
      [req.params.id, req.user.id, req.user.name, rating, comment]
    );

    // Update product avg rating
    await pool.query(
      `UPDATE products SET
        rating = (SELECT AVG(rating) FROM reviews WHERE product_id = ?),
        review_count = (SELECT COUNT(*) FROM reviews WHERE product_id = ?)
       WHERE id = ?`,
      [req.params.id, req.params.id, req.params.id]
    );

    res.status(201).json({ success: true, message: "Review added!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
