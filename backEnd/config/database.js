/* eslint-disable no-unused-vars */
import fs from 'fs/promises';
import fssync from 'fs';
import mongoose from "mongoose";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, "..", "data");
const usersFile = path.join(dataDir, "users.json");
const coursesFile = path.join(dataDir, "courses.json");
const lessonsFile = path.join(dataDir, "lessons.json");
const chaptersFile = path.join(dataDir, "chapters.json");
const quizzesFile = path.join(dataDir, "quizzes.json");
const lessonProgressFile = path.join(dataDir, "lessonProgress.json");
const reviewsFile = path.join(dataDir, "reviews.json");


mongoose.connect("mongodb://localhost:27017/coursifyDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function ensureUsersFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try { 
    await fs.access(usersFile); 
  } catch { 
    await fs.writeFile(usersFile, "[]", "utf8"); 
  }
}

async function ensureCoursesFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try { 
    await fs.access(coursesFile); 
  } catch { 
    await fs.writeFile(coursesFile, "[]", "utf8"); 
  }
}

async function ensureLessonsFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try { 
    await fs.access(lessonsFile); 
  } catch { 
    await fs.writeFile(lessonsFile, "[]", "utf8"); 
  }
}

async function ensureChaptersFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try { 
    await fs.access(chaptersFile); 
  } catch { 
    await fs.writeFile(chaptersFile, "[]", "utf8"); 
  }
}

async function ensureQuizzesFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try { 
    await fs.access(quizzesFile); 
  } catch { 
    await fs.writeFile(quizzesFile, "[]", "utf8"); 
  }
}

async function ensureReviewsFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try { 
    await fs.access(reviewsFile); 
  } catch { 
    await fs.writeFile(reviewsFile, "[]", "utf8"); 
  }
}

async function readUsers() {
  await ensureUsersFile();
  const raw = await fs.readFile(usersFile, "utf8");
  return JSON.parse(raw);
}

async function writeUsers(users) {
  await fs.writeFile(usersFile, JSON.stringify(users, null, 2), "utf8");
}

