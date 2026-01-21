import express from "express";
import { body, validationResult } from "express-validator";
import { getDatabase } from '../config/database.js'; // adjust the path to your file

import { 
  getAllCourses, 
  getCourseById, 
  createCourse, 
  updateCourse, 
  deleteCourse, 
  toggleCourseStatus,
  startLearning,
  updateProgress,
  getUserProgress,
  getCourseAnalytics,
  addLessonToCourse,
  updateLessonInCourse,
  deleteLessonFromCourse,
  trackLessonProgress,
  getUserLessonProgress,
  getInstructorCourses,
  updateLessonStatus,
  toggleQuizVisibility
} from "../controllers/coursesController.js";
import { requireAuth, requireAdmin, preventStudentManagement, requireInstructorOrAdmin } from "../middleware/auth.js";

const router = express.Router();

// Helpers: validate optional "skills" (array of strings or comma-separated string)
// and forbid system-managed fields on write operations.
const validateSkills = body("skills")
  .optional()
  .custom((value) => {
    if (Array.isArray(value)) {
      const ok = value.every(v => typeof v === "string");
      if (!ok) throw new Error("skills array must contain strings only");
      return true;
    }
    if (typeof value === "string") {
      // allow comma-separated string; controller will normalize
      return true;
    }
    throw new Error("skills must be an array of strings or a comma-separated string");
  });

const forbidSystemManaged = [
  body("participatedUsers").not().exists().withMessage("participatedUsers is system-managed"),
  body("progress").not().exists().withMessage("progress is system-managed"),
];

// Get all courses
router.get("/", getAllCourses);

// Get course by ID
router.get("/:courseId", getCourseById);

// Reviews (simple JSONDB-based)
router.post('/:courseId/reviews', async (req, res) => {
  try {
    const { courseId } = req.params;
    const { userId, rating, comment } = req.body;
    if (!userId || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'userId and rating(1-5) are required' });
    }
    const db = await getDatabase();
    const courses = db.collection('courses');
    const course = await courses.findOne({ id: courseId });
    if (!course) return res.status(404).json({ message: 'Course not found' });
    const reviews = db.collection('reviews');
    const existing = await reviews.findOne({ courseId, userId });
    if (existing) {
      await reviews.updateOne({ id: existing.id }, { $set: { rating, comment } });
      return res.json({ message: 'Review updated' });
    }
    const review = { id: `review_${Date.now()}_${Math.random().toString(36).slice(2,9)}`, courseId, userId, rating, comment: comment || '' };
    await reviews.insertOne(review);
    res.status(201).json({ message: 'Review saved' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error saving review' });
  }
});

