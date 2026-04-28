const mysql2 = require("mysql2/promise");
require("dotenv").config();

// ── Connection Pool ──────────────────────────────────────────────
const pool = mysql2.createPool({
  host:     process.env.DB_HOST     || "localhost",
  port:     process.env.DB_PORT     || 3306,
  user:     process.env.DB_USER     || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME     || "luxtech_db",
  waitForConnections: true,
  connectionLimit:    10,
});

// ── Create Tables ────────────────────────────────────────────────
const initDB = async () => {
  const conn = await pool.getConnection();
  try {
    // Create database if not exists
    await conn.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || "luxtech_db"}`);
    await conn.query(`USE ${process.env.DB_NAME || "luxtech_db"}`);

    // USERS table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        name        VARCHAR(100) NOT NULL,
        email       VARCHAR(150) NOT NULL UNIQUE,
        password    VARCHAR(255) NOT NULL,
        role        ENUM('user','admin') DEFAULT 'user',
        phone       VARCHAR(20),
        address     TEXT,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // CATEGORIES table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id    INT AUTO_INCREMENT PRIMARY KEY,
        name  VARCHAR(100) NOT NULL UNIQUE,
        icon  VARCHAR(10),
        image VARCHAR(500)
      )
    `);

    // PRODUCTS table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS products (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        name         VARCHAR(200) NOT NULL,
        description  TEXT,
        price        DECIMAL(10,2) NOT NULL,
        orig_price   DECIMAL(10,2),
        category_id  INT,
        stock        INT DEFAULT 0,
        rating       DECIMAL(3,1) DEFAULT 0,
        review_count INT DEFAULT 0,
        badge        VARCHAR(50),
        image        VARCHAR(500),
        is_featured  BOOLEAN DEFAULT FALSE,
        is_new       BOOLEAN DEFAULT FALSE,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ORDERS table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        order_number    VARCHAR(50) NOT NULL UNIQUE,
        user_id         INT,
        total           DECIMAL(10,2) NOT NULL,
        subtotal        DECIMAL(10,2) NOT NULL,
        discount        DECIMAL(10,2) DEFAULT 0,
        shipping        DECIMAL(10,2) DEFAULT 0,
        status          ENUM('pending','processing','shipped','delivered','cancelled') DEFAULT 'pending',
        payment_method  VARCHAR(50),
        payment_status  ENUM('pending','paid','failed') DEFAULT 'pending',
        stripe_payment_id VARCHAR(200),
        tracking_number VARCHAR(100),
        shipping_name   VARCHAR(100),
        shipping_email  VARCHAR(150),
        shipping_phone  VARCHAR(20),
        shipping_address TEXT,
        shipping_city   VARCHAR(100),
        shipping_state  VARCHAR(100),
        shipping_zip    VARCHAR(20),
        shipping_country VARCHAR(100),
        coupon_code     VARCHAR(50),
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ORDER ITEMS table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        order_id    INT NOT NULL,
        product_id  INT,
        name        VARCHAR(200) NOT NULL,
        price       DECIMAL(10,2) NOT NULL,
        quantity    INT NOT NULL DEFAULT 1
      )
    `);

    // REVIEWS table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        product_id  INT NOT NULL,
        user_id     INT,
        user_name   VARCHAR(100),
        rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment     TEXT,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // WISHLIST table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS wishlist (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        user_id     INT NOT NULL,
        product_id  INT NOT NULL,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        UNIQUE KEY unique_wish (user_id, product_id)
      )
    `);

    // COUPONS table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        code        VARCHAR(50) NOT NULL UNIQUE,
        discount    INT NOT NULL,
        active      BOOLEAN DEFAULT TRUE,
        expires_at  DATETIME
      )
    `);
    
// NEWSLETTER SUBSCRIBERS table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        email      VARCHAR(150) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Seed default coupons
    await conn.query(`
      INSERT IGNORE INTO coupons (code, discount) VALUES
        ('LUXTECH20', 20),
        ('SAVE10', 10),
        ('NEWUSER15', 15)
    `);

    // Seed default admin user (password: admin123)
    const bcrypt = require("bcryptjs");
    const hash = await bcrypt.hash("admin123", 10);
    await conn.query(`
      INSERT IGNORE INTO users (name, email, password, role)
      VALUES ('Admin', 'admin@luxtech.com', ?, 'admin')
    `, [hash]);

    console.log("✅ Database & tables ready!");
  } catch (err) {
    console.error("❌ DB init error:", err.message);
  } finally {
    conn.release();
  }
};

module.exports = { pool, initDB };
