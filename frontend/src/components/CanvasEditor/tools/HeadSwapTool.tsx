import React, { useRef, useState, useCallback, useEffect } from 'react';
import { removeBackground } from '@imgly/background-removal';
import { Loader2, Upload, Check, RotateCcw } from 'lucide-react';
import { CanvasLayer } from '../types';

interface HeadSwapToolProps {
  stageWidth: number;
  stageHeight: number;
  onAddLayer: (layer: CanvasLayer) => void;
}

/** 裁剪框，坐标为相对图片的比例 0~1 */
interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'move';

const MIN = 0.05;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** 把背景已去除的图片按裁剪框裁出，返回 base64 PNG */
async function cropImage(imgUrl: string, rect: CropRect): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const sw = Math.round(img.naturalWidth * rect.w);
      const sh = Math.round(img.naturalHeight * rect.h);
      const sx = Math.round(img.naturalWidth * rect.x);
      const sy = Math.round(img.naturalHeight * rect.y);
      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = imgUrl;
  });
}

/* ────────────────────────── 裁剪 UI ────────────────────────── */
interface CropSelectorProps {
  imgUrl: string;
  onConfirm: (rect: CropRect) => void;
  onReset: () => void;
}

const CropSelector: React.FC<CropSelectorProps> = ({ imgUrl, onConfirm, onReset }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // 默认选取顶部 45%、居中 80% 作为初始裁剪框（适合大头/半身）
  const [rect, setRect] = useState<CropRect>({ x: 0.1, y: 0, w: 0.8, h: 0.45 });

  const drag = useRef<{
    handle: Handle;
    startMx: number; startMy: number;
    startRect: CropRect;
    imgW: number; imgH: number;
  } | null>(null);

  const toRel = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return { rx: 0, ry: 0 };
    const { left, top, width, height } = el.getBoundingClientRect();
    return {
      rx: (clientX - left) / width,
      ry: (clientY - top) / height,
    };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent, handle: Handle) => {
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    drag.current = {
      handle,
      startMx: e.clientX,
      startMy: e.clientY,
      startRect: { ...rect },
      imgW: width,
      imgH: height,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [rect]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startMx) / d.imgW;
    const dy = (e.clientY - d.startMy) / d.imgH;
    const r = { ...d.startRect };

    if (d.handle === 'move') {
      r.x = clamp(r.x + dx, 0, 1 - r.w);
      r.y = clamp(r.y + dy, 0, 1 - r.h);
    } else {
      if (d.handle === 'nw' || d.handle === 'sw') {
        const newX = clamp(r.x + dx, 0, r.x + r.w - MIN);
        r.w = r.x + r.w - newX;
        r.x = newX;
      }
      if (d.handle === 'ne' || d.handle === 'se') {
        r.w = clamp(r.w + dx, MIN, 1 - r.x);
      }
      if (d.handle === 'nw' || d.handle === 'ne') {
        const newY = clamp(r.y + dy, 0, r.y + r.h - MIN);
        r.h = r.y + r.h - newY;
        r.y = newY;
      }
      if (d.handle === 'sw' || d.handle === 'se') {
        r.h = clamp(r.h + dy, MIN, 1 - r.y);
      }
    }
    setRect(r);
  }, []);

  const handlePointerUp = useCallback(() => { drag.current = null; }, []);

  const HANDLE_SIZE = 10;
  const hStyle = (cursor: string): React.CSSProperties => ({
    position: 'absolute',
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    background: 'white',
    border: '2px solid #00CDD4',
    borderRadius: 2,
    cursor,
    transform: 'translate(-50%, -50%)',
    zIndex: 10,
    touchAction: 'none',
  });

  return (
    <div className="space-y-2">
      {/* 图片 + 裁剪框 */}
      <div
        ref={containerRef}
        className="relative w-full rounded-lg overflow-hidden select-none"
        style={{
          backgroundImage: 'linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%)',
          backgroundSize: '12px 12px',
          backgroundPosition: '0 0,0 6px,6px -6px,-6px 0',
          backgroundColor: '#f0f0f0',
          touchAction: 'none',
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <img src={imgUrl} draggable={false} className="w-full h-auto block pointer-events-none" />

        {/* 暗色遮罩 + 裁剪框 */}
        <div
          style={{
            position: 'absolute',
            left: `${rect.x * 100}%`,
            top: `${rect.y * 100}%`,
            width: `${rect.w * 100}%`,
            height: `${rect.h * 100}%`,
            outline: '9999px solid rgba(0,0,0,0.52)',
            border: '2px solid #00CDD4',
            cursor: 'move',
            boxSizing: 'border-box',
            touchAction: 'none',
          }}
          onPointerDown={e => handlePointerDown(e, 'move')}
        >
          {/* 网格线 */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {[33, 66].map(p => (
              <React.Fragment key={p}>
                <div style={{ position: 'absolute', left: `${p}%`, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.35)' }} />
                <div style={{ position: 'absolute', top: `${p}%`, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.35)' }} />
              </React.Fragment>
            ))}
          </div>

          {/* 四角拖拽手柄 */}
          {(['nw','ne','sw','se'] as const).map(h => (
            <div
              key={h}
              style={{
                ...hStyle(h === 'nw' || h === 'se' ? 'nw-resize' : 'ne-resize'),
                left:   h.includes('w') ? 0   : '100%',
                top:    h.includes('n') ? 0   : '100%',
              }}
              onPointerDown={e => handlePointerDown(e, h)}
            />
          ))}
        </div>
      </div>

      <p className="text-[11px] text-slate-400 text-center">拖动边框移动，拖动四角调整大小</p>

      <div className="flex gap-2">
        <button
          onClick={onReset}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-sm text-slate-500 hover:bg-slate-50 transition-colors"
        >
          <RotateCcw size={13} />重新上传
        </button>
        <button
          onClick={() => onConfirm(rect)}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#00CDD4] hover:bg-[#00b8be] text-white py-2 text-sm font-medium transition-colors"
        >
          <Check size={13} />确认截取
        </button>
      </div>
    </div>
  );
};

/* ───────────────────────── 主组件 ───────────────────────── */

const HeadSwapTool: React.FC<HeadSwapToolProps> = ({ stageWidth, stageHeight, onAddLayer }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<'idle' | 'removing' | 'crop' | 'done'>('idle');
  const [removedUrl, setRemovedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 清理 object URL
  useEffect(() => () => { if (removedUrl) URL.revokeObjectURL(removedUrl); }, [removedUrl]);

  const handleFile = async (file: File) => {
    setError(null);
    setPhase('removing');
    try {
      const blob = await removeBackground(file, { model: 'isnet_quint8' });
      setRemovedUrl(URL.createObjectURL(blob));
      setPhase('crop');
    } catch (e) {
      setError(e instanceof Error ? e.message : '去除背景失败');
      setPhase('idle');
    }
  };

  const handleConfirm = async (rect: CropRect) => {
    if (!removedUrl) return;
    try {
      const base64 = await cropImage(removedUrl, rect);
      const defaultH = Math.round(stageHeight * 0.32);
      const ar = rect.w / rect.h;
      const defaultW = Math.round(defaultH * ar);
      onAddLayer({
        id: `head-${Date.now()}`,
        type: 'image',
        src: base64,
        x: Math.round((stageWidth - defaultW) / 2),
        y: Math.round((stageHeight - defaultH) / 2),
        width: defaultW,
        height: defaultH,
      });
      setPhase('done');
    } catch {
      setError('裁剪失败');
    }
  };

  const reset = () => {
    setPhase('idle');
    setRemovedUrl(null);
    setError(null);
  };

  if (phase === 'idle' || phase === 'removing') {
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-500">上传人物照片，去除背景后手动框选头部区域。</p>
        <button
          disabled={phase === 'removing'}
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-6 text-sm text-slate-500 hover:border-[#00CDD4] hover:text-[#00CDD4] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {phase === 'removing' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {phase === 'removing' ? '去除背景中…' : '点击上传照片'}
        </button>
        <input
          ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  if (phase === 'crop' && removedUrl) {
    return <CropSelector imgUrl={removedUrl} onConfirm={handleConfirm} onReset={reset} />;
  }

  // done
  return (
    <div className="space-y-3">
      <p className="text-xs text-green-600">头部已添加到画布，可拖拽调整位置和大小。</p>
      <button
        onClick={reset}
        className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-sm text-slate-500 hover:bg-slate-50 transition-colors"
      >
        <Upload size={13} />再添加一个
      </button>
    </div>
  );
};

export default HeadSwapTool;
