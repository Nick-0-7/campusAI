# CampusAI — Campus Knowledge Copilot (EDU-02)

> **Production-Quality MVP for Hackathon Submission**
> An institution-specific AI knowledge assistant for colleges and universities built on the core principle:  
> **"No Evidence → No Answer"**

---

## 🏛️ System Overview

College policies, exam regulations, attendance rules, scholarships, and placements are traditionally scattered across disparate PDFs, notices, and handbooks. **CampusAI** is an AI-powered Campus Knowledge Copilot that provides:
1. **Concise, factual answers** grounded strictly in institutional documents.
2. **Exact source citations**: Document title, page number, section heading, and confidence metrics.
3. **Strict hallucination prevention**: If supporting evidence is insufficient, it explicitly abstains with:  
   `"Information not found in the institutional knowledge base."`

---

## ⚙️ Architecture & Tech Stack

```
User (Student / Faculty / Admin)
  ↓
React 19 + Vite 8 SPA (Dark glassmorphism UI)
  ↓
Node.js + Express 5 REST API (JWT & RBAC Middleware)
  ↓
RAG Ingestion & Hybrid Retrieval Layer
  ├── Page-aware Multi-format Parser (PDF, DOCX, TXT, CSV)
  ├── Semantic Chunking Engine (Preserves Page & Section boundaries)
  ├── Dense Vector Embeddings (Gemini text-embedding-004 + Local Vectorizer)
  ├── Okapi BM25 Lexical Keyword Search (Stopword-filtered)
  ├── Reciprocal Rank Fusion (RRF) Re-ranking
  └── Strict Evidence & Salient Coverage Confidence Gate
  ↓
Grounded Gemini Engine (gemini-2.5-flash / Extractive Grounding)
  ↓
Verified Answer + Citation Cards + Abstention Shield
  ↓
MongoDB (Users, Documents, Versions, Chunks, Messages, Feedback, Audit)
```

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18+)
- MongoDB (Running locally on `mongodb://127.0.0.1:27017` or MongoDB Atlas)

### 1. Backend Setup
```bash
cd Backend
npm install
# Configure .env (pre-configured with local MongoDB)
node src/server.js
```
The server will start on `http://127.0.0.1:5000` and automatically seed default demo accounts.

### 2. Frontend Setup
```bash
# In the project root (d:/campusAI)
npm install
npm run dev
```
The frontend application will be live at `http://localhost:5173`.

---

## 🔑 Demo Accounts

For instant hackathon demonstration, click the **"Demo Accounts"** fast-fill links on the Login screen:

| Role | Email | Password | Access Rights |
| :--- | :--- | :--- | :--- |
| **Student** 🎓 | `student@campus.edu` | `StudentPassword123!` | Copilot Chat, Citation Explorer, Feedback |
| **Admin** 🛡️ | `admin@campus.edu` | `AdminPassword123!` | Document Ingestion (PDF/DOCX/CSV), Versioning, Chunk Inspector, Metrics |

---

## 🧪 Demo Scenarios

### Scenario A: Fact-Grounded Policy Query
1. Log in as **Student**.
2. Ask:  
   `"What is the minimum attendance required for semester examination?"`
3. **Result**:
   - Answer: `"Students must maintain at least 75% attendance in lectures, tutorials, and practical laboratory sessions..."`
   - Source Citation Card: `📄 Examination Rules.pdf | Page 1 | Section: Attendance Requirements`
   - Confidence: `80% Match`

### Scenario B: Strict Abstention Test ("No Evidence → No Answer")
1. Ask:  
   `"What is the policy for XYZ rule that does not exist?"`
2. **Result**:
   - The system executes Vector + BM25 search, checks salient keyword coverage, and identifies **zero evidence**.
   - Shield Banner displayed: `"Information not found in the institutional knowledge base."`
   - **Zero hallucinations created.**

### Scenario C: Admin Document Upload & Inspection
1. Log in as **Admin**.
2. Navigate to **Admin Portal**.
3. View real-time grounding rate, abstention count, and user satisfaction metrics.
4. Drag & drop any institutional PDF, DOCX, TXT, or CSV.
5. Click **"Inspect Chunks"** on any document to verify how the engine extracted and tagged individual pages and sections.

---

## 📂 Project Structure

```
d:/campusAI/
├── sample_docs/              # Test institutional files (Examination, Scholarships, Placements)
├── src/                      # Frontend Application (React 19 + Vite)
│   ├── components/
│   │   ├── Hero.jsx          # Landing page with video background & CTA
│   │   ├── Navbar.jsx        # Glassmorphic navigation bar
│   │   ├── Login.jsx         # Sign-in with Student/Faculty/Admin toggle & Demo fill
│   │   ├── Register.jsx      # Role-based account creation
│   │   ├── Chat.jsx          # Copilot Chat with Citation Cards & Feedback
│   │   └── Admin.jsx         # Admin Knowledge Hub & Multi-format Uploader
│   ├── templates/            # Curated dark stylesheets
│   │   ├── landing.css
│   │   ├── login.css
│   │   ├── chat.css
│   │   └── admin.css
│   ├── services/
│   │   └── api.js            # API client for backend communication
│   ├── App.jsx               # Routing hub
│   └── main.jsx
└── Backend/                  # Backend Application (Node.js + Express + MongoDB)
    ├── src/
    │   ├── config/db.js      # MongoDB Mongoose connection
    │   ├── models/           # User, Document, DocumentVersion, DocumentChunk, ChatSession, ChatMessage, Feedback, AuditLog
    │   ├── middleware/       # JWT Auth, Role-based Access, Multer Upload
    │   ├── utils/textParser.js # Multi-format extractor (PDF pages, DOCX, TXT, CSV)
    │   ├── rag/
    │   │   ├── chunker.js    # Semantic chunking preserving page & section
    │   │   ├── embeddings.js # Gemini text-embedding-004 + dense vectorizer
    │   │   ├── bm25.js       # Okapi BM25 keyword index with stopword filtering
    │   │   ├── retrieval.js  # Hybrid RRF search & salient coverage evidence gate
    │   │   └── gemini.js     # Strict grounded generation & citation validation
    │   ├── controllers/      # Auth, Document, Chat, Feedback controllers
    │   ├── routes/           # REST endpoints
    │   └── server.js         # Express app entrypoint & seeder
    └── scripts/seedDocuments.js # Document ingestion CLI script
```

---

## 🛡️ Hallucination & Security Controls

1. **Closed Knowledge Scope**: Queries are only answered against indexed institutional chunks.
2. **Salient Keyword Coverage**: If key non-stopword query tokens (e.g. "XYZ") have 0% coverage in candidate chunks, confidence is capped at 0.
3. **Confidence Threshold Gate**: Any candidate scoring below the confidence threshold (`0.35`) triggers immediate abstention.
4. **Strict System Prompt**: Low temperature (`0.1`), explicit negative constraint forbidding outside knowledge for campus claims.
5. **Role-Based Protection**: Admin upload and deletion endpoints are strictly locked to `admin` / `faculty` JWT tokens.
