const express = require("express");
const { pool } = require("../config/db");
const { protect, adminOnly } = require("../middleware/auth");
const nodemailer = require("nodemailer");

const router = express.Router();

// Configure email
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ── GET /api/notifications/low-stock ── Check and alert low stock ────────
router.get("/low-stock", protect, adminOnly, async (req, res) => {
  try {
    // Get all products with stock < 10
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

    // Send email to admin
    const productList = lowStockProducts
      .map((p) => `• ${p.name}: ${p.stock} units left`)
      .join("\n");

    const emailContent = `
🚨 LOW STOCK ALERT - LuxTech

The following products have stock below 10 units:

${productList}

Total low-stock products: ${lowStockProducts.length}

Please reorder these items as soon as possible!

---
LuxTech Admin System
    `;

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: "admin@luxtech.com",
        subject: `⚠️ Low Stock Alert - ${lowStockProducts.length} products`,
        text: emailContent,
      });
      console.log("Low stock alert email sent successfully");
    } catch (emailErr) {
      console.log("Email send error (non-critical):", emailErr.message);
      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      message: `⚠️ ${lowStockProducts.length} product(s) have low stock. Alert email sent to admin.`,
      lowStockProducts: lowStockProducts.map((p) => ({
        id: p.id,
        name: p.name,
        stock: p.stock,
        status: "LOW STOCK",
      })),
    });
  } catch (err) {
    console.error("Low stock check error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/notifications/order/:id/status ── Send order status email ────
router.post("/order/:id/status", protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const orderId = req.params.id;

    // Get order details
    const [orders] = await pool.query(
      "SELECT o.*, u.email, u.name FROM orders o JOIN users u ON o.user_id = u.id WHERE o.id = ?",
      [orderId]
    );

    if (!orders.length) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const order = orders[0];
    const statusMessages = {
      pending: "Your order is being prepared.",
      processing: "Your order is being processed.",
      shipped: `Your order has been shipped! Tracking: ${order.tracking_number}`,
      delivered: "Your order has been delivered!",
      cancelled: "Your order has been cancelled.",
    };

    const emailContent = `
Hello ${order.name},

Your order #${order.order_number} status has been updated:

📦 Status: ${status.toUpperCase()}
${statusMessages[status] || ""}

Order Details:
• Order ID: ${order.order_number}
• Total: $${order.total}
• Tracking: ${order.tracking_number}

Thank you for shopping with LuxTech!

---
LuxTech
    `;

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: order.email,
        subject: `Order #${order.order_number} - ${status.toUpperCase()}`,
        text: emailContent,
      });
      console.log(`Order status email sent to ${order.email}`);
    } catch (emailErr) {
      console.log("Email send error:", emailErr.message);
    }

    res.json({ success: true, message: "Status email sent successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
