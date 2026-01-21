/* eslint-disable no-unused-vars */
import { getDatabase } from "../config/database.js";

// Middleware to check if user is authenticated
export async function requireAuth(req, res, next) {
  try {
    // Check if user is in session (primary method)
    if (req.session && req.session.user) {
      req.user = req.session.user;
      return next();
    }
    
    // Fallback: check headers or body for userId (support numeric/string)
    const userId = req.headers['x-user-id'] || req.body.userId || req.query.userId;
    
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    const db = await getDatabase();
    const usersCollection = db.collection('users');
    
    const user = await usersCollection.findOne({ id: userId });
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    
    if (user.status !== "Active") {
      return res.status(403).json({ message: "Account is not active" });
    }
    
    req.user = user;
    next();
  // eslint-disable-next-line no-unused-vars
  } catch (err) {
    res.status(500).json({ message: "Authentication error" });
  }
}

// Middleware to check if user is admin
export async function requireAdmin(req, res, next) {
  try {
    await requireAuth(req, res, () => {
      if (req.user.role !== "admin" && req.user.role !== "Admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      next();
    });
  // eslint-disable-next-line no-unused-vars
  } catch (err) {
    res.status(500).json({ message: "Authorization error" });
  }
}

// Middleware to check if user is instructor or admin
export async function requireInstructorOrAdmin(req, res, next) {
  try {
    await requireAuth(req, res, () => {
      const role = req.user.role?.toLowerCase();
      if (role !== "admin" && role !== "instructor") {
        return res.status(403).json({ message: "Instructor or admin access required" });
      }
      next();
    });
  } catch (err) {
    res.status(500).json({ message: "Authorization error" });
  }
}

// Middleware to check if user is student (for read-only operations)
export async function requireStudent(req, res, next) {
  try {
    await requireAuth(req, res, () => {
      const role = req.user.role?.toLowerCase();
      if (role !== "student") {
        return res.status(403).json({ message: "Student access required" });
      }
      next();
    });
  } catch (err) {
    res.status(500).json({ message: "Authorization error" });
  }
}

// Middleware to prevent students from accessing management routes
export async function preventStudentManagement(req, res, next) {
  try {
    await requireAuth(req, res, () => {
      const role = req.user.role?.toLowerCase();
      if (role === "student") {
        return res.status(403).json({ 
          message: "Students cannot manage courses or lessons. Access denied." 
        });
      }
      next();
    });
  } catch (err) {
    res.status(500).json({ message: "Authorization error" });
  }
}
