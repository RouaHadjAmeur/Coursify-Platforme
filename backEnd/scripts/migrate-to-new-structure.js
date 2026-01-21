import { connectToDatabase, getDatabase } from '../config/database.js';
import fs from 'fs';
import path from 'path';

/**
 * Migration script to convert existing course structure to new structure
 * 
 * Changes:
 * 1. Remove 'content' field from courses and lessons
 * 2. Add 'sections' array to courses
 * 3. Add 'status' field to lessons (DRAFT, PUBLISHED, ARCHIVED)
 * 4. Convert lesson chapters to separate chapters collection with sections
 * 5. Update quizzes to support placement between chapters
 */

async function migrateToNewStructure() {
  try {
    console.log('🚀 Starting migration to new course structure...');
    
    await connectToDatabase();
    const db = await getDatabase();
    
    // Step 1: Update courses - add sections and remove content
    console.log('📚 Step 1: Updating courses...');
    const coursesCollection = db.collection('courses');
    const courses = await coursesCollection.find().toArray();
    
    for (const course of courses) {
      const updateData = {
        sections: course.sections || [], // Add empty sections array if not exists
        updatedAt: new Date().toISOString()
      };
      
      // Remove content field if it exists
      if (course.content !== undefined) {
        console.log(`  Removing content field from course: ${course.title}`);
      }
      
      await coursesCollection.updateOne(
        { id: course.id },
        { 
          $set: updateData,
          $unset: { content: "" }
        }
      );
    }
    
    console.log(`✅ Updated ${courses.length} courses`);
    
    // Step 2: Update lessons - add status and remove content
    console.log('📖 Step 2: Updating lessons...');
    const lessonsCollection = db.collection('lessons');
    const lessons = await lessonsCollection.find().toArray();
    
    for (const lesson of lessons) {
      const updateData = {
        status: lesson.status || (lesson.isPublished ? 'PUBLISHED' : 'DRAFT'),
        updatedAt: new Date().toISOString()
      };
      
      // Remove content and videoUrl fields if they exist
      const unsetFields = {};
      if (lesson.content !== undefined) {
        unsetFields.content = "";
        console.log(`  Removing content field from lesson: ${lesson.title}`);
      }
      if (lesson.videoUrl !== undefined) {
        unsetFields.videoUrl = "";
        console.log(`  Removing videoUrl field from lesson: ${lesson.title}`);
      }
      if (lesson.isPublished !== undefined) {
        unsetFields.isPublished = "";
        console.log(`  Removing isPublished field from lesson: ${lesson.title}`);
      }
      
      await lessonsCollection.updateOne(
        { id: lesson.id },
        { 
          $set: updateData,
          $unset: unsetFields
        }
      );
    }
    
    console.log(`✅ Updated ${lessons.length} lessons`);
    
    // Step 3: Convert lesson chapters to separate chapters collection
    console.log('📄 Step 3: Converting lesson chapters to separate collection...');
    const chaptersCollection = db.collection('chapters');
    
    let totalChaptersConverted = 0;
    
    for (const lesson of lessons) {
      if (lesson.chapters && lesson.chapters.length > 0) {
        console.log(`  Converting ${lesson.chapters.length} chapters from lesson: ${lesson.title}`);
        
        for (const chapter of lesson.chapters) {
          // Convert old chapter structure to new structure with sections
          const newChapter = {
            id: chapter.id || `chapter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: chapter.title,
            description: chapter.description || "",
            lessonId: lesson.id,
            order: chapter.order || 0,
            duration: chapter.duration || "0 min",
            sections: [], // Start with empty sections array
            createdAt: chapter.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          // If old chapter had content, create a text section
          if (chapter.content) {
            newChapter.sections.push({
              id: `section_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              type: 'text',
              content: chapter.content,
              order: 1,
              createdAt: new Date().toISOString()
            });
          }
          
          // If old chapter had videoUrl, create a video section
          if (chapter.videoUrl) {
            newChapter.sections.push({
              id: `section_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              type: 'video',
              content: chapter.videoUrl,
              order: newChapter.sections.length + 1,
              createdAt: new Date().toISOString()
            });
          }
          
          // If no content or videoUrl, create a default text section
          if (newChapter.sections.length === 0) {
            newChapter.sections.push({
              id: `section_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              type: 'text',
              content: `Content for ${chapter.title}`,
              order: 1,
              createdAt: new Date().toISOString()
            });
          }
          
          await chaptersCollection.insertOne(newChapter);
          totalChaptersConverted++;
        }
        
        // Remove chapters from lesson
        await lessonsCollection.updateOne(
          { id: lesson.id },
          { 
            $unset: { chapters: "" },
            $set: { updatedAt: new Date().toISOString() }
          }
        );
      }
    }
    
    console.log(`✅ Converted ${totalChaptersConverted} chapters to new structure`);
    
    // Step 4: Update quizzes to support placement
    console.log('🧩 Step 4: Updating quizzes...');
    const quizzesCollection = db.collection('quizzes');
    const quizzes = await quizzesCollection.find().toArray();
    
    for (const quiz of quizzes) {
      const updateData = {
        placement: quiz.placement || 'end', // Default to 'end' placement
        updatedAt: new Date().toISOString()
      };
      
      // Remove isPublished if it exists (replaced by placement system)
      const unsetFields = {};
      if (quiz.isPublished !== undefined) {
        unsetFields.isPublished = "";
        console.log(`  Removing isPublished field from quiz: ${quiz.title}`);
      }
      
      await quizzesCollection.updateOne(
        { id: quiz.id },
        { 
          $set: updateData,
          $unset: unsetFields
        }
      );
    }
    
    console.log(`✅ Updated ${quizzes.length} quizzes`);
    
    // Step 5: Create sample course sections
    console.log('📋 Step 5: Adding sample course sections...');
    const sampleCourses = await coursesCollection.find({ sections: { $exists: false } }).toArray();
    
    for (const course of sampleCourses) {
      const sampleSections = [
        {
          id: `section_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: 'Part 1: Introduction',
          description: 'Introduction to the course',
          order: 1
        },
        {
          id: `section_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: 'Part 2: Core Concepts',
          description: 'Main learning content',
          order: 2
        },
        {
          id: `section_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: 'Part 3: Advanced Topics',
          description: 'Advanced concepts and applications',
          order: 3
        }
      ];
      
      await coursesCollection.updateOne(
        { id: course.id },
        { 
          $set: { 
            sections: sampleSections,
            updatedAt: new Date().toISOString()
          }
        }
      );
      
      console.log(`  Added sample sections to course: ${course.title}`);
    }
    
    console.log(`✅ Added sample sections to ${sampleCourses.length} courses`);
    
    // Step 6: Create backup of old data
    console.log('💾 Step 6: Creating backup...');
    const backupData = {
      courses: courses,
      lessons: lessons,
      chapters: await chaptersCollection.find().toArray(),
      quizzes: quizzes,
      migratedAt: new Date().toISOString(),
      migrationVersion: '1.0.0'
    };
    
    const backupPath = path.join(process.cwd(), 'backups', `migration-backup-${Date.now()}.json`);
    const backupDir = path.dirname(backupPath);
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    console.log(`✅ Backup created at: ${backupPath}`);
    
    // Step 7: Generate migration report
    console.log('📊 Step 7: Generating migration report...');
    const report = {
      migrationDate: new Date().toISOString(),
      coursesUpdated: courses.length,
      lessonsUpdated: lessons.length,
      chaptersConverted: totalChaptersConverted,
      quizzesUpdated: quizzes.length,
      coursesWithSections: sampleCourses.length,
      backupPath: backupPath,
      newStructure: {
        courses: {
          fields: ['id', 'title', 'description', 'level', 'image', 'hours', 'learners', 'certificate', 'price', 'category', 'instructor', 'sections', 'skills', 'participatedUsers', 'progress', 'createdAt', 'updatedAt', 'status'],
          removedFields: ['content']
        },
        lessons: {
          fields: ['id', 'title', 'description', 'courseId', 'order', 'duration', 'status', 'chapters', 'quizzes', 'createdAt', 'updatedAt'],
          removedFields: ['content', 'videoUrl', 'isPublished'],
          statusValues: ['DRAFT', 'PUBLISHED', 'ARCHIVED']
        },
        chapters: {
          fields: ['id', 'title', 'description', 'lessonId', 'order', 'duration', 'sections', 'createdAt', 'updatedAt'],
          sectionTypes: ['text', 'video', 'image', 'audio', 'pdf', 'quiz'],
          removedFields: ['content', 'videoUrl']
        },
        quizzes: {
          fields: ['id', 'title', 'description', 'lessonId', 'timeLimit', 'passingScore', 'questions', 'placement', 'isPublished', 'createdAt', 'updatedAt'],
          placementValues: ['end', 'between_chapters', 'custom'],
          removedFields: ['isPublished']
        }
      }
    };
    
    const reportPath = path.join(process.cwd(), 'backups', `migration-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`✅ Migration report created at: ${reportPath}`);
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`  • Courses updated: ${courses.length}`);
    console.log(`  • Lessons updated: ${lessons.length}`);
    console.log(`  • Chapters converted: ${totalChaptersConverted}`);
    console.log(`  • Quizzes updated: ${quizzes.length}`);
    console.log(`  • Courses with sections: ${sampleCourses.length}`);
    console.log(`  • Backup created: ${backupPath}`);
    console.log(`  • Report created: ${reportPath}`);
    
    console.log('\n🔧 New Structure Features:');
    console.log('  • Courses now have sections (Part 1, Part 2, etc.)');
    console.log('  • Lessons have status: DRAFT, PUBLISHED, ARCHIVED');
    console.log('  • Chapters have sections with types: text, video, image, audio, pdf, quiz');
    console.log('  • Quizzes can be placed between chapters or at the end');
    console.log('  • File import/export capabilities for chapters');
    console.log('  • Better separation between admin/instructor and student functions');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateToNewStructure()
    .then(() => {
      console.log('✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

export default migrateToNewStructure;