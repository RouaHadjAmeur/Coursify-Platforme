import express from 'express';
import {
  getAllLessons,
  getLessonById,
  getLessonsByCourseId,
  createLesson,
  updateLesson,
  deleteLesson,
  updateLessonStatus,
  getLessonWithContent
} from '../controllers/lessonsController.js';
import { requireAuth, preventStudentManagement } from '../middleware/auth.js';

const router = express.Router();

// Get all lessons
router.get('/', getAllLessons);

// Get lesson by ID
router.get('/:lessonId', getLessonById);

// Get lesson with chapters and quizzes
router.get('/:lessonId/content', getLessonWithContent);

// Get lessons by course ID
router.get('/course/:courseId', getLessonsByCourseId);

// Create new lesson
router.post('/', [preventStudentManagement], createLesson);

// Update lesson
router.put('/:lessonId', [preventStudentManagement], updateLesson);

// Delete lesson
router.delete('/:lessonId', [preventStudentManagement], deleteLesson);

// Update lesson status (DRAFT, PUBLISHED, ARCHIVED)
router.patch('/:lessonId/status', [preventStudentManagement], updateLessonStatus);

export default router;
