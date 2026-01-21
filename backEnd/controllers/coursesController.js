import { getDatabase } from "../config/database.js";

function normalizeSkills(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map(s => (typeof s === "string" ? s.trim() : ""))
      .filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
  }
  return [];
}

export async function getAllCourses(req, res, next) {
  try {
    const db = await getDatabase();
    const coursesCollection = db.collection('courses');
    
    const findResult = await coursesCollection.find();
    const courses = await findResult.toArray();
    res.json(courses);
  } catch (err) {
    next(err);
  }
}

export async function getCourseById(req, res, next) {
  try {
    const { courseId } = req.params;
    
    const db = await getDatabase();
    const coursesCollection = db.collection('courses');
    
    const course = await coursesCollection.findOne({ id: courseId });
    
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    
    res.json(course);
  } catch (err) {
    next(err);
  }
}

export async function createCourse(req, res, next) {
  try {
    const {
      title,
      description,
      level,
      image,
      hours,
      learners,
      certificate,
      price,
      category,
      instructor,
      skills: skillsInput,
      sections = [] // Array of course sections (e.g., Part 1, Part 2)
    } = req.body;
    
    if (!title || !description || !level || !category || !instructor) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    
    const db = await getDatabase();
    const coursesCollection = db.collection('courses');

    const skills = normalizeSkills(skillsInput);

    const newCourse = {
      id: `course_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      description,
      level,
      image: image || "https://picsum.photos/seed/default/600/400",
      hours: hours || "2-3 hrs",
      learners: typeof learners === "number" ? learners : 0,
      certificate: Boolean(certificate) || false,
      price: typeof price === "number" ? price : 0,
      category,
      instructor,
      sections: sections, // Course sections (Part 1, Part 2, etc.)
      skills,                     // array of strings
      participatedUsers: [],      // managed later by system
      progress: 0,                // static for now
      createdAt: new Date().toISOString(),
      status: "draft"
    };
    
    const { insertedId } = await coursesCollection.insertOne(newCourse);
    
    res.status(201).json({
      message: "Course created successfully",
      course: newCourse,
      insertedId
    });
  } catch (err) {
    next(err);
  }
}

export async function updateCourse(req, res, next) {
  try {
    const { courseId } = req.params;
    const updateData = { ...req.body };

    // Normalize/lock new fields
    if (Object.prototype.hasOwnProperty.call(updateData, "skills")) {
      updateData.skills = normalizeSkills(updateData.skills);
    }
    // For now, progress & participatedUsers are system-managed; ignore client updates
    if (Object.prototype.hasOwnProperty.call(updateData, "progress")) {
      delete updateData.progress;
    }
    if (Object.prototype.hasOwnProperty.call(updateData, "participatedUsers")) {
      delete updateData.participatedUsers;
    }
    
    const db = await getDatabase();
    const coursesCollection = db.collection('courses');
    
    const result = await coursesCollection.updateOne(
      { id: courseId },
      { $set: { ...updateData, updatedAt: new Date().toISOString() } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Course not found" });
    }
    
    res.json({ message: "Course updated successfully" });
  } catch (err) {
    next(err);
  }
}

export async function deleteCourse(req, res, next) {
  try {
    const { courseId } = req.params;
    
    const db = await getDatabase();
    const coursesCollection = db.collection('courses');
    
    const result = await coursesCollection.deleteOne({ id: courseId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Course not found" });
    }
    
    res.json({ message: "Course deleted successfully" });
  } catch (err) {
    next(err);
  }
}

export async function toggleCourseStatus(req, res, next) {
  try {
    const { courseId } = req.params;
    const { status } = req.body;
    
    if (!["published", "draft"].includes(status)) {
      return res.status(400).json({ message: "Invalid status. Use 'published' or 'draft'" });
    }
    
    const db = await getDatabase();
    const coursesCollection = db.collection('courses');
    
    const result = await coursesCollection.updateOne(
      { id: courseId },
      { $set: { status, updatedAt: new Date().toISOString() } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Course not found" });
    }
    
    res.json({ message: `Course ${status} successfully` });
  } catch (err) {
    next(err);
  }
}

// POST /api/courses/:courseId/lessons/:lessonId/start
export async function startLesson(req, res, next) {
  try {
    const { courseId, lessonId } = req.params;
    const { userId } = req.body;

    if (!userId) return res.status(400).json({ message: "User ID is required" });

    const db = await getDatabase();
    const coursesCollection = db.collection('courses');

    // Find course and lesson
    const course = await coursesCollection.findOne({ id: courseId });
    if (!course) return res.status(404).json({ message: "Course not found" });

    const lesson = course.lessons?.find(l => l.id === lessonId);
    if (!lesson) return res.status(404).json({ message: "Lesson not found in this course" });

    // Check if user already exists
    let participatedUsers = course.participatedUsers || [];
    let userIndex = participatedUsers.findIndex(u => u.userId === userId);

    const now = new Date().toISOString();

    if (userIndex === -1) {
      // Add new user progress
      await coursesCollection.updateOne(
        { id: courseId },
        {
          $push: {
            participatedUsers: {
              userId,
              currentLesson: lessonId,
              lessonsCompleted: [],
              progress: 0,
              startedAt: now,
              lastAccessedAt: now,
              lastUpdated: now
            }
          },
          $set: { updatedAt: now }
        }
      );
    } else {
      // Update current lesson
      await coursesCollection.updateOne(
        { id: courseId, "participatedUsers.userId": userId },
        {
          $set: {
            "participatedUsers.$.currentLesson": lessonId,
            "participatedUsers.$.lastAccessedAt": now,
            "participatedUsers.$.lastUpdated": now,
            updatedAt: now
          }
        }
      );
    }

    res.json({ message: "Lesson started successfully", lessonId });
  } catch (err) {
    next(err);
  }
}


export async function startLearning(req, res, next) {
  try {
    const { courseId } = req.params;
    let { userId, progress = 0 } = req.body;
    
    // Ensure progress is a number
    progress = typeof progress === 'string' ? parseFloat(progress) : Number(progress);
    if (isNaN(progress)) {
      progress = 0;
    }
    
    console.log('startLearning called:', { courseId, userId, progress, progressType: typeof progress });
    
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }
    
    const db = await getDatabase();
    const coursesCollection = db.collection('courses');
    
    // Find the course
    const course = await coursesCollection.findOne({ id: courseId });
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    
    // Ensure learners field exists (initialize to 0 if it doesn't)
    // MongoDB $inc will create the field if it doesn't exist, but let's be explicit
    if (course.learners === undefined || course.learners === null) {
      const initResult = await coursesCollection.updateOne(
        { id: courseId },
        { $set: { learners: 0 } }
      );
      course.learners = 0;
      console.log('Initialized learners field to 0. Update result:', {
        matchedCount: initResult.matchedCount,
        modifiedCount: initResult.modifiedCount
      });
    }
    
    // Ensure participatedUsers array exists
    if (!course.participatedUsers || !Array.isArray(course.participatedUsers)) {
      await coursesCollection.updateOne(
        { id: courseId },
        { $set: { participatedUsers: [] } }
      );
      course.participatedUsers = [];
    }
    
    // Check if user is already in participatedUsers
    const existingUser = course.participatedUsers.find(user => user.userId === userId);
    const userAlreadyParticipated = !!existingUser;
    const existingProgress = existingUser?.progress || 0;
    
    console.log('User participation check:', {
      userAlreadyParticipated,
      existingProgress,
      newProgress: progress,
      currentLearners: course.learners || 0
    });
    
    // Update or add user to participatedUsers
    // Since the database wrapper doesn't support $push, we need to read, modify, and update
    const courseToUpdate = await coursesCollection.findOne({ id: courseId });
    if (!courseToUpdate) {
      return res.status(404).json({ message: "Course not found" });
    }
    
    // Ensure participatedUsers array exists
    if (!Array.isArray(courseToUpdate.participatedUsers)) {
      courseToUpdate.participatedUsers = [];
    }
    
    if (!userAlreadyParticipated) {
      // New user - add them to participatedUsers
      try {
        const newUserEntry = {
          userId,
          progress,
          startedAt: new Date().toISOString(),
          completedAt: null,
          lastAccessedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        };
        
        courseToUpdate.participatedUsers.push(newUserEntry);
        courseToUpdate.updatedAt = new Date().toISOString();
        
        const updateResult = await coursesCollection.updateOne(
          { id: courseId },
          { 
            $set: { 
              participatedUsers: courseToUpdate.participatedUsers,
              updatedAt: courseToUpdate.updatedAt
            }
          }
        );
        console.log('✅ Added new user to participatedUsers. Update result:', {
          matchedCount: updateResult.matchedCount,
          modifiedCount: updateResult.modifiedCount,
          newParticipatedUsersCount: courseToUpdate.participatedUsers.length
        });
      } catch (updateErr) {
        console.error('Error adding new user:', updateErr);
        throw updateErr;
      }
    } else {
      // Existing user - update their progress
      try {
        const userIndex = courseToUpdate.participatedUsers.findIndex(u => u.userId === userId);
        if (userIndex !== -1) {
          courseToUpdate.participatedUsers[userIndex] = {
            ...courseToUpdate.participatedUsers[userIndex],
            progress,
            lastUpdated: new Date().toISOString(),
            lastAccessedAt: new Date().toISOString()
          };
        } else {
          // User not found in array, add them
          courseToUpdate.participatedUsers.push({
            userId,
            progress,
            startedAt: new Date().toISOString(),
            completedAt: null,
            lastAccessedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          });
        }
        
        courseToUpdate.updatedAt = new Date().toISOString();
        
        const updateResult = await coursesCollection.updateOne(
          { id: courseId },
          { 
            $set: { 
              participatedUsers: courseToUpdate.participatedUsers,
              updatedAt: courseToUpdate.updatedAt
            }
          }
        );
        
        console.log('✅ Updated existing user progress. Update result:', {
          matchedCount: updateResult.matchedCount,
          modifiedCount: updateResult.modifiedCount,
          userIndex,
          participatedUsersCount: courseToUpdate.participatedUsers.length
        });
      } catch (updateErr) {
        console.error('Error updating existing user progress:', updateErr);
        throw updateErr;
      }
    }
    
    // Recalculate learners count from participatedUsers
    // Query the updated course to get the latest data
    const updatedCourse = await coursesCollection.findOne({ id: courseId });
    
    if (!updatedCourse) {
      console.error('Course not found after update');
      return res.status(404).json({ message: "Course not found" });
    }
    
    // Count unique users with progress > 0
    // Ensure we handle both number and string progress values
    const participatedUsers = updatedCourse.participatedUsers || [];
    const uniqueLearners = participatedUsers.filter(u => {
      const userProgress = typeof u.progress === 'string' ? parseFloat(u.progress) : Number(u.progress);
      return !isNaN(userProgress) && userProgress > 0;
    }).length;
    
    console.log('Learners count calculation:', {
      totalParticipants: participatedUsers.length,
      learnersWithProgress: uniqueLearners,
      participants: participatedUsers.map(u => ({ 
        userId: u.userId, 
        progress: u.progress,
        progressType: typeof u.progress,
        progressAsNumber: typeof u.progress === 'string' ? parseFloat(u.progress) : Number(u.progress)
      }))
    });
    
    // Update the learners field to match the actual count
    const updateResult = await coursesCollection.updateOne(
      { id: courseId },
      { $set: { learners: uniqueLearners } }
    );
    
    console.log('Learners count update result:', {
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount,
      newLearnersCount: uniqueLearners
    });
    
    // Verify by querying the updated document
    const verifyCourse = await coursesCollection.findOne({ id: courseId });
    
    console.log('✅ startLearning completed successfully:', {
      previousLearners: course.learners || 0,
      calculatedLearners: uniqueLearners,
      verifiedLearners: verifyCourse?.learners || 0,
      userAlreadyParticipated,
      previousProgress: existingProgress,
      newProgress: progress,
      totalParticipants: verifyCourse?.participatedUsers?.length || 0,
      participantsWithProgress: verifyCourse?.participatedUsers?.filter(u => {
        const p = typeof u.progress === 'string' ? parseFloat(u.progress) : Number(u.progress);
        return !isNaN(p) && p > 0;
      }).length || 0
    });
    
    // Use the calculated count
    const finalLearnersCount = uniqueLearners;
    
    res.json({ 
      message: "Learning progress updated successfully",
      progress,
      currentLearners: finalLearnersCount
    });
  } catch (err) {
    console.error('Error in startLearning:', err);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    console.error('Error name:', err.name);
    
    // Return a more detailed error response
    res.status(500).json({ 
      message: "Error updating learning progress",
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}

export async function updateProgress(req, res, next) {
  try {
    const { courseId } = req.params;
    const { userId, progress, chapterId, lessonId, completed } = req.body;
    
    if (!userId || progress === undefined) {
      return res.status(400).json({ message: "User ID and progress are required" });
    }
    
    const db = await getDatabase();
    const coursesCollection = db.collection('courses');
    
    // Find the course
    const course = await coursesCollection.findOne({ id: courseId });
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    
    // Check if user is already in participatedUsers
    const userExists = course.participatedUsers?.some(user => user.userId === userId) || false;
    
    if (userExists) {
      // Update existing user's progress
      const updateData = {
        "participatedUsers.$.progress": progress,
        "participatedUsers.$.lastUpdated": new Date().toISOString(),
        "participatedUsers.$.lastAccessedAt": new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // If completed, set completion date
      if (completed && progress >= 100) {
        updateData["participatedUsers.$.completedAt"] = new Date().toISOString();
      }
      
      // Add chapter/lesson tracking if provided
      if (chapterId) {
        updateData["participatedUsers.$.currentChapter"] = chapterId;
      }
      if (lessonId) {
        updateData["participatedUsers.$.currentLesson"] = lessonId;
      }
      
      const result = await coursesCollection.updateOne(
        { 
          id: courseId,
          "participatedUsers.userId": userId
        },
        { $set: updateData }
      );
      
      if (result.matchedCount === 0) {
        return res.status(404).json({ message: "User not found in course participants" });
      }
    } else {
      // User doesn't exist, add them to participatedUsers
      await coursesCollection.updateOne(
        { id: courseId },
        {
          $push: {
            participatedUsers: {
              userId,
              progress,
              startedAt: new Date().toISOString(),
              completedAt: completed && progress >= 100 ? new Date().toISOString() : null,
              lastAccessedAt: new Date().toISOString(),
              currentChapter: chapterId || null,
              currentLesson: lessonId || null
            }
          },
          $set: { updatedAt: new Date().toISOString() }
        }
      );
    }
    
    res.json({ 
      message: "Progress updated successfully",
      progress,
      completed: progress >= 100
    });
  } catch (err) {
    next(err);
  }
}

export async function getUserProgress(req, res) {
  try {
    const { courseId, userId } = req.params;
    const db = await getDatabase();

    const course = await db.collection("courses").findOne({ id: courseId });
    if (!course) return res.status(404).json({ error: "Course not found" });

    // Look for user in participatedUsers
    const user = course.participatedUsers?.find(u => u.userId === userId);

    if (!user) {
      return res.status(200).json({
        userId,
        courseId,
        progress: 0,
        completedLessons: []
      });
    }

    // If user exists, return their progress and completed lessons
    return res.status(200).json({
      userId,
      courseId,
      progress: user.progress || 0,
      completedLessons: user.lessonsCompleted || []
    });
  } catch (err) {
    console.error("Error fetching user progress:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}


export async function getCourseAnalytics(req, res, next) {
  try {
    const { courseId } = req.params;
    
    const db = await getDatabase();
    const coursesCollection = db.collection('courses');
    
    // Find the course
    const course = await coursesCollection.findOne({ id: courseId });
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    
    const participants = course.participatedUsers || [];
    
    // Calculate analytics
    const totalParticipants = participants.length;
    const completedCount = participants.filter(p => p.progress >= 100).length;
    const averageProgress = totalParticipants > 0 
      ? participants.reduce((sum, p) => sum + (p.progress || 0), 0) / totalParticipants 
      : 0;
    
    // Progress distribution
    const progressDistribution = {
      started: participants.filter(p => p.progress > 0 && p.progress < 25).length,
      quarter: participants.filter(p => p.progress >= 25 && p.progress < 50).length,
      half: participants.filter(p => p.progress >= 50 && p.progress < 75).length,
      threeQuarter: participants.filter(p => p.progress >= 75 && p.progress < 100).length,
      completed: completedCount
    };
    
    res.json({
      courseId: course.id,
      courseTitle: course.title,
      totalLearners: course.learners || 0,
      totalParticipants,
      completedCount,
      completionRate: totalParticipants > 0 ? (completedCount / totalParticipants) * 100 : 0,
      averageProgress: Math.round(averageProgress * 100) / 100,
      progressDistribution
    });
  } catch (err) {
    next(err);
  }
}

// Add lesson to course
export async function addLessonToCourse(req, res, next) {
  try {
    const { courseId } = req.params;
    const { title, description, order, duration, status = "DRAFT" } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ message: "Title and description are required" });
    }
    
    // Validate status
    const validStatuses = ["DRAFT", "PUBLISHED", "ARCHIVED"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status. Must be one of: DRAFT, PUBLISHED, ARCHIVED"
      });
    }
    
    const db = await getDatabase();
    const coursesCollection = db.collection('courses');
    
    const course = await coursesCollection.findOne({ id: courseId });
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    
    const newLesson = {
      id: `lesson_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      description,
      order: typeof order === "number" ? order : (course.lessons?.length || 0) + 1,
      duration: duration || "0 min",
      status: status, // DRAFT, PUBLISHED, ARCHIVED
      chapters: [],
      quizzes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await coursesCollection.updateOne(
      { id: courseId },
      { 
        $push: { lessons: newLesson },
        $set: { updatedAt: new Date().toISOString() }
      }
    );
    
    res.status(201).json({
      message: "Lesson added successfully",
      lesson: newLesson
    });
  } catch (err) {
    next(err);
  }
}

// Update lesson in course
export async function updateLessonInCourse(req, res, next) {
  try {
    const { courseId, lessonId } = req.params;
    const { title, description, order, duration, status } = req.body;
    
    const db = await getDatabase();
    const coursesCollection = db.collection('courses');
    
    const course = await coursesCollection.findOne({ id: courseId });
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    
    const lessonIndex = course.lessons?.findIndex(l => l.id === lessonId);
    if (lessonIndex === -1) {
      return res.status(404).json({ message: "Lesson not found" });
    }
    
    // Validate status if provided
    if (status !== undefined) {
      const validStatuses = ["DRAFT", "PUBLISHED", "ARCHIVED"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          message: "Invalid status. Must be one of: DRAFT, PUBLISHED, ARCHIVED"
        });
      }
    }
    
    const updateFields = {};
    if (title !== undefined) updateFields[`lessons.${lessonIndex}.title`] = title;
    if (description !== undefined) updateFields[`lessons.${lessonIndex}.description`] = description;
    if (order !== undefined) updateFields[`lessons.${lessonIndex}.order`] = order;
    if (duration !== undefined) updateFields[`lessons.${lessonIndex}.duration`] = duration;
    if (status !== undefined) updateFields[`lessons.${lessonIndex}.status`] = status;
    
    updateFields[`lessons.${lessonIndex}.updatedAt`] = new Date().toISOString();
    updateFields.updatedAt = new Date().toISOString();
    
    await coursesCollection.updateOne(
      { id: courseId },
      { $set: updateFields }
    );
    
    res.json({
      message: "Lesson updated successfully"
    });
  } catch (err) {
    next(err);
  }
}

