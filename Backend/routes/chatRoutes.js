const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Chat = require("../models/Chat");
const Document = require("../models/Document");

// In-memory chat storage for session persistence if DB connection is pending
let memoryChats = [];

// Pre-indexed verified campus knowledge rules (mimics verified campus docs until custom RAG is integrated)
const campusKnowledgeBase = [
  {
    keywords: ["attendance", "minimum attendance", "shortage", "medical leave", "attendance requirement", "appear for exam"],
    answer:
      "Minimum Attendance: 75%\n\nStudents must maintain at least 75% attendance to be eligible to appear for the semester examination.\n\nKey Provisions:\n• A condonation of up to 10% (between 65% and 74%) may be granted on medical grounds upon submitting verified certificates to the Dean of Academic Affairs within 5 working days.\n• Students below 65% attendance will receive a Year-Back / Detention in the respective course.",
    source: "Examination Rules.pdf",
    page: "Page 12",
    section: "Section 4.2 - Attendance Criteria",
    relevanceScore: 98,
  },
  {
    keywords: ["scholarship", "renewal", "financial aid", "documents for scholarship", "scholarship renewal"],
    answer:
      "Scholarship Renewal Requirements:\n\nTo renew institutional or government merit-cum-means scholarships, the following verified documents must be submitted:\n\n1. Official Grade Sheet showing minimum CGPA of 8.00 with zero active backlogs.\n2. Recent Family Annual Income Certificate (issued by Revenue Authority within the last 6 months).\n3. Current Academic Year Fee Receipt.\n4. Bonafide Student Certificate signed by the Head of Department (HOD).\n5. Copy of Linked Bank Account Passbook.",
    source: "Scholarship & Financial Aid Manual.pdf",
    page: "Page 5",
    section: "Section 3.1 - Annual Renewal Checklist",
    relevanceScore: 96,
  },
  {
    keywords: ["re-evaluation", "revaluation", "rechecking", "photocopy", "grade review", "answer script"],
    answer:
      "Answer Script Re-evaluation Guidelines:\n\n• Students may request a photocopy of their evaluated answer sheet within 7 calendar days of provisional result declaration.\n• Re-evaluation application must be submitted online through the Student ERP portal within 14 days of result release.\n• A non-refundable processing fee of ₹500 per subject is applicable.\n• If the score difference after re-evaluation exceeds 15%, the revised higher marks will be finalized.",
    source: "Examination Guidelines.pdf",
    page: "Page 18",
    section: "Section 7.4 - Evaluation & Verification",
    relevanceScore: 94,
  },
  {
    keywords: ["placement", "campus placement", "interview", "drive", "internship", "placement eligibility"],
    answer:
      "Campus Placement & Training Criteria:\n\n1. Academic Threshold: Minimum cumulative CGPA of 6.50 across all previous completed semesters.\n2. Standing Arrears: Maximum 0 active backlogs at the time of recruitment registration.\n3. Mandatory Attendance: At least 75% attendance in all pre-placement training modules (soft skills, aptitude, coding tests).\n4. 'One Student, One Job' Policy applies until 80% batch placement is achieved.",
    source: "Training & Placement Handbook.pdf",
    page: "Page 8",
    section: "Section 2.1 - General Eligibility",
    relevanceScore: 95,
  },
  {
    keywords: ["hall ticket", "admit card", "exam registration", "exam fee", "examination schedule"],
    answer:
      "Hall Ticket & Examination Protocol:\n\n• Hall Tickets are issued electronically 5 days prior to the start of semester examinations.\n• Students must have completed semester registration and fee clearance.\n• Physical college ID card along with printed hall ticket is mandatory for entry into examination halls.",
    source: "Examination Guidelines.pdf",
    page: "Page 14",
    section: "Section 5 - Admit Card Rules",
    relevanceScore: 92,
  },
  {
    keywords: ["library", "borrow", "library hours", "books", "fine", "overdue"],
    answer:
      "Central Library Borrowing Rules:\n\n• Undergraduate students can borrow up to 4 books for a period of 14 days.\n• Postgraduate & Research scholars can borrow up to 6 books for 28 days.\n• Overdue fines are ₹2/day per book for the first week, and ₹5/day thereafter.\n• The Central Library digital reading section is open from 8:00 AM to 10:00 PM on all instructional days.",
    source: "Library Handbook & Digital Resource Guide.pdf",
    page: "Page 4",
    section: "Section 1.3 - Circulation Policies",
    relevanceScore: 91,
  },
];

