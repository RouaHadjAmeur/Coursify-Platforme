import { getDatabase } from "../config/database.js";

export async function getAllQuizzes(req, res, next) {
  try {
    const db = await getDatabase();
    const quizzesCollection = db.collection('quizzes');
    
    const findResult = await quizzesCollection.find();
    const quizzes = await findResult.toArray();
    res.json(quizzes);
  } catch (err) {
    next(err);
  }
}

export async function getQuizById(req, res, next) {
  try {
    const { quizId } = req.params;
    
    const db = await getDatabase();
    const quizzesCollection = db.collection('quizzes');
    
    const quiz = await quizzesCollection.findOne({ id: quizId });
    
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }
    
    res.json(quiz);
  } catch (err) {
    next(err);
  }
}

export async function getQuizzesByLessonId(req, res, next) {
  try {
    const { lessonId } = req.params;
    
    const db = await getDatabase();
    const quizzesCollection = db.collection('quizzes');
    const chaptersCollection = db.collection('chapters');
    
    const findResult = await quizzesCollection.find({ lessonId });
    const quizzes = await findResult.toArray();
    
    // Get chapters for this lesson to understand placement
    const chaptersResult = await chaptersCollection.find({ lessonId });
    const chapters = await chaptersResult.toArray();
    
    // Sort chapters by order
    chapters.sort((a, b) => a.order - b.order);
    
    // Add placement context to quizzes
    const quizzesWithPlacement = quizzes.map(quiz => ({
      ...quiz,
      placementContext: {
        lessonId: lessonId,
        totalChapters: chapters.length,
        chapters: chapters.map(ch => ({ id: ch.id, title: ch.title, order: ch.order }))
      }
    }));
    
    res.json(quizzesWithPlacement);
  } catch (err) {
    next(err);
  }
}

