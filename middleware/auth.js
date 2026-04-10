const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");

// ── Verify token ─────────────────────────────────────────────────
const protect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Not authorized — no token" });
    }
    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.query("SELECT id, name, email, role FROM users WHERE id = ?", [decoded.id]);
    if (!rows.length) return res.status(401).json({ success: false, message: "User not found" });
    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Token invalid or expired" });
  }
};

// ── Admin only ───────────────────────────────────────────────────
const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }
  next();
};

module.exports = { protect, adminOnly };
