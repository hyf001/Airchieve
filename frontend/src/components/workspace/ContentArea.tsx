import { useWorkspace } from '@/context/WorkspaceContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  X,
  FileText,
  FileSpreadsheet,
  File,
  Save,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Download,
} from 'lucide-react';
import { useState } from 'react';

const TabIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'report':
      return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
    case 'viewer':
      return <FileText className="h-4 w-4 text-red-500" />;
    default:
      return <File className="h-4 w-4 text-blue-500" />;
  }
};

// Text Editor Component
function TextEditor({ content, onChange }: { content: string; onChange: (value: string) => void }) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 p-2 border-b border-[#313244] bg-[#181825]">
        <Button variant="ghost" size="sm" className="text-[#6c7086] hover:text-[#cdd6f4] hover:bg-[#313244]">
          <Save className="h-4 w-4 mr-1" />
          保存
        </Button>
        <Button variant="ghost" size="sm" className="text-[#6c7086] hover:text-[#cdd6f4] hover:bg-[#313244]">
          <RotateCcw className="h-4 w-4 mr-1" />
          撤销
        </Button>
      </div>
      <Textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 resize-none border-0 rounded-none focus-visible:ring-0 font-mono text-sm bg-[#1e1e2e] text-[#cdd6f4]"
        placeholder="开始编辑..."
      />
    </div>
  );
}