export async function createQuiz(req, res, next) {
  try {
    const {
      title,
      description,
      lessonId,
      timeLimit, // in minutes
      passingScore, // percentage
      questions,
      isPublished = false,
      placement = "end" // "end", "between_chapters", or specific chapter positions
    } = req.body;
    
    if (!title || !lessonId || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "Missing required fields or invalid questions" });
    }
    
    // Validate questions structure
    for (const question of questions) {
      if (!question.question || !Array.isArray(question.options) || 
          question.options.length < 2 || !Array.isArray(question.correctAnswers) ||
          question.correctAnswers.length === 0) {
        return res.status(400).json({ 
          message: "Each question must have question text, at least 2 options, and correct answers" 
        });
      }
    }
    
    const db = await getDatabase();
    const quizzesCollection = db.collection('quizzes');

    const newQuiz = {
      id: `quiz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      description: description || "",
      lessonId,
      timeLimit: typeof timeLimit === "number" ? timeLimit : 30, // default 30 minutes
      passingScore: typeof passingScore === "number" ? passingScore : 70, // default 70%
      questions,
      placement: placement,
      isPublished: Boolean(isPublished),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const { insertedId } = await quizzesCollection.insertOne(newQuiz);
    
    res.status(201).json({
      message: "Quiz created successfully",
      quiz: newQuiz,
      insertedId
    });
  } catch (err) {
    next(err);
  }
}

export async function updateQuiz(req, res, next) {
  try {
    const { quizId } = req.params;
    const updateData = { ...req.body };
    
    // Validate questions if provided
    if (updateData.questions && Array.isArray(updateData.questions)) {
      for (const question of updateData.questions) {
        if (!question.question || !Array.isArray(question.options) || 
            question.options.length < 2 || !Array.isArray(question.correctAnswers) ||
            question.correctAnswers.length === 0) {
          return res.status(400).json({ 
            message: "Each question must have question text, at least 2 options, and correct answers" 
          });
        }
      }
    }
    
    const db = await getDatabase();
    const quizzesCollection = db.collection('quizzes');
    
    const result = await quizzesCollection.updateOne(
      { id: quizId },
      { $set: { ...updateData, updatedAt: new Date().toISOString() } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Quiz not found" });
    }
    
    res.json({ message: "Quiz updated successfully" });
  } catch (err) {
    next(err);
  }
}

export async function deleteQuiz(req, res, next) {
  try {
    const { quizId } = req.params;
    
    const db = await getDatabase();
    const quizzesCollection = db.collection('quizzes');
    
    const result = await quizzesCollection.deleteOne({ id: quizId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Quiz not found" });
    }
    
    res.json({ message: "Quiz deleted successfully" });
  } catch (err) {
    next(err);
  }
}

export async function toggleQuizStatus(req, res, next) {
  try {
    const { quizId } = req.params;
    const { isPublished } = req.body;
    
    if (typeof isPublished !== "boolean") {
      return res.status(400).json({ message: "isPublished must be a boolean" });
    }
    
    const db = await getDatabase();
    const quizzesCollection = db.collection('quizzes');
    
    const result = await quizzesCollection.updateOne(
      { id: quizId },
      { $set: { isPublished, updatedAt: new Date().toISOString() } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Quiz not found" });
    }
    
    res.json({ message: `Quiz ${isPublished ? 'published' : 'unpublished'} successfully` });
  } catch (err) {
    next(err);
  }
}

export async function submitQuizAnswers(req, res, next) {
  try {
    const { quizId } = req.params;
    const { answers, userId } = req.body;
    
    if (!answers || !Array.isArray(answers) || !userId) {
      return res.status(400).json({ message: "Missing answers or userId" });
    }
    
    const db = await getDatabase();
    const quizzesCollection = db.collection('quizzes');
    
    const quiz = await quizzesCollection.findOne({ id: quizId });
    
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }
    
    // Calculate score
    let correctAnswers = 0;
    const results = [];
    
    for (let i = 0; i < quiz.questions.length; i++) {
      const question = quiz.questions[i];
      const userAnswer = answers[i] || [];
      
      // Check if user's answer matches correct answer
      const isCorrect = JSON.stringify(userAnswer.sort()) === JSON.stringify(question.correctAnswers.sort());
      
      if (isCorrect) {
        correctAnswers++;
      }
      
      results.push({
        questionIndex: i,
        question: question.question,
        userAnswer,
        correctAnswer: question.correctAnswers,
        isCorrect,
        explanation: question.explanation || ""
      });
    }
    
    const score = Math.round((correctAnswers / quiz.questions.length) * 100);
    const passed = score >= quiz.passingScore;
    
    res.json({
      score,
      passed,
      correctAnswers,
      totalQuestions: quiz.questions.length,
      passingScore: quiz.passingScore,
      results
    });
  } catch (err) {
    next(err);
  }
}

// Add quiz to lesson
export async function addQuizToLesson(req, res, next) {
  try {
    const { lessonId } = req.params;
    const { title, description, timeLimit, passingScore, questions } = req.body;
    
    if (!title || !questions || !Array.isArray(questions)) {
      return res.status(400).json({ message: "Title and questions array are required" });
    }
    
    const db = await getDatabase();
    const lessonsCollection = db.collection('lessons');
    
    const lesson = await lessonsCollection.findOne({ id: lessonId });
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }
    
    const newQuiz = {
      id: `quiz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      description: description || "",
      timeLimit: typeof timeLimit === "number" ? timeLimit : 30,
      passingScore: typeof passingScore === "number" ? passingScore : 70,
      questions: questions.map((q, index) => ({
        question: q.question,
        options: q.options || [],
        correctAnswers: q.correctAnswers || [],
        explanation: q.explanation || "",
        order: index + 1
      })),
      isPublished: false,
      createdAt: new Date().toISOString()
    };
    
    await lessonsCollection.updateOne(
      { id: lessonId },
      { 
        $push: { quizzes: newQuiz },
        $set: { updatedAt: new Date().toISOString() }
      }
    );
    
    res.status(201).json({
      message: "Quiz added successfully",
      quiz: newQuiz
    });
  } catch (err) {
    next(err);
  }
}

// Update quiz in lesson
export async function updateQuizInLesson(req, res, next) {
  try {
    const { lessonId, quizId } = req.params;
    const { title, description, timeLimit, passingScore, questions, isPublished } = req.body;
    
    const db = await getDatabase();
    const lessonsCollection = db.collection('lessons');
    
    const lesson = await lessonsCollection.findOne({ id: lessonId });
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }
    
    const quizIndex = lesson.quizzes?.findIndex(q => q.id === quizId);
    if (quizIndex === -1) {
      return res.status(404).json({ message: "Quiz not found" });
    }
    
    const updateFields = {};
    if (title !== undefined) updateFields[`quizzes.${quizIndex}.title`] = title;
    if (description !== undefined) updateFields[`quizzes.${quizIndex}.description`] = description;
    if (timeLimit !== undefined) updateFields[`quizzes.${quizIndex}.timeLimit`] = timeLimit;
    if (passingScore !== undefined) updateFields[`quizzes.${quizIndex}.passingScore`] = passingScore;
    if (isPublished !== undefined) updateFields[`quizzes.${quizIndex}.isPublished`] = isPublished;
    if (questions !== undefined) {
      updateFields[`quizzes.${quizIndex}.questions`] = questions.map((q, index) => ({
        question: q.question,
        options: q.options || [],
        correctAnswers: q.correctAnswers || [],
        explanation: q.explanation || "",
        order: index + 1
      }));
    }
    
    updateFields[`quizzes.${quizIndex}.updatedAt`] = new Date().toISOString();
    updateFields.updatedAt = new Date().toISOString();
    
    await lessonsCollection.updateOne(
      { id: lessonId },
      { $set: updateFields }
    );
    
    res.json({
      message: "Quiz updated successfully"
    });
  } catch (err) {
    next(err);
  }
}

