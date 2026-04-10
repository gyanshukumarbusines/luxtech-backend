const express  = require("express");
const nodemailer = require("nodemailer");
const { pool } = require("../config/db");
const { protect } = require("../middleware/auth");

const router = express.Router();

// ── Email Transporter ─────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password
  },
});

// ── Send Order Confirmation Email ─────────────────────────────────
const sendOrderEmail = async (order, items, userEmail, userName) => {
  const itemRows = items.map(i => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #2A2A32;color:#F0EDE8">${i.name}</td>
      <td style="padding:10px;border-bottom:1px solid #2A2A32;color:#F0EDE8;text-align:center">${i.quantity}</td>
      <td style="padding:10px;border-bottom:1px solid #2A2A32;color:#C8A96E;text-align:right">$${Number(i.price).toLocaleString()}</td>
    </tr>
  `).join("");

  const html = `
    <div style="background:#0A0A0B;padding:40px;font-family:'Helvetica',sans-serif;max-width:600px;margin:0 auto">
      <div style="text-align:center;margin-bottom:32px">
        <h1 style="color:#C8A96E;font-size:28px;letter-spacing:6px;text-transform:uppercase;margin:0">LUXTECH</h1>
        <p style="color:#7A7A8A;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:8px 0 0">Order Confirmation</p>
      </div>

      <div style="background:#111114;border:1px solid #2A2A32;padding:28px;margin-bottom:20px">
        <h2 style="color:#F0EDE8;font-size:20px;font-weight:300;margin:0 0 16px">Thank you, ${userName}! ✦</h2>
        <p style="color:#7A7A8A;font-size:13px;line-height:1.7;margin:0">
          Your order has been placed successfully and is being processed.
          You will receive a shipping notification once your items are dispatched.
        </p>
      </div>

      <div style="background:#111114;border:1px solid #2A2A32;padding:28px;margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:12px">
          <div>
            <p style="color:#7A7A8A;font-size:10px;letter-spacing:3px;text-transform:uppercase;margin:0 0 4px">Order Number</p>
            <p style="color:#C8A96E;font-size:16px;font-weight:600;margin:0">${order.order_number}</p>
          </div>
          <div>
            <p style="color:#7A7A8A;font-size:10px;letter-spacing:3px;text-transform:uppercase;margin:0 0 4px">Tracking</p>
            <p style="color:#F0EDE8;font-size:14px;margin:0">${order.tracking_number}</p>
          </div>
          <div>
            <p style="color:#7A7A8A;font-size:10px;letter-spacing:3px;text-transform:uppercase;margin:0 0 4px">Status</p>
            <p style="color:#6EC890;font-size:14px;margin:0;text-transform:capitalize">${order.status}</p>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#1A1A1F">
              <th style="padding:10px;text-align:left;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#7A7A8A">Product</th>
              <th style="padding:10px;text-align:center;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#7A7A8A">Qty</th>
              <th style="padding:10px;text-align:right;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#7A7A8A">Price</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>

        <div style="border-top:1px solid #2A2A32;margin-top:16px;padding-top:16px">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <span style="color:#7A7A8A;font-size:13px">Subtotal</span>
            <span style="color:#F0EDE8;font-size:13px">$${Number(order.subtotal).toLocaleString()}</span>
          </div>
          ${order.discount > 0 ? `
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <span style="color:#7A7A8A;font-size:13px">Discount</span>
            <span style="color:#6EC890;font-size:13px">-$${Number(order.discount).toLocaleString()}</span>
          </div>` : ""}
          <div style="display:flex;justify-content:space-between;margin-bottom:16px">
            <span style="color:#7A7A8A;font-size:13px">Shipping</span>
            <span style="color:#F0EDE8;font-size:13px">${order.shipping == 0 ? "FREE" : "$"+Number(order.shipping).toLocaleString()}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding-top:12px;border-top:1px solid #2A2A32">
            <span style="color:#F0EDE8;font-size:11px;letter-spacing:3px;text-transform:uppercase">Total</span>
            <span style="color:#C8A96E;font-size:28px;font-weight:300">$${Number(order.total).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div style="text-align:center;padding:20px 0;border-top:1px solid #2A2A32">
        <p style="color:#7A7A8A;font-size:11px;letter-spacing:1px;margin:0">
          Questions? Contact us at <a href="mailto:gyanshukumarbusiness@gmail.com" style="color:#C8A96E">gyanshukumarbusiness@gmail.com</a>
        </p>
        <p style="color:#7A7A8A;font-size:11px;margin:8px 0 0">© 2026 LuxTech. All rights reserved.</p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"LuxTech ✦" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: `✦ Order Confirmed — ${order.order_number} | LuxTech`,
    html,
  });
};

// ── POST /api/email/order-confirmation ───────────────────────────
router.post("/order-confirmation", protect, async (req, res) => {
  try {
    const { order_id } = req.body;
    const [orders] = await pool.query("SELECT * FROM orders WHERE id=? AND user_id=?", [order_id, req.user.id]);
    if (!orders.length) return res.status(404).json({ success:false, message:"Order not found" });
    const [items]  = await pool.query("SELECT * FROM order_items WHERE order_id=?", [order_id]);

    await sendOrderEmail(orders[0], items, req.user.email, req.user.name);
    res.json({ success:true, message:"Order confirmation email sent! ✦" });
  } catch (err) {
    res.status(500).json({ success:false, message:"Email failed: "+err.message });
  }
});

module.exports = { router, sendOrderEmail };