async function readJsonWithRetry(path, retries = 3, delayMs = 50) {
  for (let i = 0; i < retries; i++) {
    try {
      const raw = await fs.readFile(path, 'utf8');
      return JSON.parse(raw);
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

async function atomicWrite(path, content) {
  const tmp = `${path}.tmp-${Date.now()}`;
  await fs.writeFile(tmp, content, 'utf8');
  await fs.rename(tmp, path);
}

async function readCourses() {
  await ensureCoursesFile();
  const courses = await readJsonWithRetry(coursesFile);

  // Add defaults for new fields if missing
  return courses.map(course => ({
    ...course,
    skills: Array.isArray(course.skills) ? course.skills : [],
    participatedUsers: Array.isArray(course.participatedUsers) ? course.participatedUsers : [],
    progress: typeof course.progress === "number" ? course.progress : 0,
    lessons: Array.isArray(course.lessons) ? course.lessons : [] // ensure lessons exist
  }));
}

async function writeCourses(courses) {
  const content = JSON.stringify(courses, null, 2);
  await atomicWrite(coursesFile, content);
}

async function readLessons() {
  await ensureLessonsFile();
  return await readJsonWithRetry(lessonsFile);
}

async function writeLessons(lessons) {
  await atomicWrite(lessonsFile, JSON.stringify(lessons, null, 2));
}

async function readChapters() {
  await ensureChaptersFile();
  return await readJsonWithRetry(chaptersFile);
}

async function writeChapters(chapters) {
  await atomicWrite(chaptersFile, JSON.stringify(chapters, null, 2));
}

async function readQuizzes() {
  await ensureQuizzesFile();
  return await readJsonWithRetry(quizzesFile);
}

async function writeQuizzes(quizzes) {
  await atomicWrite(quizzesFile, JSON.stringify(quizzes, null, 2));
}

async function readReviews() {
  await ensureReviewsFile();
  const raw = await fs.readFile(reviewsFile, "utf8");
  return JSON.parse(raw);
}

async function writeReviews(reviews) {
  await fs.writeFile(reviewsFile, JSON.stringify(reviews, null, 2), "utf8");
}

export async function connectToDatabase() {
  await ensureUsersFile();
  await ensureCoursesFile();
  await ensureLessonsFile();
  await ensureChaptersFile();
  await ensureQuizzesFile();
  await ensureReviewsFile();
  console.log('Connected to JSON database successfully');
  return { client: null, db: null };
}

export async function getDatabase() {
  await ensureUsersFile();
  await ensureCoursesFile();
  await ensureLessonsFile();
  await ensureChaptersFile();
  await ensureQuizzesFile();
  await ensureReviewsFile();
  return {
    collection: (name) => {
      if (name === 'users') {
        return {
          findOne: async (query) => {
            const users = await readUsers();
            return users.find(user => Object.keys(query).every(key => user[key] === query[key]));
          },
          insertOne: async (user) => {
            const users = await readUsers();
            users.push(user);
            await writeUsers(users);
            return { insertedId: user.id };
          },
          updateOne: async (query, update) => {
            const users = await readUsers();
            const index = users.findIndex(user => Object.keys(query).every(key => user[key] === query[key]));
            if (index === -1) return { matchedCount: 0, modifiedCount: 0 };
            if (update.$set) users[index] = { ...users[index], ...update.$set };
            await writeUsers(users);
            return { matchedCount: 1, modifiedCount: 1 };
          },
          deleteOne: async (query) => {
            const users = await readUsers();
            const index = users.findIndex(user => Object.keys(query).every(key => user[key] === query[key]));
            if (index === -1) return { deletedCount: 0 };
            users.splice(index, 1);
            await writeUsers(users);
            return { deletedCount: 1 };
          },
          find: (_query = {}, options = {}) => {
            return Promise.resolve({
              toArray: async () => {
                const users = await readUsers();
                if (options.projection) {
                  return users.map(user => {
                    const filtered = { ...user };
                    Object.keys(options.projection).forEach(key => { if (options.projection[key] === 0) delete filtered[key]; });
                    return filtered;
                  });
                }
                return users;
              }
            });
          }
        };
      } else if (name === 'courses') {
        return {
          findOne: async (query) => {
            const courses = await readCourses();
            return courses.find(course => Object.keys(query).every(key => course[key] === query[key]));
          },
          insertOne: async (course) => {
            const courses = await readCourses();
            const newCourse = {
              ...course,
              skills: Array.isArray(course.skills) ? course.skills : [],
              participatedUsers: Array.isArray(course.participatedUsers) ? course.participatedUsers : [],
              progress: typeof course.progress === "number" ? course.progress : 0,
              lessons: Array.isArray(course.lessons) ? course.lessons : [] // default lessons
            };
            courses.push(newCourse);
            await writeCourses(courses);
            return { insertedId: newCourse.id };
          },
          updateOne: async (query, update) => {
            const courses = await readCourses();
            const index = courses.findIndex(course => Object.keys(query).every(key => course[key] === query[key]));
            if (index === -1) return { matchedCount: 0, modifiedCount: 0 };
            if (update.$set) {
              courses[index] = { 
                ...courses[index], 
                ...update.$set,
                skills: Array.isArray(update.$set.skills) ? update.$set.skills : courses[index].skills || [],
                participatedUsers: Array.isArray(update.$set.participatedUsers) ? update.$set.participatedUsers : courses[index].participatedUsers || [],
                progress: typeof update.$set.progress === "number" ? update.$set.progress : courses[index].progress || 0,
                lessons: Array.isArray(update.$set.lessons) ? update.$set.lessons : courses[index].lessons || []
              };
            }
            await writeCourses(courses);
            return { matchedCount: 1, modifiedCount: 1 };
          },
          deleteOne: async (query) => {
            const courses = await readCourses();
            const index = courses.findIndex(course => Object.keys(query).every(key => course[key] === query[key]));
            if (index === -1) return { deletedCount: 0 };
            courses.splice(index, 1);
            await writeCourses(courses);
            return { deletedCount: 1 };
          },
          find: (query = {}, options = {}) => {
            return Promise.resolve({
              toArray: async () => {
                let courses = await readCourses();
                if (options.projection) {
                  courses = courses.map(course => {
                    const filtered = { ...course };
                    Object.keys(options.projection).forEach(key => { if (options.projection[key] === 0) delete filtered[key]; });
                    return filtered;
                  });
                }
                return courses;
              }
            });
          }
        };
      } else if (name === 'lessons') {
  return {
    findOne: async (query) => {
      const lessons = await readLessons();
      return lessons.find(lesson => 
        Object.keys(query).every(key => {
          if (key === '_id') return lesson.id === query[key]; // support _id
          return lesson[key] === query[key];
        })
      );
    },
    insertOne: async (lesson) => {
      const lessons = await readLessons();
      const newLesson = {
        ...lesson,
        id: lesson.id || `lesson_${Date.now()}`, // ensure unique id
        chapters: Array.isArray(lesson.chapters) ? lesson.chapters : [],
        quizzes: Array.isArray(lesson.quizzes) ? lesson.quizzes : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      lessons.push(newLesson);
      await writeLessons(lessons);
      return { insertedId: newLesson.id };
    },
    updateOne: async (query, update) => {
      const lessons = await readLessons();
      const index = lessons.findIndex(lesson =>
        Object.keys(query).every(key => key === '_id' ? lesson.id === query[key] : lesson[key] === query[key])
      );
      if (index === -1) return { matchedCount: 0, modifiedCount: 0 };
      if (update.$set) {
        lessons[index] = {
          ...lessons[index],
          ...update.$set,
          chapters: Array.isArray(update.$set.chapters) ? update.$set.chapters : lessons[index].chapters || [],
          quizzes: Array.isArray(update.$set.quizzes) ? update.$set.quizzes : lessons[index].quizzes || [],
          updatedAt: new Date().toISOString()
        };
      }
      await writeLessons(lessons);
      return { matchedCount: 1, modifiedCount: 1 };
    },
    deleteOne: async (query) => {
      const lessons = await readLessons();
      const index = lessons.findIndex(lesson =>
        Object.keys(query).every(key => key === '_id' ? lesson.id === query[key] : lesson[key] === query[key])
      );
      if (index === -1) return { deletedCount: 0 };
      lessons.splice(index, 1);
      await writeLessons(lessons);
      return { deletedCount: 1 };
    },
    find: (query = {}, options = {}) => {
      return Promise.resolve({
        toArray: async () => {
          let lessons = await readLessons();
          // apply simple equality filtering
          lessons = lessons.filter(l => Object.keys(query).every(k => l[k] === query[k]));
          if (options.projection) {
            lessons = lessons.map(lesson => {
              const filtered = { ...lesson };
              Object.keys(options.projection).forEach(key => {
                if (options.projection[key] === 0) delete filtered[key];
              });
              return filtered;
            });
          }
          return lessons;
        }
      });
    }
  };

   } else if (name === 'chapters') {
        return {
          findOne: async (query) => {
            const chapters = await readChapters();
            return chapters.find(chapter => Object.keys(query).every(key => chapter[key] === query[key]));
          },
          insertOne: async (chapter) => {
            const chapters = await readChapters();
            const newChapter = {
              ...chapter,
              createdAt: new Date().toISOString()
            };
            chapters.push(newChapter);
            await writeChapters(chapters);
            return { insertedId: newChapter.id };
          },
          updateOne: async (query, update) => {
            const chapters = await readChapters();
            const index = chapters.findIndex(chapter => Object.keys(query).every(key => chapter[key] === query[key]));
            if (index === -1) return { matchedCount: 0, modifiedCount: 0 };
            if (update.$set) {
              chapters[index] = { 
                ...chapters[index], 
                ...update.$set,
                updatedAt: new Date().toISOString()
              };
            }
            await writeChapters(chapters);
            return { matchedCount: 1, modifiedCount: 1 };
          },
          deleteOne: async (query) => {
            const chapters = await readChapters();
            const index = chapters.findIndex(chapter => Object.keys(query).every(key => chapter[key] === query[key]));
            if (index === -1) return { deletedCount: 0 };
            chapters.splice(index, 1);
            await writeChapters(chapters);
            return { deletedCount: 1 };
          },
          find: (query = {}, options = {}) => {
            return Promise.resolve({
              toArray: async () => {
                let chapters = await readChapters();
                chapters = chapters.filter(c => Object.keys(query).every(k => c[k] === query[k]));
                if (options.projection) {
                  chapters = chapters.map(chapter => {
                    const filtered = { ...chapter };
                    Object.keys(options.projection).forEach(key => { if (options.projection[key] === 0) delete filtered[key]; });
                    return filtered;
                  });
                }
                return chapters;
              }
            });
          }
        };
      } else if (name === 'quizzes') {
        return {
          findOne: async (query) => {
            const quizzes = await readQuizzes();
            return quizzes.find(quiz => Object.keys(query).every(key => quiz[key] === query[key]));
          },
          insertOne: async (quiz) => {
            const quizzes = await readQuizzes();
            const newQuiz = {
              ...quiz,
              questions: Array.isArray(quiz.questions) ? quiz.questions : [],
              createdAt: new Date().toISOString()
            };
            quizzes.push(newQuiz);
            await writeQuizzes(quizzes);
            return { insertedId: newQuiz.id };
          },
          updateOne: async (query, update) => {
            const quizzes = await readQuizzes();
            const index = quizzes.findIndex(quiz => Object.keys(query).every(key => quiz[key] === query[key]));
            if (index === -1) return { matchedCount: 0, modifiedCount: 0 };
            if (update.$set) {
              quizzes[index] = { 
                ...quizzes[index], 
                ...update.$set,
                questions: Array.isArray(update.$set.questions) ? update.$set.questions : quizzes[index].questions || [],
                updatedAt: new Date().toISOString()
              };
            }
            await writeQuizzes(quizzes);
            return { matchedCount: 1, modifiedCount: 1 };
          },
          deleteOne: async (query) => {
            const quizzes = await readQuizzes();
            const index = quizzes.findIndex(quiz => Object.keys(query).every(key => quiz[key] === query[key]));
            if (index === -1) return { deletedCount: 0 };
            quizzes.splice(index, 1);
            await writeQuizzes(quizzes);
            return { deletedCount: 1 };
          },
          find: (query = {}, options = {}) => {
            return Promise.resolve({
              toArray: async () => {
                let quizzes = await readQuizzes();
                quizzes = quizzes.filter(q => Object.keys(query).every(k => q[k] === query[k]));
                if (options.projection) {
                  quizzes = quizzes.map(quiz => {
                    const filtered = { ...quiz };
                    Object.keys(options.projection).forEach(key => { if (options.projection[key] === 0) delete filtered[key]; });
                    return filtered;
                  });
                }
                return quizzes;
              }
            });
          }
        };
      } else if (name === 'reviews') {
        return {
          findOne: async (query) => {
            const reviews = await readReviews();
            return reviews.find(r => Object.keys(query).every(k => r[k] === query[k]));
          },
          insertOne: async (review) => {
            const reviews = await readReviews();
            const newReview = { ...review, createdAt: new Date().toISOString() };
            reviews.push(newReview);
            await writeReviews(reviews);
            return { insertedId: newReview.id };
          },
          updateOne: async (query, update) => {
            const reviews = await readReviews();
            const index = reviews.findIndex(r => Object.keys(query).every(k => r[k] === query[k]));
            if (index === -1) return { matchedCount: 0, modifiedCount: 0 };
            if (update.$set) reviews[index] = { ...reviews[index], ...update.$set, updatedAt: new Date().toISOString() };
            await writeReviews(reviews);
            return { matchedCount: 1, modifiedCount: 1 };
          },
          deleteOne: async (query) => {
            const reviews = await readReviews();
            const index = reviews.findIndex(r => Object.keys(query).every(k => r[k] === query[k]));
            if (index === -1) return { deletedCount: 0 };
            reviews.splice(index, 1);
            await writeReviews(reviews);
            return { deletedCount: 1 };
          },
          find: (query = {}, _options = {}) => {
            return Promise.resolve({
              toArray: async () => {
                const reviews = await readReviews();
                return reviews.filter(r => Object.keys(query).every(k => r[k] === query[k]));
              }
            });
          }
        };
      }
      return {
        findOne: async () => null,
        insertOne: async () => ({ insertedId: null }),
        updateOne: async () => ({ matchedCount: 0, modifiedCount: 0 }),
        deleteOne: async () => ({ deletedCount: 0 }),
        find: () => Promise.resolve({ toArray: async () => [] })
      };
    }
  };
}

async function ensureLessonProgressFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try { await fs.access(lessonProgressFile); } 
  catch { await fs.writeFile(lessonProgressFile, "[]", "utf8"); }
}
async function readLessonProgress() {
  await ensureLessonProgressFile();
  const raw = await fs.readFile(lessonProgressFile, "utf8");
  return JSON.parse(raw);
}

async function writeLessonProgress(progress) {
  await fs.writeFile(lessonProgressFile, JSON.stringify(progress, null, 2), "utf8");
}

export async function closeDatabase() {
  // No connection to close for JSON database
}
