import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginModal from './components/LoginModal';
import HomeView from './pages/HomeView';
import EditorView from './pages/EditorView';
import TemplatesView from './pages/TemplatesView';
import UserProfileView from './pages/UserProfileView';
import UserManagementView from './pages/UserManagementView';
import { Loader2 } from 'lucide-react';

// ============ Inner App（需要 AuthProvider 上下文） ============

const InnerApp: React.FC = () => {
  const { isLoading, login, loginModalOpen, closeLoginModal } = useAuth();

  const [currentStorybookId, setCurrentStorybookId] = useState<number | undefined>(undefined);
  const [showMyWorks,     setShowMyWorks]     = useState(false);
  const [showMyTemplates, setShowMyTemplates] = useState(false);
  const [showProfile,     setShowProfile]     = useState(false);
  const [showAdmin,       setShowAdmin]       = useState(false);

  const handleBack = () => {
    setCurrentStorybookId(undefined);
    setShowMyWorks(false);
    setShowMyTemplates(false);
    setShowProfile(false);
    setShowAdmin(false);
  };

  const isHomeView = !currentStorybookId && !showMyWorks && !showMyTemplates && !showProfile && !showAdmin;

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#061428]">
        <Loader2 size={32} className="text-indigo-600 animate-spin" />
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

      {showAdmin ? (
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
  <AuthProvider>
    <InnerApp />
  </AuthProvider>
);

export default App;
