import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginModal from './components/LoginModal';
import HomeView from './pages/HomeView';
import EditorView from './pages/EditorView';
import TemplatesView from './pages/TemplatesView';
import UserProfileView from './pages/UserProfileView';
import AdminView from './pages/AdminView';
import { CreateStorybookRequest } from './services/storybookService';
import { Loader2 } from 'lucide-react';

// ============ Inner App（需要 AuthProvider 上下文） ============

const InnerApp: React.FC = () => {
  const { isLoading, login, loginModalOpen, closeLoginModal } = useAuth();

  const [currentStorybookId, setCurrentStorybookId] = useState<number | undefined>(undefined);
  const [showMyWorks,     setShowMyWorks]     = useState(false);
  const [showMyTemplates, setShowMyTemplates] = useState(false);
  const [showProfile,     setShowProfile]     = useState(false);
  const [showAdmin,       setShowAdmin]       = useState(false);
  const [createParams,    setCreateParams]    = useState<CreateStorybookRequest | null>(null);

  const handleBack = () => {
    setCurrentStorybookId(undefined);
    setCreateParams(null);
    setShowMyWorks(false);
    setShowMyTemplates(false);
    setShowProfile(false);
    setShowAdmin(false);
  };

  const isHomeView = !currentStorybookId && !showMyWorks && !showMyTemplates && !showProfile && !showAdmin && !createParams;

  // 初始化验证 token 时显示全屏 loading，避免登录弹窗闪烁
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <Loader2 size={32} className="text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col ${isHomeView || showProfile ? 'overflow-auto' : 'overflow-hidden'}`}>
      {/* 按需弹出登录框（后端 401 时触发） */}
      {loginModalOpen && (
        <LoginModal
          onSuccess={(res) => { login(res.access_token, res.user); closeLoginModal(); }}
          onClose={closeLoginModal}
        />
      )}

      {showAdmin ? (
        <AdminView onBack={handleBack} />
      ) : showProfile ? (
        <UserProfileView onBack={handleBack} />
      ) : showMyTemplates ? (
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
          onShowProfile={() => {
            setShowProfile(true);
            setCurrentStorybookId(undefined);
            setCreateParams(null);
            setShowMyWorks(false);
            setShowMyTemplates(false);
          }}
          onShowAdmin={() => {
            setShowAdmin(true);
            setCurrentStorybookId(undefined);
            setCreateParams(null);
            setShowMyWorks(false);
            setShowMyTemplates(false);
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
