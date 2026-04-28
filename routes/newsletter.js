const express = require("express");
const { pool } = require("../config/db");
const nodemailer = require("nodemailer");
const router = express.Router();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// POST /api/newsletter/subscribe
router.post("/subscribe", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email required" });

    // Save to database
    await pool.query(`
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        email      VARCHAR(150) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(
      "INSERT IGNORE INTO newsletter_subscribers (email) VALUES (?)",
      [email]
    );

    // Send welcome email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Welcome to LuxTech Inner Circle ✦",
      html: `
        <div style="background:#0A0A0B;padding:40px;font-family:sans-serif;color:#fff;max-width:600px;margin:0 auto">
          <h1 style="color:#C8A96E;font-size:28px">Welcome to LuxTech ✦</h1>
          <p style="color:#999;font-size:15px">You are now part of our exclusive Inner Circle.</p>
          <p style="color:#999;font-size:15px">You will receive:</p>
          <ul style="color:#C8A96E;font-size:14px">
            <li>Exclusive product launches</li>
            <li>Early access to sales</li>
            <li>Curated recommendations</li>
            <li>Special member discounts</li>
          </ul>
          <p style="color:#666;font-size:12px;margin-top:30px">LuxTech — The Pinnacle of Technology</p>
        </div>
      `,
    });

    res.json({ success: true, message: "Welcome to the Inner Circle! ✦" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
