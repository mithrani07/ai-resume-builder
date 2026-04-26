import mongoose from 'mongoose';
import Resume from '../models/Resume.model.js';

// 1. IMPROVED SANITIZER: This fixes the specific errors showing in your terminal
const sanitizeSections = (sections) => {
  if (!sections) return sections;
  const cleaned = { ...sections };
  const arrayFields = ['experience', 'education', 'projects', 'certifications'];

  // Fix Project Descriptions (Convert Array to String)
  if (Array.isArray(cleaned.projects)) {
    cleaned.projects = cleaned.projects.map((proj) => ({
      ...proj,
      description: Array.isArray(proj.description) ? proj.description.join('\n') : proj.description
    }));
  }

  // Fix Certifications (Wrap strings in objects)
  if (Array.isArray(cleaned.certifications)) {
    cleaned.certifications = cleaned.certifications.map((cert) => {
      if (typeof cert === 'string') {
        return { name: cert }; // Uses 'name'. Change to 'title' if your model uses that.
      }
      return cert;
    });
  }

  // Strip invalid temporary _id values
  for (const field of arrayFields) {
    if (Array.isArray(cleaned[field])) {
      cleaned[field] = cleaned[field].map(({ _id, ...rest }) => {
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
          return { _id, ...rest };
        }
        return rest;
      });
    }
  }
  return cleaned;
};

// 2. CREATE RESUME
export const createResume = async (userId, data = {}) => {
  const resume = await Resume.create({
    userId,
    title: data.title || 'Untitled Resume',
    templateId: data.templateId || 'classic',
    targetRole: data.targetRole || '',
  });
  return resume;
};

// 3. GET RESUMES BY USER
export const getResumesByUser = async (userId) => {
  const resumes = await Resume.find({ userId })
    .sort({ updatedAt: -1 })
    .select('-__v');
  return resumes;
};

// 4. GET RESUME BY ID
export const getResumeById = async (resumeId, userId) => {
  const resume = await Resume.findOne({ _id: resumeId, userId }).select('-__v');
  if (!resume) {
    const error = new Error('Resume not found.');
    error.statusCode = 404;
    throw error;
  }
  return resume;
};

// 5. UPDATE RESUME (This is where the ATS score usually updates)
export const updateResume = async (resumeId, userId, updateData) => {
  if (updateData.sections) {
    updateData.sections = sanitizeSections(updateData.sections);
  }
  const resume = await Resume.findOneAndUpdate(
    { _id: resumeId, userId },
    { $set: updateData },
    { returnDocument: 'after' }
  );
  if (!resume) {
    const error = new Error('Resume not found.');
    error.statusCode = 404;
    throw error;
  }
  return resume;
};

// 6. UPDATE SECTION
export const updateSection = async (resumeId, userId, sectionName, sectionData) => {
  // We apply the sanitizer logic here too to fix the certification/project issues
  const tempSections = { [sectionName]: sectionData };
  const sanitized = sanitizeSections(tempSections);
  
  const updateKey = `sections.${sectionName}`;
  const resume = await Resume.findOneAndUpdate(
    { _id: resumeId, userId },
    { $set: { [updateKey]: sanitized[sectionName] } },
    { returnDocument: 'after' }
  );
  if (!resume) {
    const error = new Error('Resume not found.');
    error.statusCode = 404;
    throw error;
  }
  return resume;
};

// 7. UPDATE TEMPLATE
export const updateTemplate = async (resumeId, userId, templateId) => {
  const resume = await Resume.findOneAndUpdate(
    { _id: resumeId, userId },
    { $set: { templateId } },
    { returnDocument: 'after' }
  );
  if (!resume) {
    const error = new Error('Resume not found.');
    error.statusCode = 404;
    throw error;
  }
  return resume;
};

// 8. CREATE FROM UPLOAD (This is what was failing with "OCI Cloud")
export const createFromUpload = async (userId, parsedSections, title = 'Uploaded Resume') => {
  // Use the sanitizer to fix the data before sending to MongoDB
  const cleanSections = sanitizeSections(parsedSections);
  
  const resume = await Resume.create({
    userId,
    title,
    templateId: 'classic',
    sections: cleanSections,
  });
  return resume;
};

// 9. DELETE RESUME
export const deleteResume = async (resumeId, userId) => {
  const resume = await Resume.findOneAndDelete({ _id: resumeId, userId });
  if (!resume) {
    const error = new Error('Resume not found.');
    error.statusCode = 404;
    throw error;
  }
  return resume;
};