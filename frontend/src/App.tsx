import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginModal from './components/LoginModal';
import HomeView from './pages/HomeView';
import EditorView from './pages/EditorView';
import TemplatesView from './pages/TemplatesView';
import ImageStylesView from './pages/ImageStylesView';
import UserProfileView from './pages/UserProfileView';
import UserManagementView from './pages/UserManagementView';
import GenerationDebugView from './pages/GenerationDebugView';
import LoadingSpinner from './components/LoadingSpinner';
import { ToastContextProvider } from './components/ui/toast-provider';
import { Toaster } from './components/ui/toaster';

// ============ Inner App（需要 AuthProvider 上下文） ============

const InnerApp: React.FC = () => {
  const { isLoading, login, loginModalOpen, closeLoginModal } = useAuth();

  const [currentStorybookId, setCurrentStorybookId] = useState<number | undefined>(undefined);
  const [showMyWorks,     setShowMyWorks]     = useState(false);
  const [showMyTemplates, setShowMyTemplates] = useState(false);
  const [showProfile,     setShowProfile]     = useState(false);
  const [showAdmin,       setShowAdmin]       = useState(false);
  const [showImageStyles, setShowImageStyles] = useState(false);
  const [showGenerationDebug, setShowGenerationDebug] = useState(false);

  const handleBack = () => {
    setCurrentStorybookId(undefined);
    setShowMyWorks(false);
    setShowMyTemplates(false);
    setShowProfile(false);
    setShowAdmin(false);
    setShowImageStyles(false);
    setShowGenerationDebug(false);
  };

  const isHomeView = !currentStorybookId && !showMyWorks && !showMyTemplates && !showProfile && !showAdmin && !showImageStyles && !showGenerationDebug;

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#061428]">
        <LoadingSpinner size={48} />
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col ${isHomeView || showProfile ? 'overflow-auto' : 'overflow-hidden'}`}>
      {loginModalOpen && (
        <LoginModal
          onSuccess={(res) => { login(res.access_token, res.user); closeLoginModal(); }}
          onClose={closeLoginModal}
        />
      )}

      {showImageStyles ? (
        <ImageStylesView onBack={handleBack} />
      ) : showGenerationDebug ? (
        <GenerationDebugView onBack={handleBack} />
      ) : showAdmin ? (
        <UserManagementView onBack={handleBack} />
      ) : showProfile ? (
        <UserProfileView onBack={handleBack} />
      ) : showMyTemplates ? (
        <TemplatesView onBack={handleBack} />
      ) : isHomeView ? (
        <HomeView
          onStart={(storybookId) => {
            setCurrentStorybookId(storybookId);
            setShowMyWorks(false);
            setShowMyTemplates(false);
          }}
          onShowMyWorks={() => {
            setShowMyWorks(true);
            setCurrentStorybookId(undefined);
            setShowMyTemplates(false);
          }}
          onShowMyTemplates={() => {
            setShowMyTemplates(true);
            setCurrentStorybookId(undefined);
            setShowMyWorks(false);
          }}
          onShowProfile={() => {
            setShowProfile(true);
            setCurrentStorybookId(undefined);
            setShowMyWorks(false);
            setShowMyTemplates(false);
          }}
          onShowAdmin={() => {
            setShowAdmin(true);
            setCurrentStorybookId(undefined);
            setShowMyWorks(false);
            setShowMyTemplates(false);
            setShowImageStyles(false);
            setShowGenerationDebug(false);
          }}
          onShowImageStyles={() => {
            setShowImageStyles(true);
            setCurrentStorybookId(undefined);
            setShowMyWorks(false);
            setShowMyTemplates(false);
            setShowAdmin(false);
            setShowGenerationDebug(false);
          }}
          onShowGenerationDebug={() => {
            setShowGenerationDebug(true);
            setCurrentStorybookId(undefined);
            setShowMyWorks(false);
            setShowMyTemplates(false);
            setShowAdmin(false);
            setShowImageStyles(false);
          }}
        />
      ) : (
        <EditorView
          storybookId={currentStorybookId}
          onBack={handleBack}
          onCreateNew={handleBack}
        />
      )}
    </div>
  );
};

// ============ Root App ============

const App: React.FC = () => (
  <ToastContextProvider>
    <AuthProvider>
      <InnerApp />
      <Toaster />
    </AuthProvider>
  </ToastContextProvider>
);

export default App;
