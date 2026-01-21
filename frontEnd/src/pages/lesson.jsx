/* eslint-disable no-unused-vars */
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function Lesson() {
  const { courseId, lessonId } = useParams();

  const [lesson, setLesson] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null); // { type: 'chapter'|'quiz', data }
  const [completedIds, setCompletedIds] = useState(() => {
    try {
      // Try to get userId from localStorage first (fallback for initial load)
      const userId = localStorage.getItem('userId') || 'demo-user';
      const raw = localStorage.getItem(`progress:${userId}:${courseId}:${lessonId}`);
      return raw ? JSON.parse(raw) : { chapters: {}, quizzes: {} };
    } catch { return { chapters: {}, quizzes: {} }; }
  });
  
  const [userId, setUserId] = useState(() => {
    // Get userId from localStorage as initial value, will be updated from auth API
    return localStorage.getItem('userId') || 'demo-user';
  });
  
  // Fetch actual userId from auth status API on mount
  useEffect(() => {
    (async () => {
      try {
        const authRes = await fetch('http://localhost:3000/api/auth/status', { credentials: 'include' });
        if (authRes.ok) {
          const authData = await authRes.json();
          if (authData.isAuthenticated && authData.user?.id) {
            setUserId(authData.user.id);
            // Also update localStorage for backward compatibility
            localStorage.setItem('userId', authData.user.id);
          }
        }
      } catch (_) {
        // Silently fail - use localStorage value
      }
    })();
  }, []);

  useEffect(() => {
    const loadLesson = async () => {
      try {
        setLoading(true);
        const res = await fetch(`http://localhost:3000/api/courses/${courseId}/lessons/${lessonId}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Lesson not found");
        const data = await res.json();
        setLesson(data.lesson);
        setChapters(data.chapters);
        setQuizzes(data.quizzes);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadLesson();
  }, [courseId, lessonId]);

  // Initialize default selection when data arrives
  useEffect(() => {
    if (!selectedItem && (chapters.length || quizzes.length)) {
      if (chapters.length) setSelectedItem({ type: "chapter", data: chapters[0] });
      else if (quizzes.length) setSelectedItem({ type: "quiz", data: quizzes[0] });
    }
  }, [chapters, quizzes, selectedItem]);

  // Persist course progress to backend whenever local completion changes
  useEffect(() => {
    const total = (chapters?.length || 0) + (quizzes?.length || 0);
    if (total === 0) return;
    const done = Object.keys(completedIds.chapters || {}).filter(k => completedIds.chapters[k]).length +
                 Object.keys(completedIds.quizzes || {}).filter(k => completedIds.quizzes[k]).length;
    const progress = Math.min(100, Math.max(0, Math.round((done / total) * 100)));
    // Save only if > 0 so learners count logic can kick in on server
    (async () => {
      try {
        // Get userId from auth status API instead of localStorage
        const authRes = await fetch('http://localhost:3000/api/auth/status', { credentials: 'include' });
        if (!authRes.ok) return; // Silently fail if auth check fails
        
        const authData = await authRes.json();
        if (!authData.isAuthenticated || !authData.user?.id) return;
        
        const userId = authData.user.id;
        
        // Update progress (non-blocking, errors are silently handled)
        const progressRes = await fetch(`http://localhost:3000/api/courses/${courseId}/progress`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ userId, progress, lessonId })
        });
        
        // Only call start-learning if progress > 0 and progress update was successful
        if (progress > 0 && progressRes.ok) {
          try {
            const startLearningRes = await fetch(`http://localhost:3000/api/courses/${courseId}/start-learning`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ userId, progress })
            });
            
            if (startLearningRes.ok) {
              const result = await startLearningRes.json();
              console.log('✅ Start learning successful:', result);
            } else {
              const errorData = await startLearningRes.json().catch(() => ({}));
              console.warn('⚠️ Start learning API returned error:', startLearningRes.status, errorData);
            }
          } catch (err) {
            console.warn('⚠️ Error calling start-learning API:', err.message);
            // Silently continue - progress is already saved
          }
        }
      } catch (_) {
        // Silently ignore all errors - progress is stored in localStorage anyway
      }
    })();
  }, [completedIds, chapters, quizzes, courseId, lessonId]);

  if (loading) return <Loading />;
  if (error) return <ErrorScreen message={error} />;
  if (!lesson) return <LessonNotFound />;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl p-6 md:p-10 pt-20">
        <BackButton />

        {/* Lesson Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-3xl font-bold mb-2">{lesson.title}</h1>
          <p className="text-gray-600">{lesson.description}</p>
        </div>

        {/* Sidebar + Content */}
        <div className="grid grid-cols-12 gap-6">
          <aside className="col-span-12 md:col-span-4 lg:col-span-3 bg-white rounded-lg shadow p-4 md:p-6 h-max sticky top-24">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Sommaire</h2>
              <SidebarProgress chapters={chapters} quizzes={quizzes} completed={completedIds} />
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">Chapters</p>
                <ul className="space-y-2">
                  {chapters.map((ch) => {
                    const active = selectedItem?.type === "chapter" && selectedItem?.data?.id === ch.id;
                    const done = Boolean(completedIds.chapters?.[ch.id]);
                    return (
                      <li
                        key={ch.id}
                        className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${active ? "bg-blue-50 border-blue-300" : "hover:bg-gray-50"}`}
                        onClick={() => {
                          setSelectedItem({ type: "chapter", data: ch });
                          setCompletedIds(prev => {
                            const next = { ...prev, chapters: { ...prev.chapters, [ch.id]: true } };
                            localStorage.setItem(`progress:${userId}:${courseId}:${lessonId}`, JSON.stringify(next));
                            return next;
                          });
                        }}
                      >
                        <span className={`w-2 h-2 rounded-full ${done ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span className="truncate">{ch.title}</span>
              </li>
                    );
                  })}
          </ul>
        </div>

              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">Quizzes</p>
                <ul className="space-y-2">
                  {quizzes.map((qz) => {
                    const active = selectedItem?.type === "quiz" && selectedItem?.data?.id === qz.id;
                    const done = Boolean(completedIds.quizzes?.[qz.id]);
                    return (
                      <li
                        key={qz.id}
                        className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${active ? "bg-blue-50 border-blue-300" : "hover:bg-gray-50"}`}
                        onClick={() => setSelectedItem({ type: "quiz", data: qz })}
                      >
                        <span className={`w-2 h-2 rounded-full ${done ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span className="truncate">{qz.title}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </aside>

          <section className="col-span-12 md:col-span-8 lg:col-span-9 space-y-6">
            {!selectedItem && (
              <div className="bg-white rounded-lg shadow p-6 text-gray-500">Select a chapter or quiz from the left.</div>
            )}

            {selectedItem?.type === "chapter" && (
              <ChapterContent chapter={selectedItem.data} />
            )}

            {selectedItem?.type === "quiz" && (
              <QuizComponent 
                key={selectedItem.data.id} 
                quiz={selectedItem.data}
                userId={userId}
                onSubmitted={() => {
                  setCompletedIds(prev => {
                    const next = { ...prev, quizzes: { ...prev.quizzes, [selectedItem.data.id]: true } };
                    localStorage.setItem(`progress:${userId}:${courseId}:${lessonId}`, JSON.stringify(next));
                    return next;
                  });
                }} 
              />
            )}
          </section>
        </div>
      </main>
    </>
  );
}

/* --- Quiz Component --- */
function QuizComponent({ quiz, userId: propUserId, onSubmitted }) {
  const [answers, setAnswers] = useState({}); // { questionIndex: number[] }
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState([]);
  const [userId, setUserId] = useState(() => propUserId || localStorage.getItem('userId') || 'demo-user');
  const [quizStarted, setQuizStarted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0); // in seconds
  const [evaluationLoaded, setEvaluationLoaded] = useState(false); // Track if we've checked for existing evaluation
  const timerIntervalRef = useRef(null);
  const autoSubmittedRef = useRef(false);
  
  // Get time limit from quiz (in minutes, default to 30)
  const timeLimitMinutes = quiz?.timeLimit || 30;
  const timeLimitSeconds = timeLimitMinutes * 60;
  
  // Fetch actual userId from auth status API on mount
  useEffect(() => {
    (async () => {
      try {
        const authRes = await fetch('http://localhost:3000/api/auth/status', { credentials: 'include' });
        if (authRes.ok) {
          const authData = await authRes.json();
          if (authData.isAuthenticated && authData.user?.id) {
            const realUserId = authData.user.id;
            setUserId(realUserId);
            localStorage.setItem('userId', realUserId);
            // Trigger evaluation check after userId is set
            console.log('UserId set to:', realUserId);
            
            // Immediately check localStorage with the real userId
            if (quiz?.id) {
              const localStorageKey = `quiz_submitted_${quiz.id}_${realUserId}`;
              const localSubmitted = localStorage.getItem(localStorageKey);
              if (localSubmitted === 'true') {
                console.log('Found localStorage flag after userId set');
                setSubmitted(true);
                setQuizStarted(false);
                const localScore = localStorage.getItem(`${localStorageKey}_score`);
                const localResults = localStorage.getItem(`${localStorageKey}_results`);
                if (localScore) setScore(parseInt(localScore) || 0);
                if (localResults) {
                  try {
                    setResults(JSON.parse(localResults) || []);
                  } catch (e) {
                    console.error('Error parsing localStorage results:', e);
                  }
                }
                setEvaluationLoaded(true);
              }
            }
          }
        }
      } catch (_) {
        // Silently fail - use localStorage value
      }
    })();
  }, [quiz?.id]);

  // Load existing evaluation (prevent retake) - wait for both userId and quiz.id
  useEffect(() => {
    if (!quiz?.id) return; // Wait for quiz to be available
    
    // Check localStorage - try to find any submission for this quiz regardless of userId
    // This handles cases where userId might have changed
    const checkLocalStorage = () => {
      if (!userId || userId === 'demo-user') return false;
      
      const localStorageKey = `quiz_submitted_${quiz.id}_${userId}`;
      const localSubmitted = localStorage.getItem(localStorageKey);
      const localScore = localStorage.getItem(`${localStorageKey}_score`);
      const localResults = localStorage.getItem(`${localStorageKey}_results`);
      
      if (localSubmitted === 'true') {
        console.log('Found localStorage flag for submitted quiz, userId:', userId);
        // If we have localStorage data, use it immediately to prevent retakes
        if (localScore && localResults) {
          try {
            setSubmitted(true);
            setScore(parseInt(localScore) || 0);
            setResults(JSON.parse(localResults) || []);
            setQuizStarted(false);
            setEvaluationLoaded(true);
            console.log('Using localStorage data to prevent retake');
            return true; // Found and set
          } catch (err) {
            console.error('Error parsing localStorage data:', err);
          }
        } else {
          // Just the flag exists, but no data - still prevent retake
          setSubmitted(true);
          setQuizStarted(false);
          setEvaluationLoaded(true);
          console.log('Using localStorage flag to prevent retake (no score data)');
          return true; // Found and set
        }
      }
      return false; // Not found
    };
    
    // If userId is available, check localStorage immediately
    if (userId && userId !== 'demo-user') {
      if (checkLocalStorage()) {
        return; // Exit early, don't check API
      }
    }
    
    // Also check if quiz object has evaluations embedded (direct check)
    if (quiz.evaluations && Array.isArray(quiz.evaluations) && userId && userId !== 'demo-user') {
      const directEval = quiz.evaluations.find(evaluation => evaluation.userId === userId);
      if (directEval) {
        const localStorageKey = `quiz_submitted_${quiz.id}_${userId}`;
        console.log('Found evaluation directly in quiz object:', directEval);
        setSubmitted(true);
        setScore(directEval.score || 0);
        setResults(directEval.results || []);
        setQuizStarted(false);
        localStorage.setItem(localStorageKey, 'true');
        setEvaluationLoaded(true);
        return;
      }
    }
    
    // Also try fetching the quiz directly to check for evaluations
    const checkQuizDirectly = async () => {
      try {
        const quizRes = await fetch(`http://localhost:3000/api/quizzes/${quiz.id}`, { credentials: 'include' });
        if (quizRes.ok) {
          const quizData = await quizRes.json();
          console.log('Quiz data fetched directly:', quizData);
          if (quizData.evaluations && Array.isArray(quizData.evaluations) && userId && userId !== 'demo-user') {
            const directEval = quizData.evaluations.find(evaluation => evaluation.userId === userId);
            if (directEval) {
              const localStorageKey = `quiz_submitted_${quiz.id}_${userId}`;
              console.log('Found evaluation in directly fetched quiz:', directEval);
              setSubmitted(true);
              setScore(directEval.score || 0);
              setResults(directEval.results || []);
              setQuizStarted(false);
              localStorage.setItem(localStorageKey, 'true');
              setEvaluationLoaded(true);
              return true; // Found evaluation
            }
          }
        }
      } catch (err) {
        console.error('Error fetching quiz directly:', err);
      }
      return false; // No evaluation found
    };
    
    if (!userId || userId === 'demo-user') {
      // If userId is still demo-user, wait a bit for auth to complete
      // But also check localStorage with a fallback - search all keys for this quiz
      const checkAllLocalStorage = () => {
        // Search all localStorage keys for this quiz
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(`quiz_submitted_${quiz.id}_`)) {
            const localScore = localStorage.getItem(key.replace('quiz_submitted_', 'quiz_submitted_').replace('_score', '_score') || key + '_score');
            const localResults = localStorage.getItem(key + '_results');
            if (localScore || localResults) {
              console.log('Found localStorage entry for quiz:', key);
              setSubmitted(true);
              setQuizStarted(false);
              if (localScore) setScore(parseInt(localScore) || 0);
              if (localResults) {
                try {
                  setResults(JSON.parse(localResults) || []);
                } catch (e) {
                  console.error('Error parsing localStorage results:', e);
                }
              }
              setEvaluationLoaded(true);
              return true;
            }
          }
        }
        return false;
      };
      
      const timeout = setTimeout(() => {
        // Try to find localStorage entry even without userId
        if (!checkAllLocalStorage()) {
          setEvaluationLoaded(true);
        }
      }, 2000); // Wait 2 seconds for auth
      return () => clearTimeout(timeout);
    }
    
    const loadEval = async () => {
      // Define localStorageKey and localSubmitted in this scope
      const localStorageKey = `quiz_submitted_${quiz.id}_${userId}`;
      const localSubmitted = localStorage.getItem(localStorageKey);
      
      try {
        // First try checking the quiz directly
        const foundDirectly = await checkQuizDirectly();
        if (foundDirectly) {
          return; // Evaluation found, exit early
        }
        
        console.log('Checking for existing evaluation for quiz:', quiz.id, 'userId:', userId);
        const res = await fetch(`http://localhost:3000/api/quizzes/evaluations/${userId}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          console.log('Evaluations data:', JSON.stringify(data, null, 2));
          console.log('Looking for quizId:', quiz.id);
          console.log('Available evaluations:', data.evaluations);
          // Check if evaluations array exists and find the matching quiz
          const evalForThis = data.evaluations?.find(e => {
            const matches = e.quizId === quiz.id;
            console.log('Checking evaluation:', {
              evaluationQuizId: e.quizId,
              currentQuizId: quiz.id,
              matches: matches,
              evaluation: e
            });
            return matches;
          });
          console.log('Found evaluation for this quiz:', evalForThis);
          if (evalForThis && evalForThis.evaluation) {
            // Quiz already submitted - show results immediately
            console.log('Quiz already submitted, setting submitted state');
            setSubmitted(true);
            setScore(evalForThis.evaluation.score || 0);
            setResults(evalForThis.evaluation.results || []);
            // Don't allow starting the quiz again
            setQuizStarted(false);
            // Save to localStorage as backup
            localStorage.setItem(localStorageKey, 'true');
          } else {
            // No evaluation found in API
            console.log('No existing evaluation found in API');
            // If localStorage flag exists, respect it (user submitted before)
            if (localSubmitted === 'true') {
              console.log('localStorage flag exists, preventing retake even though API has no record');
              setSubmitted(true);
              setQuizStarted(false);
              // Try to load score/results from localStorage if available
              const localScore = localStorage.getItem(`${localStorageKey}_score`);
              const localResults = localStorage.getItem(`${localStorageKey}_results`);
              if (localScore) setScore(parseInt(localScore) || 0);
              if (localResults) {
                try {
                  setResults(JSON.parse(localResults) || []);
                } catch (e) {
                  console.error('Error parsing localStorage results:', e);
                }
              }
            }
          }
        } else {
          console.log('Failed to fetch evaluations, status:', res.status);
          const errorText = await res.text().catch(() => '');
          console.log('Error response:', errorText);
          // If we have localStorage flag but API fails, still respect it
          if (localSubmitted === 'true') {
            console.log('Using localStorage flag as fallback');
            setSubmitted(true);
            setQuizStarted(false);
          }
        }
        setEvaluationLoaded(true); // Mark as loaded regardless of result
      } catch (err) {
        console.error('Error loading evaluation:', err);
        // If we have localStorage flag but API fails, still respect it
        if (localSubmitted === 'true') {
          console.log('Using localStorage flag as fallback due to error');
          setSubmitted(true);
          setQuizStarted(false);
        }
        setEvaluationLoaded(true); // Mark as loaded even on error
      }
    };
    loadEval();
  }, [quiz?.id, quiz?.evaluations, userId]);

  // Define handleSubmit before it's used in useEffect
  const handleSubmit = useCallback(async () => {
    if (submitted || !quizStarted) return;
    
    // Clear timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    try {
      const answersArray = quiz.questions.map((_, idx) => answers[idx] || []);
      const res = await fetch(`http://localhost:3000/api/quizzes/${quiz.id}/submit-evaluation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, answers: answersArray })
      });
      if (res.status === 409) {
        const data = await res.json();
        setScore(data.evaluation.score);
        setResults(data.evaluation.results || []);
        setSubmitted(true);
        // Save to localStorage as backup
        const localStorageKey = `quiz_submitted_${quiz.id}_${userId}`;
        localStorage.setItem(localStorageKey, 'true');
        localStorage.setItem(`${localStorageKey}_score`, String(data.evaluation.score || 0));
        localStorage.setItem(`${localStorageKey}_results`, JSON.stringify(data.evaluation.results || []));
        console.log('Quiz already submitted (409), using existing evaluation:', {
          score: data.evaluation.score,
          resultsCount: data.evaluation.results?.length || 0
        });
        if (onSubmitted) onSubmitted();
        return;
      }
      if (!res.ok) throw new Error('Submit failed');
      const data = await res.json();
      setScore(data.evaluation.score);
      setResults(data.evaluation.results || []);
      setSubmitted(true);
      // Save to localStorage as backup
      const localStorageKey = `quiz_submitted_${quiz.id}_${userId}`;
      localStorage.setItem(localStorageKey, 'true');
      localStorage.setItem(`${localStorageKey}_score`, String(data.evaluation.score || 0));
      localStorage.setItem(`${localStorageKey}_results`, JSON.stringify(data.evaluation.results || []));
      console.log('Quiz submitted and saved to localStorage:', {
        score: data.evaluation.score,
        resultsCount: data.evaluation.results?.length || 0
      });
      if (onSubmitted) onSubmitted();
    } catch (e) {
      alert(e.message || 'Failed to submit');
    }
  }, [submitted, quizStarted, quiz, userId, answers, onSubmitted]);

  // Timer countdown effect
  useEffect(() => {
    if (!quizStarted || submitted) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    if (timeRemaining <= 0) {
      // Timer reached 0, will be handled by separate effect
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    timerIntervalRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [quizStarted, timeRemaining, submitted]);

  // Auto-submit when timer reaches 0
  useEffect(() => {
    if (quizStarted && timeRemaining === 0 && !submitted && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      handleSubmit();
    }
  }, [quizStarted, timeRemaining, submitted, handleSubmit]);

  const handleStartQuiz = () => {
    // Prevent starting if already submitted
    if (submitted) {
      alert('This quiz has already been completed. You cannot retake it.');
      return;
    }
    setQuizStarted(true);
    setTimeRemaining(timeLimitSeconds);
    autoSubmittedRef.current = false;
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleSelectSingle = (qIndex, optionIndex) => {
    if (submitted || !quizStarted) return;
    setAnswers((prev) => ({ ...prev, [qIndex]: [optionIndex] }));
  };

  const handleToggleMulti = (qIndex, optionIndex) => {
    if (submitted || !quizStarted) return;
    setAnswers(prev => {
      const current = new Set(prev[qIndex] || []);
      if (current.has(optionIndex)) current.delete(optionIndex); else current.add(optionIndex);
      return { ...prev, [qIndex]: Array.from(current) };
    });
  };

  // Show loading state while checking for existing evaluation
  if (!evaluationLoaded) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4DA3FF] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quiz...</p>
        </div>
      </div>
    );
  }

  // Show "Start Now" screen if quiz hasn't started and not already submitted
  if (!quizStarted && !submitted) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="text-center py-12">
          <h2 className="text-3xl font-bold mb-4">{quiz.title}</h2>
          {quiz.description && (
            <p className="text-gray-600 mb-6">{quiz.description}</p>
          )}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6 max-w-md mx-auto">
            <div className="flex items-center justify-center gap-2 mb-2">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-lg font-semibold text-blue-900">Time Limit: {timeLimitMinutes} minutes</span>
            </div>
            <p className="text-sm text-blue-700">You will have {timeLimitMinutes} minutes to complete this quiz. The timer will start when you click "Start Now".</p>
            <p className="text-xs text-red-600 mt-2 font-semibold">⚠️ You can only take this quiz once!</p>
          </div>
          <button
            onClick={handleStartQuiz}
            className="px-8 py-4 bg-[#4DA3FF] text-white rounded-lg hover:bg-[#3B8BCC] transition-colors text-lg font-semibold shadow-lg"
          >
            Start Now
          </button>
        </div>
      </div>
    );
  }

  // Show results screen if quiz was already submitted
  if (submitted && !quizStarted) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="text-center py-8">
          <h2 className="text-3xl font-bold mb-4">{quiz.title}</h2>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6 max-w-md mx-auto">
            <div className="flex items-center justify-center gap-2 mb-4">
              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xl font-semibold text-gray-900">Quiz Already Completed</span>
            </div>
            <p className="text-sm text-gray-600 mb-4">You have already taken this quiz. Your score has been recorded.</p>
            <div className="mt-4 p-4 bg-white rounded-lg border-2 border-[#4DA3FF]">
              <p className="text-3xl font-bold text-[#4DA3FF] mb-2">{score}%</p>
              <p className="text-sm text-gray-600">Your Score</p>
              {quiz.passingScore && (
                <p className={`mt-2 text-sm font-medium ${score >= quiz.passingScore ? 'text-green-600' : 'text-red-600'}`}>
                  {score >= quiz.passingScore 
                    ? `✓ You passed! (Required: ${quiz.passingScore}%)` 
                    : `✗ You did not pass. (Required: ${quiz.passingScore}%)`}
                </p>
              )}
            </div>
          </div>
        </div>
        
        {/* Show question results */}
        {results.length > 0 && (
          <div className="mt-8 space-y-6">
            <h3 className="text-xl font-semibold mb-4">Your Answers</h3>
            {quiz.questions.map((q, qIndex) => {
              const res = results.find(r => r.questionIndex === qIndex);
              const isCorrect = res?.isCorrect || false;
              const userAnswerIndices = res?.userAnswer || [];
              const correctAnswerIndices = res?.correctAnswer || [];
              
              return (
                <div key={qIndex} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-medium">{q.question}</p>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-gray-600">
                      <strong>Your answer:</strong> {
                        userAnswerIndices.length > 0 
                          ? userAnswerIndices.map(i => q.options[i]).join(', ')
                          : 'No answer provided'
                      }
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Correct answer:</strong> {
                        correctAnswerIndices.length > 0
                          ? correctAnswerIndices.map(i => q.options[i]).join(', ')
                          : 'N/A'
                      }
                    </p>
                    {res?.explanation && (
                      <p className="text-sm text-blue-600 mt-2 italic">{res.explanation}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">{quiz.title}</h2>
        {quizStarted && !submitted && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-lg font-bold ${
            timeRemaining <= 60 
              ? 'bg-red-100 text-red-700 border-2 border-red-300' 
              : timeRemaining <= 300 
              ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-300'
              : 'bg-blue-100 text-blue-700 border-2 border-blue-300'
          }`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{formatTime(timeRemaining)}</span>
          </div>
        )}
      </div>
      {quiz.questions.map((q, qIndex) => {
        const isMulti = Array.isArray(q.correctAnswers) && q.correctAnswers.length > 1;
        const selected = new Set(answers[qIndex] || []);
        const res = results.find(r => r.questionIndex === qIndex);
        return (
          <div key={qIndex} className="mb-6">
          <p className="font-medium mb-2">{q.question}</p>
          <ul className="space-y-2">
            {q.options.map((opt, i) => {
                const isSelected = selected.has(i);
                const isCorrect = submitted && res ? res.correctAnswer.includes(i) : false;
                const isWrong = submitted && res ? isSelected && !res.correctAnswer.includes(i) : false;
                const clickHandler = isMulti ? () => handleToggleMulti(qIndex, i) : () => handleSelectSingle(qIndex, i);
              return (
                <li
                  key={i}
                  className={`p-2 border rounded ${
                    submitted || quizStarted ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                  }
                    ${isSelected ? "bg-blue-100" : ""}
                    ${isCorrect ? "bg-green-200 border-green-400" : ""}
                    ${isWrong ? "bg-red-200 border-red-400" : ""}`}
                    onClick={clickHandler}
                >
                    {isMulti && <input type="checkbox" checked={isSelected} readOnly className="mr-2" />}
                    {!isMulti && <input type="radio" name={`q-${qIndex}`} checked={isSelected} readOnly className="mr-2" />}
                  {opt}
                </li>
              );
            })}
          </ul>
            {submitted && res?.explanation && (
              <p className="mt-2 text-sm text-gray-600">Explanation: {res.explanation}</p>
            )}
        </div>
        );
      })}

      {!submitted ? (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {quizStarted && timeRemaining > 0 && (
              <span>Time remaining: <strong>{formatTime(timeRemaining)}</strong></span>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={!quizStarted}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              quizStarted
                ? 'bg-[#4DA3FF] text-white hover:bg-[#3B8BCC]'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Submit Quiz
          </button>
        </div>
      ) : (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-lg font-semibold text-gray-900">Quiz Completed!</p>
          <p className="mt-2 text-2xl font-bold text-[#4DA3FF]">Your score: {score}%</p>
          {quiz.passingScore && (
            <p className={`mt-2 text-sm ${score >= quiz.passingScore ? 'text-green-600' : 'text-red-600'}`}>
              {score >= quiz.passingScore 
                ? `✓ You passed! (Required: ${quiz.passingScore}%)` 
                : `✗ You did not pass. (Required: ${quiz.passingScore}%)`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}


/* --- Chapter Content Component --- */

function ChapterContent({ chapter }) {
  const isFile = chapter?.contentType === "file" || (!!chapter?.fileUrl && !(chapter?.sections || []).length);

  const normalizeUrl = (url) => {
    if (/^https?:\/\//i.test(url)) return url;
    return `http://localhost:3000/uploads/chapters/${encodeURIComponent(url)}`;
  };

  const renderFileViewer = (url, ext, idx = 0) => {
    const isPdf = ext === "pdf";
    const isDoc = ext === "doc" || ext === "docx";
    const encodedUrl = encodeURIComponent(url);

    return (
      <div className="border rounded overflow-hidden" style={{ height: "70vh" }}>
        {isPdf ? (
          <iframe
            title={`pdf-${idx}`}
            src={url}
            className="w-full h-full"
            type="application/pdf"
          />
        ) : isDoc ? (
          <div className="h-full flex flex-col items-center justify-center p-8 bg-gray-50">
            <div className="text-center max-w-md">
              <div className="mb-4 text-4xl">📄</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">DOCX File</h3>
              <p className="text-gray-600 mb-6">
                DOCX files cannot be previewed in the browser. Please download the file to view it.
              </p>
              <a
                href={url}
                download
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#B0D0D3] hover:bg-[#9BC0C3] text-white rounded-lg font-medium transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download DOCX File
              </a>
              <p className="text-sm text-gray-500 mt-4">
                Tip: You can open DOCX files with Microsoft Word, Google Docs, or LibreOffice.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 text-gray-600 bg-gray-50 border rounded">
            📎 File type not supported for preview.
          </div>
        )}
      </div>
    );
  };

  if (isFile) {
    const rawUrl = chapter.fileUrl;
    const url = normalizeUrl(rawUrl);
    const ext = (rawUrl || "").split(".").pop()?.toLowerCase();

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-semibold mb-4">{chapter.title}</h2>
        {url && renderFileViewer(url, ext)}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-semibold mb-6">{chapter.title}</h2>
      <div className="space-y-6">
        {(chapter.sections || []).map((sec, idx) => {
          const filename = (sec.filePath || sec.content || "").split(/[/\\]/).pop();
          const ext = filename?.split(".").pop()?.toLowerCase();
          const publicUrl = normalizeUrl(filename);

          if (sec.type === "image") {
            return (
              <figure key={idx} className="space-y-2">
                <img src={publicUrl} alt={sec.caption || `image-${idx}`} className="w-full rounded border" />
                {sec.caption && <figcaption className="text-sm text-gray-500">{sec.caption}</figcaption>}
              </figure>
            );
          }

          if (sec.type === "video") {
            return (
              <div key={idx} className="w-full">
                <VideoEmbed url={sec.content} />
              </div>
            );
          }

          if (sec.type === "pdf" || sec.filePath) {
            return (
              <div key={idx} className="space-y-2">
                <div className="p-3 border rounded bg-gray-50 font-medium">{sec.originalName || filename}</div>
                {renderFileViewer(publicUrl, ext, idx)}
              </div>
            );
          }

          if (sec.type === "audio") {
            return (
              <div key={idx} className="w-full">
                <audio controls className="w-full">
                  <source src={publicUrl} />
                </audio>
              </div>
            );
          }

          if (sec.type === "mixed") {
            // Parse mixed content
            let mixedData = null;
            try {
              mixedData = typeof sec.content === 'string' ? JSON.parse(sec.content) : sec.content;
            } catch (e) {
              mixedData = { title: '', parts: [] };
            }

            return (
              <div key={idx} className="space-y-6 border rounded-lg p-6 bg-gray-50">
                {mixedData.title && (
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">{mixedData.title}</h3>
                )}
                <div className="space-y-4">
                  {(mixedData.parts || []).map((part, partIdx) => {
                    const partContent = part.content || '';
                    // Handle file URLs - if it starts with /uploads, use it directly, otherwise normalize
                    let partUrl = partContent;
                    if (!partContent.startsWith('http')) {
                      if (partContent.startsWith('/uploads/')) {
                        // Already a full path, just add the base URL
                        partUrl = `http://localhost:3000${partContent}`;
                      } else {
                        // Just a filename, normalize it
                        partUrl = normalizeUrl(partContent);
                      }
                    }
                    // Extract filename for display
                    const filename = partContent.split(/[/\\]/).pop();
                    const ext = filename?.split('.').pop()?.toLowerCase();

                    if (part.type === "text") {
                      return (
                        <div key={partIdx} className="prose max-w-none">
                          <p className="text-gray-700 whitespace-pre-wrap">{partContent}</p>
                        </div>
                      );
                    }

                    if (part.type === "image") {
                      return (
                        <figure key={partIdx} className="space-y-2">
                          <img src={partUrl} alt={`image-${partIdx}`} className="w-full rounded border max-w-2xl mx-auto" />
                        </figure>
                      );
                    }

                    if (part.type === "video") {
                      return (
                        <div key={partIdx} className="w-full">
                          <VideoEmbed url={partContent} />
                        </div>
                      );
                    }

                    if (part.type === "audio") {
                      return (
                        <div key={partIdx} className="w-full">
                          <audio controls className="w-full">
                            <source src={partUrl} />
                          </audio>
                        </div>
                      );
                    }

                    if (part.type === "pdf" || part.type === "docx") {
                      return (
                        <div key={partIdx} className="space-y-2">
                          <div className="p-3 border rounded bg-gray-50 font-medium">{filename || `file-${partIdx}`}</div>
                          {renderFileViewer(partUrl, ext, partIdx)}
                        </div>
                      );
                    }

                    return (
                      <div key={partIdx} className="p-4 border rounded bg-white">
                        <p className="text-sm text-gray-600">Unknown part type: {part.type}</p>
                        <p className="text-gray-700 mt-2">{partContent}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }

          return (
            <div key={idx} className="prose max-w-none">
              <p>{sec.content}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}



function VideoEmbed({ url }) {
  // Normalize YouTube/Vimeo/watch links to embeddable iframe src
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) {
      // watch?v= -> embed
      const v = u.searchParams.get('v');
      if (v) return <iframe className="w-full aspect-video rounded" src={`https://www.youtube.com/embed/${v}`} title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />;
    }
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.replace('/', '');
      if (id) return <iframe className="w-full aspect-video rounded" src={`https://www.youtube.com/embed/${id}`} title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />;
    }
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop();
      if (id) return <iframe className="w-full aspect-video rounded" src={`https://player.vimeo.com/video/${id}`} title="Vimeo video" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />;
    }
  } catch {}
  // Fallback: try direct iframe
  return <iframe className="w-full aspect-video rounded" src={url} title="video" allowFullScreen />;
}
/* --- Helpers --- */
const Loading = () => (
  <div className="flex items-center justify-center py-20">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#B0D0D3]" />
  </div>
);

const ErrorScreen = ({ message }) => (
  <div className="text-center py-20">
    <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
    <p>{message}</p>
  </div>
);

const LessonNotFound = () => (
  <div className="text-center py-20">
    <h2 className="text-2xl font-bold text-gray-900 mb-4">Lesson Not Found</h2>
  </div>
);

const BackButton = () => (
  <button onClick={() => window.history.back()} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
    </svg>
    Back to Course
  </button>
);

function SidebarProgress({ chapters, quizzes, completed }) {
  const total = (chapters?.length || 0) + (quizzes?.length || 0);
  const done = Object.keys(completed?.chapters || {}).filter(k => completed.chapters[k]).length +
               Object.keys(completed?.quizzes || {}).filter(k => completed.quizzes[k]).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 bg-gray-200 rounded-full h-2">
        <div className="h-2 bg-[#4DA3FF] rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-600">{done}/{total}</span>
    </div>
  );
}
