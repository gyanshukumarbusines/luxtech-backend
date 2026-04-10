const express  = require("express");
const { pool } = require("../config/db");
const { protect, adminOnly } = require("../middleware/auth");

const router = express.Router();

// ── GET /api/admin/dashboard ──────────────────────────────────────
router.get("/dashboard", protect, adminOnly, async (req, res) => {
  try {
    const [[{ totalRevenue }]] = await pool.query("SELECT SUM(total) AS totalRevenue FROM orders WHERE payment_status='paid'");
    const [[{ totalOrders }]] = await pool.query("SELECT COUNT(*) AS totalOrders FROM orders");
    const [[{ totalProducts }]] = await pool.query("SELECT COUNT(*) AS totalProducts FROM products");
    const [[{ totalUsers }]] = await pool.query("SELECT COUNT(*) AS totalUsers FROM users WHERE role='user'");

    // Monthly revenue (last 6 months)
    const [monthly] = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%b') AS month, SUM(total) AS revenue, COUNT(*) AS orders
      FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY MONTH(created_at), DATE_FORMAT(created_at, '%b')
      ORDER BY MONTH(created_at)
    `);

    // Recent orders
    const [recentOrders] = await pool.query(`
      SELECT o.*, u.name AS user_name FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC LIMIT 5
    `);

    // Low stock products
    const [lowStock] = await pool.query("SELECT id, name, stock FROM products WHERE stock < 10 ORDER BY stock ASC");

    res.json({
      success: true,
      stats: { totalRevenue: totalRevenue || 0, totalOrders, totalProducts, totalUsers },
      monthly,
      recentOrders,
      lowStock,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/admin/users ──────────────────────────────────────────
router.get("/users", protect, adminOnly, async (req, res) => {
  try {
    const [users] = await pool.query(`
      SELECT u.id, u.name, u.email, u.role, u.phone, u.created_at,
        COUNT(o.id) AS total_orders,
        COALESCE(SUM(o.total), 0) AS total_spent
      FROM users u LEFT JOIN orders o ON u.id = o.user_id
      GROUP BY u.id ORDER BY u.created_at DESC
    `);
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/admin/users/:id/role ─────────────────────────────────
router.put("/users/:id/role", protect, adminOnly, async (req, res) => {
  try {
    const { role } = req.body;
    if (!["user","admin"].includes(role))
      return res.status(400).json({ success: false, message: "Invalid role" });
    await pool.query("UPDATE users SET role=? WHERE id=?", [role, req.params.id]);
    res.json({ success: true, message: "User role updated" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/admin/users/:id ───────────────────────────────────
router.delete("/users/:id", protect, adminOnly, async (req, res) => {
  try {
    if (req.params.id == req.user.id)
      return res.status(400).json({ success: false, message: "Cannot delete yourself" });
    await pool.query("DELETE FROM users WHERE id=?", [req.params.id]);
    res.json({ success: true, message: "User deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/admin/categories ─────────────────────────────────────
router.get("/categories", protect, adminOnly, async (req, res) => {
  try {
    const [cats] = await pool.query("SELECT * FROM categories");
    res.json({ success: true, categories: cats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/admin/categories ────────────────────────────────────
router.post("/categories", protect, adminOnly, async (req, res) => {
  try {
    const { name, icon, image } = req.body;
    const [result] = await pool.query("INSERT INTO categories (name, icon, image) VALUES (?,?,?)", [name, icon, image]);
    res.status(201).json({ success: true, message: "Category created", id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/admin/coupons ────────────────────────────────────────
router.get("/coupons", protect, adminOnly, async (req, res) => {
  try {
    const [coupons] = await pool.query("SELECT * FROM coupons ORDER BY created_at DESC");
    res.json({ success: true, coupons });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/admin/coupons ───────────────────────────────────────
router.post("/coupons", protect, adminOnly, async (req, res) => {
  try {
    const { code, discount, expires_at } = req.body;
    await pool.query("INSERT INTO coupons (code, discount, expires_at) VALUES (?,?,?)", [code.toUpperCase(), discount, expires_at||null]);
    res.status(201).json({ success: true, message: "Coupon created!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
