import { getDatabase } from "../config/database.js";

export async function getAllLessons(req, res, next) {
  try {
    const db = await getDatabase();
    const lessonsCollection = db.collection('lessons');
    const chaptersCollection = db.collection('chapters');
    const quizzesCollection = db.collection('quizzes');

    const filter = {};
    if (req.query.courseId) {
      filter.courseId = req.query.courseId;
    }

    const findResult = await lessonsCollection.find(filter);
    const lessons = await findResult.toArray();

    // Optionally enrich with counts if asked
    if (req.query.withCounts === 'true') {
      const enriched = [];
      for (const lesson of lessons) {
        const chaptersCursor = await chaptersCollection.find({ lessonId: lesson.id, isPublished: true });
        const quizzesCursor = await quizzesCollection.find({ lessonId: lesson.id, isPublished: true });
        const [chapters, quizzes] = await Promise.all([
          chaptersCursor.toArray(),
          quizzesCursor.toArray(),
        ]);
        enriched.push({
          ...lesson,
          chaptersCount: chapters.length,
          quizzesCount: quizzes.length,
        });
      }
      return res.json(enriched);
    }

    res.json(lessons);
  } catch (err) {
    next(err);
  }
}

export async function getLessonById(req, res, next) {
  try {
    const { lessonId } = req.params;
    
    const db = await getDatabase();
    const lessonsCollection = db.collection('lessons');
    
    const lesson = await lessonsCollection.findOne({ id: lessonId });
    
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }
    
    res.json(lesson);
  } catch (err) {
    next(err);
  }
}

export async function getLessonsByCourseId(req, res, next) {
  try {
    const { courseId } = req.params;
    
    const db = await getDatabase();
    const lessonsCollection = db.collection('lessons');
    const chaptersCollection = db.collection('chapters');
    const quizzesCollection = db.collection('quizzes');
    
    const findResult = await lessonsCollection.find({ courseId });
    let lessons = await findResult.toArray();

    // Only published lessons for students; keep all for admins via flag
    if (req.query.publishedOnly === 'true') {
      lessons = lessons.filter(l => (l.status || 'DRAFT') === 'PUBLISHED');
    }

    const enriched = [];
    for (const lesson of lessons) {
      const chaptersCursor = await chaptersCollection.find({ lessonId: lesson.id, isPublished: true });
      const quizzesCursor = await quizzesCollection.find({ lessonId: lesson.id, isPublished: true });
      const [chapters, quizzes] = await Promise.all([
        chaptersCursor.toArray(),
        quizzesCursor.toArray(),
      ]);
      enriched.push({
        ...lesson,
        chaptersCount: chapters.length,
        quizzesCount: quizzes.length,
      });
    }
    
    res.json(enriched);
  } catch (err) {
    next(err);
  }
}

export async function createLesson(req, res, next) {
  try {
    const {
      title,
      description,
      courseId,
      order,
      duration,
      status = "DRAFT" // DRAFT, PUBLISHED, ARCHIVED
    } = req.body;
    
    if (!title || !description || !courseId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Validate status
    const validStatuses = ["DRAFT", "PUBLISHED", "ARCHIVED"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: "Invalid status. Must be one of: DRAFT, PUBLISHED, ARCHIVED" 
      });
    }
    
    const db = await getDatabase();
    const lessonsCollection = db.collection('lessons');

    const newLesson = {
      id: `lesson_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      description,
      courseId,
      order: typeof order === "number" ? order : 0,
      duration: duration || "0 min",
      status: status,
      chapters: [],
      quizzes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const { insertedId } = await lessonsCollection.insertOne(newLesson);
    
    res.status(201).json({
      message: "Lesson created successfully",
      lesson: newLesson,
      insertedId
    });
  } catch (err) {
    next(err);
  }
}

export async function updateLesson(req, res, next) {
  try {
    const { lessonId } = req.params;
    const updateData = { ...req.body };

    // Remove system-managed fields
    if (Object.prototype.hasOwnProperty.call(updateData, "chapters")) {
      delete updateData.chapters;
    }
    if (Object.prototype.hasOwnProperty.call(updateData, "quizzes")) {
      delete updateData.quizzes;
    }
    
    const db = await getDatabase();
    const lessonsCollection = db.collection('lessons');
    
    const result = await lessonsCollection.updateOne(
      { id: lessonId },
      { $set: { ...updateData, updatedAt: new Date().toISOString() } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Lesson not found" });
    }
    
    res.json({ message: "Lesson updated successfully" });
  } catch (err) {
    next(err);
  }
}

export async function deleteLesson(req, res, next) {
  try {
    const { lessonId } = req.params;
    
    const db = await getDatabase();
    const lessonsCollection = db.collection('lessons');
    
    const result = await lessonsCollection.deleteOne({ id: lessonId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Lesson not found" });
    }
    
    res.json({ message: "Lesson deleted successfully" });
  } catch (err) {
    next(err);
  }
}

export async function updateLessonStatus(req, res, next) {
  try {
    const { lessonId } = req.params;
    const { status } = req.body;
    
    // Validate status
    const validStatuses = ["DRAFT", "PUBLISHED", "ARCHIVED"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: "Invalid status. Must be one of: DRAFT, PUBLISHED, ARCHIVED" 
      });
    }
    
    const db = await getDatabase();
    const lessonsCollection = db.collection('lessons');
    
    const result = await lessonsCollection.updateOne(
      { id: lessonId },
      { $set: { status, updatedAt: new Date().toISOString() } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Lesson not found" });
    }
    
    res.json({ message: `Lesson status updated to ${status} successfully` });
  } catch (err) {
    next(err);
  }
}

// Get lesson with chapters and quizzes
export async function getLessonWithContent(req, res, next) {
  try {
    const { lessonId } = req.params;
    
    const db = await getDatabase();
    const lessonsCollection = db.collection('lessons');
    const chaptersCollection = db.collection('chapters');
    const quizzesCollection = db.collection('quizzes');
    
    const lesson = await lessonsCollection.findOne({ id: lessonId });
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }
    
    // Get chapters for this lesson
    const chaptersResult = await chaptersCollection.find({ lessonId });
    const chapters = await chaptersResult.toArray();
    
    // Get quizzes for this lesson
    const quizzesResult = await quizzesCollection.find({ lessonId });
    const quizzes = await quizzesResult.toArray();
    
    // Sort chapters by order
    chapters.sort((a, b) => a.order - b.order);
    
    // Sort quizzes by placement and order
    quizzes.sort((a, b) => {
      if (a.placement === b.placement) {
        return a.order - b.order;
      }
      const placementOrder = { 'between_chapters': 1, 'end': 2 };
      return (placementOrder[a.placement] || 3) - (placementOrder[b.placement] || 3);
    });
    
    res.json({
      ...lesson,
      chapters,
      quizzes
    });
  } catch (err) {
    next(err);
  }
}