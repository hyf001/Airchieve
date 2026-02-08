
import React, { useState } from 'react';
import HomeView from './pages/HomeView';
import EditorView from './pages/EditorView';

// 创建绘本的参数类型
interface CreateStorybookParams {
  instruction: string;
  style_prefix: string;
  images?: string[];
  creator?: string;
}

const App: React.FC = () => {
  const [currentStorybookId, setCurrentStorybookId] = useState<number | undefined>(undefined);
  const [showMyWorks, setShowMyWorks] = useState(false);
  const [createParams, setCreateParams] = useState<CreateStorybookParams | null>(null);

  const handleStart = (params: CreateStorybookParams) => {
    setCreateParams(params);
    setShowMyWorks(false);
  };

  const handleBack = () => {
    setCurrentStorybookId(undefined);
    setCreateParams(null);
    setShowMyWorks(false);
  };

  const handleCreateNew = () => {
    // 切换到 HomeView，用户可以创建新绘本
    setCurrentStorybookId(undefined);
    setCreateParams(null);
    setShowMyWorks(false);
  };

  const handleShowMyWorks = () => {
    setShowMyWorks(true);
    setCurrentStorybookId(undefined);
    setCreateParams(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {currentStorybookId === undefined && !showMyWorks && !createParams ? (
        <HomeView onStart={handleStart} onShowMyWorks={handleShowMyWorks} />
      ) : (
        <EditorView
          storybookId={currentStorybookId}
          createParams={createParams}
          onBack={handleBack}
          onCreateNew={handleCreateNew}
          onStorybookCreated={(id) => {
            setCurrentStorybookId(id);
            setCreateParams(null);
          }}
        />
      )}
    </div>
  );
};

export default App;
