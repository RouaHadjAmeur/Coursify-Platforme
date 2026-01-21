import { getDatabase } from "../config/database.js";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/chapters/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Allow PDF, DOC, DOCX, TXT, and image files
    const allowedTypes = [
      'application/pdf', 
      'text/plain', 
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, TXT, DOC, DOCX, and image files are allowed.'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

export { upload };

export async function getAllChapters(req, res, next) {
  try {
    const db = await getDatabase();
    const chaptersCollection = db.collection('chapters');
    
    const findResult = await chaptersCollection.find();
    const chapters = await findResult.toArray();
    res.json(chapters);
  } catch (err) {
    next(err);
  }
}

export async function getChapterById(req, res, next) {
  try {
    const { chapterId } = req.params;
    
    const db = await getDatabase();
    const chaptersCollection = db.collection('chapters');
    
    const chapter = await chaptersCollection.findOne({ id: chapterId });
    
    if (!chapter) {
      return res.status(404).json({ message: "Chapter not found" });
    }
    
    res.json(chapter);
  } catch (err) {
    next(err);
  }
}

export async function getChaptersByLessonId(req, res, next) {
  try {
    const { lessonId } = req.params;
    
    const db = await getDatabase();
    const chaptersCollection = db.collection('chapters');
    
    const findResult = await chaptersCollection.find({ lessonId });
    const chapters = await findResult.toArray();
    
    // Sort by order
    chapters.sort((a, b) => a.order - b.order);
    
    res.json(chapters);
  } catch (err) {
    next(err);
  }
}

export async function createChapter(req, res, next) {
  try {
    const {
      title,
      description,
      lessonId,
      order,
      duration,
      sections = [] // Array of sections with type and content
    } = req.body;
    
    if (!title || !lessonId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Validate sections if provided
    if (sections.length > 0) {
      for (const section of sections) {
        if (!section.type || !section.content) {
          return res.status(400).json({ 
            message: "Each section must have type and content" 
          });
        }
        const validTypes = ["text", "video", "image", "audio", "pdf", "docx", "quiz", "mixed"];
        if (!validTypes.includes(section.type)) {
          return res.status(400).json({ 
            message: `Invalid section type: ${section.type}. Valid types are: ${validTypes.join(", ")}` 
          });
        }
      }
    }
    
    const db = await getDatabase();
    const chaptersCollection = db.collection('chapters');

    const newChapter = {
      id: `chapter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      description: description || "",
      lessonId,
      order: typeof order === "number" ? order : 0,
      duration: duration || "0 min",
      sections: sections,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const { insertedId } = await chaptersCollection.insertOne(newChapter);
    
    res.status(201).json({
      message: "Chapter created successfully",
      chapter: newChapter,
      insertedId
    });
  } catch (err) {
    next(err);
  }
}

export async function updateChapter(req, res, next) {
  try {
    const { chapterId } = req.params;
    const updateData = { ...req.body };
    
    const db = await getDatabase();
    const chaptersCollection = db.collection('chapters');
    
    const result = await chaptersCollection.updateOne(
      { id: chapterId },
      { $set: { ...updateData, updatedAt: new Date().toISOString() } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Chapter not found" });
    }
    
    res.json({ message: "Chapter updated successfully" });
  } catch (err) {
    next(err);
  }
}

export async function deleteChapter(req, res, next) {
  try {
    const { chapterId } = req.params;
    
    const db = await getDatabase();
    const chaptersCollection = db.collection('chapters');
    
    const result = await chaptersCollection.deleteOne({ id: chapterId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Chapter not found" });
    }
    
    res.json({ message: "Chapter deleted successfully" });
  } catch (err) {
    next(err);
  }
}

export async function toggleChapterStatus(req, res, next) {
  try {
    const { chapterId } = req.params;
    const { isPublished } = req.body;
    
    if (typeof isPublished !== "boolean") {
      return res.status(400).json({ message: "isPublished must be a boolean" });
    }
    
    const db = await getDatabase();
    const chaptersCollection = db.collection('chapters');
    
    const result = await chaptersCollection.updateOne(
      { id: chapterId },
      { $set: { isPublished, updatedAt: new Date().toISOString() } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Chapter not found" });
    }
    
    res.json({ message: `Chapter ${isPublished ? 'published' : 'unpublished'} successfully` });
  } catch (err) {
    next(err);
  }
}

// Upload file for chapter content (used by mixed content)
export async function uploadFile(req, res, next) {
  try {
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    
    // Construct the file URL
    // file.filename is just the filename (e.g., "file-123.pdf")
    // We know files are stored in uploads/chapters/, so the URL is /uploads/chapters/filename
    const fileUrl = `/uploads/chapters/${file.filename}`;
    
    console.log('File uploaded:', {
      filename: file.filename,
      path: file.path,
      fileUrl: fileUrl,
      originalName: file.originalname
    });
    
    res.json({
      message: "File uploaded successfully",
      fileUrl: fileUrl,
      url: fileUrl, // Alias for compatibility
      filename: file.filename,
      originalName: file.originalname,
      fileSize: file.size
    });
  } catch (err) {
    next(err);
  }
}

// Import PDF/file as chapter
export async function importChapterFromFile(req, res, next) {
  try {
    const { lessonId, title, description, order } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    
    if (!title || !lessonId) {
      return res.status(400).json({ message: "Title and lessonId are required" });
    }
    
    const db = await getDatabase();
    const chaptersCollection = db.collection('chapters');
    
    // Create a section from the uploaded file
    const section = {
      id: `section_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: file.mimetype === 'application/pdf' ? 'pdf' : 'text',
      content: file.filename, // Store filename, actual content will be served separately
      filePath: file.path,
      originalName: file.originalname,
      fileSize: file.size,
      uploadedAt: new Date().toISOString()
    };
    
    const newChapter = {
      id: `chapter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      description: description || "",
      lessonId,
      order: typeof order === "number" ? order : 0,
      duration: "0 min",
      sections: [section],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const { insertedId } = await chaptersCollection.insertOne(newChapter);
    
    res.status(201).json({
      message: "Chapter imported successfully from file",
      chapter: newChapter,
      insertedId
    });
  } catch (err) {
    next(err);
  }
}

// Export chapter content
export async function exportChapter(req, res, next) {
  try {
    const { chapterId } = req.params;
    const { format = 'json', sectionType } = req.query; // json, pdf, txt; optional sectionType filter
    
    const db = await getDatabase();
    const chaptersCollection = db.collection('chapters');
    
    const chapter = await chaptersCollection.findOne({ id: chapterId });
    
    if (!chapter) {
      return res.status(404).json({ message: "Chapter not found" });
    }
    
    // Get lesson and course info for context
    const lessonsCollection = db.collection('lessons');
    const coursesCollection = db.collection('courses');
    
    const lesson = await lessonsCollection.findOne({ id: chapter.lessonId });
    const course = lesson ? await coursesCollection.findOne({ id: lesson.courseId }) : null;
    
    // Optionally filter sections by type for export (chapter is exported as a whole, but sections can be filtered)
    const sectionsForExport = Array.isArray(chapter.sections)
      ? (sectionType ? chapter.sections.filter(s => s.type === sectionType) : chapter.sections)
      : [];

    const exportData = {
      course: course ? {
        title: course.title,
        description: course.description
      } : null,
      lesson: lesson ? {
        title: lesson.title,
        description: lesson.description
      } : null,
      chapter: {
        title: chapter.title,
        description: chapter.description,
        sections: sectionsForExport
      },
      exportedAt: new Date().toISOString()
    };
    
    switch (format.toLowerCase()) {
      case 'pdf':
        // For PDF export, you would typically use a library like puppeteer or jsPDF
        // For now, return JSON with instructions
        res.json({
          message: "PDF export not implemented yet. Use format=json for now.",
          data: exportData
        });
        break;
        
      case 'txt':
        // Convert to plain text
        let textContent = `Chapter: ${chapter.title}\n`;
        textContent += `Description: ${chapter.description}\n`;
        if (sectionType) {
          textContent += `Filtered Section Type: ${sectionType}\n`;
        }
        textContent += `\n`;
        
        sectionsForExport.forEach((section, index) => {
          textContent += `Section ${index + 1} (${section.type}):\n`;
          if (section.type === 'text') {
            textContent += section.content + '\n\n';
          } else {
            textContent += `[${section.type.toUpperCase()} Content]\n\n`;
          }
        });
        
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${chapter.title}.txt"`);
        res.send(textContent);
        break;
        
      case 'json':
      default:
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${chapter.title}.json"`);
        res.json(exportData);
        break;
    }
  } catch (err) {
    next(err);
  }
}

// Add section to chapter
export async function addSectionToChapter(req, res, next) {
  try {
    const { chapterId } = req.params;
    const { type, content, order } = req.body;
    
    if (!type || !content) {
      return res.status(400).json({ message: "Type and content are required" });
    }
    
    const validTypes = ["text", "video", "image", "audio", "pdf", "docx", "quiz", "mixed"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        message: `Invalid section type: ${type}. Valid types are: ${validTypes.join(", ")}` 
      });
    }
    
    const db = await getDatabase();
    const chaptersCollection = db.collection('chapters');
    
    const chapter = await chaptersCollection.findOne({ id: chapterId });
    if (!chapter) {
      return res.status(404).json({ message: "Chapter not found" });
    }
    
    const newSection = {
      id: `section_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      order: typeof order === "number" ? order : (chapter.sections?.length || 0) + 1,
      createdAt: new Date().toISOString()
    };
    
    await chaptersCollection.updateOne(
      { id: chapterId },
      { 
        $push: { sections: newSection },
        $set: { updatedAt: new Date().toISOString() }
      }
    );
    
    res.status(201).json({
      message: "Section added successfully",
      section: newSection
    });
  } catch (err) {
    next(err);
  }
}

// Update section in chapter
export async function updateSectionInChapter(req, res, next) {
  try {
    const { chapterId, sectionId } = req.params;
    const { type, content, order } = req.body;
    
    const db = await getDatabase();
    const chaptersCollection = db.collection('chapters');
    
    const chapter = await chaptersCollection.findOne({ id: chapterId });
    if (!chapter) {
      return res.status(404).json({ message: "Chapter not found" });
    }
    
    const sectionIndex = chapter.sections?.findIndex(s => s.id === sectionId);
    if (sectionIndex === -1) {
      return res.status(404).json({ message: "Section not found" });
    }
    
    const updateFields = {};
    if (type !== undefined) {
    const validTypes = ["text", "video", "image", "audio", "pdf", "docx", "quiz", "mixed"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        message: `Invalid section type: ${type}. Valid types are: ${validTypes.join(", ")}` 
      });
    }
      updateFields[`sections.${sectionIndex}.type`] = type;
    }
    if (content !== undefined) updateFields[`sections.${sectionIndex}.content`] = content;
    if (order !== undefined) updateFields[`sections.${sectionIndex}.order`] = order;
    
    updateFields[`sections.${sectionIndex}.updatedAt`] = new Date().toISOString();
    updateFields.updatedAt = new Date().toISOString();
    
    await chaptersCollection.updateOne(
      { id: chapterId },
      { $set: updateFields }
    );
    
    res.json({
      message: "Section updated successfully"
    });
  } catch (err) {
    next(err);
  }
}

// Delete section from chapter
export async function deleteSectionFromChapter(req, res, next) {
  try {
    const { chapterId, sectionId } = req.params;
    
    const db = await getDatabase();
    const chaptersCollection = db.collection('chapters');
    
    await chaptersCollection.updateOne(
      { id: chapterId },
      { 
        $pull: { sections: { id: sectionId } },
        $set: { updatedAt: new Date().toISOString() }
      }
    );
    
    res.json({
      message: "Section deleted successfully"
    });
  } catch (err) {
    next(err);
  }
}
