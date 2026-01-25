import { useState } from 'react';
import { useWorkspace, type Document } from '@/context/WorkspaceContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  FileText,
  FileSpreadsheet,
  FileImage,
  FilePlus,
  FolderPlus,
  Trash2,
  Pencil,
  Search,
  MoreHorizontal,
} from 'lucide-react';

const FileIcon = ({ fileType }: { fileType?: string }) => {
  switch (fileType) {
    case 'pdf':
      return <FileText className="h-4 w-4 text-red-500" />;
    case 'excel':
      return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
    case 'image':
      return <FileImage className="h-4 w-4 text-purple-500" />;
    case 'markdown':
      return <FileText className="h-4 w-4 text-blue-500" />;
    default:
      return <File className="h-4 w-4 text-slate-500" />;
  }
};

interface DocumentItemProps {
  doc: Document;
  level: number;
}

function DocumentItem({ doc, level }: DocumentItemProps) {
  const {
    selectedDocumentId,
    expandedFolders,
    selectDocument,
    toggleFolder,
    openTab,
    deleteDocument,
    renameDocument,
  } = useWorkspace();

  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(doc.name);

  const isExpanded = expandedFolders.has(doc.id);
  const isSelected = selectedDocumentId === doc.id;

  const handleClick = () => {
    selectDocument(doc.id);
    if (doc.type === 'folder') {
      toggleFolder(doc.id);
    }
  };

  const handleDoubleClick = () => {
    if (doc.type === 'file') {
      openTab(doc);
    }
  };

  const handleRename = () => {
    if (newName.trim() && newName !== doc.name) {
      renameDocument(doc.id, newName.trim());
    }
    setIsRenaming(false);
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-1 cursor-pointer rounded-sm text-sm',
              'hover:bg-[#313244] text-[#cdd6f4]',
              isSelected && 'bg-[#313244] text-[#89b4fa]'
            )}
            style={{ paddingLeft: `${level * 12 + 8}px` }}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
          >
            {doc.type === 'folder' ? (
              <>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-500 shrink-0" />
                )}
                {isExpanded ? (
                  <FolderOpen className="h-4 w-4 text-yellow-500 shrink-0" />
                ) : (
                  <Folder className="h-4 w-4 text-yellow-500 shrink-0" />
                )}
              </>
            ) : (
              <>
                <span className="w-4" />
                <FileIcon fileType={doc.fileType} />
              </>
            )}

            {isRenaming ? (
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename();
                  if (e.key === 'Escape') setIsRenaming(false);
                }}
                className="h-5 py-0 px-1 text-sm"
                autoFocus
              />
            ) : (
              <span className="truncate">{doc.name}</span>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {doc.type === 'file' && (
            <ContextMenuItem onClick={() => openTab(doc)}>
              <File className="mr-2 h-4 w-4" />
              打开
            </ContextMenuItem>
          )}
          <ContextMenuItem
            onClick={() => {
              setNewName(doc.name);
              setIsRenaming(true);
            }}
          >
            <Pencil className="mr-2 h-4 w-4" />
            重命名
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-red-600"
            onClick={() => deleteDocument(doc.id)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            删除
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {doc.type === 'folder' && isExpanded && doc.children && (
        <div>
          {doc.children.map((child) => (
            <DocumentItem key={child.id} doc={child} level={level + 1} />
          ))}
        </div>
      )}
    </>
  );
}

export function DocumentSidebar() {
  const { documents, isSidebarOpen, toggleSidebar } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState('');

  if (!isSidebarOpen) {
    return (
      <div className="h-full w-full bg-[#1e1e2e] flex flex-col items-center py-2 gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="text-[#6c7086] hover:text-[#cdd6f4] hover:bg-[#313244]"
          onClick={toggleSidebar}
        >
          <Folder className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-[#1e1e2e] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-[#313244] flex items-center justify-between shrink-0">
        <span className="text-xs font-semibold uppercase text-[#6c7086] tracking-wider truncate">
          文件浏览器
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-[#6c7086] hover:text-[#cdd6f4] hover:bg-[#313244]">
            <FilePlus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-[#6c7086] hover:text-[#cdd6f4] hover:bg-[#313244]">
            <FolderPlus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-[#6c7086] hover:text-[#cdd6f4] hover:bg-[#313244]">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-[#313244] shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6c7086]" />
          <Input
            placeholder="搜索文件..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-sm bg-[#313244] border-[#45475a] text-[#cdd6f4] placeholder:text-[#6c7086] focus-visible:ring-[#89b4fa]"
          />
        </div>
      </div>

      {/* Document Tree */}
      <ScrollArea className="flex-1">
        <div className="py-2">
          {documents.map((doc) => (
            <DocumentItem key={doc.id} doc={doc} level={0} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
