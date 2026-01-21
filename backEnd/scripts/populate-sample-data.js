import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDatabase } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function populateSampleData() {
  try {
    // Read sample data
    const sampleDataPath = path.join(__dirname, '..', 'data', 'sample-data.json');
    const sampleData = JSON.parse(await fs.readFile(sampleDataPath, 'utf8'));
    
    const db = await getDatabase();
    
    // Populate courses
    if (sampleData.courses && sampleData.courses.length > 0) {
      const coursesCollection = db.collection('courses');
      for (const course of sampleData.courses) {
        await coursesCollection.insertOne(course);
        console.log(`✅ Added course: ${course.title}`);
      }
    }
    
    // Populate lessons
    if (sampleData.lessons && sampleData.lessons.length > 0) {
      const lessonsCollection = db.collection('lessons');
      for (const lesson of sampleData.lessons) {
        await lessonsCollection.insertOne(lesson);
        console.log(`✅ Added lesson: ${lesson.title}`);
      }
    }
    
    // Populate chapters
    if (sampleData.chapters && sampleData.chapters.length > 0) {
      const chaptersCollection = db.collection('chapters');
      for (const chapter of sampleData.chapters) {
        await chaptersCollection.insertOne(chapter);
        console.log(`✅ Added chapter: ${chapter.title}`);
      }
    }
    
    // Populate quizzes
    if (sampleData.quizzes && sampleData.quizzes.length > 0) {
      const quizzesCollection = db.collection('quizzes');
      for (const quiz of sampleData.quizzes) {
        await quizzesCollection.insertOne(quiz);
        console.log(`✅ Added quiz: ${quiz.title}`);
      }
    }
    
    console.log('\n🎉 Sample data populated successfully!');
    console.log('\nHierarchy created:');
    console.log('Course → Lessons → Chapters/Quizzes');
    
  } catch (error) {
    console.error('Error populating sample data:', error);
  }
}

populateSampleData();
