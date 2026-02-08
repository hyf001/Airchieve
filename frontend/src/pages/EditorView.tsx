
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StoryPage, StoryTemplate, ChatMessage } from '../types';
import { ChevronLeft, ChevronRight, Send, Sparkles, BookOpen, Download, RefreshCw, Palette } from 'lucide-react';
import { chatWithStoryteller, generateImage } from '../services/geminiService';

interface EditorViewProps {
  title: string;
  pages: StoryPage[];
  template: StoryTemplate;
  isGenerating: boolean;
  error: string | null;
  onBack: () => void;
  onPagesUpdate: React.Dispatch<React.SetStateAction<StoryPage[]>>;
}

const EditorView: React.FC<EditorViewProps> = ({
  title, pages, template, isGenerating, error, onBack, onPagesUpdate
}) => {
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<'next' | 'prev' | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, isTyping]);

  // Group pages into spreads (2 pages per spread: left = image, right = text)
  const spreads: StoryPage[][] = [];
  for (let i = 0; i < pages.length; i += 2) {
    spreads.push(pages.slice(i, i + 2));
  }

  const currentSpread = spreads[currentSpreadIndex];
  const nextSpreadData = spreads[currentSpreadIndex + 1];
  const prevSpreadData = spreads[currentSpreadIndex - 1];

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);

    try {
      const aiResponse = await chatWithStoryteller([], userMessage);
      setChatHistory(prev => [...prev, { role: 'model', content: aiResponse || "I'm having trouble thinking of what to say next." }]);
    } catch (err) {
      console.error(err);
      setChatHistory(prev => [...prev, { role: 'model', content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const nextSpread = useCallback(() => {
    if (currentSpreadIndex < spreads.length - 1 && !isFlipping) {
      setFlipDirection('next');
      setIsFlipping(true);
    }
  }, [currentSpreadIndex, spreads.length, isFlipping]);

  const prevSpread = useCallback(() => {
    if (currentSpreadIndex > 0 && !isFlipping) {
      setFlipDirection('prev');
      setIsFlipping(true);
    }
  }, [currentSpreadIndex, isFlipping]);

  const handleFlipEnd = () => {
    if (flipDirection === 'next') {
      setCurrentSpreadIndex(prev => prev + 1);
    } else if (flipDirection === 'prev') {
      setCurrentSpreadIndex(prev => prev - 1);
    }
    setIsFlipping(false);
    setFlipDirection(null);
  };

  const goToSpread = (idx: number) => {
    if (idx !== currentSpreadIndex && !isFlipping) {
      setCurrentSpreadIndex(idx);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextSpread();
      if (e.key === 'ArrowLeft') prevSpread();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSpread, prevSpread]);

  // --- Render helpers for page content ---
  const renderImageContent = (page: StoryPage | undefined) => {
    if (!page) return null;
    return (
      <div className="w-full h-full p-6 md:p-8 flex items-center justify-center">
        <div className="w-full h-full relative rounded-lg overflow-hidden shadow-inner bg-slate-50">
          {page.loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
              <RefreshCw className="animate-spin text-indigo-400" size={48} />
              <span className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em]">Painting Scene...</span>
            </div>
          ) : (
            <img src={page.imageUrl} alt="Story Scene" className="w-full h-full object-cover" />
          )}
        </div>
      </div>
    );
  };

  const renderTextContent = (page: StoryPage | undefined) => {
    if (!page) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center space-y-6">
            <BookOpen size={64} className="mx-auto text-slate-100" />
            <p className="text-slate-300 italic font-lexend">To be continued...</p>
          </div>
        </div>
      );
    }
    return (
      <div className="w-full h-full p-8 md:p-12 lg:p-16 flex items-center book-paper-texture">
        <div className="w-full">
          <p className="text-xl md:text-2xl lg:text-3xl text-slate-800 font-lexend leading-[1.6] first-letter:text-5xl first-letter:text-indigo-600 first-letter:font-black first-letter:mr-2 first-letter:float-left">
            {page.text}
          </p>
          {page.loading && (
            <div className="mt-8 flex items-center gap-3 text-indigo-400">
              <RefreshCw size={16} className="animate-spin" />
              <span className="text-xs font-bold uppercase tracking-widest">Typesetting...</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#E2E8F0]">
      {/* Header */}
      <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 md:px-8 z-30 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-500"
          >
            <ChevronLeft />
          </button>
          <div>
            <h1 className="font-lexend font-bold text-slate-900 truncate max-w-[200px] md:max-w-md">
              {title || 'Creating Story...'}
            </h1>
            <div className="flex items-center gap-2 text-[10px] text-indigo-500 font-black uppercase tracking-widest">
              <Palette size={10} /> {template.name}
              <span className="text-slate-300 mx-1">•</span>
              <span className="text-slate-400">{pages.filter(p => !p.loading).length} / {pages.length} Pages</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="hidden md:flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors">
            <Download size={16} />
            Export PDF
          </button>
          <button className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
            Share
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat Pane */}
        <aside className="hidden lg:flex w-[350px] border-r border-slate-200 bg-white flex-col shrink-0 relative z-20 shadow-2xl">
          <div className="p-4 border-b border-slate-100 flex items-center gap-2 text-indigo-600 bg-slate-50">
            <Sparkles size={18} />
            <h2 className="font-black text-xs uppercase tracking-widest">AI Story Assistant</h2>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
            {chatHistory.length === 0 && (
              <div className="text-center py-10 px-4">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <BookOpen size={24} />
                </div>
                <p className="text-slate-500 text-sm italic">
                  "I'm here to help you refine your story. Ask me to change a character, add a new scene, or rewrite a page!"
                </p>
              </div>
            )}

            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-700 border border-slate-100'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-2xl border border-slate-100 flex gap-1 shadow-sm">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '75ms' }} />
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-white border-t border-slate-100">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Talk to your AI co-author..."
                className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <button
                onClick={handleSendMessage}
                className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </aside>

        {/* Right: Book Workspace */}
        <main className="flex-1 relative flex flex-col items-center justify-center p-4 md:p-8 lg:p-12 overflow-hidden">
          {error && (
            <div className="absolute top-8 bg-red-50 text-red-600 px-6 py-3 rounded-full border border-red-200 font-bold text-sm z-50 animate-bounce">
              {error}
              <button onClick={onBack} className="underline font-bold ml-3">Try Again</button>
            </div>
          )}

          {/* Book Container */}
          <div className="relative w-full max-w-6xl aspect-[1.4/1] flex transition-all duration-700 group">

            {/* Navigation Left */}
            <button
              onClick={prevSpread}
              disabled={currentSpreadIndex === 0 || isFlipping}
              className="absolute -left-4 md:-left-16 top-1/2 -translate-y-1/2 p-4 bg-white/50 hover:bg-white text-slate-800 rounded-full shadow-xl transition-all z-40 disabled:opacity-0 disabled:pointer-events-none hover:scale-110 active:scale-95"
            >
              <ChevronLeft size={32} />
            </button>

            {/* The Actual Book */}
            <div className="w-full h-full bg-white rounded-xl shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] relative overflow-hidden">

              {/* Paper Stack Thickness */}
              <div className="absolute right-0 top-0 w-4 h-full bg-slate-200 border-l border-slate-300" style={{ zIndex: 50 }} />
              <div className="absolute right-1 top-0 w-2 h-full bg-slate-100 border-l border-slate-200" style={{ zIndex: 50 }} />
              <div className="absolute left-0 top-0 w-4 h-full bg-slate-200 border-r border-slate-300" style={{ zIndex: 50 }} />
              <div className="absolute left-1 top-0 w-2 h-full bg-slate-100 border-r border-slate-200" style={{ zIndex: 50 }} />

              {spreads.length > 0 ? (
                <div className="w-full h-full relative" style={{ perspective: '2500px' }}>

                  {/* ========== LAYER 0: Base spread (target revealed underneath) ========== */}
                  <div className="absolute inset-0 flex">
                    {/* Base Left */}
                    <div className="flex-1 bg-[#fffdfa] relative border-r border-slate-100 shadow-[inset_-20px_0_40px_rgba(0,0,0,0.05)]">
                      {isFlipping && flipDirection === 'next' && nextSpreadData
                        ? renderImageContent(nextSpreadData[0])
                        : isFlipping && flipDirection === 'prev' && prevSpreadData
                        ? renderImageContent(prevSpreadData[0])
                        : renderImageContent(currentSpread?.[0])
                      }
                      <div className="absolute bottom-6 left-8 text-slate-300 font-lexend text-xs font-bold">
                        {isFlipping && flipDirection === 'next'
                          ? (currentSpreadIndex + 1) * 2 + 1
                          : isFlipping && flipDirection === 'prev'
                          ? (currentSpreadIndex - 1) * 2 + 1
                          : currentSpreadIndex * 2 + 1
                        }
                      </div>
                    </div>
                    {/* Base Right */}
                    <div className="flex-1 bg-[#fffdfa] relative shadow-[inset_20px_0_40px_rgba(0,0,0,0.05)]">
                      {isFlipping && flipDirection === 'next' && nextSpreadData
                        ? renderTextContent(nextSpreadData[1])
                        : isFlipping && flipDirection === 'prev' && prevSpreadData
                        ? renderTextContent(prevSpreadData[1])
                        : renderTextContent(currentSpread?.[1])
                      }
                      <div className="absolute bottom-6 right-8 text-slate-300 font-lexend text-xs font-bold">
                        {isFlipping && flipDirection === 'next'
                          ? (currentSpreadIndex + 1) * 2 + 2
                          : isFlipping && flipDirection === 'prev'
                          ? (currentSpreadIndex - 1) * 2 + 2
                          : currentSpreadIndex * 2 + 2
                        }
                      </div>
                    </div>
                  </div>

                  {/* ========== LAYER 1: Shadow on base pages during flip ========== */}
                  {isFlipping && flipDirection === 'next' && (
                    <div className="absolute right-0 top-0 w-1/2 h-full pointer-events-none flip-shadow-reveal" style={{ zIndex: 2 }}>
                      <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />
                    </div>
                  )}
                  {isFlipping && flipDirection === 'prev' && (
                    <div className="absolute left-0 top-0 w-1/2 h-full pointer-events-none flip-shadow-reveal" style={{ zIndex: 2 }}>
                      <div className="absolute inset-0 bg-gradient-to-l from-black/20 to-transparent" />
                    </div>
                  )}

                  {/* ========== LAYER 2: Static half that stays during flip ========== */}
                  {isFlipping && flipDirection === 'next' && (
                    <div className="absolute left-0 top-0 w-1/2 h-full bg-[#fffdfa] border-r border-slate-100 shadow-[inset_-20px_0_40px_rgba(0,0,0,0.05)]" style={{ zIndex: 10 }}>
                      {renderImageContent(currentSpread?.[0])}
                      <div className="absolute bottom-6 left-8 text-slate-300 font-lexend text-xs font-bold">
                        {currentSpreadIndex * 2 + 1}
                      </div>
                    </div>
                  )}
                  {isFlipping && flipDirection === 'prev' && (
                    <div className="absolute right-0 top-0 w-1/2 h-full bg-[#fffdfa] shadow-[inset_20px_0_40px_rgba(0,0,0,0.05)]" style={{ zIndex: 10 }}>
                      {renderTextContent(currentSpread?.[1])}
                      <div className="absolute bottom-6 right-8 text-slate-300 font-lexend text-xs font-bold">
                        {currentSpreadIndex * 2 + 2}
                      </div>
                    </div>
                  )}

                  {/* ========== LAYER 3: Shadow cast on the static half by flipping page ========== */}
                  {isFlipping && flipDirection === 'next' && (
                    <div className="absolute left-0 top-0 w-1/2 h-full pointer-events-none flip-shadow-cast" style={{ zIndex: 15 }}>
                      <div className="absolute inset-0 bg-gradient-to-l from-black/25 to-transparent" />
                    </div>
                  )}
                  {isFlipping && flipDirection === 'prev' && (
                    <div className="absolute right-0 top-0 w-1/2 h-full pointer-events-none flip-shadow-cast" style={{ zIndex: 15 }}>
                      <div className="absolute inset-0 bg-gradient-to-r from-black/25 to-transparent" />
                    </div>
                  )}

                  {/* ========== LAYER 4: The flipping page (3D with front/back) ========== */}
                  {isFlipping && flipDirection === 'next' && (
                    <div
                      className="absolute right-0 top-0 w-1/2 h-full flip-to-left"
                      style={{ zIndex: 20, transformOrigin: 'left center', transformStyle: 'preserve-3d' }}
                      onAnimationEnd={handleFlipEnd}
                    >
                      {/* Front face: current right page (text) */}
                      <div
                        className="absolute inset-0 bg-[#fffdfa] shadow-[inset_20px_0_40px_rgba(0,0,0,0.05)] overflow-hidden"
                        style={{ backfaceVisibility: 'hidden' }}
                      >
                        {renderTextContent(currentSpread?.[1])}
                        <div className="absolute bottom-6 right-8 text-slate-300 font-lexend text-xs font-bold">
                          {currentSpreadIndex * 2 + 2}
                        </div>
                        {/* Gradient shading on front as it lifts */}
                        <div className="absolute inset-0 bg-gradient-to-l from-transparent to-black/5 pointer-events-none" />
                      </div>

                      {/* Back face: next left page (image) */}
                      <div
                        className="absolute inset-0 bg-[#fffdfa] border-r border-slate-100 shadow-[inset_-20px_0_40px_rgba(0,0,0,0.05)] overflow-hidden"
                        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                      >
                        {nextSpreadData && renderImageContent(nextSpreadData[0])}
                        <div className="absolute bottom-6 left-8 text-slate-300 font-lexend text-xs font-bold">
                          {(currentSpreadIndex + 1) * 2 + 1}
                        </div>
                        {/* Gradient shading on back face */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/5 pointer-events-none" />
                      </div>
                    </div>
                  )}

                  {isFlipping && flipDirection === 'prev' && (
                    <div
                      className="absolute left-0 top-0 w-1/2 h-full flip-to-right"
                      style={{ zIndex: 20, transformOrigin: 'right center', transformStyle: 'preserve-3d' }}
                      onAnimationEnd={handleFlipEnd}
                    >
                      {/* Front face: current left page (image) */}
                      <div
                        className="absolute inset-0 bg-[#fffdfa] border-r border-slate-100 shadow-[inset_-20px_0_40px_rgba(0,0,0,0.05)] overflow-hidden"
                        style={{ backfaceVisibility: 'hidden' }}
                      >
                        {renderImageContent(currentSpread?.[0])}
                        <div className="absolute bottom-6 left-8 text-slate-300 font-lexend text-xs font-bold">
                          {currentSpreadIndex * 2 + 1}
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/5 pointer-events-none" />
                      </div>

                      {/* Back face: previous right page (text) */}
                      <div
                        className="absolute inset-0 bg-[#fffdfa] shadow-[inset_20px_0_40px_rgba(0,0,0,0.05)] overflow-hidden"
                        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                      >
                        {prevSpreadData && renderTextContent(prevSpreadData[1])}
                        <div className="absolute bottom-6 right-8 text-slate-300 font-lexend text-xs font-bold">
                          {(currentSpreadIndex - 1) * 2 + 2}
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-l from-transparent to-black/5 pointer-events-none" />
                      </div>
                    </div>
                  )}

                  {/* ========== LAYER 5: Book spine (always on top) ========== */}
                  <div className="absolute left-1/2 top-0 -translate-x-1/2 w-12 h-full bg-gradient-to-r from-black/10 via-black/20 to-black/10 pointer-events-none" style={{ zIndex: 40 }} />
                  <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[1px] h-full bg-black/15 pointer-events-none" style={{ zIndex: 40 }} />

                  {/* ========== Click areas (only when not flipping) ========== */}
                  {!isFlipping && (
                    <>
                      <div onClick={prevSpread} className="absolute left-0 top-0 w-1/2 h-full cursor-pointer" style={{ zIndex: 30 }} />
                      <div onClick={nextSpread} className="absolute right-0 top-0 w-1/2 h-full cursor-pointer" style={{ zIndex: 30 }} />
                    </>
                  )}
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white">
                  <div className="text-center space-y-6 max-w-sm">
                    <div className="relative inline-block">
                      <div className="w-24 h-24 border-8 border-indigo-50 border-t-indigo-600 rounded-full animate-spin" />
                      <Sparkles className="absolute inset-0 m-auto text-indigo-600 animate-pulse" size={32} />
                    </div>
                    <h3 className="text-xl font-lexend font-bold text-slate-800">Weaving your story...</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">Turning your imagination into beautiful illustrations and typesetting. This may take a moment.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Right */}
            <button
              onClick={nextSpread}
              disabled={currentSpreadIndex >= spreads.length - 1 || isFlipping}
              className="absolute -right-4 md:-right-16 top-1/2 -translate-y-1/2 p-4 bg-white/50 hover:bg-white text-slate-800 rounded-full shadow-xl transition-all z-40 disabled:opacity-0 disabled:pointer-events-none hover:scale-110 active:scale-95"
            >
              <ChevronRight size={32} />
            </button>
          </div>

          {/* Pagination Indicators */}
          {spreads.length > 0 && (
            <div className="mt-8 md:mt-12 flex gap-3">
              {spreads.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => goToSpread(idx)}
                  className={`h-2 transition-all duration-500 rounded-full ${
                    currentSpreadIndex === idx
                      ? 'w-12 bg-indigo-600'
                      : 'w-2 bg-slate-300 hover:bg-slate-400'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Tips Overlay */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity">
            <Sparkles size={12} />
            <span>Click page edges or use arrow keys to flip</span>
          </div>
        </main>
      </div>

      <style>{`
        .book-paper-texture {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4'%3E%3Cpath fill='%23000000' fill-opacity='0.02' d='M1 3h1v1H1V3zm2-2h1v1H3V1z'%3E%3C/path%3E%3C/svg%3E");
        }

        /* === Forward flip: right page turns to the left === */
        @keyframes flipToLeft {
          0% {
            transform: rotateY(0deg);
            box-shadow: -2px 0 10px rgba(0,0,0,0.1);
          }
          30% {
            box-shadow: -15px 0 40px rgba(0,0,0,0.25);
          }
          50% {
            box-shadow: -5px 0 20px rgba(0,0,0,0.15);
          }
          70% {
            box-shadow: 15px 0 40px rgba(0,0,0,0.25);
          }
          100% {
            transform: rotateY(-180deg);
            box-shadow: 2px 0 10px rgba(0,0,0,0.1);
          }
        }
        .flip-to-left {
          animation: flipToLeft 0.75s cubic-bezier(0.4, 0.0, 0.2, 1) forwards;
        }

        /* === Backward flip: left page turns to the right === */
        @keyframes flipToRight {
          0% {
            transform: rotateY(0deg);
            box-shadow: 2px 0 10px rgba(0,0,0,0.1);
          }
          30% {
            box-shadow: 15px 0 40px rgba(0,0,0,0.25);
          }
          50% {
            box-shadow: 5px 0 20px rgba(0,0,0,0.15);
          }
          70% {
            box-shadow: -15px 0 40px rgba(0,0,0,0.25);
          }
          100% {
            transform: rotateY(180deg);
            box-shadow: -2px 0 10px rgba(0,0,0,0.1);
          }
        }
        .flip-to-right {
          animation: flipToRight 0.75s cubic-bezier(0.4, 0.0, 0.2, 1) forwards;
        }

        /* === Shadow on revealed page underneath === */
        @keyframes shadowReveal {
          0%   { opacity: 0.8; }
          40%  { opacity: 1; }
          100% { opacity: 0; }
        }
        .flip-shadow-reveal {
          animation: shadowReveal 0.75s cubic-bezier(0.4, 0.0, 0.2, 1) forwards;
        }

        /* === Shadow cast on the static page by the flipping page === */
        @keyframes shadowCast {
          0%   { opacity: 0; }
          30%  { opacity: 0.6; }
          50%  { opacity: 1; }
          70%  { opacity: 0.6; }
          100% { opacity: 0; }
        }
        .flip-shadow-cast {
          animation: shadowCast 0.75s cubic-bezier(0.4, 0.0, 0.2, 1) forwards;
        }
      `}</style>
    </div>
  );
};

export default EditorView;
