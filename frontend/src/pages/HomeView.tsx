
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StoryTemplate } from '../types';
import { TEMPLATES } from '../constants';
import { Sparkles, Upload, ArrowRight, X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { CreateStorybookRequest } from '../services/storybookService';

interface HomeViewProps {
  onStart?: (params: CreateStorybookRequest) => void;
  onShowMyWorks?: () => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onStart, onShowMyWorks }) => {
  const [prompt, setPrompt] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<StoryTemplate | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [inputExpanded, setInputExpanded] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const carouselSectionRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const expand = useCallback(() => setInputExpanded(true), []);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (
      barRef.current &&
      !barRef.current.contains(e.target as Node) &&
      !prompt.trim() &&
      uploadedImages.length === 0
    ) {
      setInputExpanded(false);
    }
    // Deselect template when clicking outside carousel
    if (
      carouselSectionRef.current &&
      !carouselSectionRef.current.contains(e.target as Node)
    ) {
      setSelectedTemplate(null);
    }
    // Close user menu when clicking outside the menu
    if (
      userMenuOpen &&
      userMenuRef.current &&
      !userMenuRef.current.contains(e.target as Node)
    ) {
      setUserMenuOpen(false);
    }
  }, [prompt, uploadedImages.length, userMenuOpen]);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImages((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });

    // Reset so re-selecting the same file still triggers onChange
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStart = async () => {
    if (!prompt.trim() || isCreating) return;

    setIsCreating(true);
    setError(null);
    setGenerationStatus('正在跳转到编辑器...');

    try {
      const template = selectedTemplate ?? TEMPLATES[0];

      // 不发起请求，直接跳转到 EditorView 并传递创建参数
      const createParams = {
        instruction: prompt,
        style_prefix: template.name,
        images: uploadedImages.length > 0 ? uploadedImages : undefined,
        creator: 'user'
      };

      if (onStart) {
        onStart(createParams);
      }
    } catch (err) {
      console.error('Failed to navigate to editor:', err);
      setError(err instanceof Error ? err.message : '跳转失败，请重试');
    } finally {
      setIsCreating(false);
      setGenerationStatus(null);
    }
  };

  const isOpen = inputExpanded || !!prompt.trim() || uploadedImages.length > 0;

  // Carousel auto-scroll — smooth continuous motion via requestAnimationFrame
  useEffect(() => {
    if (carouselPaused || selectedTemplate) return;
    const el = carouselRef.current;
    if (!el) return;
    let animId: number;
    const speed = 0.5; // px per frame
    const step = () => {
      const halfScroll = el.scrollWidth / 2;
      if (el.scrollLeft >= halfScroll) {
        el.scrollLeft -= halfScroll;
      }
      el.scrollLeft += speed;
      animId = requestAnimationFrame(step);
    };
    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [carouselPaused, selectedTemplate]);

  const scrollCarousel = (dir: number) => {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 260, behavior: 'smooth' });
  };

  return (
    <div className="relative flex-1 flex flex-col items-center py-12 px-4 pb-40 max-w-6xl mx-auto w-full">
      {/* Hero Section */}
      <header className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 font-medium text-sm mb-4">
          <Sparkles size={14} />
          <span>Powered by AI</span>
        </div>
        <h1 className="text-5xl md:text-6xl font-bold font-lexend text-slate-900 mb-4 tracking-tight">
          Create Your <span className="text-indigo-600">Magic Story</span>
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Transform your imagination into a beautifully illustrated picture book in seconds.
          Just describe your story and pick a style.
        </p>
      </header>

      {/* User Avatar - Fixed Top Right */}
      <div className="fixed top-6 right-6 z-50">
        <div className="relative">
          {/* Avatar Button */}
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="w-11 h-11 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center hover:border-slate-300 hover:bg-slate-50 transition-all duration-300 hover:scale-105 active:scale-95 shadow-sm hover:shadow-md"
          >
            {/* Custom User Icon - 简洁现代风格 */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Head */}
              <circle cx="10" cy="7" r="3.5" stroke="#64748B" strokeWidth="1.5" fill="none"/>
              {/* Shoulders/Body */}
              <path d="M4.5 17C4.5 14.5 6.5 13 10 13C13.5 13 15.5 14.5 15.5 17" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
            </svg>
          </button>

          {/* Dropdown Menu */}
          {userMenuOpen && (
            <div ref={userMenuRef} className="absolute top-full mt-2 right-0 w-48 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden animate-in slide-in-from-top-2 duration-200">
              <button
                onClick={() => {
                  onShowMyWorks?.();
                  setUserMenuOpen(false);
                }}
                className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors duration-200 flex items-center gap-2"
              >
                <Sparkles size={16} className="text-indigo-500" />
                <span>我的作品</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Style Templates — Carousel */}
      <section className="w-full mb-16">
        <h2 className="text-2xl font-bold font-lexend text-slate-900 mb-8 text-center">Choose Your Art Style</h2>
        <div
          ref={carouselSectionRef}
          className="relative group/carousel"
          onMouseEnter={() => setCarouselPaused(true)}
          onMouseLeave={() => setCarouselPaused(false)}
        >
          {/* Left arrow */}
          <button
            onClick={() => scrollCarousel(-1)}
            className="absolute -left-5 top-1/2 -translate-y-1/2 z-10
                       w-9 h-9 rounded-full bg-white/80 backdrop-blur border border-slate-200
                       shadow-lg flex items-center justify-center
                       opacity-0 group-hover/carousel:opacity-100
                       transition-opacity duration-300 hover:bg-white"
          >
            <ChevronLeft size={18} className="text-slate-600" />
          </button>

          {/* Scrollable track */}
          <div
            ref={carouselRef}
            className="flex gap-5 overflow-x-auto px-8 pb-2
                       [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {[...TEMPLATES, ...TEMPLATES].map((tmpl, idx) => (
              <button
                key={`${tmpl.id}-${idx}`}
                onClick={() => setSelectedTemplate(tmpl)}
                className={`group shrink-0 w-60 flex flex-col text-left rounded-2xl overflow-hidden border-2 transition-all duration-300 ${
                  selectedTemplate?.id === tmpl.id
                  ? 'border-indigo-600 ring-4 ring-indigo-50 shadow-lg'
                  : 'border-white bg-white hover:border-slate-200 shadow-sm'
                }`}
              >
                <div className="h-40 overflow-hidden">
                  <img
                    src={tmpl.previewUrl}
                    alt={tmpl.name}
                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-slate-900 mb-1">{tmpl.name}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2">{tmpl.description}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Right arrow */}
          <button
            onClick={() => scrollCarousel(1)}
            className="absolute -right-5 top-1/2 -translate-y-1/2 z-10
                       w-9 h-9 rounded-full bg-white/80 backdrop-blur border border-slate-200
                       shadow-lg flex items-center justify-center
                       opacity-0 group-hover/carousel:opacity-100
                       transition-opacity duration-300 hover:bg-white"
          >
            <ChevronRight size={18} className="text-slate-600" />
          </button>
        </div>
      </section>

      {/* Showcase Area */}
      <section className="w-full bg-slate-900 rounded-[3rem] py-16 px-8 text-center text-white">
        <h2 className="text-3xl font-bold font-lexend mb-4">Community Creations</h2>
        <p className="text-slate-400 mb-10">See what others have imagined with DreamWeave.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="aspect-square bg-slate-800 rounded-2xl overflow-hidden hover:opacity-80 transition-opacity">
              <img src={`https://picsum.photos/seed/creation-${i}/300/300`} alt="Creation" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </section>

      {/* Floating Input Bar */}
      <div
        ref={barRef}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl"
        onMouseEnter={expand}
      >
        {/* Glassmorphism container */}
        <div
          className={`
            relative overflow-hidden rounded-2xl
            border border-white/30
            bg-gradient-to-br from-white/70 via-white/60 to-indigo-50/50
            backdrop-blur-xl
            shadow-[0_8px_40px_rgba(99,102,241,0.12)]
            transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]
            ${isOpen ? 'p-5' : 'p-3'}
          `}
        >
          {/* Subtle shimmer overlay */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-60" />

          {/* Error message */}
          {error && (
            <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Generation status */}
          {generationStatus && (
            <div className="mb-3 p-3 rounded-lg bg-indigo-50 border border-indigo-200">
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="text-indigo-600 animate-spin" />
                <p className="text-sm text-indigo-600">{generationStatus}</p>
              </div>
            </div>
          )}

          {/* Image thumbnails row */}
          {uploadedImages.length > 0 && (
            <div className="relative flex items-center gap-2 mb-3 overflow-x-auto pb-1">
              {uploadedImages.map((src, i) => (
                <div
                  key={i}
                  className="group/thumb relative shrink-0 w-12 h-12 rounded-lg overflow-hidden
                             border border-white/40 shadow-sm"
                >
                  <img src={src} alt={`Upload ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute inset-0 flex items-center justify-center
                               bg-black/40 opacity-0 group-hover/thumb:opacity-100
                               transition-opacity duration-200"
                  >
                    <X size={14} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Expanded textarea area */}
          <div
            className={`
              transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] overflow-hidden
              ${isOpen ? 'max-h-40 opacity-100 mb-3' : 'max-h-0 opacity-0 mb-0'}
            `}
          >
            <textarea
              className="w-full p-3 rounded-xl
                         bg-white/50 border border-white/40 backdrop-blur-sm
                         focus:bg-white/70 focus:ring-0 focus:outline-none
                         transition-all duration-300 text-sm text-slate-800
                         placeholder:text-slate-400 resize-none leading-relaxed"
              rows={3}
              placeholder="Describe your story idea... A little squirrel named Nutty discovers a secret door in an old oak tree..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onFocus={expand}
            />
          </div>

          {/* Bottom action row */}
          <div className="relative flex items-center gap-2">
            {/* Upload button — slides in when expanded */}
            <input
              type="file"
              className="hidden"
              ref={fileInputRef}
              accept="image/*"
              multiple
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`
                flex items-center justify-center shrink-0
                rounded-xl border border-white/40 bg-white/40 backdrop-blur-sm
                hover:bg-white/70 transition-all duration-500
                ${isOpen
                  ? 'w-10 h-10 opacity-100 scale-100'
                  : 'w-0 h-10 opacity-0 scale-75 border-0 p-0 overflow-hidden'}
              `}
              title="Upload character references"
            >
              <Upload size={16} className="text-slate-500" />
            </button>

            {/* Collapsed: placeholder bar */}
            {!isOpen && (
              <div
                className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl
                           bg-white/40 border border-white/40 backdrop-blur-sm
                           cursor-text text-slate-400 text-sm
                           hover:bg-white/60 transition-all duration-300"
                onClick={expand}
              >
                <Sparkles size={14} className="text-indigo-400 shrink-0" />
                <span>What story will you create today?</span>
              </div>
            )}

            {/* Expanded: selected style pill */}
            {isOpen && (
              <div className="flex-1 flex items-center gap-1.5 px-3 py-2 rounded-xl
                              bg-white/30 border border-white/30 text-xs text-slate-500 truncate">
                <span className={`w-2 h-2 rounded-full shrink-0 ${selectedTemplate ? 'bg-indigo-400' : 'bg-slate-300'}`} />
                <span className="truncate">{selectedTemplate ? selectedTemplate.name : 'No style selected'}</span>
              </div>
            )}

            {/* Send button */}
            <button
              disabled={!prompt.trim()}
              onClick={handleStart}
              className={`
                shrink-0 flex items-center justify-center w-10 h-10
                rounded-xl font-bold text-white
                transition-all duration-500
                ${prompt.trim()
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-500 shadow-lg shadow-indigo-200/50 hover:shadow-indigo-300/60 hover:scale-105 active:scale-95'
                  : 'bg-slate-300/60 backdrop-blur-sm cursor-not-allowed'}
              `}
            >
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeView;