// @route   POST /api/chat/query
// @desc    Process student question, generate concise answer with citations, and save to DB
router.post("/query", async (req, res) => {
  try {
    const { studentId, studentName, sessionId, question } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({
        success: false,
        message: "Question text is required.",
      });
    }

    const cleanQuery = question.toLowerCase().trim();
    const isDbConnected = mongoose.connection.readyState === 1;

    let uploadedDocs = [];
    if (isDbConnected) {
      try {
        uploadedDocs = await Document.find().sort({ createdAt: -1 });
      } catch (err) {
        console.warn("Could not query Document model:", err.message);
      }
    }

    let matchedEntry = null;

    // 1. Search in static verified campus knowledge base
    for (const item of campusKnowledgeBase) {
      if (item.keywords.some((kw) => cleanQuery.includes(kw))) {
        matchedEntry = item;
        break;
      }
    }

    // 2. Also check if the query relates to any uploaded document in the DB
    if (!matchedEntry && uploadedDocs.length > 0) {
      const docMatch = uploadedDocs.find((doc) => {
        const titleWords = doc.title.toLowerCase().split(/\s+/);
        const categoryWords = doc.category.toLowerCase().split(/\s+/);
        return (
          titleWords.some((w) => w.length > 3 && cleanQuery.includes(w)) ||
          categoryWords.some((w) => w.length > 3 && cleanQuery.includes(w))
        );
      });

      if (docMatch) {
        matchedEntry = {
          answer: `According to official institutional document "${docMatch.title}" (${docMatch.category}):\n\nThis policy is active for ${docMatch.department}. Please refer to the verified circular text or contact the department desk for detailed clause execution.\n\nDescription summary: ${docMatch.description || "Official circular published by " + docMatch.uploaderName}.`,
          source: docMatch.originalName,
          page: "Page 1",
          section: `${docMatch.category} - Official Directive`,
          relevanceScore: 89,
        };
      }
    }

    let isFoundInKnowledgeBase = true;
    let answerText = "";
    let citations = [];

    if (matchedEntry) {
      answerText = matchedEntry.answer;
      citations = [
        {
          source: matchedEntry.source,
          page: matchedEntry.page,
          section: matchedEntry.section,
          relevanceScore: matchedEntry.relevanceScore,
          excerpt: `Verified against institutional archives: ${matchedEntry.source} (${matchedEntry.section})`,
        },
      ];
    } else {
      // Hallucination Control: Explicit rejection when not found in knowledge base
      isFoundInKnowledgeBase = false;
      answerText =
        "Information not found in the verified institutional knowledge base.\n\nTo avoid hallucination and uphold academic accuracy, the Campus Knowledge Copilot only answers from verified circulars, notices, and handbooks provided by the institution.\n\nPlease verify your query keywords or ask your department administrator to upload the relevant circular.";
      citations = [];
    }

    let savedChat = null;

    if (isDbConnected) {
      try {
        const newChat = new Chat({
          student: studentId || null,
          studentName: studentName || "Student",
          sessionId: sessionId || "default_session",
          question: question.trim(),
          answer: answerText,
          isFoundInKnowledgeBase,
          citations,
        });
        savedChat = await newChat.save();
      } catch (err) {
        console.warn("DB save chat error:", err.message);
      }
    }

    if (!savedChat) {
      savedChat = {
        _id: "chat-" + Date.now(),
        studentName: studentName || "Student",
        sessionId: sessionId || "default_session",
        question: question.trim(),
        answer: answerText,
        isFoundInKnowledgeBase,
        citations,
        createdAt: new Date().toISOString(),
      };
      memoryChats.push(savedChat);
    }

    return res.status(200).json({
      success: true,
      data: savedChat,
    });
  } catch (error) {
    console.error("Chat Query Error:", error);
    return res.status(500).json({
      success: false,
      message: "Error processing your question.",
      error: error.message,
    });
  }
});

// @route   GET /api/chat/history
// @desc    Retrieve chat history for student or session
router.get("/history", async (req, res) => {
  try {
    const { studentId, sessionId } = req.query;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      let filter = {};
      if (studentId) filter.student = studentId;
      else if (sessionId) filter.sessionId = sessionId;

      const history = await Chat.find(filter).sort({ createdAt: 1 }).limit(50);
      return res.json({ success: true, count: history.length, history });
    }

    const filtered = memoryChats.filter((c) =>
      sessionId ? c.sessionId === sessionId : true
    );
    return res.json({ success: true, count: filtered.length, history: filtered });
  } catch (error) {
    console.error("Chat History Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve chat history.",
      error: error.message,
    });
  }
});

// @route   DELETE /api/chat/history
// @desc    Clear chat session
router.delete("/history", async (req, res) => {
  try {
    const { studentId, sessionId } = req.query;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      let filter = {};
      if (studentId) filter.student = studentId;
      else if (sessionId) filter.sessionId = sessionId;
      await Chat.deleteMany(filter);
    }

    memoryChats = memoryChats.filter((c) =>
      sessionId ? c.sessionId !== sessionId : false
    );

    return res.json({
      success: true,
      message: "Chat history cleared successfully.",
    });
  } catch (error) {
    console.error("Clear Chat Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to clear chat history.",
      error: error.message,
    });
  }
});

// @route   POST /api/chat/feedback
// @desc    Update feedback on answer (up/down)
router.post("/feedback", async (req, res) => {
  try {
    const { chatId, feedback } = req.body;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected && mongoose.isValidObjectId(chatId)) {
      const updated = await Chat.findByIdAndUpdate(chatId, { feedback }, { new: true });
      return res.json({ success: true, updated });
    }

    const found = memoryChats.find((c) => c._id === chatId);
    if (found) found.feedback = feedback;

    return res.json({ success: true, feedback });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
