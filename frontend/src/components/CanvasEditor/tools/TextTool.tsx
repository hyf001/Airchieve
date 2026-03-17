import React, { useState } from 'react';
import { Type } from 'lucide-react';
import { CanvasLayer } from '../types';

interface TextToolProps {
  stageWidth: number;
  stageHeight: number;
  pageText?: string;
  onAddLayer: (layer: CanvasLayer) => void;
}

const FONT_OPTIONS = [
  { label: '黑体', value: '"PingFang SC", "Microsoft YaHei", sans-serif' },
  { label: '宋体', value: '"Songti SC", "SimSun", serif' },
  { label: '圆体', value: '"PingFang SC", "Noto Sans SC", sans-serif' },
];

const TextTool: React.FC<TextToolProps> = ({ stageWidth, stageHeight, pageText = '', onAddLayer }) => {
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState(36);
  const [color, setColor] = useState('#ffffff');
  const [bold, setBold] = useState(false);
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);

  const handleAdd = () => {
    if (!text.trim()) return;
    const w = Math.round(stageWidth * 0.5);
    const h = Math.round(fontSize * 1.8 * (text.split('\n').length || 1) + 20);
    onAddLayer({
      id: `text-${Date.now()}`,
      type: 'text',
      text: text.trim(),
      fontSize,
      fontFamily,
      color,
      bold,
      x: Math.round((stageWidth - w) / 2),
      y: Math.round((stageHeight - h) / 2),
      width: w,
      height: h,
    });
    setText('');
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={3}
          placeholder="输入文字…"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none outline-none focus:ring-2 focus:ring-[#00CDD4]/30 focus:border-[#00CDD4]"
        />
        {pageText && (
          <button
            onClick={() => setText(pageText)}
            title="填入绘本文字"
            className="absolute bottom-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-[#00CDD4]/15 text-slate-500 hover:text-[#00CDD4] transition-colors"
          >
            填入绘本文字
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">字号</label>
          <input
            type="number"
            min={12} max={120}
            value={fontSize}
            onChange={e => setFontSize(Number(e.target.value))}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-[#00CDD4]/30 focus:border-[#00CDD4]"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">颜色</label>
          <input
            type="color"
            value={color}
            onChange={e => setColor(e.target.value)}
            className="w-full h-9 border border-slate-200 rounded-lg px-1 cursor-pointer"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-500 mb-1 block">字体</label>
        <select
          value={fontFamily}
          onChange={e => setFontFamily(e.target.value)}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none"
        >
          {FONT_OPTIONS.map(f => <option key={f.label} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-600">
        <input type="checkbox" checked={bold} onChange={e => setBold(e.target.checked)} className="accent-[#00CDD4]" />
        加粗
      </label>

      <button
        onClick={handleAdd}
        disabled={!text.trim()}
        className="w-full flex items-center justify-center gap-2 bg-[#00CDD4] hover:bg-[#00b8be] text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Type size={14} />
        添加文字
      </button>
    </div>
  );
};

export default TextTool;
