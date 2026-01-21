import React from 'react';

export default function CourseCard({
  title,
  level = "Beginner",
  image,
  hours = "2–3 hrs",
  learners = 0,
  certificate = false,
  price = 0,
  isFree,
  id,
  skills = [],
  category,
  instructor,
  description,
  chapters = [],
  onMoreInfo = () => {},
  onStart = () => {},
}) {
  const levelColor = {
    Beginner: "#F7AF9D",
    Intermediate: "#B0D0D3",
    Advanced: "#C08497",
  }[level] || "#F7E3AF";

  // robust FREE detection
  const free =
    isFree === true ||
    isFree === "true" ||
    (typeof price === "string" ? price.trim() === "0" : (price ?? 0) === 0);

  // format as dollars (adds "$" if missing)
  const formatDollar = (val) => {
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed.startsWith("$")) return trimmed;
      const n = Number(trimmed);
      return Number.isFinite(n) ? `$${n.toFixed(2)}` : `$${trimmed}`;
    }
    const n = Number(val);
    return Number.isFinite(n) ? `$${n.toFixed(2)}` : "$0.00";
  };

  const priceLabel = free ? "FREE" : formatDollar(price);

  const [showModal, setShowModal] = React.useState(false);
  const [avg, setAvg] = React.useState(null);
  const [avgCount, setAvgCount] = React.useState(0);
  const [reviews, setReviews] = React.useState([]);
  const [myRating, setMyRating] = React.useState(0);
  const [myComment, setMyComment] = React.useState("");

  const handleMoreInfo = () => {
    setShowModal(true);
    onMoreInfo();
  };

  // Load reviews when card mounts and when modal opens (to ensure freshness)
  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/courses/${id}/reviews`);
        if (res.ok) {
          const data = await res.json();
          setAvg(data.average);
          setAvgCount(data.count || 0);
          setReviews(data.reviews || []);
        }
      } catch (_) {}
    })();
  }, [id, showModal]);

  const handleStartLearning = async () => {
    try {
      // Get current user ID from auth status API
      let userId = localStorage.getItem('userId');
      
      // Fetch actual userId from auth status API
      try {
        const authRes = await fetch('http://localhost:3000/api/auth/status', { credentials: 'include' });
        if (authRes.ok) {
          const authData = await authRes.json();
          if (authData.isAuthenticated && authData.user?.id) {
            userId = authData.user.id;
            localStorage.setItem('userId', userId);
          }
        }
      } catch (err) {
        console.error('Error fetching auth status:', err);
      }
      
      if (!userId || userId === 'anonymous_user') {
        console.error('User not authenticated');
        onStart(); // Still navigate
        return;
      }
      
      // Check current user's progress for this course
      // First try to get from backend API
      let currentProgress = 0;
      try {
        const progressRes = await fetch(`http://localhost:3000/api/courses/${id}/progress/${userId}`, {
          credentials: 'include'
        });
        if (progressRes.ok) {
          const progressData = await progressRes.json();
          currentProgress = progressData.progress || 0;
          console.log('Progress from API:', currentProgress);
        } else {
          console.log('Progress API returned status:', progressRes.status);
        }
      } catch (err) {
        console.error('Error fetching progress from API:', err);
      }
      
      // Also check localStorage for progress (might have progress not yet synced to backend)
      // Calculate progress from localStorage by checking all lessons for this course
      try {
        // Fetch course lessons to calculate progress
        const lessonsRes = await fetch(`http://localhost:3000/api/lessons/course/${id}?publishedOnly=true`, {
          credentials: 'include'
        });
        if (lessonsRes.ok) {
          const lessons = await lessonsRes.json();
          let totalCompleted = 0;
          let totalItems = 0;
          
          // For each lesson, check localStorage for completed chapters/quizzes
          for (const lesson of lessons) {
            try {
              const lessonContentRes = await fetch(`http://localhost:3000/api/lessons/${lesson.id}/content`, {
                credentials: 'include'
              });
              if (lessonContentRes.ok) {
                const lessonData = await lessonContentRes.json();
                const lessonChapters = lessonData.chapters || [];
                const lessonQuizzes = lessonData.quizzes || [];
                
                totalItems += lessonChapters.length + lessonQuizzes.length;
                
                // Check localStorage for this lesson
                const keyPrefix = `progress:${userId}:${id}:${lesson.id}`;
                const raw = localStorage.getItem(keyPrefix);
                if (raw) {
                  try {
                    const parsed = JSON.parse(raw);
                    const chaptersDone = Object.keys(parsed.chapters || {}).filter(k => parsed.chapters[k]).length;
                    const quizzesDone = Object.keys(parsed.quizzes || {}).filter(k => parsed.quizzes[k]).length;
                    const lessonCompleted = chaptersDone + quizzesDone;
                    totalCompleted += lessonCompleted;
                    console.log(`Lesson ${lesson.id}: ${lessonCompleted} completed (${chaptersDone} chapters, ${quizzesDone} quizzes) out of ${lessonChapters.length + lessonQuizzes.length} total`);
                  } catch (e) {
                    console.error('Error parsing localStorage progress:', e);
                  }
                } else {
                  console.log(`No localStorage data for lesson ${lesson.id}`);
                }
              }
            } catch (err) {
              console.error('Error fetching lesson content:', err);
            }
          }
          
          const localStorageProgress = totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 0;
          console.log('Progress from localStorage:', localStorageProgress, 'totalItems:', totalItems, 'totalCompleted:', totalCompleted);
          
          // Use the higher of the two (API or localStorage)
          if (localStorageProgress > currentProgress) {
            currentProgress = localStorageProgress;
            console.log('Using localStorage progress:', currentProgress);
          }
        }
      } catch (err) {
        console.error('Error calculating progress from localStorage:', err);
      }
      
      console.log('Final progress to send:', currentProgress);
      
      console.log('Calling start-learning with progress:', currentProgress, 'userId:', userId);
      
      // Call the start learning API with the actual progress
      // Only increment learners if progress > 0 (handled by backend)
      const response = await fetch(`http://localhost:3000/api/courses/${id}/start-learning`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          userId,
          progress: currentProgress // Use actual progress, not hardcoded 1
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Learning started result:', result);
        console.log('Learner count incremented:', result.learnerCountIncremented);
        console.log('Current learners count:', result.currentLearners);
        
        if (result.learnerCountIncremented) {
          console.log('✅ Learners count was incremented! New count:', result.currentLearners);
        } else {
          console.log('⚠️ Learners count was NOT incremented. Reason: progress =', currentProgress, 'or user already counted');
        }
        
        // Call the original onStart callback
        onStart();
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to start learning:', response.status, errorData);
        // Still call onStart for UI navigation
        onStart();
      }
    } catch (error) {
      console.error('Error starting learning:', error);
      // Still call onStart for UI navigation
      onStart();
    }
  };

  return (
    <>
    {/* CHANGED: remove fixed width; let parent decide width */}
    <article className="group w-full h-full overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md flex flex-col">
      {/* Image area */}
      <div className="relative h-40 overflow-hidden">
        <img
          src={image}
          alt={title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Left badge: certificate */}
        {certificate && (
          <span className="absolute left-3 top-3 rounded-md bg-white/95 px-2 py-0.5 text-[11px] font-semibold shadow">
            CERTIFICATE
          </span>
        )}

        {/* Right badge: FREE or $price */}
        <span
          className={`absolute right-3 top-3 rounded-md px-2 py-0.5 text-[11px] font-semibold shadow ${
            free ? "bg-green-50 text-green-700" : "bg-white/95 text-gray-900"
          }`}
        >
          {priceLabel}
        </span>
        {/* Rating badge */}
        {avg !== null && (
          <span className="absolute left-3 bottom-3 rounded-md bg-black/60 text-white px-2 py-0.5 text-[11px] font-semibold flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 20 20" fill="#FFD166"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.802 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.802-2.034a1 1 0 00-1.175 0l-2.802 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81H7.03a1 1 0 00.95-.69l1.07-3.292z"/></svg>
            {avg.toFixed(1)} ({avgCount})
          </span>
        )}
      </div>

      {/* Body */}
      {/* CHANGED: make body flex-1 so buttons sit at bottom and card heights match */}
      <div className="flex-1 p-4 flex flex-col">
        {/* Level pill */}
        <div className="mb-3">
          <span
            className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold text-gray-900"
            style={{ backgroundColor: levelColor }}
          >
            {level.toUpperCase()} LEVEL
          </span>
        </div>

        <h3 className="line-clamp-2 text-base font-semibold text-gray-900">
          {title}
        </h3>

        {/* Meta row */}
        <div className="mt-2 flex items-center justify-between text-[12px] text-gray-600">
          <div className="flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
              <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>{hours}</span>
          </div>
          <div className="flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M16 11a4 4 0 10-8 0 4 4 0 008 0z" stroke="currentColor" strokeWidth="2" />
              <path d="M4 20a8 8 0 0116 0" stroke="currentColor" strokeWidth="2" />
            </svg>
            <span>{Intl.NumberFormat().format(learners)} learners</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleMoreInfo}
            className="w-1/2 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50"
          >
            More Info
          </button>
          <button
            onClick={handleStartLearning}
            className="w-1/2 rounded-xl px-3 py-2 text-xs font-semibold text-white shadow-sm transition"
            style={{ backgroundColor: "#3AC389" }}
          >
            Start Learning
          </button>
        </div>
      </div>
    </article>

    {/* Course Details Modal */}
    {showModal && (
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}>
        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <img
                  src={image}
                  alt={title}
                  className="w-20 h-20 rounded-lg object-cover"
                />
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold text-gray-900"
                      style={{ backgroundColor: levelColor }}
                    >
                      {level.toUpperCase()} LEVEL
                    </span>
                    {certificate && (
                      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700">
                        CERTIFIED
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Course Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Price & Duration */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Price</label>
                  <div className={`text-lg font-semibold ${free ? 'text-green-600' : 'text-gray-900'}`}>
                    {priceLabel}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Duration</label>
                  <div className="text-sm text-gray-900">{hours}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Learners</label>
                  <div className="text-sm text-gray-900">{Intl.NumberFormat().format(learners)} enrolled</div>
                </div>
              </div>

              {/* Category & Instructor */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Category</label>
                  <div className="text-sm text-gray-900">{category || 'Uncategorized'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Instructor</label>
                  <div className="text-sm text-gray-900">{instructor || 'TBA'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Certification</label>
                  <div className="text-sm text-gray-900">
                    {certificate ? 'Certificate of Completion Available' : 'No Certificate'}
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            {description && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-500 mb-2">Description</label>
                <p className="text-sm text-gray-700 leading-relaxed">{description}</p>
              </div>
            )}

            {/* Skills */}
            {skills && skills.length > 0 && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-500 mb-2">Skills You'll Learn</label>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-blue-50 text-blue-700"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Chapters */}
            {chapters && chapters.length > 0 && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-500 mb-2">Course Content</label>
                <div className="space-y-2">
                  {chapters.map((chapter, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-blue-600">{index + 1}</span>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">{chapter.title || `Chapter ${index + 1}`}</div>
                        {chapter.description && (
                          <div className="text-xs text-gray-500">{chapter.description}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowModal(false);
                  handleStartLearning();
                }}
                className="flex-1 px-4 py-2 text-white rounded-lg transition-colors"
                style={{ backgroundColor: "#3AC389" }}
              >
                Start Learning
              </button>
            </div>

            {/* Reviews */}
            <div className="mt-6 border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-700 font-semibold">Course Reviews</div>
                {avg !== null && (
                  <div className="text-xs text-gray-500">Average: {avg.toFixed(2)} ({avgCount})</div>
                )}
              </div>
              
              {/* Display existing reviews */}
              {reviews.length > 0 && (
                <div className="mb-4 space-y-3 max-h-60 overflow-y-auto">
                  {reviews.map((review) => (
                    <div key={review.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{review.userName || 'Anonymous'}</span>
                          <div className="flex items-center gap-1">
                            {[1,2,3,4,5].map(n => (
                              <svg key={n} width="14" height="14" viewBox="0 0 20 20" fill={n <= (review.rating || 0) ? '#FFD166' : '#E5E7EB'}>
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.802 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.802-2.034a1 1 0 00-1.175 0l-2.802 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81H7.03a1 1 0 00.95-.69l1.07-3.292z"/>
                              </svg>
                            ))}
                          </div>
                        </div>
                        {review.createdAt && (
                          <span className="text-xs text-gray-500">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {review.comment && (
                        <p className="text-sm text-gray-700 mt-1">{review.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Submit new review */}
              <div className="border-t border-gray-200 pt-4">
                <div className="text-xs text-gray-600 mb-2">Write a Review</div>
                <div className="flex items-center gap-2 mb-2">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setMyRating(n)} aria-label={`rate ${n}`}>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill={n <= myRating ? '#FFD166' : '#E5E7EB'}>
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.802 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.802-2.034a1 1 0 00-1.175 0l-2.802 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81H7.03a1 1 0 00.95-.69l1.07-3.292z"/>
                      </svg>
                    </button>
                  ))}
                </div>
                <textarea value={myComment} onChange={(e)=>setMyComment(e.target.value)} placeholder="Optional comment" className="w-full border rounded p-2 text-sm" rows={2} />
                <div className="mt-2 flex justify-end">
                  <button onClick={async ()=>{
                    if (myRating === 0) {
                      alert('Please select a rating');
                      return;
                    }
                    try {
                      const userId = localStorage.getItem('userId') || 'demo-user';
                      const res = await fetch(`http://localhost:3000/api/courses/${id}/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, rating: myRating, comment: myComment })});
                      if (res.ok){
                        // Refresh reviews list
                        const r = await fetch(`http://localhost:3000/api/courses/${id}/reviews`);
                        const data = await r.json(); 
                        setAvg(data.average); 
                        setAvgCount(data.count||0);
                        setReviews(data.reviews || []);
                        setMyRating(0);
                        setMyComment('');
                        alert('Review submitted successfully!');
                      } else { 
                        const errorData = await res.json().catch(() => ({}));
                        alert('Failed to submit review: ' + (errorData.message || 'Unknown error'));
                      }
                    } catch (e){ 
                      console.error(e); 
                      alert('Error submitting review'); 
                    }
                  }} className="px-3 py-1.5 text-xs bg-[#4DA3FF] text-white rounded hover:bg-[#3A8FE6] transition-colors">Submit Review</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
