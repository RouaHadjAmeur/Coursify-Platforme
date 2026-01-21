// src/pages/InstructorCourseDetail.jsx
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Eye, EyeOff, BookOpen, FileText, HelpCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from "../components/Navbar";

export default function InstructorCourseDetail() {
  const API_BASE = 'http://localhost:3000';
  const navigate = useNavigate();
  const { courseId } = useParams();

  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/status`, {
        credentials: 'include'
      });
      const data = await response.json();

      if (data.isAuthenticated) {
        const userRole = data.user.role?.toLowerCase();
        if (userRole === 'instructor' || userRole === 'teacher') {
          setUser(data.user);
          fetchCourseData();
        } else {
          navigate('/');
        }
      } else {
        navigate('/login');
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourseData = async () => {
    try {
      // Fetch course details
      const courseRes = await fetch(`${API_BASE}/api/courses/${courseId}`, {
        credentials: 'include'
      });
      if (courseRes.ok) {
        const courseData = await courseRes.json();
        setCourse(courseData);
      }

      // Fetch lessons with their content
      const lessonsRes = await fetch(`${API_BASE}/api/lessons/course/${courseId}`, {
        credentials: 'include'
      });
      if (lessonsRes.ok) {
        const lessonsData = await lessonsRes.json();
        
        // Fetch chapters and quizzes for each lesson
        const enrichedLessons = await Promise.all(
          lessonsData.map(async (lesson) => {
            try {
              const [chaptersRes, quizzesRes] = await Promise.all([
                fetch(`${API_BASE}/api/chapters/lesson/${lesson.id}`, { credentials: 'include' }),
                fetch(`${API_BASE}/api/quizzes/lesson/${lesson.id}`, { credentials: 'include' })
              ]);

              const chapters = chaptersRes.ok ? await chaptersRes.json() : [];
              const quizzes = quizzesRes.ok ? await quizzesRes.json() : [];

              return {
                ...lesson,
                chapters,
                quizzes
              };
            } catch (error) {
              console.error(`Error fetching content for lesson ${lesson.id}:`, error);
              return { ...lesson, chapters: [], quizzes: [] };
            }
          })
        );

        setLessons(enrichedLessons);
      }
    } catch (error) {
      console.error('Error fetching course data:', error);
    }
  };

  const toggleLessonStatus = async (lessonId, currentStatus) => {
    const newStatus = currentStatus === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    
    try {
      const response = await fetch(`${API_BASE}/api/lessons/${lessonId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        setLessons(prev => prev.map(l => 
          l.id === lessonId ? { ...l, status: newStatus } : l
        ));
      } else {
        const error = await response.json();
        alert('Error updating lesson status: ' + (error.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating lesson status:', error);
      alert('Error updating lesson status');
    }
  };

  const toggleChapterStatus = async (chapterId, currentIsPublished) => {
    const newIsPublished = !currentIsPublished;
    
    try {
      const response = await fetch(`${API_BASE}/api/chapters/${chapterId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isPublished: newIsPublished })
      });

      if (response.ok) {
        setLessons(prev => prev.map(lesson => ({
          ...lesson,
          chapters: lesson.chapters.map(ch => 
            ch.id === chapterId ? { ...ch, isPublished: newIsPublished } : ch
          )
        })));
      } else {
        const error = await response.json();
        alert('Error updating chapter status: ' + (error.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating chapter status:', error);
      alert('Error updating chapter status');
    }
  };

  const toggleQuizStatus = async (quizId, currentStatus) => {
    const newStatus = !currentStatus; // isPublished is boolean
    
    try {
      const response = await fetch(`${API_BASE}/api/quizzes/${quizId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isPublished: newStatus })
      });

      if (response.ok) {
        setLessons(prev => prev.map(lesson => ({
          ...lesson,
          quizzes: lesson.quizzes.map(q => 
            q.id === quizId ? { ...q, isPublished: newStatus } : q
          )
        })));
      } else {
        const error = await response.json();
        alert('Error updating quiz status: ' + (error.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating quiz status:', error);
      alert('Error updating quiz status');
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center pt-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#B0D0D3] mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading course...</p>
          </div>
        </div>
      </>
    );
  }

  if (!course) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gray-50 pt-20 pb-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center py-12">
              <p className="text-gray-600">Course not found</p>
              <button
                onClick={() => navigate('/instructor-courses')}
                className="mt-4 text-[#B0D0D3] hover:text-[#9BC0C3] font-medium"
              >
                Back to My Courses
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50 pt-20 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => navigate('/instructor-courses')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to My Courses
            </button>
            <h1 className="text-3xl font-bold text-gray-900">{course.title}</h1>
            <p className="text-gray-600 mt-2">{course.description}</p>
            <div className="flex items-center gap-2 mt-4">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {course.category}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {course.level}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                course.status === 'published'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {course.status === 'published' ? 'Published' : 'Draft'}
              </span>
            </div>
          </div>

          {/* Lessons List */}
          <div className="space-y-6">
            {lessons.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No lessons yet</h3>
                <p className="text-gray-500">Add lessons to this course to get started</p>
              </div>
            ) : (
              lessons.map((lesson, lessonIndex) => (
                <div key={lesson.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  {/* Lesson Header */}
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex-shrink-0 w-8 h-8 bg-[#B0D0D3]/20 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-[#B0D0D3]">{lessonIndex + 1}</span>
                          </div>
                          <h3 className="text-xl font-semibold text-gray-900">{lesson.title}</h3>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            lesson.status === 'PUBLISHED' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : lesson.status === 'ARCHIVED'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {lesson.status || 'DRAFT'}
                          </span>
                        </div>
                        {lesson.description && (
                          <p className="text-sm text-gray-600 ml-11">{lesson.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => toggleLessonStatus(lesson.id, lesson.status || 'DRAFT')}
                        className={`p-2 rounded-lg transition-colors ${
                          lesson.status === 'PUBLISHED'
                            ? 'text-amber-600 hover:bg-amber-50'
                            : 'text-emerald-600 hover:bg-emerald-50'
                        }`}
                        title={lesson.status === 'PUBLISHED' ? 'Hide Lesson' : 'Show Lesson'}
                      >
                        {lesson.status === 'PUBLISHED' ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Chapters */}
                  {lesson.chapters && lesson.chapters.length > 0 && (
                    <div className="p-6 border-b border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Chapters ({lesson.chapters.length})
                      </h4>
                      <div className="space-y-3 ml-6">
                        {lesson.chapters.map((chapter, chapterIndex) => (
                          <div key={chapter.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-gray-500">#{chapterIndex + 1}</span>
                              <span className="text-sm font-medium text-gray-900">{chapter.title}</span>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                chapter.isPublished
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {chapter.isPublished ? 'Published' : 'Draft'}
                              </span>
                            </div>
                            <button
                              onClick={() => toggleChapterStatus(chapter.id, chapter.isPublished || false)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                chapter.isPublished
                                  ? 'text-amber-600 hover:bg-amber-50'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={chapter.isPublished ? 'Hide Chapter' : 'Show Chapter'}
                            >
                              {chapter.isPublished ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quizzes */}
                  {lesson.quizzes && lesson.quizzes.length > 0 && (
                    <div className="p-6">
                      <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <HelpCircle className="w-4 h-4" />
                        Quizzes ({lesson.quizzes.length})
                      </h4>
                      <div className="space-y-3 ml-6">
                        {lesson.quizzes.map((quiz, quizIndex) => (
                          <div key={quiz.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-gray-500">#{quizIndex + 1}</span>
                              <span className="text-sm font-medium text-gray-900">{quiz.title}</span>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                quiz.isPublished
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {quiz.isPublished ? 'Published' : 'Draft'}
                              </span>
                            </div>
                            <button
                              onClick={() => toggleQuizStatus(quiz.id, quiz.isPublished || false)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                quiz.isPublished
                                  ? 'text-amber-600 hover:bg-amber-50'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={quiz.isPublished ? 'Hide Quiz' : 'Show Quiz'}
                            >
                              {quiz.isPublished ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty state for lesson with no content */}
                  {(!lesson.chapters || lesson.chapters.length === 0) && 
                   (!lesson.quizzes || lesson.quizzes.length === 0) && (
                    <div className="p-6 text-center text-gray-500 text-sm">
                      No chapters or quizzes in this lesson yet
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
