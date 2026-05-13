const express = require("express");
const { Resend } = require("resend");
const { pool } = require("../config/db");
const { protect } = require("../middleware/auth");

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

const sendOrderEmail = async (order, items, userEmail, userName) => {
  const itemRows = items.map(i => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #2A2A32;color:#F0EDE8">${i.name}</td>
      <td style="padding:10px;border-bottom:1px solid #2A2A32;color:#F0EDE8;text-align:center">${i.quantity}</td>
      <td style="padding:10px;border-bottom:1px solid #2A2A32;color:#C8A96E;text-align:right">₹${Number(i.price).toLocaleString()}</td>
    </tr>
  `).join("");

  const html = `
    <div style="background:#0A0A0B;padding:40px;font-family:'Helvetica',sans-serif;max-width:600px;margin:0 auto">
      <h1 style="color:#C8A96E;text-align:center">LUXTECH</h1>
      <p style="color:#F0EDE8">Thank you, ${userName}! Your order <strong>${order.order_number}</strong> is confirmed.</p>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#1A1A1F">
            <th style="padding:10px;color:#7A7A8A;text-align:left">Product</th>
            <th style="padding:10px;color:#7A7A8A;text-align:center">Qty</th>
            <th style="padding:10px;color:#7A7A8A;text-align:right">Price</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <p style="color:#C8A96E;font-size:20px;text-align:right">Total: ₹${Number(order.total).toLocaleString()}</p>
      <p style="color:#7A7A8A;text-align:center">© 2026 LuxTech</p>
    </div>
  `;

  await resend.emails.send({
    from: "LuxTech <onboarding@resend.dev>",
    to: userEmail,
    subject: `✦ Order Confirmed — ${order.order_number} | LuxTech`,
    html,
  });
};

router.post("/order-confirmation", protect, async (req, res) => {
  try {
    const { order_id } = req.body;
    const [orders] = await pool.query("SELECT * FROM orders WHERE id=? AND user_id=?", [order_id, req.user.id]);
    if (!orders.length) return res.status(404).json({ success: false, message: "Order not found" });
    const [items] = await pool.query("SELECT * FROM order_items WHERE order_id=?", [order_id]);
    await sendOrderEmail(orders[0], items, req.user.email, req.user.name);
    res.json({ success: true, message: "Email sent!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Email failed: " + err.message });
  }
});

module.exports = { router, sendOrderEmail };
