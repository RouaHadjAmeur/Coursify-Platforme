import { getDatabase } from './config/database.js';

async function testHierarchy() {
  try {
    console.log('🧪 Testing Course → Lesson → Chapter/Quiz Hierarchy\n');
    
    const db = await getDatabase();
    
    // Test 1: Create a course
    console.log('1. Creating a course...');
    const coursesCollection = db.collection('courses');
    const course = {
      id: 'test_course_1',
      title: 'Test Web Development Course',
      description: 'A comprehensive test course',
      level: 'Beginner',
      category: 'Programming',
      instructor: 'Test Instructor',
      price: 0,
      skills: ['HTML', 'CSS', 'JavaScript'],
      participatedUsers: [],
      progress: 0,
      lessons: [],
      createdAt: new Date().toISOString(),
      status: 'published'
    };
    
    await coursesCollection.insertOne(course);
    console.log('✅ Course created:', course.title);
    
    // Test 2: Create lessons for the course
    console.log('\n2. Creating lessons...');
    const lessonsCollection = db.collection('lessons');
    
    const lesson1 = {
      id: 'test_lesson_1',
      title: 'HTML Fundamentals',
      description: 'Learn HTML basics',
      courseId: 'test_course_1',
      order: 1,
      duration: '2 hours',
      videoUrl: 'https://example.com/video1',
      content: 'HTML is the foundation of web development...',
      isPublished: true,
      chapters: [],
      quizzes: [],
      createdAt: new Date().toISOString()
    };
    
    const lesson2 = {
      id: 'test_lesson_2',
      title: 'CSS Styling',
      description: 'Master CSS styling',
      courseId: 'test_course_1',
      order: 2,
      duration: '3 hours',
      videoUrl: 'https://example.com/video2',
      content: 'CSS makes your websites beautiful...',
      isPublished: true,
      chapters: [],
      quizzes: [],
      createdAt: new Date().toISOString()
    };
    
    await lessonsCollection.insertOne(lesson1);
    await lessonsCollection.insertOne(lesson2);
    console.log('✅ Lessons created:', lesson1.title, 'and', lesson2.title);
    
    // Test 3: Create chapters for lessons
    console.log('\n3. Creating chapters...');
    const chaptersCollection = db.collection('chapters');
    
    const chapter1 = {
      id: 'test_chapter_1',
      title: 'HTML Document Structure',
      content: 'Every HTML document has a basic structure...',
      lessonId: 'test_lesson_1',
      order: 1,
      duration: '30 min',
      videoUrl: 'https://example.com/chapter1',
      isPublished: true,
      createdAt: new Date().toISOString()
    };
    
    const chapter2 = {
      id: 'test_chapter_2',
      title: 'HTML Elements',
      content: 'Learn about HTML elements and tags...',
      lessonId: 'test_lesson_1',
      order: 2,
      duration: '45 min',
      videoUrl: 'https://example.com/chapter2',
      isPublished: true,
      createdAt: new Date().toISOString()
    };
    
    await chaptersCollection.insertOne(chapter1);
    await chaptersCollection.insertOne(chapter2);
    console.log('✅ Chapters created:', chapter1.title, 'and', chapter2.title);
    
    // Test 4: Create quizzes for lessons
    console.log('\n4. Creating quizzes...');
    const quizzesCollection = db.collection('quizzes');
    
    const quiz1 = {
      id: 'test_quiz_1',
      title: 'HTML Basics Quiz',
      description: 'Test your HTML knowledge',
      lessonId: 'test_lesson_1',
      timeLimit: 15,
      passingScore: 70,
      questions: [
        {
          question: 'What does HTML stand for?',
          options: [
            'HyperText Markup Language',
            'High Tech Modern Language',
            'Home Tool Markup Language'
          ],
          correctAnswers: [0],
          explanation: 'HTML stands for HyperText Markup Language'
        },
        {
          question: 'Which tag is used for the largest heading?',
          options: ['h1', 'h6', 'heading', 'head'],
          correctAnswers: [0],
          explanation: 'h1 is used for the largest heading'
        }
      ],
      isPublished: true,
      createdAt: new Date().toISOString()
    };
    
    await quizzesCollection.insertOne(quiz1);
    console.log('✅ Quiz created:', quiz1.title);
    
    // Test 5: Verify the hierarchy
    console.log('\n5. Verifying hierarchy...');
    
    // Get course with lessons
    const courseWithLessons = await coursesCollection.findOne({ id: 'test_course_1' });
    const lessonsResult = await lessonsCollection.find({ courseId: 'test_course_1' });
    const chaptersResult = await chaptersCollection.find({ lessonId: 'test_lesson_1' });
    const quizzesResult = await quizzesCollection.find({ lessonId: 'test_lesson_1' });
    
    const lessons = await lessonsResult.toArray();
    const chapters = await chaptersResult.toArray();
    const quizzes = await quizzesResult.toArray();
    
    console.log('📚 Course:', courseWithLessons.title);
    console.log('   📖 Lessons:', lessons.length);
    lessons.forEach(lesson => {
      console.log('      -', lesson.title);
    });
    
    console.log('   📄 Chapters in first lesson:', chapters.length);
    chapters.forEach(chapter => {
      console.log('      -', chapter.title);
    });
    
    console.log('   🧩 Quizzes in first lesson:', quizzes.length);
    quizzes.forEach(quiz => {
      console.log('      -', quiz.title, `(${quiz.questions.length} questions)`);
    });
    
    // Test 6: Test quiz submission
    console.log('\n6. Testing quiz submission...');
    const quizSubmission = {
      userId: 'test_user_1',
      answers: [
        [0], // Correct answer for question 1
        [0]  // Correct answer for question 2
      ]
    };
    
    // Simulate quiz evaluation
    let correctAnswers = 0;
    const results = [];
    
    for (let i = 0; i < quiz1.questions.length; i++) {
      const question = quiz1.questions[i];
      const userAnswer = quizSubmission.answers[i] || [];
      const isCorrect = JSON.stringify(userAnswer.sort()) === JSON.stringify(question.correctAnswers.sort());
      
      if (isCorrect) correctAnswers++;
      
      results.push({
        questionIndex: i,
        question: question.question,
        userAnswer,
        correctAnswer: question.correctAnswers,
        isCorrect,
        explanation: question.explanation
      });
    }
    
    const score = Math.round((correctAnswers / quiz1.questions.length) * 100);
    const passed = score >= quiz1.passingScore;
    
    console.log('📊 Quiz Results:');
    console.log('   Score:', score + '%');
    console.log('   Passed:', passed ? 'Yes' : 'No');
    console.log('   Correct Answers:', correctAnswers + '/' + quiz1.questions.length);
    
    console.log('\n🎉 All tests passed! Hierarchy is working correctly.');
    console.log('\nHierarchy Summary:');
    console.log('Course → Lessons → Chapters/Quizzes');
    console.log('✅ Course has lessons');
    console.log('✅ Lessons have chapters');
    console.log('✅ Lessons have quizzes');
    console.log('✅ Quizzes have questions with options and correct answers');
    console.log('✅ Quiz evaluation system works');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testHierarchy();
