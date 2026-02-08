
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StoryTemplate } from '../types';
import { TEMPLATES } from '../constants';
import { Sparkles, Upload, ArrowRight, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface HomeViewProps {
  onStart: (prompt: string, template: StoryTemplate, fileData?: string[]) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onStart }) => {
  const [prompt, setPrompt] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<StoryTemplate | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [inputExpanded, setInputExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const carouselSectionRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [carouselPaused, setCarouselPaused] = useState(false);

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
  }, [prompt, uploadedImages.length]);

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

  const handleStart = () => {
    if (!prompt.trim()) return;
    onStart(prompt, selectedTemplate ?? TEMPLATES[0], uploadedImages.length > 0 ? uploadedImages : undefined);
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
          <span>Powered by Gemini AI</span>
        </div>
        <h1 className="text-5xl md:text-6xl font-bold font-lexend text-slate-900 mb-4 tracking-tight">
          Create Your <span className="text-indigo-600">Magic Story</span>
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Transform your imagination into a beautifully illustrated picture book in seconds.
          Just describe your story and pick a style.
        </p>
      </header>

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
                         focus:border-indigo-300 focus:bg-white/70 focus:ring-0
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
