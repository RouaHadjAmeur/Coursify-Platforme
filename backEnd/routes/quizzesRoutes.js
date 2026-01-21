import express from 'express';
import { body } from 'express-validator';
import {
  getAllQuizzes,
  getQuizById,
  getQuizzesByLessonId,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  toggleQuizStatus,
  submitQuizAnswers,
  addQuizToLesson,
  updateQuizInLesson,
  deleteQuizFromLesson,
  submitQuizAndSaveEvaluation,
  getUserQuizEvaluations
} from '../controllers/quizzesController.js';
import { requireAuth, preventStudentManagement } from '../middleware/auth.js';

const router = express.Router();

// Get all quizzes
router.get('/', getAllQuizzes);

// Get quiz by ID
router.get('/:quizId', getQuizById);

// Get quizzes by lesson ID
router.get('/lesson/:lessonId', getQuizzesByLessonId);

// Create new quiz
router.post('/', [preventStudentManagement], createQuiz);

// Update quiz
router.put('/:quizId', [preventStudentManagement], updateQuiz);

// Delete quiz
router.delete('/:quizId', [preventStudentManagement], deleteQuiz);

// Toggle quiz status (published/unpublished)
router.patch('/:quizId/status', [preventStudentManagement], toggleQuizStatus);

// Submit quiz answers for evaluation
router.post('/:quizId/submit', [requireAuth], submitQuizAnswers);

// Add quiz to lesson
router.post('/lesson/:lessonId', [preventStudentManagement], addQuizToLesson);

// Update quiz in lesson
router.put('/lesson/:lessonId/:quizId', [preventStudentManagement], updateQuizInLesson);

// Delete quiz from lesson
router.delete('/lesson/:lessonId/:quizId', [preventStudentManagement], deleteQuizFromLesson);

// Submit quiz and save evaluation
router.post('/:quizId/submit-evaluation', [
  requireAuth,
  body("userId").notEmpty().withMessage("User ID is required"),
  body("answers").isArray().withMessage("Answers must be an array")
], submitQuizAndSaveEvaluation);

// Get user's quiz evaluations
router.get('/evaluations/:userId', [requireAuth], getUserQuizEvaluations);

export default router;
