const API_BASE_URL = "http://localhost:5000/api";

const getHeaders = (isFormData = false) => {
  const token = localStorage.getItem("campusai_token");
  const headers = {};
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  // Authentication
  auth: {
    login: async (credentials) => {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(credentials),
      });
      return res.json();
    },

    register: async (userData) => {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(userData),
      });
      return res.json();
    },

    getMe: async () => {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        method: "GET",
        headers: getHeaders(),
      });
      return res.json();
    },
  },

  // Faculty Documents
  documents: {
    upload: async (formData) => {
      const res = await fetch(`${API_BASE_URL}/documents/upload`, {
        method: "POST",
        headers: getHeaders(true),
        body: formData,
      });
      return res.json();
    },

    getAll: async (params = {}) => {
      const query = new URLSearchParams(params).toString();
      const res = await fetch(`${API_BASE_URL}/documents${query ? `?${query}` : ""}`, {
        method: "GET",
        headers: getHeaders(),
      });
      return res.json();
    },

    getStats: async () => {
      const res = await fetch(`${API_BASE_URL}/documents/stats`, {
        method: "GET",
        headers: getHeaders(),
      });
      return res.json();
    },

    delete: async (id) => {
      const res = await fetch(`${API_BASE_URL}/documents/${id}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      return res.json();
    },
  },

  // Student Chat / Copilot
  chat: {
    sendQuery: async ({ studentId, studentName, sessionId, question }) => {
      const res = await fetch(`${API_BASE_URL}/chat/query`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          studentId,
          studentName,
          sessionId,
          question,
        }),
      });
      return res.json();
    },

    getHistory: async ({ studentId, sessionId }) => {
      const params = new URLSearchParams();
      if (studentId) params.append("studentId", studentId);
      if (sessionId) params.append("sessionId", sessionId);

      const res = await fetch(`${API_BASE_URL}/chat/history?${params.toString()}`, {
        method: "GET",
        headers: getHeaders(),
      });
      return res.json();
    },

    clearHistory: async ({ studentId, sessionId }) => {
      const params = new URLSearchParams();
      if (studentId) params.append("studentId", studentId);
      if (sessionId) params.append("sessionId", sessionId);

      const res = await fetch(`${API_BASE_URL}/chat/history?${params.toString()}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      return res.json();
    },

    sendFeedback: async (chatId, feedback) => {
      const res = await fetch(`${API_BASE_URL}/chat/feedback`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ chatId, feedback }),
      });
      return res.json();
    },
  },
};
