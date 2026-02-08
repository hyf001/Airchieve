
import React, { useState, useCallback } from 'react';
import { AppView, StoryPage, StoryTemplate, ChatMessage } from './types';
import { TEMPLATES } from './constants';
import HomeView from './pages/HomeView';
import EditorView from './pages/EditorView';
import { generateStoryStructure, generateImage } from './services/geminiService';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('home');
  const [currentTemplate, setCurrentTemplate] = useState<StoryTemplate>(TEMPLATES[0]);
  const [storyTitle, setStoryTitle] = useState('');
  const [pages, setPages] = useState<StoryPage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCreation = async (prompt: string, template: StoryTemplate, fileData?: string[]) => {
    setIsGenerating(true);
    setView('editor');
    setCurrentTemplate(template);
    setError(null);

    try {
      // 1. Generate story structure
      const storyData = await generateStoryStructure(prompt, template.name);
      setStoryTitle(storyData.title || 'Untitled Adventure');

      const initialPages = storyData.pages.map((p: any, index: number) => ({
        id: `page-${index}`,
        text: p.text,
        imageUrl: '',
        loading: true,
        imagePrompt: p.imagePrompt
      }));
      setPages(initialPages);

      // 2. Generate images sequentially (to avoid rate limits and show progress)
      for (let i = 0; i < initialPages.length; i++) {
        const imageUrl = await generateImage(initialPages[i].imagePrompt, template.promptStyle);
        setPages(prev => prev.map((p, idx) => idx === i ? { ...p, imageUrl, loading: false } : p));
      }

    } catch (err: any) {
      console.error(err);
      setError('Failed to generate story. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const resetToHome = () => {
    setView('home');
    setPages([]);
    setStoryTitle('');
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {view === 'home' ? (
        <HomeView onStart={startCreation} />
      ) : (
        <EditorView
          title={storyTitle}
          pages={pages}
          template={currentTemplate}
          isGenerating={isGenerating}
          error={error}
          onBack={resetToHome}
          onPagesUpdate={setPages}
        />
      )}
    </div>
  );
};

export default App;
