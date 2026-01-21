/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useNavigate } from "react-router-dom";


export default function CourseLearning() {
  const { courseId } = useParams();
    const navigate = useNavigate();


  // --- Course and general state ---
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);


     

  // --- Current lesson state ---
  const [currentLesson, setCurrentLesson] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [quizzes, setQuizzes] = useState([]);


  // --- Load course, lessons, progress ---
  useEffect(() => {
    const loadCourseAndLessons = async () => {
      try {
        setLoading(true);
        setError(null);

        // --- Auth check ---
        const authRes = await fetch('http://localhost:3000/api/auth/status', { credentials: 'include' });
        const authData = await authRes.json();
        if (!authData.isAuthenticated || !authData.user) {
          setError('You must be logged in to start learning');
          return;
        }
        setIsAuthenticated(true);
        const userId = authData.user.id;

        // --- Fetch course ---
        const courseRes = await fetch(`http://localhost:3000/api/courses/${courseId}`, { credentials: 'include' });
        if (!courseRes.ok) throw new Error('Course not found');
        const courseData = await courseRes.json();
        setCourse(courseData);

        // --- Fetch lessons ---
        // Fetch lessons by course with counts for chapters/quizzes
        const lessonsRes = await fetch(`http://localhost:3000/api/lessons/course/${courseId}?publishedOnly=true`, { credentials: 'include' });
        if (!lessonsRes.ok) throw new Error('Error fetching lessons');
        const lessonsData = await lessonsRes.json();
        setLessons(lessonsData);

        // --- Calculate progress from localStorage (same way as sidebar) ---
        if (userId) {
          // Calculate total progress across all lessons
          (async () => {
            try {
              let totalCompleted = 0;
              let totalItems = 0;

              // For each lesson, fetch its chapters and quizzes to count total items
              for (const lesson of lessonsData) {
                try {
                  const lessonRes = await fetch(`http://localhost:3000/api/lessons/${lesson.id}/content`, { credentials: 'include' });
                  if (lessonRes.ok) {
                    const lessonData = await lessonRes.json();
                    const lessonChapters = lessonData.chapters || [];
                    const lessonQuizzes = lessonData.quizzes || [];
                    
                    // Count total items in this lesson
                    totalItems += lessonChapters.length + lessonQuizzes.length;
                    
                    // Count completed items from localStorage
                    const keyPrefix = `progress:${userId}:${courseId}:${lesson.id}`;
                    const raw = localStorage.getItem(keyPrefix);
                    if (raw) {
                      const parsed = JSON.parse(raw);
                      const chaptersDone = Object.keys(parsed.chapters || {}).filter(k => parsed.chapters[k]).length;
                      const quizzesDone = Object.keys(parsed.quizzes || {}).filter(k => parsed.quizzes[k]).length;
                      totalCompleted += chaptersDone + quizzesDone;
                    }
                  }
                } catch (err) {
                  // Skip this lesson if we can't fetch its content
                  console.warn(`Could not fetch content for lesson ${lesson.id}:`, err);
                }
              }

              // Calculate percentage
              const calculatedProgress = totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 0;
              setProgress(calculatedProgress);
            } catch (progressError) {
              // If calculation fails, just set progress to 0
              // No need to call backend API since we're using localStorage
              setProgress(0);
            }
          })();
        } else {
          setProgress(0);
        }

      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadCourseAndLessons();
  }, [courseId]);

  // Recalculate progress when lessons change or when user returns to page
  useEffect(() => {
    if (!isAuthenticated || !lessons.length) return;

    const recalculateProgress = async () => {
      try {
        const authRes = await fetch('http://localhost:3000/api/auth/status', { credentials: 'include' });
        if (!authRes.ok) return;
        
        const authData = await authRes.json();
        if (!authData.isAuthenticated || !authData.user) return;
        
        const userId = authData.user.id;
        let totalCompleted = 0;
        let totalItems = 0;

        for (const lesson of lessons) {
          try {
            const lessonRes = await fetch(`http://localhost:3000/api/lessons/${lesson.id}/content`, { credentials: 'include' });
            if (lessonRes.ok) {
              const lessonData = await lessonRes.json();
              const lessonChapters = lessonData.chapters || [];
              const lessonQuizzes = lessonData.quizzes || [];
              
              totalItems += lessonChapters.length + lessonQuizzes.length;
              
              const keyPrefix = `progress:${userId}:${courseId}:${lesson.id}`;
              const raw = localStorage.getItem(keyPrefix);
              if (raw) {
                try {
                  const parsed = JSON.parse(raw);
                  const chaptersDone = Object.keys(parsed.chapters || {}).filter(k => parsed.chapters[k]).length;
                  const quizzesDone = Object.keys(parsed.quizzes || {}).filter(k => parsed.quizzes[k]).length;
                  totalCompleted += chaptersDone + quizzesDone;
                } catch (parseErr) {
                  // Invalid JSON in localStorage, skip this lesson
                }
              }
            }
          } catch (err) {
            // Silently skip this lesson if we can't fetch its content
          }
        }

        const calculatedProgress = totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 0;
        setProgress(calculatedProgress);
      } catch (err) {
        // Silently fail - don't log to avoid console noise
      }
    };

    // Recalculate when component becomes visible (user returns from lesson page)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        recalculateProgress();
      }
    };

    // Also recalculate periodically (but less frequently to avoid too many API calls)
    const interval = setInterval(() => {
      // Only recalculate if page is visible
      if (!document.hidden) {
        recalculateProgress();
      }
    }, 5000); // Check every 5 seconds instead of 3

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', recalculateProgress);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', recalculateProgress);
    };
  }, [isAuthenticated, lessons, courseId]);

  // --- Start lesson handler (fetch lesson details only) ---
 const handleStartLesson = async (lessonId) => {
    try {
      const res = await fetch(`http://localhost:3000/api/courses/${courseId}/lessons/${lessonId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Lesson not found");
      const data = await res.json();
      console.log("Lesson loaded:", data);

      // Navigate to the Lesson page with lessonId
      navigate(`/courses/${courseId}/lessons/${lessonId}`, { state: { lessonData: data } });
    } catch (err) {
      console.error("Error loading lesson:", err);
      alert(`Error loading lesson: ${err.message || "Please try again."}`);
    }
  };


  // --- Conditional rendering ---
  if (!isAuthenticated) return <AuthRequired />;
  if (loading) return <Loading />;
  if (error) return <ErrorScreen message={error} />;
  if (!course) return <CourseNotFound />;

  // --- Main render ---
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl p-6 md:p-10 pt-20">
        <BackButton />

        {/* Course Header */}
        <CourseHeader course={course} />

        {/* Course Progress */}
        <CourseProgress progress={progress} />

        {/* Lessons List */}
        <LessonsList lessons={lessons} handleStartLesson={handleStartLesson} courseId={course.id} />

        {/* Current Lesson Display */}
        {currentLesson && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">{currentLesson.title}</h2>
            <p className="text-gray-600 mb-4">{currentLesson.description}</p>

            <h3 className="font-medium mb-2">Chapters:</h3>
            <ul className="list-disc pl-6 mb-4">
              {chapters.map(ch => <li key={ch.id}>{ch.title}</li>)}
            </ul>

            <h3 className="font-medium mb-2">Quizzes:</h3>
            <ul className="list-disc pl-6">
              {quizzes.map(q => <li key={q.id}>{q.title}</li>)}
            </ul>
          </div>
        )}
      </main>
    </>
  );
}

/* --- Helper components --- */
const AuthRequired = () => (
  <><Navbar />
    <div className="text-center py-20">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
      <p>You must be logged in to start learning courses.</p>
      <button onClick={() => window.location.href = '/login'} className="bg-[#4DA3FF] px-6 py-3 rounded-lg mt-4">Go to Login</button>
    </div>
  </>
);

const Loading = () => (
  <><Navbar />
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#B0D0D3]" />
    </div>
  </>
);

const ErrorScreen = ({ message }) => (
  <><Navbar />
    <div className="text-center py-20">
      <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
      <p>{message}</p>
    </div>
  </>
);

const CourseNotFound = () => (
  <><Navbar />
    <div className="text-center py-20">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Course Not Found</h2>
      <button onClick={() => window.location.href = '/all-courses'} className="bg-[#4DA3FF] px-6 py-3 rounded-lg mt-4">Back to Courses</button>
    </div>
  </>
);


const BackButton = () => (
  <button onClick={() => window.history.back()} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
    </svg>
    Back to Courses
  </button>
);

const CourseHeader = ({ course }) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{course.title}</h1>
        <p className="text-gray-600 mb-4">{course.description}</p>
      </div>
      <div className="ml-6 text-right">
        <div className="text-2xl font-bold text-gray-900">{course.price === 0 ? 'Free' : `$${course.price}`}</div>
        <div className="text-sm text-gray-500">Course Price</div>
      </div>
    </div>
  </div>
);

const CourseProgress = ({ progress }) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
    <h2 className="text-xl font-semibold text-gray-900 mb-4">Course Progress</h2>
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div className="bg-[#4DA3FF] h-3 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <span className="text-sm font-medium text-gray-600">{progress}% Complete</span>
    </div>
  </div>
);



const LessonsList = ({ lessons, handleStartLesson, courseId }) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200">
    <div className="p-6 border-b border-gray-200">
      <h2 className="text-xl font-semibold text-gray-900">Course Content</h2>
      <p className="text-gray-600 mt-1">{lessons.length} lessons available</p>
    </div>
    <div className="divide-y divide-gray-200">
      {lessons.length > 0 ? lessons.map((lesson, idx) => (
        <div key={lesson.id} className="p-6 hover:bg-gray-50 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-[#4DA3FF]/20 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-[#4DA3FF]">{idx + 1}</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900">{lesson.title || 'Untitled Lesson'}</h3>
                <p className="text-gray-600 mt-1">{lesson.description}</p>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                  <span>{lesson.duration || '30 min'}</span>
                  <span>{lesson.chaptersCount ?? lesson.chapters?.length ?? 0} chapters</span>
                  <span>{lesson.quizzesCount ?? lesson.quizzes?.length ?? 0} quizzes</span>
                  <CourseRowProgress courseId={courseId} lessonId={lesson.id} />
                </div>
              </div>
            </div>
            <button
              onClick={() => handleStartLesson(lesson.id)}
              className="px-4 py-2 bg-[#4DA3FF] text-white rounded-lg hover:bg-[#3B8BCC] transition-colors text-sm font-medium"
            >
              Start Lesson
            </button>
          </div>
        </div>
      )) : (
        <div className="p-8 text-center text-gray-500">
          <p className="text-lg font-medium">No lessons available yet</p>
          <p className="text-sm">Lessons will appear here once they are added to this course.</p>
        </div>
      )}
    </div>
  </div>
);

function CourseRowProgress({ courseId, lessonId }) {
  try {
    const userId = localStorage.getItem('userId') || 'demo-user';
    const keyPrefix = `progress:${userId}:${courseId}:${lessonId}`;
    const raw = localStorage.getItem(keyPrefix);
    const parsed = raw ? JSON.parse(raw) : { chapters: {}, quizzes: {} };
    const chaptersDone = Object.values(parsed.chapters || {}).filter(Boolean).length;
    const quizzesDone = Object.values(parsed.quizzes || {}).filter(Boolean).length;
    const total = chaptersDone + quizzesDone;
    if (total === 0) return null;
    return <span className="text-xs text-gray-500">{total} completed</span>;
  } catch {
    return null;
  }
}
