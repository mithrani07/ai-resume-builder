import * as aiService from '../services/ai.service.js';
import ChatHistory from '../models/ChatHistory.model.js';
import Resume from '../models/Resume.model.js';

export const chat = async (req, res, next) => {
  console.log(">>> AI Chat Route Hit"); // Minimal log
  try {
    const { resumeId, message, sectionTargeted } = req.body;
    console.log("Payload:", { resumeId, message }); // Check if frontend is sending data

    if (!resumeId || !message) {
      return res.status(400).json({ success: false, message: 'resumeId and message are required.' });
    }

    let chatHistory = await ChatHistory.findOne({
      resumeId,
      userId: req.user._id,
      agentType: 'interview',
    });

    if (!chatHistory) {
      console.log("Creating new ChatHistory document");
      chatHistory = await ChatHistory.create({
        resumeId,
        userId: req.user._id,
        agentType: 'interview',
        messages: [],
        metadata: { sectionTargeted: sectionTargeted || '' },
      });
    }

    chatHistory.messages.push({ role: 'user', content: message });

    const resume = await Resume.findById(resumeId);
    
    console.log("Sending to Gemini Service..."); // Minimal log
    const result = await aiService.chatWithInterviewAgent({
      message,
      conversationHistory: chatHistory.messages.slice(-20),
      currentSections: resume?.sections || {},
      sectionTargeted: sectionTargeted || '',
      targetRole: resume?.targetRole || '',
      resumeId,
      jobDescription: resume?.jobDescription || '',
    });

    chatHistory.messages.push({ role: 'assistant', content: result.message });
    await chatHistory.save();

    console.log("AI Response saved successfully");
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("Chat Controller Error:", error);
    next(error);
  }
};

export const generateBullets = async (req, res, next) => {
  console.log(">>> Generate Bullets Route Hit");
  try {
    const { resumeId, rawExperience, role, company } = req.body;

    if (!rawExperience) {
      return res.status(400).json({ success: false, message: 'rawExperience is required.' });
    }

    const resume = resumeId ? await Resume.findById(resumeId) : null;

    const result = await aiService.generateBullets({
      rawExperience,
      role: role || '',
      company: company || '',
      targetRole: resume?.targetRole || '',
      jobDescription: resume?.jobDescription || '',
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const generateSummary = async (req, res, next) => {
  console.log(">>> Generate Summary Route Hit");
  try {
    const { resumeId } = req.body;

    if (!resumeId) {
      return res.status(400).json({ success: false, message: 'resumeId is required.' });
    }

    const resume = await Resume.findOne({ _id: resumeId, userId: req.user._id });
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found.' });
    }

    const result = await aiService.generateSummary({
      sections: resume.sections,
      targetRole: resume.targetRole,
      jobDescription: resume.jobDescription,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const atsScore = async (req, res, next) => {
  console.log(">>> ATS Score Route Hit");
  try {
    const { resumeId, jobDescription } = req.body;

    if (!resumeId) {
      return res.status(400).json({ success: false, message: 'resumeId is required.' });
    }

    const resume = await Resume.findOne({ _id: resumeId, userId: req.user._id });
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found.' });
    }

    if (jobDescription) {
      resume.jobDescription = jobDescription;
    }

    const result = await aiService.getAtsScore({
      sections: resume.sections,
      jobDescription: jobDescription || resume.jobDescription,
      targetRole: resume.targetRole,
    });

    const numericBreakdown = {};
    if (result.breakdown) {
      for (const [key, val] of Object.entries(result.breakdown)) {
        numericBreakdown[key] = typeof val === 'object' ? (val.score || 0) : (val || 0);
      }
    }

    resume.atsScore = {
      overall: result.overall || 0,
      breakdown: numericBreakdown,
      missingKeywords: result.missingKeywords || [],
      suggestions: result.suggestions || [],
    };
    await resume.save();

    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const review = async (req, res, next) => {
  console.log(">>> Review Route Hit");
  try {
    const { resumeId } = req.body;

    if (!resumeId) {
      return res.status(400).json({ success: false, message: 'resumeId is required.' });
    }

    const resume = await Resume.findOne({ _id: resumeId, userId: req.user._id });
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found.' });
    }

    const result = await aiService.reviewResume({
      sections: resume.sections,
      targetRole: resume.targetRole,
      jobDescription: resume.jobDescription,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const matchJob = async (req, res, next) => {
  console.log(">>> Match Job Route Hit");
  try {
    const { resumeId, jobDescription } = req.body;

    if (!resumeId || !jobDescription) {
      return res.status(400).json({ success: false, message: 'resumeId and jobDescription are required.' });
    }

    const resume = await Resume.findOne({ _id: resumeId, userId: req.user._id });
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found.' });
    }

    resume.jobDescription = jobDescription;
    await resume.save();

    const result = await aiService.matchJob({
      sections: resume.sections,
      jobDescription,
      targetRole: resume.targetRole,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const skillGaps = async (req, res, next) => {
  console.log(">>> Skill Gaps Route Hit");
  try {
    const { resumeId, jobDescription } = req.body;

    if (!resumeId) {
      return res.status(400).json({ success: false, message: 'resumeId is required.' });
    }

    const resume = await Resume.findOne({ _id: resumeId, userId: req.user._id });
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found.' });
    }

    const result = await aiService.detectSkillGaps({
      skills: resume.sections.skills,
      jobDescription: jobDescription || resume.jobDescription,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getChatHistory = async (req, res, next) => {
  console.log(">>> Get Chat History Hit");
  try {
    const { resumeId } = req.params;

    const histories = await ChatHistory.find({
      resumeId,
      userId: req.user._id,
    }).sort({ updatedAt: -1 });

    return res.json({ success: true, data: histories });
  } catch (error) {
    next(error);
  }
};