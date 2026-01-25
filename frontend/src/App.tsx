import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { Layout } from '@/components/layout';
import { AuthProvider } from '@/context/AuthContext';
import { WorkspaceProvider } from '@/context/WorkspaceContext';
import { AuthGlobalHandler } from '@/components/auth/AuthGlobalHandler';
import {
  HomePage,
  LandingPage,
  ProjectsPage,
  ChatPage,
  ChatListPage,
  EvaluationPage,
  EvaluationDetailPage,
  UsersPage,
  SettingsPage,
  WorkspacePage,
} from '@/pages';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WorkspaceProvider>
          <BrowserRouter>
            <Routes>
              {/* Landing Page */}
              <Route path="/" element={<LandingPage />} />

              {/* Workspace Route */}
              <Route path="/workspace" element={<WorkspacePage />} />

              {/* Legacy/Admin Routes */}
              <Route path="/admin" element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="chat" element={<ChatListPage />} />
                <Route path="chat/:projectId" element={<ChatPage />} />
                <Route path="evaluation" element={<EvaluationPage />} />
                <Route path="evaluation/:projectId" element={<EvaluationDetailPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
          <AuthGlobalHandler />
          <Toaster />
        </WorkspaceProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