// Delete quiz from lesson
export async function deleteQuizFromLesson(req, res, next) {
  try {
    const { lessonId, quizId } = req.params;
    
    const db = await getDatabase();
    const lessonsCollection = db.collection('lessons');
    
    await lessonsCollection.updateOne(
      { id: lessonId },
      { 
        $pull: { quizzes: { id: quizId } },
        $set: { updatedAt: new Date().toISOString() }
      }
    );
    
    res.json({
      message: "Quiz deleted successfully"
    });
  } catch (err) {
    next(err);
  }
}

// Submit quiz and save evaluation
export async function submitQuizAndSaveEvaluation(req, res, next) {
  try {
    const { quizId } = req.params;
    const { userId, answers } = req.body;
    
    if (!userId || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ message: "User ID and answers array are required" });
    }
    
    const db = await getDatabase();
    const quizzesCollection = db.collection('quizzes');
    
    const quiz = await quizzesCollection.findOne({ id: quizId });
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Enforce single attempt per user
    const existing = (quiz.evaluations || []).find(ev => ev.userId === userId);
    if (existing) {
      return res.status(409).json({
        message: "Quiz already submitted by this user",
        evaluation: {
          score: existing.score,
          passed: existing.passed,
          correctAnswers: existing.correctAnswers,
          totalQuestions: existing.totalQuestions,
          passingScore: existing.passingScore,
          results: existing.results
        }
      });
    }
    
    // Calculate score and results
    let correctAnswers = 0;
    const results = [];
    
    for (let i = 0; i < quiz.questions.length; i++) {
      const question = quiz.questions[i];
      const userAnswer = answers[i] || [];
      
      // Check if user's answer matches correct answer
      const isCorrect = JSON.stringify(userAnswer.sort()) === JSON.stringify(question.correctAnswers.sort());
      
      if (isCorrect) {
        correctAnswers++;
      }
      
      results.push({
        questionIndex: i,
        question: question.question,
        userAnswer,
        correctAnswer: question.correctAnswers,
        isCorrect,
        explanation: question.explanation || ""
      });
    }
    
    const score = Math.round((correctAnswers / quiz.questions.length) * 100);
    const passed = score >= quiz.passingScore;
    
    // Save the evaluation
    const evaluation = {
      id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      quizId,
      score,
      passed,
      correctAnswers,
      totalQuestions: quiz.questions.length,
      passingScore: quiz.passingScore,
      answers,
      results,
      submittedAt: new Date().toISOString()
    };
    
    // Add evaluation to quiz
    await quizzesCollection.updateOne(
      { id: quizId },
      { 
        $push: { evaluations: evaluation },
        $set: { updatedAt: new Date().toISOString() }
      }
    );
    
    res.json({
      message: "Quiz submitted and evaluation saved successfully",
      evaluation: {
        score,
        passed,
        correctAnswers,
        totalQuestions: quiz.questions.length,
        passingScore: quiz.passingScore,
        results
      }
    });
  } catch (err) {
    next(err);
  }
}

// Get user's quiz evaluations
export async function getUserQuizEvaluations(req, res, next) {
  try {
    const { userId } = req.params;
    
    const db = await getDatabase();
    const quizzesCollection = db.collection('quizzes');
    
    const quizzesCursor = await quizzesCollection.find({});
    const quizzes = await quizzesCursor.toArray();
    const userEvaluations = [];
    
    for (const quiz of quizzes) {
      if (quiz.evaluations) {
        const userEvals = quiz.evaluations.filter(evaluation => evaluation.userId === userId);
        for (const evaluation of userEvals) {
          userEvaluations.push({
            quizId: quiz.id,
            quizTitle: quiz.title,
            evaluation: evaluation
          });
        }
      }
    }
    
    res.json({
      userId,
      evaluations: userEvaluations
    });
  } catch (err) {
    next(err);
  }
}