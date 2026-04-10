const express  = require("express");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const { pool } = require("../config/db");
const { protect } = require("../middleware/auth");

const router = express.Router();

// ── Generate JWT ─────────────────────────────────────────────────
const genToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });

// ── POST /api/auth/register ──────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: "All fields required" });
    if (password.length < 6)
      return res.status(400).json({ success: false, message: "Password min 6 characters" });

    // Check existing
    const [exists] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
    if (exists.length)
      return res.status(400).json({ success: false, message: "Email already registered" });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hash]
    );

    res.status(201).json({
      success: true,
      message: "Account created successfully!",
      token: genToken(result.insertId),
      user: { id: result.insertId, name, email, role: "user" },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/auth/login ─────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: "Email and password required" });

    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    if (!rows.length)
      return res.status(401).json({ success: false, message: "Invalid email or password" });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ success: false, message: "Invalid email or password" });

    res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      token: genToken(user.id),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────────
router.get("/me", protect, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, email, role, phone, address, created_at FROM users WHERE id = ?",
      [req.user.id]
    );
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/auth/profile ────────────────────────────────────────
router.put("/profile", protect, async (req, res) => {
  try {
    const { name, phone, address, password } = req.body;
    if (password) {
      if (password.length < 6)
        return res.status(400).json({ success: false, message: "Password min 6 characters" });
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        "UPDATE users SET name=?, phone=?, address=?, password=? WHERE id=?",
        [name, phone, address, hash, req.user.id]
      );
    } else {
      await pool.query(
        "UPDATE users SET name=?, phone=?, address=? WHERE id=?",
        [name, phone, address, req.user.id]
      );
    }
    res.json({ success: true, message: "Profile updated successfully!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
