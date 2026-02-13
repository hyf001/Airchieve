
import React, { useState } from 'react';
import HomeView from './pages/HomeView';
import EditorView from './pages/EditorView';
import TemplatesView from './pages/TemplatesView';

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
  const [showMyTemplates, setShowMyTemplates] = useState(false);
  const [createParams, setCreateParams] = useState<CreateStorybookParams | null>(null);

  const handleStart = (params: CreateStorybookParams) => {
    setCreateParams(params);
    setShowMyWorks(false);
    setShowMyTemplates(false);
  };

  const handleBack = () => {
    setCurrentStorybookId(undefined);
    setCreateParams(null);
    setShowMyWorks(false);
    setShowMyTemplates(false);
  };

  const handleCreateNew = () => {
    // 切换到 HomeView，用户可以创建新绘本
    setCurrentStorybookId(undefined);
    setCreateParams(null);
    setShowMyWorks(false);
    setShowMyTemplates(false);
  };

  const handleShowMyWorks = () => {
    setShowMyWorks(true);
    setCurrentStorybookId(undefined);
    setCreateParams(null);
    setShowMyTemplates(false);
  };

  const handleShowMyTemplates = () => {
    setShowMyTemplates(true);
    setCurrentStorybookId(undefined);
    setCreateParams(null);
    setShowMyWorks(false);
  };

  const isHomeView = currentStorybookId === undefined && !showMyWorks && !showMyTemplates && !createParams;

  return (
    <div className={`h-screen flex flex-col ${isHomeView ? 'overflow-auto' : 'overflow-hidden'}`}>
      {showMyTemplates ? (
        <TemplatesView onBack={handleBack} />
      ) : isHomeView ? (
        <HomeView
          onStart={handleStart}
          onShowMyWorks={handleShowMyWorks}
          onShowMyTemplates={handleShowMyTemplates}
        />
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
