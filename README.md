# Saarthi AI (CampusAI) — Institutional Knowledge Copilot

> **Production-Quality Institutional RAG Copilot for Higher Education**  
> Built on the core principle: **"No Evidence → No Answer"**

---

## 🏛️ System Overview

College policies, exam timetables, attendance regulations, scholarships, and placement rules are traditionally scattered across disparate PDFs, scanned notices, and academic handbooks. **Saarthi AI** is an institutional knowledge copilot providing:

1. **Concise, factual answers** grounded strictly in institutional documents.
2. **Exact source citations**: Document title, page number, section heading, and confidence metrics.
3. **Student Profile Context**: Personalized branch, academic year, and roll number context tags that adapt responses to the student's exact curriculum.
4. **Visual PDF Citation Viewer**: Interactive document viewer highlighting grounded excerpts with direct page jumps.
5. **Add to Calendar**: Instant one-click Google Calendar & `.ics` export for campus events, exams, and holidays.
6. **Policy Version Diff Analyzer**: Administrative side-by-side policy version comparison for tracking circular revisions.
7. **Institutional Knowledge Gap Heatmap**: Identifies frequent student queries with low retrieval confidence to pinpoint policy documentation gaps.
8. **Campus Slang & Vocabulary Expansion**: Seamlessly resolves campus terminology (`endsem`, `midsem`, `kt`, `backlog`, `reval`) to formal academic language (`End Semester Examination`, `Continuous Assessment`, `Remedial Exam`).
9. **Calendar & Schedule Deductive Reasoning**: Correctly interprets monthly academic calendars, holiday tables, and date inquiries (e.g., distinguishing declared Probable Holidays from regular working days).
10. **Strict Hallucination Prevention**: If supporting evidence is insufficient, it explicitly abstains with:  
    `"Information not found in the institutional knowledge base."`

---

## ⚙️ Architecture & Tech Stack

