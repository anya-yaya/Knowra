// src/App.js
import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import ReactMarkdown from 'react-markdown';

function App() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sources, setSources] = useState([]);
  const [showSources, setShowSources] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check local storage or system preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const API_URL = 'http://localhost:8000';

  // Apply theme to body
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleFileUpload = async () => {
    if (!file) {
      alert('Please select a file first');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    setUploadStatus({ type: 'loading', message: 'Processing document...' });

    try {
      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      
      setUploadStatus({ 
        type: 'success', 
        message: `✅ ${data.message} (${data.chunks} chunks)`
      });
      
      // Add system message about successful upload
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'system',
        content: `📄 Document "${file.name}" uploaded successfully! You can now ask questions about it.`
      }]);
      
      setTimeout(() => setUploadStatus(null), 3000);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
    } catch (error) {
      setUploadStatus({ type: 'error', message: '❌ Upload failed: ' + error.message });
      setTimeout(() => setUploadStatus(null), 3000);
    } finally {
      setUploading(false);
    }
  };

  const handleQuery = async () => {
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputValue
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);
    setShowSources(false);

    try {
      const res = await fetch(`${API_URL}/query?q=${encodeURIComponent(inputValue)}`, {
        method: 'POST',
      });
      const data = await res.json();

      // Add assistant message
      const assistantMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        content: data.answer,
        quiz: data.quiz,
        timeline: data.timeline,
        confidence: data.confidence
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      setSources(data.sources);
      
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        type: 'error',
        content: 'Sorry, I encountered an error. Please make sure the backend is running.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleQuery();
    }
  };

  const formatDate = () => {
    const now = new Date();
    return now.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`app ${isDarkMode ? 'dark-theme' : 'light-theme'}`}>
      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">📚</span>
            <span className="logo-text">Knowra</span>
          </div>
          <div className="header-actions">
            <button 
              className="theme-toggle-btn"
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
            <button 
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? '←' : '→'}
            </button>
          </div>
        </div>

        <div className="upload-section">
          <div className="upload-area">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files[0])}
              id="file-input"
              style={{ display: 'none' }}
            />
            <button 
              className="upload-btn"
              onClick={() => fileInputRef.current.click()}
            >
              📄 {file ? file.name : 'Upload PDF'}
            </button>
            {file && (
              <button 
                className="upload-submit-btn"
                onClick={handleFileUpload}
                disabled={uploading}
              >
                {uploading ? 'Processing...' : 'Process Document'}
              </button>
            )}
          </div>
          {uploadStatus && (
            <div className={`upload-status ${uploadStatus.type}`}>
              {uploadStatus.message}
            </div>
          )}
        </div>

        <div className="sources-section">
          <div className="sources-header">
            <span>📖 Sources</span>
            <span className="sources-count">{sources.length} references</span>
          </div>
          <div className="sources-list">
            {sources.map((source, idx) => (
              <div key={idx} className="source-item">
                <div className="source-number">{idx + 1}</div>
                <div className="source-text">{source.substring(0, 150)}...</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="main-content">
        <div className="chat-header">
          <div className="chat-header-content">
            <h1>Knowra Assistant</h1>
            <p>Your intelligent document companion</p>
          </div>
          <button 
            className="mobile-theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </div>

        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="welcome-screen">
              <div className="welcome-icon">🤖</div>
              <h2>Welcome to Knowra</h2>
              <p>Upload a document and start asking questions</p>
              <div className="suggestions">
                <div className="suggestion-chip" onClick={() => setInputValue("What is this document about?")}>
                  What is this document about?
                </div>
                <div className="suggestion-chip" onClick={() => setInputValue("Summarize the key points")}>
                  Summarize the key points
                </div>
                <div className="suggestion-chip" onClick={() => setInputValue("Extract important dates")}>
                  Extract important dates
                </div>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`message ${message.type}`}>
                <div className="message-avatar">
                  {message.type === 'user' ? '👤' : 
                   message.type === 'assistant' ? '🤖' : 
                   message.type === 'system' ? 'ℹ️' : '⚠️'}
                </div>
                <div className="message-content">
                  <div className="message-header">
                    <span className="message-sender">
                      {message.type === 'user' ? 'You' : 
                       message.type === 'assistant' ? 'Knowra AI' : 
                       message.type === 'system' ? 'System' : 'Error'}
                    </span>
                    <span className="message-time">{formatDate()}</span>
                  </div>
                  <div className="message-text">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                  
                  {message.confidence && (
                    <div className="confidence-indicator">
                      <div className="confidence-bar">
                        <div 
                          className="confidence-fill"
                          style={{ width: `${message.confidence * 100}%` }}
                        />
                      </div>
                      <span>Confidence: {(message.confidence * 100).toFixed(0)}%</span>
                    </div>
                  )}

                  {(message.quiz || message.timeline) && (
                    <div className="additional-content">
                      {message.quiz && (
                        <details className="quiz-details">
                          <summary>📝 Generated Quiz</summary>
                          <div className="quiz-content">
                            <ReactMarkdown>{message.quiz}</ReactMarkdown>
                          </div>
                        </details>
                      )}
                      {message.timeline && (
                        <details className="timeline-details">
                          <summary>⏱️ Timeline</summary>
                          <div className="timeline-content">
                            <ReactMarkdown>{message.timeline}</ReactMarkdown>
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          
          {loading && (
            <div className="message assistant loading">
              <div className="message-avatar">🤖</div>
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-container">
          <div className="chat-input-wrapper">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question about your document..."
              rows="1"
              disabled={loading}
            />
            <button 
              onClick={handleQuery}
              disabled={loading || !inputValue.trim()}
              className="send-btn"
            >
              {loading ? '...' : 'Send'}
            </button>
          </div>
          <div className="input-hint">
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;