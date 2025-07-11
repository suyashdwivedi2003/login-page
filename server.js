// server.js
const express = require("express");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

console.log("Loaded EMAIL_USER from .env:", process.env.EMAIL_USER);

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("public")); // Serves index.html and login.html from "public" folder

// MongoDB schema
const User = mongoose.model("User", new mongoose.Schema({
  email: String,
  token: String,
  isVerified: Boolean,
}));

// Email transporter (Gmail + App Password)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Send verification link
app.post("/auth/send-verification", async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: "Email is required" });

  const token = Math.random().toString(36).substring(2, 15);
  const link = `${process.env.BASE_URL}/verify?token=${token}`;

  try {
    // Save or update user in DB
    await User.findOneAndUpdate(
      { email },
      { email, token, isVerified: false },
      { upsert: true, new: true }
    );

    // Send mail
    const info = await transporter.sendMail({
      to: email,
      subject: "Verify your email",
      html: `<p>Click the link to verify:</p><a href="${link}">${link}</a>`,
    });

    console.log("✅ Email sent:", info.response);
    res.json({ message: "Verification link sent to your email." });

  } catch (err) {
    console.error("❌ Error sending email:", err);
    res.status(500).json({ message: "Failed to send email. Check server logs." });
  }
});

// Verify link
app.get("/verify", async (req, res) => {
  const token = req.query.token;

  try {
    const user = await User.findOne({ token });

    if (user) {
      user.isVerified = true;
      user.token = null;
      await user.save();

      // Redirect to index.html with verified=1
      return res.redirect("/index.html?verified=1");
    } else {
      return res.send("❌ Invalid or expired token.");
    }
  } catch (err) {
    console.error("❌ Verification error:", err);
    res.status(500).send("Something went wrong.");
  }
});

// Connect to MongoDB and start server
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    app.listen(process.env.PORT || 3000, () => {
      console.log(`🚀 Server running at ${process.env.BASE_URL}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to connect to MongoDB:", err);
  });