// PDF Viewer Component
function PDFViewer({ documentName }: { documentName: string }) {
  const [zoom, setZoom] = useState(100);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-2 border-b border-[#313244] bg-[#181825]">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-[#6c7086] hover:text-[#cdd6f4] hover:bg-[#313244]" onClick={() => setZoom(Math.max(50, zoom - 10))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-[#cdd6f4]">{zoom}%</span>
          <Button variant="ghost" size="sm" className="text-[#6c7086] hover:text-[#cdd6f4] hover:bg-[#313244]" onClick={() => setZoom(Math.min(200, zoom + 10))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="ghost" size="sm" className="text-[#6c7086] hover:text-[#cdd6f4] hover:bg-[#313244]">
          <Download className="h-4 w-4 mr-1" />
          下载
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex items-center justify-center min-h-full p-8">
          <div
            className="bg-[#181825] shadow-lg border border-[#313244] rounded-lg p-8"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          >
            <div className="w-[600px] h-[800px] flex flex-col items-center justify-center text-[#6c7086]">
              <FileText className="h-16 w-16 mb-4" />
              <p className="text-lg font-medium text-[#cdd6f4]">{documentName}</p>
              <p className="text-sm">PDF 预览区域</p>
              <p className="text-xs mt-4">AI 可以帮助您分析这份文档</p>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// Report Viewer Component (Excel/Tables)
function ReportViewer({ documentName }: { documentName: string }) {
  // Sample data for demo
  const sampleData = [
    { id: 1, name: '产品A', sales: 12500, growth: '+15%' },
    { id: 2, name: '产品B', sales: 8300, growth: '+8%' },
    { id: 3, name: '产品C', sales: 15600, growth: '+22%' },
    { id: 4, name: '产品D', sales: 6200, growth: '-3%' },
    { id: 5, name: '产品E', sales: 9800, growth: '+12%' },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-2 border-b border-[#313244] bg-[#181825]">
        <span className="text-sm font-medium text-[#cdd6f4]">{documentName}</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-[#6c7086] hover:text-[#cdd6f4] hover:bg-[#313244]">
            <Download className="h-4 w-4 mr-1" />
            导出
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#181825]">
                <th className="border border-[#313244] p-2 text-left text-sm font-medium text-[#cdd6f4]">ID</th>
                <th className="border border-[#313244] p-2 text-left text-sm font-medium text-[#cdd6f4]">产品名称</th>
                <th className="border border-[#313244] p-2 text-right text-sm font-medium text-[#cdd6f4]">销售额</th>
                <th className="border border-[#313244] p-2 text-right text-sm font-medium text-[#cdd6f4]">增长率</th>
              </tr>
            </thead>
            <tbody>
              {sampleData.map((row) => (
                <tr key={row.id} className="hover:bg-[#313244]">
                  <td className="border border-[#313244] p-2 text-sm text-[#cdd6f4]">{row.id}</td>
                  <td className="border border-[#313244] p-2 text-sm text-[#cdd6f4]">{row.name}</td>
                  <td className="border border-[#313244] p-2 text-sm text-right text-[#cdd6f4]">¥{row.sales.toLocaleString()}</td>
                  <td
                    className={cn(
                      'border border-[#313244] p-2 text-sm text-right',
                      row.growth.startsWith('+') ? 'text-[#a6e3a1]' : 'text-[#f38ba8]'
                    )}
                  >
                    {row.growth}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="bg-[#89b4fa]/10 border border-[#89b4fa]/20 rounded-lg p-4">
              <p className="text-sm text-[#6c7086]">总销售额</p>
              <p className="text-2xl font-bold text-[#89b4fa]">¥52,400</p>
            </div>
            <div className="bg-[#a6e3a1]/10 border border-[#a6e3a1]/20 rounded-lg p-4">
              <p className="text-sm text-[#6c7086]">平均增长</p>
              <p className="text-2xl font-bold text-[#a6e3a1]">+10.8%</p>
            </div>
            <div className="bg-[#cba6f7]/10 border border-[#cba6f7]/20 rounded-lg p-4">
              <p className="text-sm text-[#6c7086]">产品数量</p>
              <p className="text-2xl font-bold text-[#cba6f7]">5</p>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// Empty State
function EmptyContent() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-[#6c7086]">
      <FileText className="h-16 w-16 mb-4" />
      <p className="text-lg font-medium text-[#cdd6f4]">没有打开的文档</p>
      <p className="text-sm">从左侧双击文件来打开</p>
    </div>
  );
}

export function ContentArea() {
  const { tabs, activeTabId, closeTab, setActiveTab, documents } = useWorkspace();
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Find document by id (recursive)
  const findDocument = (docs: typeof documents, id: string): typeof documents[0] | undefined => {
    for (const doc of docs) {
      if (doc.id === id) return doc;
      if (doc.children) {
        const found = findDocument(doc.children, id);
        if (found) return found;
      }
    }
    return undefined;
  };

  const activeDocument = activeTab ? findDocument(documents, activeTab.documentId) : undefined;

  const getContent = (docId: string) => {
    if (editedContent[docId] !== undefined) {
      return editedContent[docId];
    }
    const doc = findDocument(documents, docId);
    return doc?.content || '';
  };

  const handleContentChange = (docId: string, value: string) => {
    setEditedContent((prev) => ({ ...prev, [docId]: value }));
  };

  return (
    <div className="flex-1 flex flex-col bg-[#1e1e2e] min-w-0 h-full">
      {/* Tabs */}
      {tabs.length > 0 && (
        <div className="flex items-center border-b border-[#313244] bg-[#181825] overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                'flex items-center gap-2 px-3 py-2 border-r border-[#313244] cursor-pointer text-sm',
                'hover:bg-[#313244]',
                activeTabId === tab.id
                  ? 'bg-[#1e1e2e] text-[#cdd6f4] border-t-2 border-t-[#89b4fa]'
                  : 'text-[#6c7086]'
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              <TabIcon type={tab.type} />
              <span className="max-w-[120px] truncate">{tab.name}</span>
              {tab.isDirty && <span className="text-[#89b4fa]">●</span>}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 hover:bg-[#45475a] text-[#6c7086] hover:text-[#cdd6f4]"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {!activeTab ? (
          <EmptyContent />
        ) : activeTab.type === 'editor' ? (
          <TextEditor
            content={getContent(activeTab.documentId)}
            onChange={(value) => handleContentChange(activeTab.documentId, value)}
          />
        ) : activeTab.type === 'viewer' ? (
          <PDFViewer documentName={activeDocument?.name || ''} />
        ) : (
          <ReportViewer documentName={activeDocument?.name || ''} />
        )}
      </div>
    </div>
  );
}
