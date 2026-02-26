import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginModal from './components/LoginModal';
import HomeView from './pages/HomeView';
import EditorView from './pages/EditorView';
import TemplatesView from './pages/TemplatesView';
import { CreateStorybookRequest } from './services/storybookService';
import { Loader2 } from 'lucide-react';

// ============ Inner App（需要 AuthProvider 上下文） ============

const InnerApp: React.FC = () => {
  const { isAuthenticated, isLoading, login } = useAuth();

  const [currentStorybookId, setCurrentStorybookId] = useState<number | undefined>(undefined);
  const [showMyWorks,     setShowMyWorks]     = useState(false);
  const [showMyTemplates, setShowMyTemplates] = useState(false);
  const [createParams,    setCreateParams]    = useState<CreateStorybookRequest | null>(null);

  const handleBack = () => {
    setCurrentStorybookId(undefined);
    setCreateParams(null);
    setShowMyWorks(false);
    setShowMyTemplates(false);
  };

  const isHomeView = !currentStorybookId && !showMyWorks && !showMyTemplates && !createParams;

  // 初始化验证 token 时显示全屏 loading，避免登录弹窗闪烁
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <Loader2 size={32} className="text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col ${isHomeView ? 'overflow-auto' : 'overflow-hidden'}`}>
      {/* 未登录时覆盖登录弹窗，背景页面仍然渲染 */}
      {!isAuthenticated && (
        <LoginModal onSuccess={(res) => login(res.access_token, res.user)} />
      )}

      {showMyTemplates ? (
        <TemplatesView onBack={handleBack} />
      ) : isHomeView ? (
        <HomeView
          onStart={(params) => {
            setCreateParams(params);
            setShowMyWorks(false);
            setShowMyTemplates(false);
          }}
          onShowMyWorks={() => {
            setShowMyWorks(true);
            setCurrentStorybookId(undefined);
            setCreateParams(null);
            setShowMyTemplates(false);
          }}
          onShowMyTemplates={() => {
            setShowMyTemplates(true);
            setCurrentStorybookId(undefined);
            setCreateParams(null);
            setShowMyWorks(false);
          }}
        />
      ) : (
        <EditorView
          storybookId={currentStorybookId}
          createParams={createParams}
          onBack={handleBack}
          onCreateNew={handleBack}
          onStorybookCreated={(id) => {
            setCurrentStorybookId(id);
            setCreateParams(null);
          }}
        />
      )}
    </div>
  );
};

// ============ Root App ============

const App: React.FC = () => (
  <AuthProvider>
    <InnerApp />
  </AuthProvider>
);

export default App;