// Delete lesson from course
export async function deleteLessonFromCourse(req, res, next) {
  try {
    const { courseId, lessonId } = req.params;
    
    const db = await getDatabase();
    const coursesCollection = db.collection('courses');
    
    await coursesCollection.updateOne(
      { id: courseId },
      { 
        $pull: { lessons: { id: lessonId } },
        $set: { updatedAt: new Date().toISOString() }
      }
    );
    
    res.json({
      message: "Lesson deleted successfully"
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/courses/:courseId/lessons/:lessonId/progress
export async function trackLessonProgress(req, res) {
  try {
    const { courseId, lessonId } = req.params;
    const { userId, progress = 0, completed = false } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const db = await getDatabase();

    // 1️⃣ Find the course
    const course = await db.collection("courses").findOne({ id: courseId });
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    // 2️⃣ Check that the lesson belongs to this course
    if (!course.lessons || !course.lessons.includes(lessonId)) {
      return res.status(404).json({ error: "Lesson not found in this course" });
    }

    // 3️⃣ Find the lesson
    const lesson = await db.collection("lessons").findOne({ id: lessonId, courseId });
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found in this course" });
    }

    // 4️⃣ Update or create progress for this user
    const userProgressCollection = db.collection("lessonProgress");
    let userProgress = await userProgressCollection.findOne({ lessonId, userId });

    const now = new Date().toISOString();

    if (userProgress) {
      // Update existing progress
      userProgress.progress = progress;
      userProgress.completed = completed;
      userProgress.updatedAt = now;
      await userProgressCollection.updateOne(
        { lessonId, userId },
        { $set: userProgress }
      );
    } else {
      // Create new progress record
      userProgress = {
        lessonId,
        courseId,
        userId,
        progress,
        completed,
        createdAt: now,
        updatedAt: now,
      };
      await userProgressCollection.insertOne(userProgress);
    }

    return res.status(200).json({
      message: "Lesson progress updated successfully",
      progress: userProgress,
    });
  } catch (err) {
    console.error("Error tracking lesson progress:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}


// Get user's lesson progress
// GET /api/courses/:courseId/lessons/:lessonId/progress/:userId
export async function getUserLessonProgress(req, res, next) {
  try {
    const { courseId, lessonId, userId } = req.params;

    const db = await getDatabase();
    const coursesCollection = db.collection('courses');

    const course = await coursesCollection.findOne({ id: courseId });
    if (!course) return res.status(404).json({ message: "Course not found" });

    const lesson = course.lessons?.find(l => l.id === lessonId);
    if (!lesson) return res.status(404).json({ message: "Lesson not found in this course" });

    const user = course.participatedUsers?.find(u => u.userId === userId) || {};

    res.json({
      courseId,
      lessonId,
      userId,
      progress: user.progress || 0,
      completed: user.lessonsCompleted?.includes(lessonId) || false,
      lastAccessedAt: user.lastAccessedAt || null,
      currentLesson: user.currentLesson || null,
      chapters: lesson.chapters || [],
      quizzes: lesson.quizzes || []
    });
  } catch (err) {
    next(err);
  }
}


// Get instructor's courses
export async function getInstructorCourses(req, res, next) {
  try {
    const { instructorId } = req.params;
    
    const db = await getDatabase();
    const coursesCollection = db.collection('courses');
    
    const courses = await coursesCollection.find({ instructor: instructorId }).toArray();
    
    res.json({
      instructorId,
      courses: courses.map(course => ({
        id: course.id,
        title: course.title,
        description: course.description,
        status: course.status,
        sections: course.sections || [],
        learners: course.learners || 0,
        lessons: course.lessons?.map(lesson => ({
          id: lesson.id,
          title: lesson.title,
          status: lesson.status, // DRAFT, PUBLISHED, ARCHIVED
          chapters: lesson.chapters?.length || 0,
          quizzes: lesson.quizzes?.length || 0
        })) || [],
        createdAt: course.createdAt,
        updatedAt: course.updatedAt
      }))
    });
  } catch (err) {
    next(err);
  }
}

// Update lesson status for instructor
export async function updateLessonStatus(req, res, next) {
  try {
    const { courseId, lessonId } = req.params;
    const { instructorId, status } = req.body;
    
    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }
    
    // Validate status
    const validStatuses = ["DRAFT", "PUBLISHED", "ARCHIVED"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status. Must be one of: DRAFT, PUBLISHED, ARCHIVED"
      });
    }
    
    const db = await getDatabase();
    const coursesCollection = db.collection('courses');
    
    const course = await coursesCollection.findOne({ id: courseId });
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    
    // Check if the instructor owns this course
    if (course.instructor !== instructorId) {
      return res.status(403).json({ message: "You can only manage your own courses" });
    }
    
    const lessonIndex = course.lessons?.findIndex(l => l.id === lessonId);
    if (lessonIndex === -1) {
      return res.status(404).json({ message: "Lesson not found" });
    }
    
    await coursesCollection.updateOne(
      { id: courseId },
      {
        $set: {
          [`lessons.${lessonIndex}.status`]: status,
          [`lessons.${lessonIndex}.updatedAt`]: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      }
    );
    
    res.json({
      message: `Lesson status updated to ${status} successfully`,
      lessonId,
      status: status
    });
  } catch (err) {
    next(err);
  }
}

// Toggle quiz visibility for instructor
export async function toggleQuizVisibility(req, res, next) {
  try {
    const { courseId, lessonId, quizId } = req.params;
    const { instructorId } = req.body;
    
    const db = await getDatabase();
    const coursesCollection = db.collection('courses');
    
    const course = await coursesCollection.findOne({ id: courseId });
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    
    // Check if the instructor owns this course
    if (course.instructor !== instructorId) {
      return res.status(403).json({ message: "You can only manage your own courses" });
    }
    
    const lessonIndex = course.lessons?.findIndex(l => l.id === lessonId);
    if (lessonIndex === -1) {
      return res.status(404).json({ message: "Lesson not found" });
    }
    
    const quizIndex = course.lessons[lessonIndex].quizzes?.findIndex(q => q.id === quizId);
    if (quizIndex === -1) {
      return res.status(404).json({ message: "Quiz not found" });
    }
    
    const newVisibility = !course.lessons[lessonIndex].quizzes[quizIndex].isPublished;
    
    await coursesCollection.updateOne(
      { id: courseId },
      {
        $set: {
          [`lessons.${lessonIndex}.quizzes.${quizIndex}.isPublished`]: newVisibility,
          [`lessons.${lessonIndex}.quizzes.${quizIndex}.updatedAt`]: new Date().toISOString(),
          [`lessons.${lessonIndex}.updatedAt`]: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      }
    );
    
    res.json({
      message: `Quiz ${newVisibility ? 'published' : 'hidden'} successfully`,
      quizId,
      isPublished: newVisibility
    });
  } catch (err) {
    next(err);
  }
}