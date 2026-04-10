const express  = require("express");
const { sendOrderEmail } = require("./email");
const stripe   = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { pool } = require("../config/db");
const { protect, adminOnly } = require("../middleware/auth");

const router = express.Router();

// ── Helper: generate order number ────────────────────────────────
const genOrderNum = () => `LT-${new Date().getFullYear()}-${Math.floor(Math.random()*90000+10000)}`;
const genTracking = () => `LTEX${Math.floor(Math.random()*90000000+10000000)}`;

// ── POST /api/orders/checkout ─────────────────────────────────────
// Creates Stripe payment intent + saves pending order
router.post("/checkout", protect, async (req, res) => {
  try {
    const { items, shipping, coupon_code, payment_method } = req.body;
    if (!items || !items.length)
      return res.status(400).json({ success: false, message: "No items in order" });

    // Calculate totals
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    let discount = 0;

    if (coupon_code) {
      const [coupons] = await pool.query(
        "SELECT * FROM coupons WHERE code = ? AND active = 1 AND (expires_at IS NULL OR expires_at > NOW())",
        [coupon_code]
      );
      if (coupons.length) discount = Math.round(subtotal * coupons[0].discount / 100);
    }

    const shippingCost = subtotal > 999 ? 0 : 49;
    const total = subtotal - discount + shippingCost;

    // For Stripe payments — create payment intent
    let clientSecret = null;
    let stripePaymentId = null;

    if (payment_method === "stripe") {
      const intent = await stripe.paymentIntents.create({
        amount: Math.round(total * 100), // in cents
        currency: "usd",
        metadata: { user_id: req.user.id },
      });
      clientSecret = intent.client_secret;
      stripePaymentId = intent.id;
    }

    // Save order to DB
    const orderNum = genOrderNum();
    const tracking = genTracking();
    const [result] = await pool.query(
      `INSERT INTO orders (order_number, user_id, total, subtotal, discount, shipping, status,
        payment_method, payment_status, stripe_payment_id, tracking_number,
        shipping_name, shipping_email, shipping_phone, shipping_address,
        shipping_city, shipping_state, shipping_zip, shipping_country, coupon_code)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        orderNum, req.user.id, total, subtotal, discount, shippingCost,
        "pending",
        payment_method || "cod",
        payment_method === "cod" ? "pending" : "pending",
        stripePaymentId, tracking,
        shipping.name, shipping.email, shipping.phone, shipping.address,
        shipping.city, shipping.state, shipping.zip, shipping.country,
        coupon_code || null,
      ]
    );

    const orderId = result.insertId;

    // Save order items
    for (const item of items) {
      await pool.query(
        "INSERT INTO order_items (order_id, product_id, name, price, quantity) VALUES (?,?,?,?,?)",
        [orderId, item.id, item.name, item.price, item.quantity]
      );
      // Reduce stock
      await pool.query("UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?", [item.quantity, item.id, item.quantity]);
    }
   // Send confirmation email
     console.log("Sending email to:", req.user.email);
       try {
  const [orderData] = await pool.query("SELECT * FROM orders WHERE id=?", [orderId]);
  const [orderItems] = await pool.query("SELECT * FROM order_items WHERE order_id=?", [orderId]);
  await sendOrderEmail(orderData[0], orderItems, req.user.email, req.user.name);
} catch(emailErr) {
  console.log("Email error:", emailErr.message);
}
    res.status(201).json({
      success: true,
      message: "Order placed successfully! ✦",
      order: { id: orderId, order_number: orderNum, total, tracking, status: "pending" },
      clientSecret, // used by Stripe frontend
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/orders/my ────────────────────────────────────────────
router.get("/my", protect, async (req, res) => {
  try {
    const [orders] = await pool.query(
      "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC",
      [req.user.id]
    );
    // Attach items to each order
    for (const order of orders) {
      const [items] = await pool.query("SELECT * FROM order_items WHERE order_id = ?", [order.id]);
      order.items = items;
    }
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/orders/:id ───────────────────────────────────────────
router.get("/:id", protect, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM orders WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: "Order not found" });
    const [items] = await pool.query("SELECT * FROM order_items WHERE order_id = ?", [req.params.id]);
    res.json({ success: true, order: { ...rows[0], items } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/orders/admin/all ── Admin only ───────────────────────
router.get("/admin/all", protect, adminOnly, async (req, res) => {
  try {
    const { page=1, limit=20, status } = req.query;
    const offset = (page-1)*limit;
    let where = "1=1";
    const params = [];
    if (status) { where += " AND o.status = ?"; params.push(status); }

    const [orders] = await pool.query(
      `SELECT o.*, u.name AS user_name, u.email AS user_email
       FROM orders o LEFT JOIN users u ON o.user_id = u.id
       WHERE ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
      [...params, +limit, +offset]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM orders o WHERE ${where}`, params);

    res.json({ success: true, orders, total, page: +page, pages: Math.ceil(total/limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/orders/admin/:id/status ── Admin only ────────────────
router.put("/admin/:id/status", protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["pending","processing","shipped","delivered","cancelled"];
    if (!validStatuses.includes(status))
      return res.status(400).json({ success: false, message: "Invalid status" });

    await pool.query("UPDATE orders SET status = ? WHERE id = ?", [status, req.params.id]);
    res.json({ success: true, message: `Order status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/orders/stripe-webhook ──────────────────────────────
router.post("/stripe-webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object;
    await pool.query(
      "UPDATE orders SET payment_status='paid', status='processing' WHERE stripe_payment_id = ?",
      [pi.id]
    );
  }

  res.json({ received: true });
});

module.exports = router;
