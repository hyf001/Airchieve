import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

const showcaseCards = [
  {
    icon: '\u{1F4C4}',
    tag: '\u6587\u6863\u5206\u6790',
    title: '\u5408\u540C\u98CE\u9669\u8BC4\u4F30\u62A5\u544A',
    desc: '\u81EA\u52A8\u8BC6\u522B50\u9875\u5408\u540C\u4E2D\u7684\u5173\u952E\u6761\u6B3E\uFF0C\u6807\u8BB0\u6F5C\u5728\u98CE\u9669\u70B9\uFF0C\u751F\u6210\u7ED3\u6784\u5316\u6458\u8981',
    gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
  },
  {
    icon: '\u{1F3A8}',
    tag: '\u56FE\u50CF\u5904\u7406',
    title: '\u6C34\u5F69\u753B\u98CE\u683C\u8F6C\u6362',
    desc: '\u5C06\u666E\u901A\u7167\u7247\u8F6C\u6362\u4E3A\u827A\u672F\u6C34\u5F69\u753B\u6548\u679C\uFF0C\u4FDD\u6301\u7EC6\u8282\u7684\u540C\u65F6\u589E\u6DFB\u827A\u672F\u6C14\u606F',
    gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%)',
  },
  {
    icon: '\u{1F4DA}',
    tag: '\u7ED8\u672C\u521B\u4F5C',
    title: '\u592A\u7A7A\u63A2\u9669\u513F\u7AE5\u7ED8\u672C',
    desc: '\u5B8C\u6574\u6545\u4E8B\u6587\u672C\u914DAI\u751F\u6210\u7684\u7CBE\u7F8E\u63D2\u753B\uFF0C\u9002\u54083-8\u5C81\u513F\u7AE5\u9605\u8BFB',
    gradient: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(249, 115, 22, 0.15) 100%)',
  },
  {
    icon: '\u{1F310}',
    tag: '\u7FFB\u8BD1\u8F6C\u6362',
    title: '\u6280\u672F\u6587\u6863\u4E2D\u82F1\u4E92\u8BD1',
    desc: '\u4FDD\u6301\u4E13\u4E1A\u672F\u8BED\u51C6\u786E\u6027\uFF0C\u7EF4\u6301\u539F\u6709\u683C\u5F0F\uFF0C\u652F\u6301\u6279\u91CF\u5904\u7406',
    gradient: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(217, 70, 239, 0.15) 100%)',
  },
  {
    icon: '\u{1F4CA}',
    tag: '\u6570\u636E\u63D0\u53D6',
    title: '\u8D22\u62A5\u6570\u636E\u7ED3\u6784\u5316',
    desc: '\u4ECEPDF\u8D22\u62A5\u4E2D\u63D0\u53D6\u5173\u952E\u8D22\u52A1\u6570\u636E\uFF0C\u81EA\u52A8\u751F\u6210Excel\u8868\u683C',
    gradient: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(217, 119, 6, 0.15) 100%)',
  },
  {
    icon: '\u270D\uFE0F',
    tag: '\u5185\u5BB9\u751F\u6210',
    title: '\u8425\u9500\u6587\u6848\u521B\u4F5C',
    desc: '\u6839\u636E\u4EA7\u54C1\u7279\u70B9\u751F\u6210\u591A\u4E2A\u7248\u672C\u7684\u8425\u9500\u6587\u6848\uFF0C\u9002\u914D\u4E0D\u540C\u6E20\u9053',
    gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%)',
  },
];

const quickPrompts: Record<string, string> = {
  doc: '\u8BF7\u5206\u6790\u8FD9\u4EFD\u6587\u6863\uFF0C\u63D0\u53D6\u5173\u952E\u4FE1\u606F\u548C\u8981\u70B9\u6458\u8981',
  image: '\u8BF7\u5206\u6790\u8FD9\u5F20\u56FE\u7247\uFF0C\u5E76\u5E94\u7528\u827A\u672F\u98CE\u683C\u8F6C\u6362',
  story: '\u8BF7\u521B\u4F5C\u4E00\u4E2A\u513F\u7AE5\u7ED8\u672C\u6545\u4E8B\uFF0C\u4E3B\u9898\u662F\uFF1A',
  translate: '\u8BF7\u5C06\u6587\u6863\u7FFB\u8BD1\u6210\u82F1\u6587\uFF0C\u4FDD\u6301\u539F\u6709\u683C\u5F0F',
};

