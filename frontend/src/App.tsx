
import React, { useState } from 'react';
import HomeView from './pages/HomeView';
import EditorView from './pages/EditorView';

const App: React.FC = () => {
  const [currentStorybookId, setCurrentStorybookId] = useState<number | undefined>(undefined);
  const [showMyWorks, setShowMyWorks] = useState(false);

  const handleStart = (storybookId: number) => {
    setCurrentStorybookId(storybookId);
    setShowMyWorks(false);
  };

  const handleBack = () => {
    setCurrentStorybookId(undefined);
    setShowMyWorks(false);
  };

  const handleCreateNew = () => {
    // 切换到 HomeView，用户可以创建新绘本
    setCurrentStorybookId(undefined);
    setShowMyWorks(false);
  };

  const handleShowMyWorks = () => {
    setShowMyWorks(true);
    setCurrentStorybookId(undefined);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {currentStorybookId === undefined && !showMyWorks ? (
        <HomeView onStart={handleStart} onShowMyWorks={handleShowMyWorks} />
      ) : (
        <EditorView
          storybookId={currentStorybookId}
          onBack={handleBack}
          onCreateNew={handleCreateNew}
        />
      )}
    </div>
  );
};

export default App;
