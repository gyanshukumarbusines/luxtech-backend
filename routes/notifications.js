const express = require("express");
const { pool } = require("../config/db");
const { protect, adminOnly } = require("../middleware/auth");
const { Resend } = require("resend");

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

// Low stock check
router.get("/low-stock", protect, adminOnly, async (req, res) => {
  try {
    const [products] = await pool.query(
      "SELECT id, name, stock FROM products WHERE stock < 10 ORDER BY stock ASC"
    );

    if (products.length === 0) {
      return res.json({ success: true, message: "✅ All products have sufficient stock!", products: [] });
    }

    const productList = products.map((p) => `• ${p.name}: ${p.stock} units left`).join("<br>");

    await resend.emails.send({
      from: "LuxTech <onboarding@resend.dev>",
      to: process.env.EMAIL_USER,
      subject: `⚠️ Low Stock Alert - ${products.length} products`,
      html: `<h2>🚨 LOW STOCK ALERT</h2><p>${productList}</p>`,
    });

    res.json({ success: true, message: `⚠️ ${products.length} product(s) have low stock!`, products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Order status notification
router.post("/order/:id/status", protect, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const [orders] = await pool.query(
      "SELECT o.*, u.email, u.name FROM orders o JOIN users u ON o.user_id = u.id WHERE o.id = ?",
      [id]
    );

    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const order = orders[0];

    await resend.emails.send({
      from: "LuxTech <onboarding@resend.dev>",
      to: order.email,
      subject: `✦ Order ${order.order_number} - Status Updated`,
      html: `<div style="background:#0A0A0B;padding:40px;color:#F0EDE8;font-family:Helvetica">
        <h1 style="color:#C8A96E">LUXTECH</h1>
        <p>Hi ${order.name},</p>
        <p>Your order <strong>${order.order_number}</strong> status has been updated to: <strong style="color:#C8A96E">${status}</strong></p>
        <p>Thank you for shopping with LuxTech!</p>
      </div>`,
    });

    res.json({ success: true, message: "Notification sent!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
