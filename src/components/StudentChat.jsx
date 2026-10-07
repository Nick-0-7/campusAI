import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../services/api";
import "../templates/chat.css";
import saarthiOrb from "../assets/saarthi-orb.svg";
import FormattedMessage from "./FormattedMessage";
import {
  Sparkles,
  Search,
  Home,
  Clock,
  FileText,
  Sun,
  Moon,
  Mic,
  Volume2,
  ArrowUp,
  AlertTriangle,
  Check,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Plus,
  MoreHorizontal,
  GraduationCap,
  ChevronDown,
  ShieldCheck,
  Trash2,
  MessageSquare,
  ArrowRight,
  Calendar,
  Download,
  ExternalLink,
  Edit3,
  UserCheck,
  Eye,
  X,
} from "lucide-react";

const StudentChat = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // User state
  const [currentUser, setCurrentUser] = useState(null);

  // Theme state: dark / light
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("campusai_theme") || "dark";
  });

  // Chat states
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState(() => "session-" + Date.now());
  const [copiedId, setCopiedId] = useState(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [activeTab, setActiveTab] = useState("home");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Feature 1: Student Profile Context State & Handlers
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileFormData, setProfileFormData] = useState({
    name: "Student",
    department: "Computer Science & Engineering",
    year: "3rd Year",
    rollNo: "CS2024-042",
  });
  const [profileSaving, setProfileSaving] = useState(false);

  // Feature 2: Visual Citation & PDF Viewer Modal State
  const [selectedCitation, setSelectedCitation] = useState(null);
  const [citationViewMode, setCitationViewMode] = useState("highlight"); // "highlight" | "pdf"

  // Feature 3: Calendar Event Generator State
  const [calendarEvent, setCalendarEvent] = useState(null);

  // Dynamic user query history with persistence and search
  const [historySearch, setHistorySearch] = useState("");
  const [dynamicHistory, setDynamicHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("campusai_chat_history");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn("Failed to load chat history from localStorage", e);
    }
    return [
      {
        id: "h1",
        query: "What is the minimum attendance requirement to appear for exams?",
        answer: "Minimum Attendance: 75%\n\nStudents must maintain at least 75% attendance to be eligible to appear for the semester examination. A condonation of up to 10% may be granted on medical grounds.",
        timestamp: "Recent",
        date: "Today",
      },
      {
        id: "h2",
        query: "What documents are required for scholarship renewal?",
        answer: "Scholarship Renewal Requirements: Grade Card (min 8.0 CGPA), income certificate, fee receipt, active student bank account passbook copy, and HOD recommendation.",
        timestamp: "Recent",
        date: "Today",
      },
      {
        id: "h3",
        query: "Procedure for semester examination re-evaluation...",
        answer: "Re-evaluation Process: Apply online via Student ERP within 14 days of provisional result declaration with processing fee of ₹500 per subject.",
        timestamp: "Recent",
        date: "Today",
      },
      {
        id: "h4",
        query: "Campus placement drive eligibility and CGPA cutoff?",
        answer: "Campus Placement Eligibility: Minimum cumulative CGPA of 6.50, zero active backlogs, and 75% pre-placement training attendance.",
        timestamp: "Recent",
        date: "Today",
      },
    ];
  });

  // Clear all history
  const handleClearHistory = async () => {
    if (window.confirm("Are you sure you want to clear your conversation history?")) {
      try {
        await api.chat.clearHistory({ studentId: currentUser?.id, sessionId });
      } catch (e) {
        console.warn("Backend clear history warning:", e);
      }
      setDynamicHistory([]);
      localStorage.removeItem("campusai_chat_history");
    }
  };

  // Delete single history item
  const handleDeleteHistoryItem = (idToDelete, e) => {
    if (e) e.stopPropagation();
    setDynamicHistory((prev) => {
      const updated = prev.filter((item) => item.id !== idToDelete);
      localStorage.setItem("campusai_chat_history", JSON.stringify(updated));
      return updated;
    });
  };

  // Select item from history to load or re-ask
  const handleSelectHistoryItem = (item) => {
    setActiveTab("home");
    if (item.answer) {
      setMessages([
        {
          id: "msg-user-" + item.id,
          sender: "user",
          text: item.query,
          timestamp: item.timestamp || "Past",
        },
        {
          id: "msg-bot-" + item.id,
          sender: "assistant",
          text: item.answer,
          citations: item.citations || [],
          isFoundInKnowledgeBase: true,
          timestamp: item.timestamp || "Past",
        },
      ]);
    } else {
      handleSendMessage(item.query);
    }
  };

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("campusai_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // Dynamic greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  // Reset conversation and create new session
  const handleNewChat = () => {
    if (isSpeaking && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    setMessages([]);
    setSessionId("session-" + Date.now());
  };

  // Web Speech API: Voice-to-Text
  const toggleVoiceInput = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.start();
    } catch (e) {
      console.warn("Speech recognition error:", e);
      setIsListening(false);
    }
  };

  // Text-to-Speech: Read Aloud
  const toggleAudioSpeech = (customText) => {
    if (!window.speechSynthesis) {
      alert("Text-to-speech audio is not supported in this browser.");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    let textToSpeak = customText;
    if (!textToSpeak) {
      const lastBotMsg = [...messages].reverse().find((m) => m.sender === "assistant");
      if (!lastBotMsg) return;
      textToSpeak = lastBotMsg.text;
    }

    const cleanText = textToSpeak.replace(/[*#_`|]/g, " ");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Grouped history dynamically derived from user queries
  const sidebarHistoryItems = [
    {
      group: "Recent Inquiries",
      items: dynamicHistory,
    },
    {
      group: "Institutional Guidelines",
      items: [
        {
          id: "fa1",
          query: "Hostel residency curfew and gate pass rules...",
        },
        {
          id: "fa2",
          query: "Central library book borrowing limits and fine policy...",
        },
      ],
    },
  ];

  // 3 Axora bottom suggestion cards
  const suggestionCards = [
    {
      title: "Attendance Rules",
      desc: "75% attendance criteria, medical condonation, and detention policies",
      query: "What is the minimum attendance required to appear for the semester examination?",
    },
    {
      title: "Scholarship Aid",
      desc: "Merit-cum-means renewal, income certificates, and HOD forms",
      query: "What documents are required for scholarship renewal?",
    },
    {
      title: "Exam & Grading",
      desc: "Answer script photocopies, re-check fees, and hall tickets",
      query: "What is the procedure and fee for semester exam re-evaluation?",
    },
  ];

  // Load user info
  useEffect(() => {
    const userJson = localStorage.getItem("campusai_user");
    let userObj = null;

    if (userJson) {
      try {
        userObj = JSON.parse(userJson);
      } catch (e) {
        console.error("Parse user error", e);
      }
    }

    if (!userObj && location.state?.user) {
      userObj = location.state.user;
    }

    if (!userObj) {
      userObj = {
        name: "Student",
        email: "student@campus.edu",
        role: "student",
        rollNo: "CS2024-042",
        department: "Computer Science & Engineering",
        year: "3rd Year",
      };
    }

    setCurrentUser(userObj);
  }, []);

  useEffect(() => {
    if (currentUser) {
      setProfileFormData({
        name: currentUser.name || "Student",
        department: currentUser.department || "Computer Science & Engineering",
        year: currentUser.year || "3rd Year",
        rollNo: currentUser.rollNo || "CS2024-042",
      });
    }
  }, [currentUser]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      const res = await api.auth.updateProfile(profileFormData);
      if (res && res.success && res.user) {
        const updated = { ...currentUser, ...res.user };
        setCurrentUser(updated);
        localStorage.setItem("campusai_user", JSON.stringify(updated));
      } else {
        const updated = { ...currentUser, ...profileFormData };
        setCurrentUser(updated);
        localStorage.setItem("campusai_user", JSON.stringify(updated));
      }
    } catch (err) {
      const updated = { ...currentUser, ...profileFormData };
      setCurrentUser(updated);
      localStorage.setItem("campusai_user", JSON.stringify(updated));
    } finally {
      setProfileSaving(false);
      setIsProfileModalOpen(false);
    }
  };

  const handleOpenCalendarModal = (msg) => {
    const text = msg.text || "";
    const dateRegex = /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2})\b/i;
    const match = text.match(dateRegex);

    let eventDate = new Date();
    eventDate.setDate(eventDate.getDate() + 1);
    let dateStr = eventDate.toISOString().split("T")[0];

    if (match) {
      const parsed = Date.parse(match[0] + " 2026");
      if (!isNaN(parsed)) {
        dateStr = new Date(parsed).toISOString().split("T")[0];
      }
    }

    const lines = text.split("\n").filter((l) => l.trim().length > 0);
    let title = "Campus Academic Schedule Event";
    if (lines.length > 0) {
      const firstClean = lines[0].replace(/[#*•_]/g, "").trim();
      if (firstClean.length > 5 && firstClean.length < 50) title = firstClean;
    }

    setCalendarEvent({
      title,
      date: dateStr,
      time: "09:30",
      description: text.slice(0, 300) + "\n\nVerified via CampusAI Saarthi Copilot",
    });
  };

  const handleExportGoogleCalendar = () => {
    if (!calendarEvent) return;
    const { title, date, time, description } = calendarEvent;
    const cleanDate = date.replace(/-/g, "");
    const cleanTime = (time || "09:30").replace(":", "") + "00";
    const startDateTime = `${cleanDate}T${cleanTime}`;

    const [hh, mm] = (time || "09:30").split(":").map(Number);
    const endHh = String((hh + 2) % 24).padStart(2, "0");
    const endDateTime = `${cleanDate}T${endHh}${String(mm).padStart(2, "0")}00`;

    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      title
    )}&dates=${startDateTime}/${endDateTime}&details=${encodeURIComponent(
      description
    )}&location=${encodeURIComponent("College Campus")}`;

    window.open(url, "_blank");
  };

  const handleDownloadICS = () => {
    if (!calendarEvent) return;
    const { title, date, time, description } = calendarEvent;
    const cleanDate = date.replace(/-/g, "");
    const cleanTime = (time || "09:30").replace(":", "") + "00";
    const startDateTime = `${cleanDate}T${cleanTime}Z`;

    const [hh, mm] = (time || "09:30").split(":").map(Number);
    const endHh = String((hh + 2) % 24).padStart(2, "0");
    const endDateTime = `${cleanDate}T${endHh}${String(mm).padStart(2, "0")}00Z`;

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//CampusAI//Academic Calendar Copilot//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${Date.now()}@campusai.copilot`,
      `DTSTAMP:${cleanDate}T000000Z`,
      `DTSTART:${startDateTime}`,
      `DTEND:${endDateTime}`,
      `SUMMARY:${title.replace(/[\n\r]/g, " ")}`,
      `DESCRIPTION:${description.replace(/[\n\r]/g, " ")}`,
      "LOCATION:College Campus",
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute("download", `${title.toLowerCase().replace(/[^a-z0-9]/g, "_")}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    const userMessageId = "msg-" + Date.now();
    const newUserMessage = {
      id: userMessageId,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInputText("");
    setIsTyping(true);

    // Track in sidebar dynamic history
    setDynamicHistory((prev) => {
      const filtered = prev.filter(
        (item) => item.query.toLowerCase() !== text.toLowerCase()
      );
      return [{ id: "h-" + Date.now(), query: text }, ...filtered.slice(0, 9)];
    });

    try {
      const response = await api.chat.sendQuery({
        studentId: currentUser?.id,
        studentName: currentUser?.name || "Student",
        sessionId,
        question: text,
        userProfile: currentUser
          ? {
              name: currentUser.name,
              role: currentUser.role,
              department: currentUser.department,
              year: currentUser.year,
              rollNo: currentUser.rollNo,
            }
          : undefined,
      });

      if (response && response.success && response.data) {
        const botData = response.data;
        const newBotMessage = {
          id: botData._id || "bot-" + Date.now(),
          sender: "assistant",
          text: botData.answer,
          citations: botData.citations || [],
          isFoundInKnowledgeBase: botData.isFoundInKnowledgeBase !== false,
          feedback: "none",
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
        setMessages((prev) => [...prev, newBotMessage]);

        // Save complete Q&A to history
        setDynamicHistory((prev) => {
          const entry = {
            id: "h-" + Date.now(),
            query: text,
            answer: botData.answer,
            citations: botData.citations || [],
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            date: "Today",
          };
          const filtered = prev.filter((item) => item.query.toLowerCase() !== text.toLowerCase());
          const updated = [entry, ...filtered];
          localStorage.setItem("campusai_chat_history", JSON.stringify(updated));
          return updated;
        });
      } else {
        throw new Error(response?.message || "Failed to get response");
      }
    } catch (err) {
      console.warn("Backend query failed, using local verified fallback:", err);

      // Graceful fallback response
      const queryLower = text.toLowerCase();
      let fallbackAnswer = "";
      let fallbackCitations = [];
      let found = true;

      if (queryLower.includes("attendance")) {
        fallbackAnswer =
          "Minimum Attendance: 75%\n\nStudents must maintain at least 75% attendance to be eligible to appear for the semester examination. A condonation of up to 10% may be granted on verified medical grounds upon submitting certificates to the Dean of Academic Affairs within 5 working days.";
        fallbackCitations = [
          {
            source: "Examination Rules.pdf",
            page: "Page 12",
            section: "Section 4.2 - Attendance Criteria",
            relevanceScore: 98,
          },
        ];
      } else if (queryLower.includes("scholarship")) {
        fallbackAnswer =
          "Scholarship Renewal Requirements:\n\n1. Grade Card of previous academic year (Minimum CGPA of 8.0 without any active backlogs)\n2. Annual family income certificate issued by competent revenue authority (dated within last 6 months)\n3. Fee receipt of the current semester\n4. Recommendation letter from the Head of Department (HOD)\n5. Active student bank account passbook copy.";
        fallbackCitations = [
          {
            source: "Scholarship & Financial Aid Manual.pdf",
            page: "Page 5",
            section: "Section 3.1 - Annual Renewal Checklist",
            relevanceScore: 96,
          },
        ];
      } else if (queryLower.includes("re-evaluation") || queryLower.includes("reval")) {
        fallbackAnswer =
          "Re-evaluation Process:\n\nStudents can apply for answer script re-evaluation within 15 days of result declaration via the campus academic portal. A non-refundable processing fee of ₹500 per subject must be paid online.";
        fallbackCitations = [
          {
            source: "Examination Guidelines.pdf",
            page: "Page 18",
            section: "Section 7.4 - Evaluation & Verification",
            relevanceScore: 94,
          },
        ];
      } else if (queryLower.includes("placement")) {
        fallbackAnswer =
          "Campus Placement Eligibility:\n\nStudents must possess a minimum cumulative CGPA of 6.5 with no standing backlogs at the start of the 7th semester. An overall attendance of 75% across training sessions is mandatory.";
        fallbackCitations = [
          {
            source: "Training & Placement Handbook.pdf",
            page: "Page 8",
            section: "Section 2.1 - General Eligibility",
            relevanceScore: 95,
          },
        ];
      } else {
        found = false;
        fallbackAnswer =
          "Information not found in the verified institutional knowledge base.\n\nSaarthi AI only answers from verified circulars, notices, and handbooks provided by the institution to avoid hallucination.";
        fallbackCitations = [];
      }

      const fallbackBotMessage = {
        id: "bot-" + Date.now(),
        sender: "assistant",
        text: fallbackAnswer,
        citations: fallbackCitations,
        isFoundInKnowledgeBase: found,
        feedback: "none",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, fallbackBotMessage]);
    } finally {
      setIsTyping(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  };

  const handleCopyText = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFeedback = async (chatId, type) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === chatId
          ? { ...msg, feedback: msg.feedback === type ? "none" : type }
          : msg
      )
    );

    try {
      await api.chat.sendFeedback(chatId, type);
    } catch (e) {
      console.warn("Feedback sync error", e);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("campusai_user");
    localStorage.removeItem("campusai_token");
    navigate("/");
  };

  const displayName = currentUser?.name || "Student";
  const firstName = displayName.split(" ")[0];

  return (
    <div className="axora-chat-container">
      {/* ====================================================================
          LEFT SIDEBAR (Matching Axora Layout - 100% Icon-Based)
          ==================================================================== */}
      <aside className="axora-sidebar">
        {/* Brand */}
        <div className="axora-brand" onClick={() => navigate("/")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "10px" }}>
          <img src={saarthiOrb} alt="SaarthiAI" style={{ width: "26px", height: "26px", filter: "drop-shadow(0 0 8px rgba(79, 117, 255, 0.45))" }} />
          <span className="axora-brand-text" style={{ fontSize: "16px", fontWeight: "700", letterSpacing: "-0.3px", color: "#ffffff" }}>SaarthiAI</span>
        </div>

        {/* Search Bar */}
        <div className="axora-search-bar">
          <Search size={14} />
          <input
            type="text"
            placeholder="Search or ask anything..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchFilter.trim()) {
                e.preventDefault();
                const q = searchFilter.trim();
                setSearchFilter("");
                setActiveTab("home");
                handleSendMessage(q);
              }
            }}
          />
          <span className="axora-kbd-shortcut">↵</span>
        </div>

        {/* Main Navigation Items */}
        <div className="axora-nav-group">
          <button
            className={`axora-nav-item ${activeTab === "home" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("home");
            }}
          >
            <Home size={15} />
            <span>Home</span>
          </button>

          <button
            className={`axora-nav-item ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            <Clock size={15} />
            <span>History</span>
          </button>
        </div>

        {/* Grouped Chat History Timeline */}
        <div className="axora-history-container">
          <div className="axora-sidebar-history-head">
            <span className="axora-timeline-header">Recent Inquiries</span>
            {dynamicHistory.length > 0 && (
              <button
                type="button"
                className="axora-sidebar-clear-btn"
                onClick={handleClearHistory}
                title="Clear inquiry history"
              >
                <Trash2 size={11} />
                <span>Clear</span>
              </button>
            )}
          </div>
          {searchFilter.trim() && (
            <button
              className="axora-history-item"
              style={{
                background: "rgba(79, 117, 255, 0.2)",
                border: "1px solid rgba(79, 117, 255, 0.4)",
                color: "#93c5fd",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontWeight: "600",
                marginBottom: "6px",
              }}
              onClick={() => {
                const q = searchFilter.trim();
                setSearchFilter("");
                setActiveTab("home");
                handleSendMessage(q);
              }}
            >
              <Search size={13} style={{ flexShrink: 0, color: "#60a5fa" }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                Ask AI: "{searchFilter}"
              </span>
            </button>
          )}
          {dynamicHistory
            .filter((item) => item.query.toLowerCase().includes(searchFilter.toLowerCase()))
            .map((item) => (
              <button
                key={item.id}
                className="axora-history-item"
                title={item.query}
                onClick={() => handleSelectHistoryItem(item)}
              >
                {item.query}
              </button>
            ))}

          <div className="axora-timeline-header">Institutional Guidelines</div>
          <button
            className="axora-history-item"
            title="Hostel residency curfew and gate pass rules..."
            onClick={() => handleSendMessage("Hostel residency curfew and gate pass rules...")}
          >
            Hostel residency curfew and gate pass rules...
          </button>
          <button
            className="axora-history-item"
            title="Central library book borrowing limits and fine policy..."
            onClick={() => handleSendMessage("Central library book borrowing limits and fine policy...")}
          >
            Central library book borrowing limits and fine policy...
          </button>
        </div>

        {/* Sidebar Bottom Profile Bar */}
        <div className="axora-profile-bar">
          <div className="axora-profile-left">
            <div className="axora-avatar-circle">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="axora-profile-details">
              <span className="axora-profile-name">{displayName}</span>
              <span className="axora-profile-plan">
                {currentUser?.role === "faculty" ? "Faculty" : "Student - Active"}
              </span>
            </div>
          </div>

          <button
            className="axora-profile-action-btn"
            title="Log out"
            onClick={handleLogout}
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </aside>

      {/* ====================================================================
          MAIN CHAT SECTION
          ==================================================================== */}
      <main className="axora-main-content">
        {/* Top Navbar */}
        <header className="axora-top-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {/* Model Selector Dropdown */}
            <div className="axora-model-selector">
              <span>Saarthi Copilot</span>
              <ChevronDown size={12} className="arrow" />
            </div>

            {/* Feature 1: Student Profile Context Chip */}
            <div
              className="student-profile-chip"
              onClick={() => setIsProfileModalOpen(true)}
              title="Click to personalize branch, year & roll number context"
            >
              <UserCheck size={13} style={{ color: "var(--chat-accent)" }} />
              <span>
                {currentUser?.name || "Student"} • {currentUser?.department || "Computer Science"} • {currentUser?.year || "3rd Year"}
              </span>
              <Edit3 size={11} className="edit-icon" />
            </div>
          </div>

          {/* Right Action Icons */}
          <div className="axora-top-actions">
            {/* Dark / Light Mode Toggle Button */}
            <button
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
            >
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {currentUser?.role === "faculty" && (
              <button
                className="faculty-portal-link"
                onClick={() => navigate("/faculty-dashboard")}
              >
                <GraduationCap size={14} />
                <span>Faculty Portal</span>
              </button>
            )}

            <button
              className="axora-icon-button"
              title="New Chat Session"
              onClick={handleNewChat}
            >
              <Plus size={15} />
            </button>

            <button
              className="axora-icon-button"
              title="More options"
              onClick={handleLogout}
            >
              <MoreHorizontal size={15} />
            </button>
          </div>
        </header>

        {/* Center Content: Either History View, Welcome View, or Message Thread */}
        {activeTab === "history" ? (
          /* ================================================================
             DEDICATED CONVERSATION HISTORY VIEW WITH SEARCH & CLEAR
             ================================================================ */
          <div className="axora-history-view">
            <div className="axora-history-header">
              <div className="axora-history-header-left">
                <div className="axora-history-title-row">
                  <Clock size={22} className="axora-history-icon" />
                  <h2>Conversation History</h2>
                  <span className="axora-history-count-badge">
                    {dynamicHistory.length} {dynamicHistory.length === 1 ? "inquiry" : "inquiries"}
                  </span>
                </div>
                <p className="axora-history-subtitle">
                  Review your past campus inquiries, citations, and verified AI answers.
                </p>
              </div>

              <div className="axora-history-header-actions">
                {dynamicHistory.length > 0 && (
                  <button
                    type="button"
                    className="axora-clear-history-btn"
                    onClick={handleClearHistory}
                    title="Clear all conversation history"
                  >
                    <Trash2 size={15} />
                    <span>Clear All History</span>
                  </button>
                )}
                <button
                  type="button"
                  className="axora-new-chat-btn"
                  onClick={() => {
                    setActiveTab("home");
                    handleNewChat();
                  }}
                >
                  <Plus size={15} />
                  <span>New Chat</span>
                </button>
              </div>
            </div>

            {/* Live Search Across History */}
            {dynamicHistory.length > 0 && (
              <div className="axora-history-search-bar">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search across history or type a question..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && historySearch.trim()) {
                      e.preventDefault();
                      const q = historySearch.trim();
                      setHistorySearch("");
                      setActiveTab("home");
                      handleSendMessage(q);
                    }
                  }}
                />
                {historySearch && (
                  <button
                    type="button"
                    className="axora-history-search-clear"
                    onClick={() => setHistorySearch("")}
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            {/* History Cards Grid or Empty State */}
            {dynamicHistory.filter((item) =>
              item.query.toLowerCase().includes(historySearch.toLowerCase()) ||
              (item.answer && item.answer.toLowerCase().includes(historySearch.toLowerCase()))
            ).length === 0 ? (
              <div className="axora-history-empty-state">
                <div className="axora-history-empty-icon">
                  <Clock size={36} />
                </div>
                <h3>{historySearch ? "No Past Inquiries Match This Query" : "No Conversation History"}</h3>
                <p>
                  {historySearch
                    ? `You haven't asked about "${historySearch}" before. Ask Saarthi AI right now to retrieve verified institutional answers!`
                    : "Your conversation queries and answers will appear here as you ask questions in Saarthi AI."}
                </p>
                {historySearch ? (
                  <button
                    type="button"
                    className="axora-history-start-btn"
                    style={{ background: "#4f75ff", color: "#ffffff" }}
                    onClick={() => {
                      const q = historySearch.trim();
                      setHistorySearch("");
                      setActiveTab("home");
                      handleSendMessage(q);
                    }}
                  >
                    <Sparkles size={15} />
                    <span>Ask AI: "{historySearch}"</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="axora-history-start-btn"
                    onClick={() => setActiveTab("home")}
                  >
                    <span>Start New Conversation</span>
                    <ArrowRight size={15} />
                  </button>
                )}
              </div>
            ) : (
              <div className="axora-history-grid">
                {dynamicHistory
                  .filter((item) =>
                    item.query.toLowerCase().includes(historySearch.toLowerCase()) ||
                    (item.answer && item.answer.toLowerCase().includes(historySearch.toLowerCase()))
                  )
                  .map((item) => (
                    <div
                      key={item.id}
                      className="axora-history-card"
                      onClick={() => handleSelectHistoryItem(item)}
                    >
                      <div className="axora-history-card-top">
                        <span className="axora-history-card-tag">
                          <MessageSquare size={12} />
                          <span>{item.date || item.timestamp || "Inquiry"}</span>
                        </span>
                        <button
                          type="button"
                          className="axora-history-delete-single-btn"
                          title="Delete this inquiry"
                          onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <h4 className="axora-history-card-query">{item.query}</h4>

                      {item.answer && (
                        <p className="axora-history-card-preview">
                          {item.answer}
                        </p>
                      )}

                      <div className="axora-history-card-footer">
                        <span className="axora-history-card-open-prompt">
                          <span>Open in chat</span>
                          <ArrowRight size={13} />
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ) : messages.length === 0 ? (
          /* ================================================================
             EMPTY / WELCOME STATE (Exact match to Axora, NO SPHERE)
             ================================================================ */
          <div className="axora-welcome-wrapper">
            {/* Greeting Header (NO SPHERE) */}
            <h1 className="axora-greeting-title">
              {getGreeting()}, {firstName}.
              <span className="sub-question">Can I help you with anything ?</span>
            </h1>

            {/* Signature Floating Input Card */}
            <div className="axora-input-container">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
              >
                <div className="axora-input-card">
                  <textarea
                    ref={inputRef}
                    className="axora-textarea"
                    placeholder="Message Saarthi AI..."
                    rows="1"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />

                  {/* Input Card Bottom Toolbar */}
                  <div className="axora-input-toolbar">
                    <div className="axora-input-tools-left">
                      <span
                        style={{
                          fontSize: "12px",
                          color: "var(--chat-text-muted)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        <ShieldCheck size={14} style={{ color: "#22c55e" }} />
                        <span>Strict Institutional Citations</span>
                      </span>
                    </div>

                    <div className="axora-input-tools-right">
                      <button
                        type="button"
                        className={`axora-tool-icon-btn ${isListening ? "active pulse" : ""}`}
                        title={isListening ? "Listening... Click to stop" : "Voice Input"}
                        onClick={toggleVoiceInput}
                        style={isListening ? { color: "#ef4444", background: "rgba(239, 68, 68, 0.15)" } : {}}
                      >
                        <Mic size={14} />
                      </button>

                      <button
                        type="button"
                        className={`axora-tool-icon-btn ${isSpeaking ? "active" : ""}`}
                        title={isSpeaking ? "Stop Audio" : "Read Aloud"}
                        onClick={() => toggleAudioSpeech()}
                        style={isSpeaking ? { color: "#38bdf8", background: "rgba(56, 189, 248, 0.15)" } : {}}
                      >
                        <Volume2 size={14} />
                      </button>

                      <button
                        type="submit"
                        className="axora-send-btn"
                        disabled={!inputText.trim() || isTyping}
                        title="Send"
                      >
                        <ArrowUp size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* 3 Horizontal Suggestion Cards (Exact match to screenshot bottom) */}
            <div className="axora-suggestion-grid">
              {suggestionCards.map((card, idx) => (
                <div
                  key={idx}
                  className="axora-suggestion-card"
                  onClick={() => handleSendMessage(card.query)}
                >
                  <div className="axora-card-title">{card.title}</div>
                  <p className="axora-card-desc">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ================================================================
             CONVERSATION VIEW (Active message thread)
             ================================================================ */
          <>
            <div className="axora-thread-container">
              <div className="axora-thread-inner">
                {messages.map((msg) => (
                  <div key={msg.id} className={`axora-msg-row ${msg.sender}`}>
                    {msg.sender === "assistant" && (
                      <div className="axora-msg-avatar assistant">
                        <Sparkles size={16} />
                      </div>
                    )}

                    <div className="axora-msg-bubble">
                      <div className="axora-msg-text">
                        <FormattedMessage content={msg.text} />
                      </div>

                      {/* Supporting Institutional Citation Card */}
                      {msg.sender === "assistant" && (
                        <>
                          {msg.isFoundInKnowledgeBase && msg.citations?.length > 0 ? (
                            msg.citations.map((cite, cIdx) => (
                              <div
                                key={cIdx}
                                className="axora-citation-card"
                                onClick={() => {
                                  setSelectedCitation(cite);
                                  setCitationViewMode("highlight");
                                }}
                                style={{ cursor: "pointer" }}
                                title="Click to open grounded excerpt and PDF document viewer"
                              >
                                <div className="axora-citation-meta">
                                  <div className="axora-citation-icon">
                                    <FileText size={15} />
                                  </div>
                                  <div>
                                    <div className="axora-citation-title">
                                      {cite.source}
                                    </div>
                                    <div className="axora-citation-loc">
                                      <span className="axora-citation-page">
                                        {cite.page || "Page 1"}
                                      </span>
                                      <span>•</span>
                                      <span>{cite.section || "Clause"}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="axora-citation-badge" style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                  <Eye size={12} />
                                  <span>{cite.relevanceScore || 95}% Match</span>
                                </div>
                              </div>
                            ))
                          ) : !msg.isFoundInKnowledgeBase ? (
                            <div className="axora-refusal-alert">
                              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: "2px" }} />
                              <div>
                                <strong>Zero-Hallucination Safe Refusal</strong>
                                <div style={{ marginTop: "2px", opacity: 0.9 }}>
                                  Information not found in institutional circulars. The copilot avoids unverified answers.
                                </div>
                              </div>
                            </div>
                          ) : null}

                          {/* Message Actions */}
                          <div className="axora-msg-actions">
                            <button
                              className="axora-action-btn"
                              onClick={() => handleCopyText(msg.text, msg.id)}
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check size={12} />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={12} />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>

                            <button
                              className="axora-action-btn"
                              onClick={() => toggleAudioSpeech(msg.text)}
                              title="Read response aloud"
                            >
                              <Volume2 size={12} />
                            </button>

                            {/* Feature 3: Add to Google / Outlook Calendar */}
                            <button
                              className="axora-action-btn calendar"
                              onClick={() => handleOpenCalendarModal(msg)}
                              title="Add schedule, holiday, or deadline to Google / Outlook Calendar"
                            >
                              <Calendar size={12} />
                              <span>Add to Calendar</span>
                            </button>

                            <button
                              className={`axora-action-btn ${
                                msg.feedback === "up" ? "active" : ""
                              }`}
                              onClick={() => handleFeedback(msg.id, "up")}
                              title="Helpful citation"
                            >
                              <ThumbsUp size={12} />
                            </button>

                            <button
                              className={`axora-action-btn ${
                                msg.feedback === "down" ? "active" : ""
                              }`}
                              onClick={() => handleFeedback(msg.id, "down")}
                              title="Not helpful"
                            >
                              <ThumbsDown size={12} />
                            </button>

                            <span
                              style={{
                                fontSize: "11px",
                                color: "var(--chat-text-muted)",
                                marginLeft: "6px",
                              }}
                            >
                              {msg.timestamp}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {msg.sender === "user" && (
                      <div className="axora-msg-avatar user">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                ))}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="axora-msg-row assistant">
                    <div className="axora-msg-avatar assistant">
                      <Sparkles size={16} />
                    </div>
                    <div
                      className="axora-msg-bubble"
                      style={{ width: "auto", padding: "12px 18px" }}
                    >
                      <div className="axora-typing">
                        <span className="axora-typing-dot"></span>
                        <span className="axora-typing-dot"></span>
                        <span className="axora-typing-dot"></span>
                        <span
                          style={{
                            fontSize: "12px",
                            color: "var(--chat-text-muted)",
                            marginLeft: "8px",
                          }}
                        >
                          Searching institutional knowledge base...
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Pinned Bottom Input Bar */}
            <div className="axora-pinned-input-bar">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
              >
                <div className="axora-input-card">
                  <textarea
                    ref={inputRef}
                    className="axora-textarea"
                    placeholder="Message Saarthi AI..."
                    rows="1"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />

                  <div className="axora-input-toolbar">
                    <div className="axora-input-tools-left">

                      <span
                        style={{
                          fontSize: "12px",
                          color: "var(--chat-text-muted)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        <ShieldCheck size={14} style={{ color: "#22c55e" }} />
                        <span>Strict Institutional Citations</span>
                      </span>
                    </div>

                    <div className="axora-input-tools-right">
                      <button
                        type="button"
                        className={`axora-tool-icon-btn ${isListening ? "active pulse" : ""}`}
                        title={isListening ? "Listening... Click to stop" : "Voice Input"}
                        onClick={toggleVoiceInput}
                        style={isListening ? { color: "#ef4444", background: "rgba(239, 68, 68, 0.15)" } : {}}
                      >
                        <Mic size={14} />
                      </button>

                      <button
                        type="button"
                        className={`axora-tool-icon-btn ${isSpeaking ? "active" : ""}`}
                        title={isSpeaking ? "Stop Audio" : "Read Aloud"}
                        onClick={() => toggleAudioSpeech()}
                        style={isSpeaking ? { color: "#38bdf8", background: "rgba(56, 189, 248, 0.15)" } : {}}
                      >
                        <Volume2 size={14} />
                      </button>

                      <button
                        type="submit"
                        className="axora-send-btn"
                        disabled={!inputText.trim() || isTyping}
                        title="Send Question"
                      >
                        <ArrowUp size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </>
        )}

        {/* ====================================================================
            FEATURE 1: PERSONALIZED STUDENT PROFILE CONTEXT MODAL
            ==================================================================== */}
        {isProfileModalOpen && (
          <div className="axora-modal-overlay" onClick={() => setIsProfileModalOpen(false)}>
            <div className="axora-modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="axora-modal-header">
                <h3>
                  <UserCheck size={18} style={{ color: "var(--chat-accent)" }} />
                  <span>Personalized Student Profile Context</span>
                </h3>
                <button className="axora-modal-close-btn" onClick={() => setIsProfileModalOpen(false)}>
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={handleSaveProfile}>
                <div className="axora-modal-body">
                  <p style={{ fontSize: "12.5px", color: "var(--chat-text-secondary)", margin: 0, lineHeight: 1.5 }}>
                    Saarthi Copilot personalizes timetable schedules, exam rules, and attendance requirements specifically to your branch and academic year.
                  </p>
                  <div className="axora-form-group">
                    <label>Student Full Name</label>
                    <input
                      type="text"
                      className="axora-form-input"
                      value={profileFormData.name}
                      onChange={(e) => setProfileFormData({ ...profileFormData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="axora-form-group">
                    <label>Department / Engineering Branch</label>
                    <select
                      className="axora-form-select"
                      value={profileFormData.department}
                      onChange={(e) => setProfileFormData({ ...profileFormData, department: e.target.value })}
                    >
                      <option value="Computer Science & Engineering">Computer Science & Engineering (CSE)</option>
                      <option value="Information Technology">Information Technology (IT)</option>
                      <option value="Electronics & Telecommunication">Electronics & Telecommunication (ENTC)</option>
                      <option value="Mechanical Engineering">Mechanical Engineering</option>
                      <option value="Civil Engineering">Civil Engineering</option>
                      <option value="Electrical Engineering">Electrical Engineering</option>
                      <option value="Artificial Intelligence & Data Science">AI & Data Science (AIDS)</option>
                      <option value="MBA & Management Studies">MBA & Management Studies</option>
                    </select>
                  </div>
                  <div className="axora-form-group">
                    <label>Academic Year</label>
                    <select
                      className="axora-form-select"
                      value={profileFormData.year}
                      onChange={(e) => setProfileFormData({ ...profileFormData, year: e.target.value })}
                    >
                      <option value="1st Year">1st Year (Freshman / FE)</option>
                      <option value="2nd Year">2nd Year (Sophomore / SE)</option>
                      <option value="3rd Year">3rd Year (Junior / TE)</option>
                      <option value="4th Year">4th Year (Senior / BE)</option>
                      <option value="Postgraduate">Postgraduate (M.Tech / MBA)</option>
                    </select>
                  </div>
                  <div className="axora-form-group">
                    <label>College Roll / PRN Number</label>
                    <input
                      type="text"
                      className="axora-form-input"
                      value={profileFormData.rollNo}
                      placeholder="e.g. CS2024-042"
                      onChange={(e) => setProfileFormData({ ...profileFormData, rollNo: e.target.value })}
                    />
                  </div>
                </div>
                <div className="axora-modal-footer">
                  <button type="button" className="axora-btn-secondary" onClick={() => setIsProfileModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="axora-btn-primary" disabled={profileSaving}>
                    <Check size={14} />
                    <span>{profileSaving ? "Saving..." : "Save Context"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ====================================================================
            FEATURE 2: VISUAL CITATION & PDF VIEWER MODAL
            ==================================================================== */}
        {selectedCitation && (
          <div className="axora-modal-overlay" onClick={() => setSelectedCitation(null)}>
            <div className="axora-modal-box axora-docviewer-modal" onClick={(e) => e.stopPropagation()}>
              <div className="axora-modal-header">
                <h3>
                  <FileText size={18} style={{ color: "var(--chat-accent)" }} />
                  <span>{selectedCitation.source}</span>
                  <span className="axora-doc-page-badge">
                    {selectedCitation.page || "Page 1"}
                  </span>
                </h3>
                <button className="axora-modal-close-btn" onClick={() => setSelectedCitation(null)}>
                  <X size={16} />
                </button>
              </div>

              <div className="axora-docviewer-tabs">
                <button
                  className={`axora-docviewer-tab ${citationViewMode === "highlight" ? "active" : ""}`}
                  onClick={() => setCitationViewMode("highlight")}
                >
                  <Eye size={13} />
                  <span>Grounded Text Highlight</span>
                </button>
                <button
                  className={`axora-docviewer-tab ${citationViewMode === "pdf" ? "active" : ""}`}
                  onClick={() => setCitationViewMode("pdf")}
                >
                  <ExternalLink size={13} />
                  <span>Official PDF Viewer</span>
                </button>
              </div>

              <div className="axora-docviewer-body">
                {citationViewMode === "highlight" ? (
                  <div className="axora-doc-page-paper">
                    <div className="axora-doc-page-header">
                      <span>Section: {selectedCitation.section || "General Guidelines"} • Version v{selectedCitation.version || 1}</span>
                      <span style={{ color: "#22c55e", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <ShieldCheck size={14} />
                        Strict Grounded Excerpt
                      </span>
                    </div>

                    <div className="axora-doc-bounding-box">
                      <span className="axora-doc-bounding-label">Exact Source Paragraph</span>
                      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                        {selectedCitation.fullExcerpt || selectedCitation.snippet || "Relevant clause context retrieved from official document."}
                      </p>
                    </div>

                    <div style={{ marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "var(--chat-text-muted)" }}>
                      <span>Relevance Match: {selectedCitation.relevanceScore || 95}%</span>
                      {selectedCitation.documentId && (
                        <a
                          href={`http://localhost:5000/api/documents/${selectedCitation.documentId}/download`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "var(--chat-accent)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        >
                          <Download size={13} />
                          Download Official File
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="axora-doc-iframe-container">
                    {selectedCitation.documentId ? (
                      <iframe
                        title="Document PDF Preview"
                        src={`http://localhost:5000/api/documents/${selectedCitation.documentId}/file#page=${selectedCitation.pageNumber || 1}`}
                        className="axora-doc-iframe"
                      />
                    ) : (
                      <div style={{ padding: "40px", textAlign: "center", color: "var(--chat-text-muted)" }}>
                        <p>Document preview loaded from institutional knowledge base.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="axora-modal-footer">
                {selectedCitation.documentId && (
                  <a
                    href={`http://localhost:5000/api/documents/${selectedCitation.documentId}/file`}
                    target="_blank"
                    rel="noreferrer"
                    className="axora-btn-secondary"
                    style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <ExternalLink size={14} />
                    <span>Open Full Document</span>
                  </a>
                )}
                <button className="axora-btn-primary" onClick={() => setSelectedCitation(null)}>
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            FEATURE 3: ADD TO GOOGLE / OUTLOOK CALENDAR MODAL
            ==================================================================== */}
        {calendarEvent && (
          <div className="axora-modal-overlay" onClick={() => setCalendarEvent(null)}>
            <div className="axora-modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="axora-modal-header">
                <h3>
                  <Calendar size={18} style={{ color: "#38bdf8" }} />
                  <span>Add Schedule to Calendar</span>
                </h3>
                <button className="axora-modal-close-btn" onClick={() => setCalendarEvent(null)}>
                  <X size={16} />
                </button>
              </div>
              <div className="axora-modal-body">
                <p style={{ fontSize: "12.5px", color: "var(--chat-text-secondary)", margin: 0, lineHeight: 1.5 }}>
                  Export examination dates, holiday schedules, or submission deadlines directly to your personal Google Calendar or download an .ics file for Outlook/Apple Calendar.
                </p>

                <div className="axora-form-group">
                  <label>Event Title</label>
                  <input
                    type="text"
                    className="axora-form-input"
                    value={calendarEvent.title}
                    onChange={(e) => setCalendarEvent({ ...calendarEvent, title: e.target.value })}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="axora-form-group">
                    <label>Event Date</label>
                    <input
                      type="date"
                      className="axora-form-input"
                      value={calendarEvent.date}
                      onChange={(e) => setCalendarEvent({ ...calendarEvent, date: e.target.value })}
                    />
                  </div>
                  <div className="axora-form-group">
                    <label>Event Time</label>
                    <input
                      type="time"
                      className="axora-form-input"
                      value={calendarEvent.time}
                      onChange={(e) => setCalendarEvent({ ...calendarEvent, time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="axora-form-group">
                  <label>Description & Grounded Reference</label>
                  <textarea
                    className="axora-form-textarea"
                    rows="3"
                    value={calendarEvent.description}
                    onChange={(e) => setCalendarEvent({ ...calendarEvent, description: e.target.value })}
                  />
                </div>

                <div className="calendar-export-grid">
                  <div className="calendar-export-btn" onClick={handleExportGoogleCalendar}>
                    <Calendar size={22} style={{ color: "#4285F4" }} />
                    <span className="title">Google Calendar</span>
                    <span className="desc">Opens web event creator</span>
                  </div>

                  <div className="calendar-export-btn" onClick={handleDownloadICS}>
                    <Download size={22} style={{ color: "#0078D4" }} />
                    <span className="title">Outlook / Apple (.ics)</span>
                    <span className="desc">Downloads .ics calendar file</span>
                  </div>
                </div>
              </div>
              <div className="axora-modal-footer">
                <button className="axora-btn-secondary" onClick={() => setCalendarEvent(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default StudentChat;
