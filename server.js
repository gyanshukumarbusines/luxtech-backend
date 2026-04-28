require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const { initDB } = require("./config/db");

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || "*", credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────
app.use("/api/auth",          require("./routes/auth"));
app.use("/api/products",      require("./routes/products"));
app.use("/api/orders",        require("./routes/orders"));
app.use("/api/admin",         require("./routes/admin"));
app.use("/api/wishlist",      require("./routes/wishlist"));
app.use("/api/email",         require("./routes/email").router);
app.use("/api/reviews",       require("./routes/reviews"));
app.use("/api/images",        require("./routes/images"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/razorpay", require("./routes/razorpay"));
app.use("/api/newsletter", require("./routes/newsletter"));

app.get("/", (req, res) => {
  res.json({ success: true, message: "⚡ LuxTech API v2.0 is running!", version: "2.0.0" });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 LuxTech API v2.0 running on http://localhost:${PORT}`);
    console.log(`📦 Database connected & tables ready`);
    console.log(`\n✅ New Features:`);
    console.log(`   📸 Multiple Product Images → /api/images`);
    console.log(`   ⭐ Product Reviews         → /api/reviews`);
    console.log(`   📧 Order Status Emails     → /api/notifications/order/:id/status`);
    console.log(`   ⚠️  Low Stock Alerts        → /api/notifications/low-stock`);
    console.log(`\n🔐 Admin: admin@luxtech.com / admin123\n`);
  });
});
