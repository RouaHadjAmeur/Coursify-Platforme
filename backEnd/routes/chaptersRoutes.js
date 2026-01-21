import express from 'express';
import {
  getAllChapters,
  getChapterById,
  getChaptersByLessonId,
  createChapter,
  updateChapter,
  deleteChapter,
  toggleChapterStatus,
  importChapterFromFile,
  exportChapter,
  addSectionToChapter,
  updateSectionInChapter,
  deleteSectionFromChapter,
  uploadFile,
  upload
} from '../controllers/chaptersController.js';
import { requireAuth, preventStudentManagement } from '../middleware/auth.js';

const router = express.Router();

// Get all chapters
router.get('/', getAllChapters);

// Get chapter by ID
router.get('/:chapterId', getChapterById);

// Get chapters by lesson ID
router.get('/lesson/:lessonId', getChaptersByLessonId);

// Create new chapter
router.post('/', [preventStudentManagement], createChapter);

// Update chapter
router.put('/:chapterId', [preventStudentManagement], updateChapter);

// Delete chapter
router.delete('/:chapterId', [preventStudentManagement], deleteChapter);

// Toggle chapter status (published/unpublished)
router.patch('/:chapterId/status', [preventStudentManagement], toggleChapterStatus);

// Upload file for chapter content (used by mixed content)
router.post('/upload', [preventStudentManagement, upload.single('file')], uploadFile);

// Import chapter from file (PDF, DOC, TXT)
router.post('/import', [preventStudentManagement, upload.single('file')], importChapterFromFile);

// Export chapter content
router.get('/:chapterId/export', exportChapter);

// Section management within chapters
router.post('/:chapterId/sections', [preventStudentManagement], addSectionToChapter);
router.put('/:chapterId/sections/:sectionId', [preventStudentManagement], updateSectionInChapter);
router.delete('/:chapterId/sections/:sectionId', [preventStudentManagement], deleteSectionFromChapter);

export default router;
