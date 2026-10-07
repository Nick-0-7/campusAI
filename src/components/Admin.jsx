import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import "../templates/admin.css";

const Admin = () => {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalUsers: 2,
    totalDocuments: 3,
    totalQueries: 0,
    abstentionCount: 0,
    groundingRate: 100,
    positiveFeedback: 0,
    negativeFeedback: 0,
  });

  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  // Form State
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("Academic Affairs");
  const [category, setCategory] = useState("Examination");
  const [version, setVersion] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);

  // Chunk Modal
  const [inspectedDoc, setInspectedDoc] = useState(null);
  const [sampleChunks, setSampleChunks] = useState([]);
  const [loadingChunks, setLoadingChunks] = useState(false);

  // Error Modal
  const [inspectedErrorDoc, setInspectedErrorDoc] = useState(null);
  const [reprocessingId, setReprocessingId] = useState(null);

  // Feature 7: Knowledge Gap & Query Topic Analytics
  const [topicDistribution, setTopicDistribution] = useState({});
  const [knowledgeGaps, setKnowledgeGaps] = useState([]);

  // Feature 4: Policy Version Comparison / Diff Analyzer State
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [diffDoc1, setDiffDoc1] = useState("");
  const [diffDoc2, setDiffDoc2] = useState("");
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffResult, setDiffResult] = useState(null);

  useEffect(() => {
    // Auth & Role check
    const token = localStorage.getItem("campusai_token");
    const stored = localStorage.getItem("campusai_user");

    if (!token || !stored) {
      navigate("/login");
      return;
    }

    const user = JSON.parse(stored);
    if (user.role !== "admin" && user.role !== "faculty") {
      alert("Access Denied: Admin privileges required.");
      navigate("/chat");
      return;
    }

    loadDashboardData();
  }, [navigate]);

  const loadDashboardData = async () => {
    try {
      setLoadingDocs(true);
      const [docsRes, statsRes] = await Promise.all([
        api.listDocuments(),
        api.getAdminStats(),
      ]);

      if (docsRes.documents) {
        setDocuments(docsRes.documents);
        if (docsRes.documents.length >= 2) {
          setDiffDoc1(docsRes.documents[0]._id);
          setDiffDoc2(docsRes.documents[1]._id);
        } else if (docsRes.documents.length === 1) {
          setDiffDoc1(docsRes.documents[0]._id);
          setDiffDoc2(docsRes.documents[0]._id);
        }
      }
      if (statsRes.stats) setStats(statsRes.stats);
      if (statsRes.topicDistribution) setTopicDistribution(statsRes.topicDistribution);
      if (statsRes.knowledgeGaps) setKnowledgeGaps(statsRes.knowledgeGaps);
    } catch (err) {
      console.warn("Failed to load admin dashboard data:", err);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleRunDiff = async () => {
    if (!diffDoc1) return;
    setDiffLoading(true);
    setDiffResult(null);
    try {
      const res = await api.compareDocuments({ doc1Id: diffDoc1, doc2Id: diffDoc2 });
      if (res && res.success && res.comparison) {
        setDiffResult(res.comparison);
      } else {
        alert(res?.message || "Failed to analyze policy comparison");
      }
    } catch (err) {
      alert("Error analyzing policy comparison: " + err.message);
    } finally {
      setDiffLoading(false);
    }
  };

  const handlePrefillGapUpload = (gap) => {
    setTitle(gap.recommendedDoc.replace(/\.[^/.]+$/, ""));
    setCategory("General");
    window.scrollTo({ top: 400, behavior: "smooth" });
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      if (!title) {
        setTitle(selected.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setUploadStatus({ type: "error", message: "Please select a document file" });
      return;
    }

    setUploading(true);
    setUploadStatus(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);
    formData.append("department", department);
    formData.append("category", category);
    formData.append("version", version);

    try {
      await api.uploadDocument(formData);
      setUploadStatus({
        type: "success",
        message: `Successfully uploaded ${title}. Ingestion and chunking initiated!`,
      });
      setFile(null);
      setTitle("");
      // Refresh documents
      setTimeout(() => loadDashboardData(), 1200);
    } catch (err) {
      setUploadStatus({ type: "error", message: err.message || "Upload failed" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm("Are you sure you want to delete this document and its indexed vectors?")) {
      return;
    }

    try {
      await api.deleteDocument(docId);
      loadDashboardData();
    } catch (err) {
      alert("Failed to delete document: " + err.message);
    }
  };

  const handleReprocess = async (docId) => {
    setReprocessingId(docId);
    try {
      await api.reprocessDocument(docId);
      setTimeout(() => loadDashboardData(), 1000);
    } catch (err) {
      alert("Failed to re-process document: " + err.message);
    } finally {
      setReprocessingId(null);
    }
  };

  const handleInspectChunks = async (doc) => {
    setInspectedDoc(doc);
    setLoadingChunks(true);
    try {
      const res = await api.getDocumentDetails(doc._id);
      setSampleChunks(res.sampleChunks || []);
    } catch (err) {
      alert("Failed to fetch chunks: " + err.message);
    } finally {
      setLoadingChunks(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("campusai_token");
    localStorage.removeItem("campusai_user");
    navigate("/login");
  };

  return (
    <div className="admin-page">
      {/* Header */}
      <header className="admin-header">
        <div className="admin-logo" onClick={() => navigate("/")}>
          <div className="logo-icon">S</div>
          <span>Saarthi AI</span>
          <span className="admin-badge">Admin Knowledge Hub</span>
        </div>

        <div className="admin-actions">
          <button
            className="admin-nav-btn"
            style={{ borderColor: "#555ce0", color: "#a5b4fc" }}
            onClick={() => setIsDiffModalOpen(true)}
          >
            ⚖️ Policy Diff Analyzer
          </button>
          <button className="admin-nav-btn" onClick={() => navigate("/chat")}>
            Student Chat View ↗
          </button>
          <button className="admin-nav-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="admin-main">
        {/* Metric Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-title">Indexed Documents</span>
            <span className="stat-value">{stats.totalDocuments}</span>
            <span className="stat-meta">Institutional Knowledge Base</span>
          </div>

          <div className="stat-card">
            <span className="stat-title">Grounding Rate</span>
            <span className="stat-value">{stats.groundingRate}%</span>
            <span className="stat-meta">Zero Hallucinations Verified</span>
          </div>

          <div className="stat-card">
            <span className="stat-title">Queries Handled</span>
            <span className="stat-value">{stats.totalQueries}</span>
            <span className="stat-meta">
              {stats.abstentionCount} Abstentions ("No Evidence")
            </span>
          </div>

          <div className="stat-card">
            <span className="stat-title">Student Feedback</span>
            <span className="stat-value">
              {stats.positiveFeedback + stats.negativeFeedback > 0
                ? `${Math.round(
                    (stats.positiveFeedback /
                      (stats.positiveFeedback + stats.negativeFeedback)) *
                      100
                  )}% Positive`
                : "100% Positive"}
            </span>
            <span className="stat-meta">
              👍 {stats.positiveFeedback} &nbsp; 👎 {stats.negativeFeedback}
            </span>
          </div>
        </div>

        {/* ====================================================================
            FEATURE 7: INSTITUTIONAL INQUIRIES HEATMAP & KNOWLEDGE GAPS
            ==================================================================== */}
        <div className="admin-analytics-grid">
          {/* Left: Topic Popularity Heatmap */}
          <div className="admin-card">
            <h2 className="card-title">Institutional Inquiries Heatmap</h2>
            <p className="card-subtitle">
              Live topic volume distribution from campus student queries
            </p>
            <div className="topic-heatmap-list">
              {Object.entries(topicDistribution).length > 0 ? (
                Object.entries(topicDistribution).map(([topic, count], idx) => {
                  const maxVal = Math.max(...Object.values(topicDistribution), 1);
                  const pct = Math.round((count / maxVal) * 100);
                  return (
                    <div key={idx} className="topic-heatmap-item">
                      <div className="topic-label-row">
                        <span>{topic}</span>
                        <span>{count} inquiries</span>
                      </div>
                      <div className="topic-progress-bar">
                        <div className="topic-progress-fill" style={{ width: `${Math.max(pct, 12)}%` }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ color: "#8c8d98", fontSize: "13px", padding: "10px 0" }}>
                  Analyzing student query trends...
                </div>
              )}
            </div>
          </div>

          {/* Right: Actionable Knowledge Gaps */}
          <div className="admin-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 className="card-title">Actionable Knowledge Gaps</h2>
              <span className="gap-badge High">
                {knowledgeGaps.length} Missing Topics
              </span>
            </div>
            <p className="card-subtitle">
              Student questions that resulted in "No Evidence" abstention. Uploading recommended circulars will resolve these gaps.
            </p>

            <div className="knowledge-gap-cards">
              {knowledgeGaps.map((gap, idx) => (
                <div key={idx} className="gap-card">
                  <div className="gap-card-header">
                    <span className="gap-card-title">{gap.topic}</span>
                    <span className={`gap-badge ${gap.urgency}`}>{gap.urgency} Priority</span>
                  </div>
                  <p className="gap-query-sample">"{gap.sampleQuery}"</p>
                  <div className="gap-card-footer">
                    <span>Target: <strong>{gap.recommendedDoc}</strong></span>
                    <button
                      className="gap-upload-action"
                      onClick={() => handlePrefillGapUpload(gap)}
                    >
                      + Upload This File
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Two Column Grid */}
        <div className="admin-section-grid">
          {/* Document Ingestion Card */}
          <div className="admin-card">
            <h2 className="card-title">Upload Institutional Document</h2>
            <p className="card-subtitle">
              Upload PDF, DOCX, TXT, or CSV files. Text will be extracted, semantically chunked, embedded, and indexed with page citations.
            </p>

            {uploadStatus && (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "8px",
                  marginBottom: "16px",
                  fontSize: "13px",
                  background:
                    uploadStatus.type === "success"
                      ? "rgba(16, 185, 129, 0.12)"
                      : "rgba(239, 68, 68, 0.12)",
                  color: uploadStatus.type === "success" ? "#10b981" : "#f87171",
                  border: `1px solid ${
                    uploadStatus.type === "success" ? "#10b981" : "#ef4444"
                  }`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                }}
              >
                <span>{uploadStatus.message}</span>
                {uploadStatus.message.toLowerCase().includes("token") && (
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem("campusai_token");
                      localStorage.removeItem("campusai_user");
                      navigate("/login");
                    }}
                    style={{
                      background: "#ef4444",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "5px 10px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Re-login ↗
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="upload-form">
              <div className="form-group">
                <label>Document Title</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Attendance Policy 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Department</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Academic Affairs"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Knowledge Category</label>
                <select
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="Examination">Examination & Regulations</option>
                  <option value="Attendance">Attendance Policies</option>
                  <option value="Scholarship">Scholarships & Financial Aid</option>
                  <option value="Placements">Career & Placements</option>
                  <option value="Academic">Academic Handbook</option>
                  <option value="General">General Campus Policies</option>
                </select>
              </div>

              <div className="form-group">
                <label>Document Version</label>
                <input
                  type="number"
                  min="1"
                  className="form-input"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Select File (PDF, DOCX, TXT, CSV)</label>
                <label className="file-dropzone">
                  <div className="dropzone-icon">📁</div>
                  <div className="dropzone-text">
                    {file ? file.name : "Click to select or drag and drop"}
                  </div>
                  <div className="dropzone-sub">
                    PDF (page-tracked), DOCX, TXT, CSV (up to 25MB)
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.csv"
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                  />
                </label>
              </div>

              <button
                type="submit"
                className="upload-submit-btn"
                disabled={uploading || !file}
              >
                {uploading ? "Ingesting & Chunking..." : "Process & Index Document"}
              </button>
            </form>
          </div>

          {/* Document Inventory Card */}
          <div className="admin-card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "16px",
              }}
            >
              <div>
                <h2 className="card-title">Indexed Institutional Knowledge</h2>
                <p className="card-subtitle" style={{ margin: 0 }}>
                  Active institutional documents ready for RAG hybrid retrieval
                </p>
              </div>
              <button
                className="admin-nav-btn"
                style={{ fontSize: "12px", padding: "6px 10px" }}
                onClick={loadDashboardData}
              >
                ↻ Refresh
              </button>
            </div>

            <div className="documents-table-wrapper">
              {loadingDocs ? (
                <div style={{ padding: "30px", textAlign: "center", color: "#8c8d98" }}>
                  Loading document database...
                </div>
              ) : documents.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#8c8d98" }}>
                  No institutional documents uploaded yet.
                </div>
              ) : (
                <table className="documents-table">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Category</th>
                      <th>Ver</th>
                      <th>Chunks</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc._id}>
                        <td>
                          <div className="doc-name-cell">
                            <span>📄</span>
                            <span>{doc.title}</span>
                          </div>
                        </td>
                        <td>
                          <span className="category-badge">{doc.category}</span>
                        </td>
                        <td>v{doc.currentVersion}</td>
                        <td>{doc.chunkCount}</td>
                        <td>
                          <span className={`status-badge ${doc.status}`}>
                            {doc.status}
                          </span>
                        </td>
                        <td>
                          {doc.status === "failed" ? (
                            <>
                              <button
                                className="table-btn"
                                style={{ borderColor: "#ef4444", color: "#f87171" }}
                                onClick={() => setInspectedErrorDoc(doc)}
                              >
                                View Error
                              </button>
                              <button
                                className="table-btn"
                                onClick={() => handleReprocess(doc._id)}
                                disabled={reprocessingId === doc._id}
                              >
                                {reprocessingId === doc._id ? "Processing..." : "Retry"}
                              </button>
                            </>
                          ) : (
                            <button
                              className="table-btn"
                              onClick={() => handleInspectChunks(doc)}
                            >
                              Inspect Chunks
                            </button>
                          )}
                          <button
                            className="table-btn"
                            title="Compare this policy version with another document"
                            onClick={() => {
                              setDiffDoc1(doc._id);
                              setIsDiffModalOpen(true);
                            }}
                          >
                            ⚖️ Diff
                          </button>
                          <button
                            className="table-btn delete"
                            onClick={() => handleDelete(doc._id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Error Details Modal */}
      {inspectedErrorDoc && (
        <div className="modal-overlay" onClick={() => setInspectedErrorDoc(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: "640px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title" style={{ color: "#f87171" }}>
                ⚠️ Ingestion Error: {inspectedErrorDoc.title}
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setInspectedErrorDoc(null)}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                borderRadius: "8px",
                padding: "14px",
                color: "#fca5a5",
                fontSize: "13px",
                marginBottom: "16px",
                lineHeight: "1.5",
              }}
            >
              <strong>Reason:</strong> {inspectedErrorDoc.errorMessage || "No digital text characters extracted"}
            </div>

            <div style={{ fontSize: "13px", color: "#c6c7d2", lineHeight: "1.6" }}>
              <strong style={{ color: "#ffffff" }}>Why this happens:</strong>
              <p style={{ marginTop: "4px", marginBottom: "12px" }}>
                This PDF is composed of scanned images or raster graphics without a native digital text layer (0 selectable text characters). Standard PDF text extractors cannot read scanned pixels without OCR.
              </p>

              <strong style={{ color: "#ffffff" }}>How to resolve:</strong>
              <ul style={{ paddingLeft: "20px", marginTop: "6px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <li>
                  <strong>Option 1 (Automated Gemini OCR):</strong> Set your <code>GEMINI_API_KEY</code> in <code>Backend/.env</code>. CampusAI will automatically invoke Gemini Multimodal vision to OCR and index scanned pages.
                </li>
                <li>
                  <strong>Option 2 (Searchable PDF):</strong> Save/export the document with a digital text layer (OCR-enabled PDF) or upload a DOCX, TXT, or CSV version.
                </li>
              </ul>
            </div>

            <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                className="table-btn"
                onClick={() => setInspectedErrorDoc(null)}
              >
                Close
              </button>
              <button
                className="table-btn"
                style={{ background: "#555ce0", color: "#ffffff", borderColor: "#555ce0" }}
                onClick={() => {
                  const id = inspectedErrorDoc._id;
                  setInspectedErrorDoc(null);
                  handleReprocess(id);
                }}
              >
                Retry Ingestion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chunk Inspector Modal */}
      {inspectedDoc && (
        <div className="modal-overlay" onClick={() => setInspectedDoc(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: "720px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title">
                🔍 Inspecting RAG Chunks: {inspectedDoc.title}
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setInspectedDoc(null)}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "12.5px", color: "#8c8d98", marginBottom: "14px" }}>
              Total indexed chunks: {inspectedDoc.chunkCount} | Preserves page number, section heading, and dense embedding vectors.
            </p>

            {loadingChunks ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#8c8d98" }}>
                Loading chunks...
              </div>
            ) : sampleChunks.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#8c8d98" }}>
                No chunks found for this document.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "420px", overflowY: "auto" }}>
                {sampleChunks.map((chunk, cIdx) => (
                  <div
                    key={cIdx}
                    style={{
                      background: "#08090d",
                      border: "1px solid #1a1b24",
                      borderRadius: "8px",
                      padding: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "6px",
                        fontSize: "11px",
                      }}
                    >
                      <span className="meta-tag">Chunk #{chunk.chunkIndex}</span>
                      <span className="meta-tag">Page {chunk.pageNumber}</span>
                      <span className="meta-tag">Section: {chunk.section}</span>
                    </div>
                    <div style={{ fontSize: "12.5px", color: "#c6c7d2", lineHeight: "1.5" }}>
                      {chunk.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
          FEATURE 4: POLICY VERSION DIFF ANALYZER MODAL
          ==================================================================== */}
      {isDiffModalOpen && (
        <div className="modal-overlay" onClick={() => setIsDiffModalOpen(false)}>
          <div className="diff-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span>⚖️</span>
                <span>Policy Version Comparison & Diff Analyzer</span>
              </div>
              <button className="modal-close-btn" onClick={() => setIsDiffModalOpen(false)}>
                ✕
              </button>
            </div>

            <div className="diff-modal-body">
              <p style={{ fontSize: "12.5px", color: "#a0a1ae", margin: 0 }}>
                Compare two institutional policies or document versions side-by-side. Gemini AI cross-references clauses to extract added regulations, modified dates/thresholds, and impact on students & faculty.
              </p>

              <div className="diff-selector-row">
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: "12px", color: "#8c8d98" }}>Document A (Base Version)</label>
                  <select
                    className="form-select"
                    value={diffDoc1}
                    onChange={(e) => setDiffDoc1(e.target.value)}
                  >
                    {documents.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.title} (v{d.currentVersion})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: "12px", color: "#8c8d98" }}>Document B (Revised Version)</label>
                  <select
                    className="form-select"
                    value={diffDoc2}
                    onChange={(e) => setDiffDoc2(e.target.value)}
                  >
                    {documents.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.title} (v{d.currentVersion})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  className="upload-submit-btn"
                  style={{ padding: "10px 18px", marginTop: 0 }}
                  onClick={handleRunDiff}
                  disabled={diffLoading || !diffDoc1}
                >
                  {diffLoading ? "Analyzing Diff..." : "Run Policy Diff"}
                </button>
              </div>

              {diffResult && (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {/* Executive Summary */}
                  <div className="diff-section-box">
                    <div className="diff-section-title" style={{ color: "#a5b4fc" }}>
                      📋 Executive Summary of Changes
                    </div>
                    <p style={{ fontSize: "13.5px", color: "#e2e8f0", lineHeight: 1.5, margin: 0 }}>
                      {diffResult.diff.summary}
                    </p>
                  </div>

                  {/* Additions (+) */}
                  {diffResult.diff.additions?.length > 0 && (
                    <div className="diff-section-box">
                      <div className="diff-section-title" style={{ color: "#22c55e" }}>
                        (+) Added Policies & New Provisions
                      </div>
                      {diffResult.diff.additions.map((item, idx) => (
                        <div key={idx} className="diff-item added">
                          + {item}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Modifications (Δ) */}
                  {diffResult.diff.modifications?.length > 0 && (
                    <div className="diff-section-box">
                      <div className="diff-section-title" style={{ color: "#f59e0b" }}>
                        (Δ) Modified Deadlines, Fees & Clauses
                      </div>
                      {diffResult.diff.modifications.map((item, idx) => (
                        <div key={idx} className="diff-item modified">
                          Δ {item}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Deletions (-) */}
                  {diffResult.diff.deletions?.length > 0 && (
                    <div className="diff-section-box">
                      <div className="diff-section-title" style={{ color: "#ef4444" }}>
                        (-) Removed or Relaxed Regulations
                      </div>
                      {diffResult.diff.deletions.map((item, idx) => (
                        <div key={idx} className="diff-item deleted">
                          - {item}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Impact Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div className="diff-section-box">
                      <div className="diff-section-title" style={{ color: "#38bdf8" }}>
                        🎓 Student Impact
                      </div>
                      <p style={{ fontSize: "12.5px", color: "#cbd5e1", margin: 0, lineHeight: 1.5 }}>
                        {diffResult.diff.studentImpact}
                      </p>
                    </div>

                    <div className="diff-section-box">
                      <div className="diff-section-title" style={{ color: "#c084fc" }}>
                        🏛️ Faculty & Admin Directives
                      </div>
                      <p style={{ fontSize: "12.5px", color: "#cbd5e1", margin: 0, lineHeight: 1.5 }}>
                        {diffResult.diff.facultyImpact}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ borderTop: "1px solid #1e202b", padding: "14px 20px" }}>
              <button className="table-btn" onClick={() => setIsDiffModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
