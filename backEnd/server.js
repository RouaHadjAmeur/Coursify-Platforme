/* eslint-env node */
/* global process */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/authRoutes.js';
import coursesRoutes from './routes/coursesRoutes.js';
import lessonsRoutes from './routes/lessonsRoutes.js';
import chaptersRoutes from './routes/chaptersRoutes.js';
import quizzesRoutes from './routes/quizzesRoutes.js';
import { connectToDatabase, getDatabase } from './config/database.js';
import passport from './config/googleAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* ---------- CORS (strict, with preflight) ---------- */
// Support both environment variable and hardcoded origins
const CORS_ORIGIN = process.env.CORS_ORIGIN;
const ALLOWED_ORIGINS = CORS_ORIGIN 
  ? [CORS_ORIGIN] 
  : [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5174',
      'http://localhost:5175',
      'http://127.0.0.1:5175',
    ];

// If CORS_ORIGIN is set, also allow it (for production)
if (CORS_ORIGIN && !ALLOWED_ORIGINS.includes(CORS_ORIGIN)) {
  ALLOWED_ORIGINS.push(CORS_ORIGIN);
}

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // allow Postman/cURL
      return ALLOWED_ORIGINS.includes(origin)
        ? cb(null, true)
        : cb(new Error('CORS blocked'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
  })
);
app.options('*', cors());

/* ---------- Parsers & Session ---------- */
/**
 * IMPORTANT :
 * - On accepte ~3MB côté body-parser pour tolérer l'overhead Base64 (~+33%)
 *   d'une image binaire de 2MB.
 * - La validation stricte 2MB (réels) doit être faite côté contrôleur
 *   (ex: calcul bytes à partir du Base64 et renvoyer 413 si > 2MB).
 */
app.use(express.json({ limit: '3mb' }));
app.use(express.urlencoded({ limit: '3mb', extended: true }));
app.use(cookieParser());
app.use(
  session({
    secret: 'coursify-secret-key-2024',
    resave: true, // Resave session even if not modified (helps with rolling sessions)
    saveUninitialized: false,
    rolling: true, // Reset expiration on every request (keeps session alive while user is active)
    name: 'coursify.sid', // Custom session name
    cookie: {
      secure: false, // true en prod derrière HTTPS
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days - session will refresh on each request due to rolling: true
      sameSite: 'lax', // Helps with cross-site requests
      path: '/', // Ensure cookie is available for all paths
    },
  })
);

// Middleware to refresh session on authenticated requests
app.use((req, res, next) => {
  // If user is authenticated, update session to refresh expiration (rolling: true handles this)
  if (req.session && req.session.user) {
    // Just updating a timestamp ensures the session is saved and expiration is refreshed
    req.session.lastAccess = new Date().toISOString();
  }
  next();
});

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

/* ---------- View engine ---------- */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// Disable view caching in development to reflect EJS edits immediately
const isDev = process.env.NODE_ENV !== 'production';
if (isDev) {
  app.set('view cache', false);
}

/* ---------- Logger (optional) ---------- */
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

/* ---------- Health check ---------- */
app.get('/api/health', (_req, res) => res.json({ ok: true }));

/* ---------- API Routes ---------- */
app.use('/api/auth', authRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/lessons', lessonsRoutes);
app.use('/api/chapters', chaptersRoutes);
app.use('/api/quizzes', quizzesRoutes);



// Serve uploaded chapter files (pdf, docx, etc.)
// Serve uploads with permissive CORS for embedders like PDF.js/Office viewer
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');

    // Set correct MIME types
    if (filePath.endsWith('.pdf')) {
      res.set('Content-Type', 'application/pdf');
    } else if (filePath.endsWith('.docx')) {
      res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.set('Content-Disposition', 'inline'); // Allow inline viewing/download
    } else if (filePath.endsWith('.doc')) {
      res.set('Content-Type', 'application/msword');
      res.set('Content-Disposition', 'inline');
    } else if (filePath.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
      // Set image MIME types
      const ext = filePath.split('.').pop().toLowerCase();
      const mimeTypes = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml'
      };
      res.set('Content-Type', mimeTypes[ext] || 'image/jpeg');
    }
  }
}));



/* ---------- Pages (EJS) ---------- */
app.get('/staff', async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.session || !req.session.user) {
      return res.redirect('http://localhost:5173/login?redirect=/staff');
    }

    // Check if user is admin
    const userRole = req.session.user.role?.toLowerCase();
    if (userRole !== 'admin') {
      return res.status(403).send('Access denied. Admin privileges required.');
    }

    const db = await getDatabase();
    const usersCollection = db.collection('users');

    const findResult = await usersCollection.find(
      {},
      {
        projection: {
          passwordHash: 0,
        },
      }
    );

    const users = await findResult.toArray();

    const staff = users.map((user, index) => ({
      id: user.id || `user-${index + 1}`,
      name: user.name,
      email: user.email,
      contact: user.contact || '',
      joined: user.joined,
      role: user.role,
      status: user.status || 'Active',
      published: user.published !== false,
    }));

    // Pass current user to template
    res.render('staff', { 
      users: staff,
      currentUser: req.session.user 
    });
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).send('Error loading staff page');
  }
});