export function LandingPage() {
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState('');
  const [dragover, setDragover] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const setQuickPrompt = (type: string) => {
    setInputValue(quickPrompts[type] || '');
  };

  const handleStartProcessing = () => {
    navigate('/workspace');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.metaKey && e.key === 'Enter') {
      handleStartProcessing();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragover(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragover(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragover(false);
    navigate('/workspace');
  };

  // Duplicate cards for infinite scroll
  const allCards = [...showcaseCards, ...showcaseCards];

  return (
    <div className="landing-page">
      {/* Background Elements */}
      <div className="landing-bg-pattern" />
      <div className="landing-orb landing-orb-1" />
      <div className="landing-orb landing-orb-2" />
      <div className="landing-orb landing-orb-3" />

      <div className="landing-container">
        {/* Header */}
        <header className="landing-header">
          <div className="landing-logo">
            <div className="landing-logo-icon">{'\u{1F4E6}'}</div>
            <span className="landing-logo-text">Airchieve</span>
            <span className="landing-badge">Beta</span>
          </div>
        </header>

        {/* Hero Section */}
        <section className="landing-hero">
          <h1>AI{'\u9A71\u52A8\u7684\u667A\u80FD\u5F52\u6863'}</h1>
          <p className="landing-hero-subtitle">
            {'\u8BA9AI\u5E2E\u4F60\u5904\u7406\u6587\u6863\u3001\u56FE\u7247\u548C\u521B\u4F5C\u5185\u5BB9\u3002\u81EA\u52A8\u5206\u6790\u3001\u667A\u80FD\u5F52\u6863\u3001\u521B\u610F\u751F\u6210\u3002'}
          </p>
        </section>

        {/* Main Input Card */}
        <div className="landing-input-card">
          <label className="landing-input-label">
            {'\u2728 \u8F93\u5165\u4F60\u7684\u521B\u4F5C\u9700\u6C42'}
          </label>

          <textarea
            className="landing-main-textarea"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={'\u63CF\u8FF0\u4F60\u60F3\u8981\u5B8C\u6210\u7684\u4EFB\u52A1...\n\n\u4F8B\u5982\uFF1A\n\u2022 \u5206\u6790\u8FD9\u4EFDPDF\u5408\u540C\u7684\u98CE\u9669\u6761\u6B3E\n\u2022 \u5C06\u56FE\u7247\u8F6C\u6362\u4E3A\u6C34\u5F69\u753B\u98CE\u683C\n\u2022 \u521B\u4F5C\u4E00\u4E2A\u592A\u7A7A\u63A2\u9669\u7684\u513F\u7AE5\u7ED8\u672C'}
          />

          <div className="landing-quick-actions">
            <button className="landing-quick-btn" onClick={() => setQuickPrompt('doc')}>
              {'\u{1F4C4} \u6587\u6863\u5206\u6790'}
            </button>
            <button className="landing-quick-btn" onClick={() => setQuickPrompt('image')}>
              {'\u{1F3A8} \u56FE\u50CF\u5904\u7406'}
            </button>
            <button className="landing-quick-btn" onClick={() => setQuickPrompt('story')}>
              {'\u{1F4DA} \u7ED8\u672C\u521B\u4F5C'}
            </button>
            <button className="landing-quick-btn" onClick={() => setQuickPrompt('translate')}>
              {'\u{1F310} \u7FFB\u8BD1\u8F6C\u6362'}
            </button>
          </div>

          <div
            className={`landing-upload-zone ${dragover ? 'dragover' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="landing-upload-icon">{'\u{1F4CE}'}</div>
            <div className="landing-upload-text">{'\u70B9\u51FB\u4E0A\u4F20\u6587\u4EF6\u6216\u62D6\u62FD\u5230\u6B64\u5904'}</div>
            <div className="landing-upload-hint">{'\u652F\u6301 PDF\u3001Word\u3001\u56FE\u7247\u7B49\u591A\u79CD\u683C\u5F0F'}</div>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            multiple
            onChange={() => navigate('/workspace')}
          />

          <button className="landing-btn-primary" onClick={handleStartProcessing}>
            {'\u5F00\u59CB\u5904\u7406 \u2192'}
          </button>
        </div>

        {/* Showcase Section */}
        <section className="landing-showcase-section">
          <div className="landing-showcase-header">
            <h2 className="landing-showcase-title">AI{'\u521B\u4F5C\u6210\u679C\u5C55\u793A'}</h2>
            <p className="landing-showcase-subtitle">{'\u770B\u770B Airchieve \u80FD\u4E3A\u4F60\u521B\u9020\u4EC0\u4E48'}</p>
          </div>

          <div className="landing-showcase-scroll-wrapper">
            <div className="landing-showcase-track">
              {allCards.map((card, index) => (
                <div className="landing-showcase-card" key={index}>
                  <div
                    className="landing-showcase-image"
                    style={{ background: card.gradient }}
                  >
                    <div className="landing-showcase-image-icon">{card.icon}</div>
                  </div>
                  <div className="landing-showcase-content">
                    <span className="landing-showcase-tag">{card.tag}</span>
                    <h3 className="landing-showcase-card-title">{card.title}</h3>
                    <p className="landing-showcase-card-desc">{card.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="landing-footer">
          <p>&copy; 2024 Airchieve. Powered by AI Technology.</p>
        </footer>
      </div>
    </div>
  );
}
