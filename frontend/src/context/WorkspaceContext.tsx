import { useState, createContext, useContext, type ReactNode } from 'react';

// Document types
export interface Document {
  id: string;
  name: string;
  type: 'folder' | 'file';
  fileType?: 'text' | 'pdf' | 'excel' | 'image' | 'markdown';
  children?: Document[];
  parentId?: string;
  content?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tab {
  id: string;
  documentId: string;
  name: string;
  type: 'editor' | 'viewer' | 'report';
  isDirty?: boolean;
}

interface WorkspaceState {
  documents: Document[];
  tabs: Tab[];
  activeTabId: string | null;
  selectedDocumentId: string | null;
  expandedFolders: Set<string>;
  isChatOpen: boolean;
  isSidebarOpen: boolean;
  activeProjectId: string | null;
}

interface WorkspaceContextType extends WorkspaceState {
  // Document actions
  addDocument: (doc: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>) => void;
  deleteDocument: (id: string) => void;
  renameDocument: (id: string, name: string) => void;
  selectDocument: (id: string | null) => void;
  toggleFolder: (id: string) => void;

  // Tab actions
  openTab: (doc: Document) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;

  // Panel actions
  toggleChat: () => void;
  toggleSidebar: () => void;

  // Project actions
  setActiveProject: (projectId: string | null) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  }
  return context;
}

// Sample documents for demo
const sampleDocuments: Document[] = [
  {
    id: '1',
    name: '我的文档',
    type: 'folder',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    children: [
      {
        id: '1-1',
        name: '项目报告.md',
        type: 'file',
        fileType: 'markdown',
        parentId: '1',
        content: '# 项目报告\n\n这是一份项目报告...',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '1-2',
        name: '数据分析.xlsx',
        type: 'file',
        fileType: 'excel',
        parentId: '1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: '2',
    name: '合同文件',
    type: 'folder',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    children: [
      {
        id: '2-1',
        name: '服务合同.pdf',
        type: 'file',
        fileType: 'pdf',
        parentId: '2',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: '3',
    name: '会议记录.txt',
    type: 'file',
    fileType: 'text',
    content: '会议记录内容...',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkspaceState>({
    documents: sampleDocuments,
    tabs: [],
    activeTabId: null,
    selectedDocumentId: null,
    expandedFolders: new Set(['1', '2']),
    isChatOpen: true,
    isSidebarOpen: true,
    activeProjectId: null,
  });

  const addDocument = (doc: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newDoc: Document = {
      ...doc,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      documents: [...prev.documents, newDoc],
    }));
  };

  const deleteDocument = (id: string) => {
    const removeDoc = (docs: Document[]): Document[] => {
      return docs
        .filter((d) => d.id !== id)
        .map((d) => ({
          ...d,
          children: d.children ? removeDoc(d.children) : undefined,
        }));
    };
    setState((prev) => ({
      ...prev,
      documents: removeDoc(prev.documents),
      tabs: prev.tabs.filter((t) => t.documentId !== id),
    }));
  };

  const renameDocument = (id: string, name: string) => {
    const rename = (docs: Document[]): Document[] => {
      return docs.map((d) => {
        if (d.id === id) {
          return { ...d, name, updatedAt: new Date().toISOString() };
        }
        if (d.children) {
          return { ...d, children: rename(d.children) };
        }
        return d;
      });
    };
    setState((prev) => ({
      ...prev,
      documents: rename(prev.documents),
      tabs: prev.tabs.map((t) => (t.documentId === id ? { ...t, name } : t)),
    }));
  };

  const selectDocument = (id: string | null) => {
    setState((prev) => ({ ...prev, selectedDocumentId: id }));
  };

  const toggleFolder = (id: string) => {
    setState((prev) => {
      const newExpanded = new Set(prev.expandedFolders);
      if (newExpanded.has(id)) {
        newExpanded.delete(id);
      } else {
        newExpanded.add(id);
      }
      return { ...prev, expandedFolders: newExpanded };
    });
  };

  const openTab = (doc: Document) => {
    if (doc.type === 'folder') return;

    setState((prev) => {
      const existingTab = prev.tabs.find((t) => t.documentId === doc.id);
      if (existingTab) {
        return { ...prev, activeTabId: existingTab.id };
      }

      const newTab: Tab = {
        id: Date.now().toString(),
        documentId: doc.id,
        name: doc.name,
        type: doc.fileType === 'excel' ? 'report' : doc.fileType === 'pdf' ? 'viewer' : 'editor',
      };

      return {
        ...prev,
        tabs: [...prev.tabs, newTab],
        activeTabId: newTab.id,
        selectedDocumentId: doc.id,
      };
    });
  };

  const closeTab = (tabId: string) => {
    setState((prev) => {
      const tabIndex = prev.tabs.findIndex((t) => t.id === tabId);
      const newTabs = prev.tabs.filter((t) => t.id !== tabId);

      let newActiveTabId = prev.activeTabId;
      if (prev.activeTabId === tabId) {
        if (newTabs.length > 0) {
          const newIndex = Math.min(tabIndex, newTabs.length - 1);
          newActiveTabId = newTabs[newIndex].id;
        } else {
          newActiveTabId = null;
        }
      }

      return { ...prev, tabs: newTabs, activeTabId: newActiveTabId };
    });
  };

  const setActiveTab = (tabId: string) => {
    setState((prev) => {
      const tab = prev.tabs.find((t) => t.id === tabId);
      return {
        ...prev,
        activeTabId: tabId,
        selectedDocumentId: tab?.documentId || prev.selectedDocumentId,
      };
    });
  };

  const toggleChat = () => {
    setState((prev) => ({ ...prev, isChatOpen: !prev.isChatOpen }));
  };

  const toggleSidebar = () => {
    setState((prev) => ({ ...prev, isSidebarOpen: !prev.isSidebarOpen }));
  };

  const setActiveProject = (projectId: string | null) => {
    setState((prev) => ({ ...prev, activeProjectId: projectId }));
  };

  return (
    <WorkspaceContext.Provider
      value={{
        ...state,
        addDocument,
        deleteDocument,
        renameDocument,
        selectDocument,
        toggleFolder,
        openTab,
        closeTab,
        setActiveTab,
        toggleChat,
        toggleSidebar,
        setActiveProject,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