app.get('/courses', async (req, res) => {
  try {
    const db = await getDatabase();
    const coursesCollection = db.collection('courses');
    const usersCollection = db.collection('users');

    const [coursesResult, usersResult] = await Promise.all([
      coursesCollection.find(),
      usersCollection.find({}, { projection: { passwordHash: 0 } }),
    ]);

    const courses = await coursesResult.toArray();
    const users = await usersResult.toArray();

    res.render('courses', { courses, users });
  } catch (error) {
    console.error('Error loading courses page:', error);
    res.status(500).send('Error loading courses page');
  }
});

// Course learning page (backend view for admin preview)
app.get('/course-learning/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    const db = await getDatabase();
    
    // Get course details
    const coursesCollection = db.collection('courses');
    const course = await coursesCollection.findOne({ id: courseId });
    
    if (!course) {
      return res.status(404).send('Course not found');
    }
    
    // Get lessons for this course (only published), with published chapter/quiz counts
    const lessonsCollection = db.collection('lessons');
    const chaptersCollection = db.collection('chapters');
    const quizzesCollection = db.collection('quizzes');

    const lessonsCursor = await lessonsCollection.find({ courseId });
    let lessons = await lessonsCursor.toArray();

    // Backward compatibility: also include lessons embedded in the course document
    const embeddedLessons = Array.isArray(course.lessons) ? course.lessons : [];
    if (embeddedLessons.length > 0) {
      // Merge by id (prefer standalone collection version when both exist)
      const byId = new Map(lessons.map(l => [l.id, l]));
      for (const l of embeddedLessons) {
        if (!byId.has(l.id)) byId.set(l.id, l);
      }
      lessons = Array.from(byId.values());
    }

    // Only show published lessons to students
    lessons = lessons.filter(l => (l.status || 'DRAFT') === 'PUBLISHED');

    // Enrich with chapter and quiz counts (published only) and sort by order
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
        chapters,
        quizzes,
      });
    }

    enriched.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    res.render('course-learning', { course, lessons: enriched });
  } catch (error) {
    console.error('Error loading course learning page:', error);
    res.status(500).send('Error loading course learning page');
  }
});

app.get('/test-lesson/:lessonId', async (req, res) => {
  try {
    const { lessonId } = req.params;
    const db = await getDatabase();
    
    // Get lesson details
    const lessonsCollection = db.collection('lessons');
    const lesson = await lessonsCollection.findOne({ id: lessonId });
    
    if (!lesson) {
      return res.status(404).send('Lesson not found');
    }
    
    // Get chapters for this lesson
    const chaptersCollection = db.collection('chapters');
    const chaptersResult = await chaptersCollection.find({ lessonId });
    const chapters = await chaptersResult.toArray();
    
    // Get quizzes for this lesson
    const quizzesCollection = db.collection('quizzes');
    const quizzesResult = await quizzesCollection.find({ lessonId });
    const quizzes = await quizzesResult.toArray();
    
    res.render('test-lesson', { lesson, chapters, quizzes });
  } catch (error) {
    console.error('Error loading test lesson page:', error);
    res.status(500).send('Error loading test lesson page');
  }
});

app.get('/test-quiz/:quizId', async (req, res) => {
  try {
    const { quizId } = req.params;
    const db = await getDatabase();
    
    // Get quiz details
    const quizzesCollection = db.collection('quizzes');
    const quiz = await quizzesCollection.findOne({ id: quizId });
    
    if (!quiz) {
      return res.status(404).send('Quiz not found');
    }
    
    res.render('test-quiz', { quiz });
  } catch (error) {
    console.error('Error loading test quiz page:', error);
    res.status(500).send('Error loading test quiz page');
  }
});

// Instructor courses page
app.get('/my-courses', async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.session || !req.session.user) {
      return res.redirect('http://localhost:5173/login');
    }

    const user = req.session.user;
    
    // Check if user is instructor or admin
    if (user.role !== 'instructor' && user.role !== 'admin' && user.role !== 'Teacher') {
      return res.status(403).send('Access denied. Instructor or admin role required.');
    }

    const db = await getDatabase();
    const coursesCollection = db.collection('courses');
    
    // Get courses for this instructor
    const courses = await coursesCollection.find({ instructor: user.name }).toArray();
    
    res.render('instructor-courses', { 
      courses, 
      user,
      title: 'My Courses - Coursify'
    });
  } catch (error) {
    console.error('Error loading instructor courses page:', error);
    res.status(500).send('Error loading instructor courses page');
  }
});

