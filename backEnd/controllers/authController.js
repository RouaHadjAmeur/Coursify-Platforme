// eslint-disable-next-line no-unused-vars
import { validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { getDatabase } from "../config/database.js";

export async function signup(req, res, next) {
  try {
    // Remove validation check since routes handle it
    const { firstName, lastName, email, contact, password, role } = req.body;
    const emailNorm = (email || "").toLowerCase().trim();
    const fullName = `${firstName} ${lastName}`.trim();

    const db = await getDatabase();
    const usersCollection = db.collection('users');

    // Check if email already exists
    const existingUser = await usersCollection.findOne({ email: emailNorm });
    if (existingUser) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = {
      id: nanoid(),
      firstName: (firstName || "").trim(),
      lastName: (lastName || "").trim(),
      name: fullName,
      email: emailNorm,
      passwordHash,
      role: role || "Student",
      status: "Pending", // New users start with pending status
      contact: contact || "",
      joined: new Date().toLocaleDateString('en-US', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      }),
      published: true,
      createdAt: new Date().toISOString(),
      approvedBy: null,
      approvedAt: null,
    };

    await usersCollection.insertOne(user);

    // Return safe fields only
    return res.status(201).json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
      email: user.email,
      contact: user.contact,
      role: user.role,
      status: user.status,
      joined: user.joined,
      createdAt: user.createdAt,
      message: "Account created successfully. Please wait for admin approval."
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    // Remove validation check since routes handle it
    const { email, password } = req.body;
    const emailNorm = (email || "").toLowerCase().trim();

    const db = await getDatabase();
    const usersCollection = db.collection('users');

    // Find user by email
    const user = await usersCollection.findOne({ email: emailNorm });
    if (!user) {
      return res.status(401).json({ message: "User not found. Please sign up." });
    }

    // Check if user is approved
    if (user.status === "Pending") {
      return res.status(403).json({ 
        message: "Your account is pending admin approval. Please wait for approval before logging in.",
        status: "pending"
      });
    }

    if (user.status === "Rejected") {
      return res.status(403).json({ 
        message: "Your account has been rejected by admin. Please contact support.",
        status: "rejected"
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Incorrect password." });
    }

    // Create session
    req.session.user = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
      email: user.email,
      contact: user.contact,
      role: user.role,
      status: user.status,
      joined: user.joined,
      createdAt: user.createdAt,
    };

    // Return safe fields only
    return res.status(200).json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
      email: user.email,
      contact: user.contact,
      role: user.role,
      status: user.status,
      joined: user.joined,
      createdAt: user.createdAt,
      message: "Login successful",
      isAdmin: user.role === "Admin" || user.role === "admin"
    });
  } catch (err) {
    next(err);
  }
}

export async function getAllUsers(req, res, next) {
  try {
    const db = await getDatabase();
    const usersCollection = db.collection('users');
    
    const findResult = await usersCollection.find({}, { 
      projection: { 
        passwordHash: 0 // Exclude password hash
      } 
    });
    
    const users = await findResult.toArray();
    
    return res.status(200).json(users);
  } catch (err) {
    next(err);
  }
}

// New function to approve/reject users
export async function updateUserStatus(req, res, next) {
  try {
    const { userId, status, approvedBy } = req.body;
    
    if (!userId || !status || !approvedBy) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!["Active", "Approved", "Rejected", "Pending"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const db = await getDatabase();
    const usersCollection = db.collection('users');

    const updateData = {
      status,
      approvedBy,
      approvedAt: new Date().toISOString()
    };

    const result = await usersCollection.updateOne(
      { id: userId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ 
      message: `User ${status.toLowerCase()} successfully`,
      status 
    });
  } catch (err) {
    next(err);
  }
}

// New function to update user (admin only - can update role/status)
export async function updateUser(req, res, next) {
  try {
    const { userId } = req.params;
    const { firstName, lastName, email, contact, role, status, profilePicture } = req.body;

    const db = await getDatabase();
    const usersCollection = db.collection('users');

    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (email) updateData.email = email.toLowerCase().trim();
    if (contact) updateData.contact = contact;
    if (role) updateData.role = role;
    if (status) updateData.status = status;
    if (profilePicture) updateData.profilePicture = profilePicture;

    // Update name if firstName or lastName changed
    if (firstName || lastName) {
      const user = await usersCollection.findOne({ id: userId });
      if (user) {
        const newFirstName = firstName || user.firstName;
        const newLastName = lastName || user.lastName;
        updateData.name = `${newFirstName} ${newLastName}`.trim();
      }
    }

    const result = await usersCollection.updateOne(
      { id: userId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update session if it's the current user
    if (req.session && req.session.user && req.session.user.id === userId) {
      const updatedUser = await usersCollection.findOne({ id: userId });
      if (updatedUser) {
        req.session.user = {
          ...req.session.user,
          ...updateData,
          name: updateData.name || req.session.user.name
        };
      }
    }

    res.json({ message: "User updated successfully" });
  } catch (err) {
    next(err);
  }
}

// Function to update own profile (users can update their own profile, but not role/status)
export async function updateOwnProfile(req, res, next) {
  try {
    const { userId } = req.params;
    const { firstName, lastName, email, contact, profilePicture } = req.body;

    // Check if user is updating their own profile
    if (req.user && req.user.id !== userId) {
      return res.status(403).json({ message: "You can only update your own profile" });
    }

    const db = await getDatabase();
    const usersCollection = db.collection('users');

    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (email) updateData.email = email.toLowerCase().trim();
    if (contact) updateData.contact = contact;
    if (profilePicture) updateData.profilePicture = profilePicture;

    // Update name if firstName or lastName changed
    if (firstName || lastName) {
      const user = await usersCollection.findOne({ id: userId });
      if (user) {
        const newFirstName = firstName || user.firstName;
        const newLastName = lastName || user.lastName;
        updateData.name = `${newFirstName} ${newLastName}`.trim();
      }
    }

    const result = await usersCollection.updateOne(
      { id: userId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update session if it's the current user
    if (req.session && req.session.user && req.session.user.id === userId) {
      const updatedUser = await usersCollection.findOne({ id: userId });
      if (updatedUser) {
        req.session.user = {
          ...req.session.user,
          ...updateData,
          name: updateData.name || req.session.user.name
        };
      }
    }

    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    next(err);
  }
}

// New function to get user by ID
export async function getUserById(req, res, next) {
  try {
    const { userId } = req.params;

    const db = await getDatabase();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne(
      { id: userId },
      { 
        projection: { 
          passwordHash: 0 // Exclude password hash
        } 
      }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
}

// Change password function
export async function changePassword(req, res, next) {
  try {
    const { userId } = req.params;
    const { currentPassword, newPassword } = req.body;

    // Check if user is updating their own password
    if (req.user && req.user.id !== userId) {
      return res.status(403).json({ message: "You can only change your own password" });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters long" });
    }

    const db = await getDatabase();
    const usersCollection = db.collection('users');

    // Find user
    const user = await usersCollection.findOne({ id: userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    const result = await usersCollection.updateOne(
      { id: userId },
      { $set: { passwordHash: newPasswordHash } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    next(err);
  }
}

// New function to delete user
export async function deleteUser(req, res, next) {
  try {
    const { userId } = req.params;

    const db = await getDatabase();
    const usersCollection = db.collection('users');

    const result = await usersCollection.deleteOne({ id: userId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (err) {
    next(err);
  }
}