```
User (Student / Faculty / Admin)
  ↓
React 19 + Vite 8 SPA (Dark Glassmorphism UI, Speech-to-Text & TTS)
  ↓
Node.js + Express 5 REST API (JWT & RBAC Middleware)
  ↓
RAG Ingestion & Hybrid Retrieval Engine
  ├── Page-aware Multi-format Parser (PDF, DOCX, TXT, CSV)
  ├── Multimodal Vision OCR Fallback for scanned documents
  ├── Semantic Chunking Engine (Preserves Page & Section boundaries)
  ├── Campus Slang & Vocabulary Query Expander (endsem, midsem, kt, holidays)
  ├── Dense Vector Embeddings (Gemini text-embedding-004 + Local Vectorizer)
  ├── Okapi BM25 Lexical Keyword Search (Stopword-filtered)
  ├── Reciprocal Rank Fusion (RRF) Re-ranking
  └── Temporal & Schedule Intent Routing
  ↓
Grounded Gemini Generation Engine (gemini-3.5-flash-lite / gemini-3.8-flash)
  ↓
Verified Answer + Source Citation Cards + Abstention Shield
  ↓
MongoDB Atlas (Users, Documents, Versions, Chunks, Messages, Feedback, Audit)
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18 or higher
- **MongoDB**: MongoDB Atlas connection string or local MongoDB instance (`mongodb://127.0.0.1:27017/campusai`)
- **Google Gemini API Key**: From [Google AI Studio](https://aistudio.google.com/)

---

### 1. Backend Setup

```bash
cd Backend
npm install
```

Create or configure `Backend/.env`:

```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/campusai?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key_here
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
EMBEDDING_MODEL=gemini-embedding-001
CONFIDENCE_THRESHOLD=0.45
ADMIN_ACCESS_TOKEN=CAMPUS_AI_ADMIN_SECURE_2026_KEY
FACULTY_ACCESS_TOKEN=CAMPUS_AI_ADMIN_SECURE_2026_KEY
```

Start the backend:
```bash
npm run start
# Or for development with live reload:
npm run dev
```
The backend server will run on `http://localhost:5000`.

---

### 2. Frontend Setup

In the root directory (`d:/campusAI`):

```bash
npm install
npm run dev
```

The frontend application will be live at `http://localhost:5173`.

---

## 🔑 Demo Accounts

For fast demonstration, the login screen provides role toggles and quick access:

| Role | Email | Password | Access Rights |
| :--- | :--- | :--- | :--- |
| **Student** 🎓 | `student@campus.edu` | `StudentPassword123!` | AI Copilot Chat, Citation Explorer, Feedback, Chat History |
| **Faculty** 📚 | `faculty@campus.edu` | `FacultyPassword123!` | Document Uploads, Category Tagging, Department Management |
| **Admin** 🛡️ | `admin@campus.edu` | `AdminPassword123!` | Knowledge Base Hub, Multi-format Ingestion, Version Control, Analytics |

---

## 🧪 Demo Scenarios

### Scenario A: Calendar & Holiday Date Query
- **Query:** `"When do we have holiday in October"`
- **Result:**
  - Extracts the institutional Academic Calendar for Academic Year 2026–27.
  - Lists officially declared Probable Holidays: **Oct 2 (Mahatma Gandhi Jayanti)** & **Oct 20 (Dashahara)**.
  - Clarifies that other dates remain regular academic working days.
  - **Source Citation:** `Institute-Academic-Calendar-2026-27 | Page 2 | Confidence: 100%`

### Scenario B: Campus Slang & Exam Schedule Query
- **Query:** `"When the endsem will be ..."`
- **Result:**
  - Automatically expands `endsem` &rarr; `End Semester Examination (ESE)`.
  - Accurately quotes the dates: **Nov 16–30, 2026** (S.Y., T.Y., B.Tech.) and **May 18–22, 2027** (B.Tech Self-Learning).
  - **Source Citation:** `Institute-Academic-Calendar-2026-27 | Pages 2 & 4`

### Scenario C: Fact-Grounded Attendance Policy
- **Query:** `"What is the minimum attendance required for semester examination?"`
- **Result:**
  - States the **75% minimum attendance rule** across lectures, tutorials, and practical labs.
  - Details medical condonation rules (65%–74%) and detention below 65%.
  - **Source Citation:** `Academic Rules and Regulations (SITCOE) | Page 4`

### Scenario D: Strict Abstention Test ("No Evidence → No Answer")
- **Query:** `"What is the policy for XYZ rule that does not exist?"`
- **Result:**
  - Executes Hybrid Vector + BM25 search and detects zero factual support.
  - Displays: `"Information not found in the institutional knowledge base."`
  - **Zero hallucinations produced.**

---

## 📂 Project Structure

```
d:/campusAI/
├── sample_docs/              # Institutional test documents (Examination, Calendar, Manuals)
├── src/                      # Frontend Application (React 19 + Vite 8)
│   ├── assets/               # SaarthiAI glowing cosmic orb logo & graphics
│   ├── components/
│   │   ├── Hero.jsx          # Futuristic landing page with glowing orb & CTAs
│   │   ├── Navbar.jsx        # Glassmorphic top navigation bar
│   │   ├── Login.jsx         # Sign-in with Student / Faculty / Admin roles
│   │   ├── Register.jsx      # Role-based account registration with token validation
│   │   ├── StudentChat.jsx   # AI Copilot Chat with Voice (STT & TTS), History & Citations
│   │   ├── FacultyDashboard.jsx # Faculty document management & upload portal
│   │   ├── Admin.jsx         # Administrative Knowledge Hub, Stats & Chunk Inspector
│   │   └── FormattedMessage.jsx # Preprocessor for markdown tables and OCR schedules
│   ├── templates/            # Curated stylesheets (chat.css, dashboard.css, etc.)
│   ├── services/
│   │   └── api.js            # Unified API client for local & deployed backends
│   ├── App.jsx               # React Router configuration
│   └── main.jsx
└── Backend/                  # Backend Application (Node.js + Express 5 + MongoDB)
    ├── src/
    │   ├── config/db.js      # MongoDB connection
    │   ├── models/           # User, Document, DocumentVersion, DocumentChunk, ChatSession, ChatMessage, Feedback, AuditLog
    │   ├── middleware/       # JWT Auth, Role-based Access, Multer Upload
    │   ├── utils/textParser.js # Multi-format extractor with Multimodal OCR fallback
    │   ├── rag/
    │   │   ├── chunker.js    # Semantic chunking preserving page & section
    │   │   ├── embeddings.js # Gemini text-embedding-004 + dense semantic vectorizer
    │   │   ├── bm25.js       # Okapi BM25 keyword index with stopword filtering
    │   │   ├── retrieval.js  # Hybrid RRF, campus slang expansion, and schedule intent routing
    │   │   └── gemini.js     # Grounded generation, model fallback, and calendar reasoning
    │   ├── controllers/      # Auth, Document, Chat, Feedback controllers
    │   ├── routes/           # REST API endpoints
    │   └── server.js         # Express app entrypoint, health diagnostics & seeder
    └── scripts/seedDocuments.js # Automated document indexing script
```

---

## 🛡️ Reliability & Guardrails

1. **Evidence Gating**: Questions are answered exclusively using retrieved source chunks.
2. **Campus Slang Expander**: Bridges informal student shorthand (`endsem`, `midsem`, `kt`) to official academic documents.
3. **Temporal Intent Routing**: Detects calendar and holiday inquiries and routes them directly to academic schedules.
4. **Model Fallback Chain**: Prioritizes `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, and `gemini-flash-lite-latest` with instant failover on 404/429 limits.
5. **Audited Log Tracing**: Every authentication, document modification, and chat interaction logs audit trails.