// Management routes for adding new content
app.get('/manage-course/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    const db = await getDatabase();
    
    const coursesCollection = db.collection('courses');
    const course = await coursesCollection.findOne({ id: courseId });
    
    if (!course) {
      return res.status(404).send('Course not found');
    }
    
    res.render('manage-course', { course });
  } catch (error) {
    console.error('Error loading manage course page:', error);
    res.status(500).send('Error loading manage course page');
  }
});

app.get('/manage-lesson/:lessonId', async (req, res) => {
  try {
    // Check authentication
    if (!req.session || !req.session.user) {
      return res.redirect('/login');
    }
    
    const role = req.session.user.role?.toLowerCase();
    if (role === 'student') {
      return res.status(403).send('Access denied. Students cannot manage lessons.');
    }
    
    const { lessonId } = req.params;
    const db = await getDatabase();
    
    const lessonsCollection = db.collection('lessons');
    const lesson = await lessonsCollection.findOne({ id: lessonId });
    
    if (!lesson) {
      return res.status(404).send('Lesson not found');
    }
    
    res.render('manage-lesson', { lesson, user: req.session.user });
  } catch (error) {
    console.error('Error loading manage lesson page:', error);
    res.status(500).send('Error loading manage lesson page');
  }
});

app.get('/new-staff', async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.session || !req.session.user) {
      return res.redirect('http://localhost:5173/login?redirect=/new-staff');
    }

    // Check if user is admin
    const userRole = req.session.user.role?.toLowerCase();
    if (userRole !== 'admin') {
      return res.status(403).send('Access denied. Admin privileges required.');
    }

    const db = await getDatabase();
    const usersCollection = db.collection('users');

    const findResult = await usersCollection.find(
      {},
      {
        projection: {
          passwordHash: 0,
        },
      }
    );

    const users = await findResult.toArray();

    const staff = users.map((user, index) => ({
      id: user.id || `user-${index + 1}`,
      name: user.name,
      email: user.email,
      contact: user.contact || '',
      joined: user.joined,
      role: user.role,
      status: user.status || 'Active',
      published: user.published !== false,
    }));

    // Pass current user to template
    res.render('staff', { 
      users: staff,
      currentUser: req.session.user 
    });
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).send('Error loading staff page');
  }
});

app.get('/', async (req, res) => {
  try {
    const db = await getDatabase();
    const usersCollection = db.collection('users');

    const findResult = await usersCollection.find(
      {},
      {
        projection: {
          passwordHash: 0,
        },
      }
    );

    const users = await findResult.toArray();

    const staff = users.map((user, index) => ({
      id: user.id || `user-${index + 1}`,
      name: user.name,
      email: user.email,
      contact: user.contact || '',
      joined: user.joined,
      role: user.role,
      status: user.status || 'Active',
      published: user.published !== false,
    }));

    res.render('staff', { users: staff });
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).send('Error loading dashboard');
  }
});

/* ---------- Auth helpers ---------- */
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ message: 'Error logging out' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

app.get('/api/auth/status', (req, res) => {
  // Refresh session expiration on each status check (rolling session)
  // With rolling: true, just accessing req.session will refresh the expiration
  if (req.session && req.session.user) {
    // Update a property to ensure session is saved (rolling session will refresh expiration)
    req.session.lastAccess = new Date().toISOString();
    res.json({ isAuthenticated: true, user: req.session.user });
  } else {
    res.json({ isAuthenticated: false });
  }
});

app.get('/api/auth/users', async (req, res) => {
  try {
    const db = await getDatabase();
    const usersCollection = db.collection('users');

    const findResult = await usersCollection.find(
      {},
      {
        projection: {
          passwordHash: 0,
        },
      }
    );

    const users = await findResult.toArray();

    const transformedUsers = users.map((user, index) => ({
      id: user.id || `user-${index + 1}`,
      name: user.name,
      email: user.email,
      contact: user.contact || '',
      joined: user.joined,
      role: user.role,
      status: user.status || 'Active',
      published: user.published !== false,
    }));

    res.json(transformedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

/* ---------- 404 & Error handlers ---------- */
app.use((req, res) => res.status(404).json({ message: 'Not Found' }));

app.use((err, _req, res, _next) => {
  // CORS strict: origin refusée
  if (err && err.message === 'CORS blocked') {
    return res.status(403).json({ message: 'CORS blocked: origin not allowed' });
  }

  // Body parser (express.json/urlencoded) : payload trop grand
  if (err && err.type === 'entity.too.large') {
    // Message lisible par le front (affichage toast/alert)
    return res.status(413).json({
      error: 'PAYLOAD_TOO_LARGE',
      message: 'Image size exceeds 2MB limit.',
    });
  }

  console.error(err);
  res.status(500).json({ message: 'Server error' });
});

/* ---------- Start ---------- */
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  try {
    await connectToDatabase();
    app.listen(PORT, () => {
      console.log(`✅ API listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
