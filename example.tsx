
import React, { useState, useEffect, useRef } from 'react';
import { StoryPage, StoryTemplate, ChatMessage } from '../types';
import { ChevronLeft, ChevronRight, Send, Sparkles, BookOpen, Download, RefreshCw, Palette, UserCircle, ShieldCheck, Anchor } from 'lucide-react';
// Note: chatWithStoryteller function has been removed as chat functionality is no longer supported

interface EditorViewProps {
  title: string;
  characterProfile: string;
  characterSheet: string | null;
  pages: StoryPage[];
  template: StoryTemplate;
  isGenerating: boolean;
  error: string | null;
  onBack: () => void;
  onPagesUpdate: React.Dispatch<React.SetStateAction<StoryPage[]>>;
}

const EditorView: React.FC<EditorViewProps> = ({ 
  title, characterProfile, characterSheet, pages, template, isGenerating, error, onBack 
}) => {
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chatHistory, isTyping]);

  // Group pages into spreads (2 pages per spread)
  const spreads = [];
  for (let i = 0; i < pages.length; i += 2) {
    spreads.push(pages.slice(i, i + 2));
  }

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', content: msg }]);
    setIsTyping(true);
    try {
      // Chat functionality has been removed
      // The storybook editing is now handled through the storybook API endpoints
      setChatHistory(prev => [...prev, { role: 'model', content: "对话功能已移除，请使用绘本编辑API进行故事修改。" }]);
    } catch {
      setChatHistory(prev => [...prev, { role: 'model', content: "抱歉，出错了。" }]);
    } finally {
      setIsTyping(false);
    }
  };

  const nextSpread = () => {
    if (currentSpreadIndex < spreads.length - 1) {
      setCurrentSpreadIndex(prev => prev + 1);
    }
  };

  const prevSpread = () => {
    if (currentSpreadIndex > 0) {
      setCurrentSpreadIndex(prev => prev - 1);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#E2E8F0]">
      {/* Header */}
      <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 z-30 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-500"><ChevronLeft /></button>
          <div>
            <h1 className="font-lexend font-bold text-slate-900 truncate max-w-xs">{title || '绘本创作中...'}</h1>
            <div className="flex items-center gap-2 text-[10px] text-indigo-500 font-black uppercase tracking-widest">
              <Palette size={10} /> {template.name}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <div className="text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
             进度: {pages.filter(p => !p.loading).length} / {pages.length} 页
           </div>
           <button className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">导出 PDF</button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden lg:flex w-[350px] border-r border-slate-200 bg-white flex-col shrink-0 relative z-20 shadow-2xl">
          <div className="p-5 border-b border-slate-100 bg-slate-50">
            <h2 className="flex items-center gap-2 text-slate-800 font-black text-xs uppercase tracking-widest mb-4">
              <ShieldCheck size={16} className="text-indigo-600" /> 视觉锚点
            </h2>
            
            {characterSheet ? (
              <div className="space-y-3">
                <div className="relative aspect-square bg-white rounded-2xl overflow-hidden border-2 border-slate-200 shadow-inner group">
                   <img src={characterSheet} alt="Character Anchor" className="w-full h-full object-cover" />
                   <div className="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                   <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur p-1.5 rounded-lg shadow-sm">
                      <Anchor size={12} className="text-indigo-600" />
                   </div>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed italic bg-white p-3 rounded-xl border border-slate-100 line-clamp-3">"{characterProfile}"</p>
              </div>
            ) : (
              <div className="aspect-square bg-slate-100 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-slate-200 text-slate-400">
                <RefreshCw size={24} className="animate-spin mb-2" />
                <span className="text-[10px] font-bold">生成全局视觉中...</span>
              </div>
            )}
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/30">
            {chatHistory.length === 0 && (
              <div className="text-center py-10">
                <Sparkles size={24} className="mx-auto text-indigo-200 mb-3" />
                <p className="text-[11px] text-slate-400 uppercase tracking-widest font-bold">AI 编辑已就绪</p>
              </div>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border border-slate-100'}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isTyping && <div className="text-[10px] text-indigo-500 font-bold animate-pulse">正在输入建议...</div>}
          </div>

          <div className="p-4 bg-white border-t border-slate-100">
            <div className="flex gap-2">
              <input 
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-indigo-100"
                placeholder="在此处调整故事细节..."
              />
              <button onClick={handleSendMessage} className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all"><Send size={16} /></button>
            </div>
          </div>
        </aside>

        {/* Book Workspace */}
        <main className="flex-1 relative flex flex-col items-center justify-center p-4 md:p-8 lg:p-12 overflow-hidden">
          {error && (
             <div className="absolute top-8 bg-red-50 text-red-600 px-6 py-3 rounded-full border border-red-200 font-bold text-sm z-50 animate-bounce">
               {error}
             </div>
          )}

          {/* Book Container */}
          <div className="relative w-full max-w-6xl aspect-[1.4/1] flex transition-all duration-700 group">
            
            {/* Navigation Left */}
            <button 
              onClick={prevSpread}
              disabled={currentSpreadIndex === 0}
              className={`absolute -left-4 md:-left-16 top-1/2 -translate-y-1/2 p-4 bg-white/50 hover:bg-white text-slate-800 rounded-full shadow-xl transition-all z-40 disabled:opacity-0 disabled:pointer-events-none hover:scale-110 active:scale-95`}
            >
              <ChevronLeft size={32} />
            </button>

            {/* The Actual Book */}
            <div className="w-full h-full bg-white rounded-xl shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] flex relative overflow-hidden perspective-2000">
              
              {/* Paper Stack Thickness (Right Side) */}
              <div className="absolute right-0 top-0 w-4 h-full bg-slate-200 border-l border-slate-300 z-10"></div>
              <div className="absolute right-1 top-0 w-2 h-full bg-slate-100 border-l border-slate-200 z-10"></div>

              {/* Spread Rendering */}
              {spreads.length > 0 ? (
                <div className="w-full h-full flex animate-in fade-in zoom-in duration-500">
                  {/* Left Page (Image) */}
                  <div 
                    onClick={prevSpread}
                    className="flex-1 bg-[#fffdfa] relative border-r border-slate-100 shadow-[inset_-20px_0_40px_rgba(0,0,0,0.05)] cursor-pointer group/page"
                  >
                    {spreads[currentSpreadIndex][0] && (
                      <div className="w-full h-full p-8 flex items-center justify-center">
                        <div className="w-full h-full relative rounded-lg overflow-hidden shadow-inner bg-slate-50">
                          {spreads[currentSpreadIndex][0].loading ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                               <RefreshCw className="animate-spin text-indigo-400" size={48} />
                               <span className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em]">绘制插画中...</span>
                            </div>
                          ) : (
                            <img 
                              src={spreads[currentSpreadIndex][0].imageUrl} 
                              alt="Story Scene" 
                              className="w-full h-full object-cover transition-transform duration-1000 group-hover/page:scale-105"
                            />
                          )}
                        </div>
                      </div>
                    )}
                    {/* Page Number Left */}
                    <div className="absolute bottom-6 left-8 text-slate-300 font-lexend text-xs font-bold">
                      {currentSpreadIndex * 2 + 1}
                    </div>
                  </div>

                  {/* Book Spine (Middle) */}
                  <div className="absolute left-1/2 top-0 -translate-x-1/2 w-12 h-full bg-gradient-to-r from-black/10 via-black/20 to-black/10 z-20 pointer-events-none"></div>
                  <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[1px] h-full bg-black/10 z-20 pointer-events-none"></div>

                  {/* Right Page (Text) */}
                  <div 
                    onClick={nextSpread}
                    className="flex-1 bg-[#fffdfa] relative shadow-[inset_20px_0_40px_rgba(0,0,0,0.05)] cursor-pointer group/page"
                  >
                    <div className="w-full h-full p-12 lg:p-20 flex items-center bg-[url('https://www.transparenttextures.com/patterns/paper.png')]">
                      {spreads[currentSpreadIndex][1] ? (
                        <div className="w-full animate-in slide-in-from-right-8 duration-700">
                           <p className="text-2xl lg:text-4xl text-slate-800 font-lexend leading-[1.6] first-letter:text-6xl first-letter:text-indigo-600 first-letter:font-black first-letter:mr-2 first-letter:float-left">
                             {spreads[currentSpreadIndex][1].text}
                           </p>
                           {spreads[currentSpreadIndex][1].loading && (
                             <div className="mt-8 flex items-center gap-3 text-indigo-400">
                               <RefreshCw size={16} className="animate-spin" />
                               <span className="text-xs font-bold uppercase tracking-widest">文字排版中...</span>
                             </div>
                           )}
                        </div>
                      ) : (
                        <div className="w-full text-center space-y-6">
                           <BookOpen size={64} className="mx-auto text-slate-100" />
                           <p className="text-slate-300 italic">精彩未完待续...</p>
                        </div>
                      )}
                    </div>
                    {/* Page Number Right */}
                    <div className="absolute bottom-6 right-8 text-slate-300 font-lexend text-xs font-bold">
                      {currentSpreadIndex * 2 + 2}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white">
                  <div className="text-center space-y-6 max-w-sm">
                    <div className="relative inline-block">
                      <div className="w-24 h-24 border-8 border-indigo-50 border-t-indigo-600 rounded-full animate-spin"></div>
                      <Sparkles className="absolute inset-0 m-auto text-indigo-600 animate-pulse" size={32} />
                    </div>
                    <h3 className="text-xl font-lexend font-bold text-slate-800">正在装帧你的故事...</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">正在将你的灵感转化为精美的插画与排版，这可能需要一点点时间。</p>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Right */}
            <button 
              onClick={nextSpread}
              disabled={currentSpreadIndex === spreads.length - 1}
              className={`absolute -right-4 md:-right-16 top-1/2 -translate-y-1/2 p-4 bg-white/50 hover:bg-white text-slate-800 rounded-full shadow-xl transition-all z-40 disabled:opacity-0 disabled:pointer-events-none hover:scale-110 active:scale-95`}
            >
              <ChevronRight size={32} />
            </button>
          </div>

          {/* Pagination Indicators */}
          <div className="mt-12 flex gap-3">
            {spreads.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSpreadIndex(idx)}
                className={`h-2 transition-all duration-500 rounded-full ${currentSpreadIndex === idx ? 'w-12 bg-indigo-600' : 'w-2 bg-slate-300 hover:bg-slate-400'}`}
              />
            ))}
          </div>

          {/* Tips Overlay */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity">
            <Sparkles size={12} />
            <span>点击页面边缘即可左右翻页</span>
          </div>
        </main>
      </div>

      <style>{`
        .perspective-2000 {
          perspective: 2000px;
        }
        @keyframes pageTurn {
          0% { transform: rotateY(0deg); }
          100% { transform: rotateY(-180deg); }
        }
      `}</style>
    </div>
  );
};

export default EditorView;