router.get('/:courseId/reviews', async (req, res) => {
  try {
    const { courseId } = req.params;
    const db = await getDatabase();
    const reviews = db.collection('reviews');
    const users = db.collection('users');
    const cursor = await reviews.find({ courseId });
    const list = await cursor.toArray();
    
    // Enrich reviews with user names
    const enrichedReviews = await Promise.all(list.map(async (review) => {
      try {
        const user = await users.findOne({ id: review.userId });
        return {
          ...review,
          userName: user ? (user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Anonymous') : 'Anonymous'
        };
      } catch (err) {
        console.error('Error fetching user for review:', err);
        return {
          ...review,
          userName: 'Anonymous'
        };
      }
    }));
    
    const avg = list.length ? list.reduce((s, r) => s + (r.rating || 0), 0) / list.length : 0;
    res.json({ average: Number(avg.toFixed(2)), count: list.length, reviews: enrichedReviews });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error fetching reviews' });
  }
});

// Create new course
router.post(
  "/",
  [
    requireAdmin,
    body("title").trim().notEmpty().withMessage("Title is required"),
    body("description").trim().notEmpty().withMessage("Description is required"),
    body("level").trim().notEmpty().withMessage("Level is required"),
    body("category").trim().notEmpty().withMessage("Category is required"),
    body("instructor").trim().notEmpty().withMessage("Instructor is required"),
    validateSkills,
    ...forbidSystemManaged,
  ],
  createCourse
);

// Update course (skills allowed; system-managed fields forbidden)
router.put(
  "/:courseId",
  [
    preventStudentManagement,
    validateSkills,
    ...forbidSystemManaged,
  ],
  updateCourse
);

// Delete course
router.delete("/:courseId", [requireAdmin], deleteCourse);

// Toggle course status (publish/unpublish)
router.patch("/:courseId/status", [preventStudentManagement], toggleCourseStatus);

// Start learning a course (increment learner count if progress > 0)
router.post("/:courseId/start-learning", [
  requireAuth,
  body("userId").notEmpty().withMessage("User ID is required"),
  body("progress").optional().isNumeric().withMessage("Progress must be a number"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
], startLearning);

// Update user progress in a course
router.put("/:courseId/progress", [
  requireAuth,
  body("userId").notEmpty().withMessage("User ID is required"),
  body("progress").isNumeric().withMessage("Progress must be a number"),
  body("chapterId").optional().isString().withMessage("Chapter ID must be a string"),
  body("lessonId").optional().isString().withMessage("Lesson ID must be a string"),
  body("completed").optional().isBoolean().withMessage("Completed must be a boolean")
], updateProgress);

// Get user's progress in a specific course
router.get("/:courseId/progress/:userId", getUserProgress);

// Get course analytics
router.get("/:courseId/analytics", getCourseAnalytics);

// Add lesson to course
router.post("/:courseId/lessons", [
  preventStudentManagement,
  body("title").trim().notEmpty().withMessage("Title is required"),
  body("description").trim().notEmpty().withMessage("Description is required"),
  body("order").optional().isNumeric().withMessage("Order must be a number"),
  body("duration").optional().isString().withMessage("Duration must be a string"),
  body("status").optional().isIn(["DRAFT", "PUBLISHED", "ARCHIVED"]).withMessage("Status must be DRAFT, PUBLISHED, or ARCHIVED")
], addLessonToCourse);

// Update lesson in course
router.put("/:courseId/lessons/:lessonId", [
  preventStudentManagement,
  body("title").optional().trim().notEmpty().withMessage("Title cannot be empty"),
  body("description").optional().trim().notEmpty().withMessage("Description cannot be empty"),
  body("order").optional().isNumeric().withMessage("Order must be a number"),
  body("duration").optional().isString().withMessage("Duration must be a string"),
  body("status").optional().isIn(["DRAFT", "PUBLISHED", "ARCHIVED"]).withMessage("Status must be DRAFT, PUBLISHED, or ARCHIVED")
], updateLessonInCourse);

// Delete lesson from course
router.delete("/:courseId/lessons/:lessonId", [preventStudentManagement], deleteLessonFromCourse);

// Track user lesson progress
router.post("/:courseId/lessons/:lessonId/progress", [
  requireAuth,
  body("userId").notEmpty().withMessage("User ID is required"),
  body("progress").optional().isNumeric().withMessage("Progress must be a number"),
  body("completed").optional().isBoolean().withMessage("Completed must be a boolean")
], trackLessonProgress);

// Get user's lesson progress
router.get("/:courseId/lessons/:lessonId/progress/:userId", [requireAuth], getUserLessonProgress);

// Get instructor's courses
router.get("/instructor/:instructorId", [requireInstructorOrAdmin], getInstructorCourses);

// Update lesson status for instructor
router.patch("/:courseId/lessons/:lessonId/status", [
  requireInstructorOrAdmin,
  body("instructorId").notEmpty().withMessage("Instructor ID is required"),
  body("status").isIn(["DRAFT", "PUBLISHED", "ARCHIVED"]).withMessage("Status must be DRAFT, PUBLISHED, or ARCHIVED")
], updateLessonStatus);

// Toggle quiz visibility for instructor
router.patch("/:courseId/lessons/:lessonId/quizzes/:quizId/visibility", [
  requireInstructorOrAdmin,
  body("instructorId").notEmpty().withMessage("Instructor ID is required")
], toggleQuizVisibility);
// Get lesson details (with chapters and quizzes)
router.get("/:courseId/lessons/:lessonId", async (req, res) => {
  try {
    const { courseId, lessonId } = req.params;
    const db = await getDatabase(); // JSON DB instance with .collection(name)

    // --- Get course ---
    const course = await db.collection("courses").findOne({ id: courseId });
    if (!course) return res.status(404).json({ error: "Course not found" });

    // Note: some courses may not embed lessons; trust the lesson's courseId check below

    // --- Get lesson ---
    const lesson = await db.collection("lessons").findOne({ id: lessonId, courseId });
    if (!lesson) return res.status(404).json({ error: "Lesson not found" });

    // --- Get chapters ---
    const allChapters = await db.collection("chapters").find({ lessonId, isPublished: true });
    const chaptersArray = await allChapters.toArray();

    // --- Get quizzes ---
    const allQuizzes = await db.collection("quizzes").find({ lessonId, isPublished: true });
    const quizzesArray = await allQuizzes.toArray();

    return res.status(200).json({
      lesson,
      chapters: chaptersArray,
      quizzes: quizzesArray,
    });
  } catch (err) {
    console.error("Error fetching lesson details:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
