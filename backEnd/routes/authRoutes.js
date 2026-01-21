/* global process */
/* eslint-env node */
import express from "express";
import { body } from "express-validator";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

import {
  signup,
  login,
  getAllUsers,
  getUserById,
  updateUserStatus,
  updateUser,
  updateOwnProfile,
  changePassword,
  deleteUser,
} from "../controllers/authController.js";
import { uploadProfilePic, uploadProfilePicture } from "../controllers/profileController.js";

import { getDatabase } from "../config/database.js";
import { safeSendMail } from "../utils/mailer.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { verifyGoogleToken } from "../config/googleAuth.js";
import passport from "../config/googleAuth.js";

const router = express.Router();

/* ----------------- Auth: signup / login ----------------- */
router.post(
  "/signup",
  [
    body("firstName").trim().notEmpty().withMessage("First name is required"),
    body("lastName").trim().notEmpty().withMessage("Last name is required"),
    body("email").isEmail().withMessage("Valid email required").normalizeEmail(),
    body("contact").trim().isLength({ min: 8 }).withMessage("Phone number must be at least 8 digits"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
    body("role").trim().notEmpty().withMessage("Role is required"),
  ],
  signup
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email required").normalizeEmail(),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  login
);

/* ----------------- Password reset: request link ----------------- */
router.post(
  "/forgot-password",
  [body("email").isEmail().withMessage("Valid email required").normalizeEmail()],
  async (req, res) => {
    try {
      const { email } = req.body;
      const emailNorm = (email || "").toLowerCase().trim();

      const db = await getDatabase();
      const users = db.collection("users");
      const user = await users.findOne({ email: emailNorm });

      if (!user) {
        // generic response
        return res.json({ message: "If the email exists, a reset link was sent." });
      }

      // generate token and store its hash
      const resetToken = crypto.randomBytes(32).toString("hex");
      // eslint-disable-next-line no-unused-vars
      const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
      const ttlMin = Number(process.env.RESET_TOKEN_TTL_MINUTES || 30);
      const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000);

      const result = await users.updateOne(
          { _id: user._id },
          { $set: { resetToken, resetTokenExpiresAt: expiresAt } }
        );
console.log("updateOne result:", result);
      const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
      const resetUrl = `${clientUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(emailNorm)}`;

      const mail = await safeSendMail({
        to: emailNorm,
        subject: "Password Reset Request - Coursify",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color:#0a84ff;margin-bottom:8px;">Password Reset Request</h2>
            <p>Hello,</p>
            <p>You requested a password reset for your Coursify account.</p>
            <p><a href="${resetUrl}" style="display:inline-block;padding:10px 16px;text-decoration:none;border-radius:6px;background:#0a84ff;color:#fff">Reset Password</a></p>
            <p>This link expires in ${ttlMin} minutes.</p>
          </div>
        `,
      });

      if (!mail.ok) {
        console.warn("Email delivery failed (continuing):", mail.error);
      } else {
        const { accepted = [], rejected = [] } = mail.info || {};
        console.log("📨 Gmail accepted:", accepted, "rejected:", rejected);
      }

      const payload = { message: "If the email exists, a reset link was sent." };
      if (process.env.NODE_ENV !== "production") {
        payload.devResetUrl = resetUrl;
        console.log("🔗 devResetUrl:", resetUrl);
      }

      return res.json(payload);
    } catch (err) {
      console.error("Forgot-password error:", err);
      return res.status(500).json({ message: "Failed to send reset link" });
    }
  }
);

/* ----------------- Password reset: set new password ----------------- */
router.post(
  "/reset-password",
  [
    body("email").isEmail().normalizeEmail(),
    body("token").isString().notEmpty(),
    body("newPassword").isLength({ min: 8 }),
  ],
  async (req, res) => {
    try {
      const { email, token, newPassword } = req.body;
      const emailNorm = (email || "").toLowerCase().trim();
      // eslint-disable-next-line no-unused-vars
      const tokenNorm = decodeURIComponent(token); // make sure to decode

      const db = await getDatabase();
      const users = db.collection("users");

      const user = await users.findOne({ email: emailNorm, resetToken: token });

      if (!user || new Date(user.resetTokenExpiresAt) < new Date()) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }
    

      if (!user) return res.status(400).json({ message: "Invalid or expired token" });

      const passwordHash = await bcrypt.hash(newPassword, 12);

      await users.updateOne(
        { _id: user._id },
        { $set: { passwordHash }, $unset: { resetToken: "", resetTokenExpiresAt: "" } }
      );

      return res.json({ message: "Password reset successful. Please log in with your new password." });
    } catch (err) {
      console.error("Reset-password error:", err);
      return res.status(500).json({ message: "Failed to reset password" });
    }
  }
);

/* ----------------- Google OAuth Routes ----------------- */
// Google OAuth login (redirect to Google)
router.get("/google", (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ 
      message: "Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables." 
    });
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

// Google OAuth callback
router.get("/google/callback", (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.redirect('http://localhost:5173/login?error=google_oauth_not_configured');
  }
  passport.authenticate('google', { failureRedirect: 'http://localhost:5173/login?error=google_auth_failed' })(req, res, next);
}, async (req, res) => {
    try {
      // Store user in session
      req.session.user = req.user;
      
      // Redirect based on user role
      if (req.user.role === 'Admin' || req.user.role === 'admin') {
        res.redirect('http://localhost:3000/');
      } else {
        res.redirect('http://localhost:5173/');
      }
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      res.redirect('http://localhost:5173/login?error=google_auth_failed');
    }
  }
);

// Google OAuth with ID token (for frontend)
router.post("/google", async (req, res) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(503).json({ 
        message: "Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables." 
      });
    }

    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ message: "Google credential is required" });
    }

    // Verify the Google ID token
    const googleUser = await verifyGoogleToken(credential);
    
    const db = await getDatabase();
    const usersCollection = db.collection('users');
    
    // Check if user already exists
    let user = await usersCollection.findOne({ 
      $or: [
        { googleId: googleUser.googleId },
        { email: googleUser.email.toLowerCase() }
      ]
    });

    if (user) {
      // Update existing user with Google ID if not already set
      if (!user.googleId) {
        await usersCollection.updateOne(
          { _id: user._id },
          { 
            $set: { 
              googleId: googleUser.googleId,
              profilePicture: googleUser.profilePicture,
              lastLoginAt: new Date()
            } 
          }
        );
        user.googleId = googleUser.googleId;
        user.profilePicture = googleUser.profilePicture;
        user.lastLoginAt = new Date();
      }
    } else {
      // Create new user
      const newUser = {
        id: nanoid(),
        googleId: googleUser.googleId,
        firstName: googleUser.firstName,
        lastName: googleUser.lastName,
        email: googleUser.email.toLowerCase(),
        name: googleUser.name,
        profilePicture: googleUser.profilePicture,
        role: 'Student', // Default role for Google users
        status: 'Active', // Auto-approve Google users
        createdAt: new Date(),
        lastLoginAt: new Date(),
        isGoogleUser: true
      };

      const result = await usersCollection.insertOne(newUser);
      newUser._id = result.insertedId;
      user = newUser;
    }

    // Store user in session
    req.session.user = user;

    res.json({ 
      message: "Google authentication successful", 
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture,
        isGoogleUser: user.isGoogleUser
      },
      isAdmin: user.role === 'Admin' || user.role === 'admin'
    });
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.status(500).json({ message: "Google authentication failed" });
  }
});

/* ----------------- Admin user management ----------------- */
router.get("/users", [requireAdmin], getAllUsers);
router.get("/users/:userId", [requireAdmin], getUserById);
router.put("/users/status", [requireAdmin], updateUserStatus);
router.put("/users/:userId", [requireAdmin], updateUser); // Admin only - can update role/status
router.put("/profile/:userId", [requireAuth], updateOwnProfile); // Users can update their own profile
router.put("/users/:userId/password", [requireAuth], changePassword);
router.post("/users/:userId/profile-picture", [requireAuth, uploadProfilePicture.single('profilePicture')], uploadProfilePic);
router.delete("/users/:userId", [requireAdmin], deleteUser);

export default router;
