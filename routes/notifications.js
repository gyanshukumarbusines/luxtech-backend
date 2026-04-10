const express  = require("express");
const { pool } = require("../config/db");
const { protect, adminOnly } = require("../middleware/auth");
const nodemailer = require("nodemailer");

const router = express.Router();

// ── Email Transporter ─────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

// ── Send Order Status Update Email ───────────────────────────────
const sendStatusEmail = async (order, userEmail, userName) => {
  const statusColors = {
    processing: "#A0A0FF",
    shipped:    "#C8A96E",
    delivered:  "#6EC890",
    cancelled:  "#E88080",
  };
  const color = statusColors[order.status] || "#C8A96E";

  const statusMessages = {
    processing: "Your order is being carefully prepared.",
    shipped:    `Your order is on its way! Tracking: ${order.tracking_number}`,
    delivered:  "Your order has been delivered. Enjoy your new device! ✦",
    cancelled:  "Your order has been cancelled. Contact us for assistance.",
  };

  const html = `
    <div style="background:#0A0A0B;padding:40px;font-family:'Helvetica',sans-serif;max-width:600px;margin:0 auto">
      <div style="text-align:center;margin-bottom:32px">
        <h1 style="color:#C8A96E;font-size:28px;letter-spacing:6px;text-transform:uppercase;margin:0">LUXTECH</h1>
        <p style="color:#7A7A8A;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:8px 0 0">Order Update</p>
      </div>

      <div style="background:#111114;border:1px solid #2A2A32;padding:28px;margin-bottom:20px;text-align:center">
        <div style="width:60px;height:60px;background:${color}22;border:1px solid ${color}44;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:28px">
          ${order.status==="delivered"?"✅":order.status==="shipped"?"🚚":order.status==="cancelled"?"❌":"⚙️"}
        </div>
        <h2 style="color:#F0EDE8;font-size:22px;font-weight:300;margin:0 0 8px">Order ${order.status.charAt(0).toUpperCase()+order.status.slice(1)}!</h2>
        <p style="color:#7A7A8A;font-size:13px;line-height:1.7;margin:0">${statusMessages[order.status] || "Your order status has been updated."}</p>
      </div>

      <div style="background:#111114;border:1px solid #2A2A32;padding:24px;margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:16px">
          <div>
            <p style="color:#7A7A8A;font-size:10px;letter-spacing:3px;text-transform:uppercase;margin:0 0 4px">Order Number</p>
            <p style="color:#C8A96E;font-size:16px;font-weight:600;margin:0">${order.order_number}</p>
          </div>
          <div>
            <p style="color:#7A7A8A;font-size:10px;letter-spacing:3px;text-transform:uppercase;margin:0 0 4px">Status</p>
            <p style="color:${color};font-size:16px;font-weight:600;margin:0;text-transform:capitalize">${order.status}</p>
          </div>
          <div>
            <p style="color:#7A7A8A;font-size:10px;letter-spacing:3px;text-transform:uppercase;margin:0 0 4px">Total</p>
            <p style="color:#F0EDE8;font-size:16px;font-weight:600;margin:0">$${Number(order.total).toLocaleString()}</p>
          </div>
        </div>
        ${order.tracking_number ? `
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid #2A2A32">
          <p style="color:#7A7A8A;font-size:10px;letter-spacing:3px;text-transform:uppercase;margin:0 0 4px">Tracking Number</p>
          <p style="color:#C8A96E;font-size:14px;margin:0;font-family:monospace">${order.tracking_number}</p>
        </div>` : ""}
      </div>

      <div style="text-align:center;padding:20px 0;border-top:1px solid #2A2A32">
        <p style="color:#7A7A8A;font-size:11px;margin:0">
          Questions? <a href="mailto:gyanshukumarbusiness@gmail.com" style="color:#C8A96E">gyanshukumarbusiness@gmail.com</a>
        </p>
        <p style="color:#7A7A8A;font-size:11px;margin:8px 0 0">© 2026 LuxTech. All rights reserved.</p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"LuxTech ✦" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: `✦ Order ${order.status.charAt(0).toUpperCase()+order.status.slice(1)} — ${order.order_number} | LuxTech`,
    html,
  });
};

// ── Send Low Stock Alert Email ────────────────────────────────────
const sendLowStockAlert = async (products) => {
  const rows = products.map(p => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #2A2A32;color:#F0EDE8">${p.name}</td>
      <td style="padding:10px;border-bottom:1px solid #2A2A32;color:${p.stock<=3?"#E88080":"#C8A96E"};text-align:center;font-weight:700">${p.stock} left</td>
    </tr>
  `).join("");

  const html = `
    <div style="background:#0A0A0B;padding:40px;font-family:'Helvetica',sans-serif;max-width:600px;margin:0 auto">
      <div style="text-align:center;margin-bottom:32px">
        <h1 style="color:#C8A96E;font-size:28px;letter-spacing:6px;text-transform:uppercase;margin:0">LUXTECH</h1>
        <p style="color:#E88080;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:8px 0 0">⚠️ Low Stock Alert</p>
      </div>
      <div style="background:#111114;border:1px solid #E88080;padding:28px;margin-bottom:20px">
        <h2 style="color:#F0EDE8;font-size:20px;font-weight:300;margin:0 0 16px">Products Running Low!</h2>
        <p style="color:#7A7A8A;font-size:13px;margin:0 0 20px">The following products need to be restocked:</p>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#1A1A1F">
              <th style="padding:10px;text-align:left;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#7A7A8A">Product</th>
              <th style="padding:10px;text-align:center;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#7A7A8A">Stock</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="text-align:center;padding:20px 0;border-top:1px solid #2A2A32">
        <p style="color:#7A7A8A;font-size:11px;margin:0">© 2026 LuxTech Admin Panel</p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"LuxTech Admin ✦" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
    subject: `⚠️ Low Stock Alert — ${products.length} Products Need Restocking | LuxTech`,
    html,
  });
};

// ── PUT /api/notifications/order/:id/status ── Admin only ─────────
// Update order status AND send email to customer
router.put("/order/:id/status", protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["pending","processing","shipped","delivered","cancelled"];
    if (!validStatuses.includes(status))
      return res.status(400).json({ success: false, message: "Invalid status" });

    // Update order
    await pool.query("UPDATE orders SET status=? WHERE id=?", [status, req.params.id]);

    // Get order + user details
    const [orders] = await pool.query(
      `SELECT o.*, u.email AS user_email, u.name AS user_name
       FROM orders o LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id=?`,
      [req.params.id]
    );

    if (orders.length && orders[0].user_email) {
      try {
        await sendStatusEmail(orders[0], orders[0].user_email, orders[0].user_name);
        console.log(`✅ Status email sent to ${orders[0].user_email}`);
      } catch (emailErr) {
        console.log("Status email error:", emailErr.message);
      }
    }

    res.json({ success: true, message: `Order status updated to ${status} & email sent!` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/notifications/low-stock ── Admin only ────────────────
// Check low stock and send alert email
router.get("/low-stock", protect, adminOnly, async (req, res) => {
  try {
    const threshold = req.query.threshold || 10;
    const [products] = await pool.query(
      "SELECT id, name, stock FROM products WHERE stock < ? ORDER BY stock ASC",
      [threshold]
    );

    if (products.length === 0)
      return res.json({ success: true, message: "All products have sufficient stock!", products: [] });

    // Send alert email
    try {
      await sendLowStockAlert(products);
      console.log(`⚠️ Low stock alert sent for ${products.length} products`);
    } catch (emailErr) {
      console.log("Low stock email error:", emailErr.message);
    }

    res.json({
      success: true,
      message: `Alert sent! ${products.length} products are low on stock.`,
      products,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/notifications/low-stock/auto ── Check automatically ─
// Called when an order is placed to auto-check stock
const checkAndAlertLowStock = async () => {
  try {
    const [products] = await pool.query(
      "SELECT id, name, stock FROM products WHERE stock < 5 ORDER BY stock ASC"
    );
    if (products.length > 0) {
      await sendLowStockAlert(products);
      console.log(`⚠️ Auto low stock alert: ${products.length} products`);
    }
  } catch (err) {
    console.log("Auto stock check error:", err.message);
  }
};

module.exports = { router, sendStatusEmail, checkAndAlertLowStock };
