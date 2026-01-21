import multer from "multer";
import path from "path";
import fs from "fs";
import { getDatabase } from "../config/database.js";

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/profiles/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

export const uploadProfilePicture = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Allow only image files
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only image files (JPEG, PNG, GIF, WebP, SVG) are allowed.'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit for profile pictures
  }
});

// Upload profile picture
export async function uploadProfilePic(req, res, next) {
  try {
    const { userId } = req.params;
    const file = req.file;
    
    // Check if user is updating their own profile picture
    if (req.user && req.user.id !== userId) {
      return res.status(403).json({ message: "You can only update your own profile picture" });
    }
    
    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    
    // Construct the file URL
    const fileUrl = `/uploads/profiles/${file.filename}`;
    
    const db = await getDatabase();
    const usersCollection = db.collection('users');
    
    // Update user's profile picture
    const result = await usersCollection.updateOne(
      { id: userId },
      { $set: { profilePicture: fileUrl } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Update session if it's the current user
    if (req.session && req.session.user && req.session.user.id === userId) {
      req.session.user.profilePicture = fileUrl;
    }
    
    res.json({
      message: "Profile picture uploaded successfully",
      profilePicture: fileUrl
    });
  } catch (err) {
    console.error('Error uploading profile picture:', err);
    next(err);
  }
}
