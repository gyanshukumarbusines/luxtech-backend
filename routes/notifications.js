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

// Low stock check - products with stock < 10
router.get("/low-stock", protect, adminOnly, async (req, res) => {
  try {
    const [products] = await pool.query(
      "SELECT id, name, stock FROM products WHERE stock < 10 ORDER BY stock ASC"
    );

    if (products.length === 0) {
      return res.json({
        success: true,
        message: "✅ All products have sufficient stock!",
        products: [],
      });
    }

    // Send email with low stock alert
    const productList = products
      .map((p) => `• ${p.name}: ${p.stock} units left`)
      .join("\n");

    const emailContent = `
🚨 LOW STOCK ALERT - LuxTech

The following products have stock below 10 units:

${productList}

Total low-stock products: ${products.length}

Please reorder these items as soon as possible!

---
LuxTech Admin System
    `;

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER, // Send to your email
        subject: `⚠️ Low Stock Alert - ${products.length} products`,
        text: emailContent,
      });
      console.log("Low stock alert email sent successfully");
    } catch (emailErr) {
      console.log("Email send error:", emailErr.message);
      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      message: `⚠️ ${products.length} product(s) have low stock! Alert sent to ${process.env.EMAIL_USER}`,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        stock: p.stock,
      })),
    });
  } catch (err) {
    console.error("Low stock check error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
