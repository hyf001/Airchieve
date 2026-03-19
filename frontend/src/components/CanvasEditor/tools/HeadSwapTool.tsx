import React, { useRef, useState, useEffect } from 'react';
import { removeBackground } from '@imgly/background-removal';
import { Loader2, Upload, Check, RotateCcw } from 'lucide-react';
import { CanvasLayer } from '../types';

interface HeadSwapToolProps {
  stageWidth: number;
  stageHeight: number;
  onAddLayer: (layer: CanvasLayer) => void;
}

type Point = { x: number; y: number }; // normalized 0~1 relative to image

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Build an 8-point octagon from normalized face bbox, expanded to include hair/ears */
function buildHeadPolygon(fx: number, fy: number, fw: number, fh: number): Point[] {
  const top    = clamp(fy - fh * 0.75, 0, 1); // room for hair above face
  const bottom = clamp(fy + fh * 1.10, 0, 1); // just below chin
  const left   = clamp(fx - fw * 0.28, 0, 1); // room for ears
  const right  = clamp(fx + fw * 1.28, 0, 1);
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  const rx = (right - left) / 2;
  const ry = (bottom - top) / 2;
  return [
    { x: cx,           y: top },
    { x: cx + rx * 0.7, y: top + ry * 0.3 },
    { x: right,         y: cy },
    { x: cx + rx * 0.7, y: bottom - ry * 0.3 },
    { x: cx,            y: bottom },
    { x: cx - rx * 0.7, y: bottom - ry * 0.3 },
    { x: left,          y: cy },
    { x: cx - rx * 0.7, y: top + ry * 0.3 },
  ];
}

function defaultPolygon(): Point[] {
  return buildHeadPolygon(0.1, 0.02, 0.8, 0.42);
}

/** Run MediaPipe face detection and return head polygon, or null on failure */
async function detectHeadPolygon(dataUrl: string): Promise<Point[] | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mp = await import(/* @vite-ignore */ '@mediapipe/tasks-vision') as any;
    const FaceDetector = mp.FaceDetector ?? mp.default?.FaceDetector;
    const FilesetResolver = mp.FilesetResolver ?? mp.default?.FilesetResolver;
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );
    const detector = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
        delegate: 'GPU',
      },
      runningMode: 'IMAGE',
      minDetectionConfidence: 0.4,
    });

    const img = new Image();
    img.src = dataUrl;
    await new Promise<void>(res => { img.onload = () => res(); });

    const result = detector.detect(img);
    detector.close();

    if (!result.detections.length) return null;

    // Pick detection with largest area
    const best = result.detections.reduce((a, b) => {
      const aA = (a.boundingBox?.width ?? 0) * (a.boundingBox?.height ?? 0);
      const bA = (b.boundingBox?.width ?? 0) * (b.boundingBox?.height ?? 0);
      return bA > aA ? b : a;
    });

    const bb = best.boundingBox!;
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    return buildHeadPolygon(bb.originX / W, bb.originY / H, bb.width / W, bb.height / H);
  } catch (e) {
    console.warn('[HeadSwap] face detection failed:', e);
    return null;
  }
}

/** Crop a rectangular bbox from original image, returns blob */
async function cropRectToBlob(imgUrl: string, x: number, y: number, w: number, h: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const W = img.naturalWidth;
      const H = img.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * W);
      canvas.height = Math.round(h * H);
      canvas.getContext('2d')!.drawImage(img, Math.round(x * W), Math.round(y * H), canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
    };
    img.onerror = reject;
    img.src = imgUrl;
  });
}

/** Apply polygon mask to a bg-removed image (polygon coords relative to bbox) */
async function applyPolygonMask(imgUrl: string, points: Point[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const W = img.naturalWidth;
      const H = img.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d')!;
      ctx.beginPath();
      points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x * W, p.y * H);
        else ctx.lineTo(p.x * W, p.y * H);
      });
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = imgUrl;
  });
}

/* ─────────────────────── Polygon Crop Selector ─────────────────────── */

interface PolygonCropSelectorProps {
  imgUrl: string;
  initialPoints: Point[];
  onConfirm: (points: Point[]) => void;
  onReset: () => void;
  processing?: boolean;
}

const PolygonCropSelector: React.FC<PolygonCropSelectorProps> = ({
  imgUrl, initialPoints, onConfirm, onReset, processing = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<Point[]>(initialPoints);
  const dragRef = useRef<{ idx: number; ox: number; oy: number; pt: Point } | null>(null);

  const startDragVertex = (e: React.PointerEvent, idx: number) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { idx, ox: e.clientX, oy: e.clientY, pt: points[idx] };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const el = containerRef.current!;
    const { width, height } = el.getBoundingClientRect();
    const dx = (e.clientX - d.ox) / width;
    const dy = (e.clientY - d.oy) / height;
    setPoints(prev => prev.map((p, i) =>
      i === d.idx ? { x: clamp(d.pt.x + dx, 0, 1), y: clamp(d.pt.y + dy, 0, 1) } : p
    ));
  };

  const handlePointerUp = () => { dragRef.current = null; };

  const removeVertex = (idx: number) => {
    if (points.length <= 3) return;
    setPoints(prev => prev.filter((_, i) => i !== idx));
  };

  const addVertexAfter = (afterIdx: number) => {
    const a = points[afterIdx];
    const b = points[(afterIdx + 1) % points.length];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    setPoints(prev => [
      ...prev.slice(0, afterIdx + 1),
      mid,
      ...prev.slice(afterIdx + 1),
    ]);
  };

  const polyStr = points.map(p => `${p.x},${p.y}`).join(' ');
  const overlayPath = `M0,0 H1 V1 H0 Z M${polyStr} Z`;

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="relative w-full rounded-lg overflow-hidden select-none"
        style={{
          backgroundImage:
            'linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%)',
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

        {/* SVG overlay: dark mask + polygon outline */}
        <svg
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          {/* Dark area outside polygon */}
          <path d={overlayPath} fill="rgba(0,0,0,0.52)" fillRule="evenodd" />
          {/* Polygon outline */}
          <polygon
            points={polyStr}
            fill="none"
            stroke="#00CDD4"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Edge midpoint handles — click to add vertex */}
        {points.map((p, i) => {
          const next = points[(i + 1) % points.length];
          const mx = (p.x + next.x) / 2;
          const my = (p.y + next.y) / 2;
          return (
            <div
              key={`mid-${i}`}
              style={{
                position: 'absolute',
                left: `${mx * 100}%`,
                top: `${my * 100}%`,
                width: 5, height: 5,
                background: 'rgba(0,205,212,0.5)',
                borderRadius: '50%',
                transform: 'translate(-50%, -50%)',
                cursor: 'copy',
                zIndex: 15,
                touchAction: 'none',
              }}
              onClick={(e) => { e.stopPropagation(); addVertexAfter(i); }}
            />
          );
        })}

        {/* Vertex handles — drag to move, double-click to remove */}
        {points.map((p, i) => (
          <div
            key={`v-${i}`}
            style={{
              position: 'absolute',
              left: `${p.x * 100}%`,
              top: `${p.y * 100}%`,
              width: 7, height: 7,
              background: '#00CDD4',
              borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              cursor: 'grab',
              zIndex: 20,
              touchAction: 'none',
            }}
            onPointerDown={e => startDragVertex(e, i)}
            onDoubleClick={() => removeVertex(i)}
          />
        ))}

        {/* Processing overlay */}
        {processing && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/75 z-30 rounded-lg">
            <Loader2 size={20} className="animate-spin text-[#00CDD4]" />
            <span className="ml-2 text-sm text-slate-500">去除背景中…</span>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-400 text-center">
        拖动顶点调整轮廓 · 双击顶点删除 · 点击边线中点加顶点
      </p>

      <div className="flex gap-2">
        <button
          onClick={onReset}
          disabled={processing}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-sm text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          <RotateCcw size={13} />重新上传
        </button>
        <button
          onClick={() => onConfirm(points)}
          disabled={processing}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#00CDD4] hover:bg-[#00b8be] text-white py-2 text-sm font-medium disabled:opacity-50 transition-colors"
        >
          <Check size={13} />确认截取
        </button>
      </div>
    </div>
  );
};

/* ─────────────────────── Main Component ─────────────────────── */

const HeadSwapTool: React.FC<HeadSwapToolProps> = ({ stageWidth, stageHeight, onAddLayer }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<'idle' | 'detecting' | 'crop' | 'processing' | 'done'>('idle');
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [initialPolygon, setInitialPolygon] = useState<Point[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (originalUrl?.startsWith('blob:')) URL.revokeObjectURL(originalUrl);
    };
  }, [originalUrl]);

  const handleFile = async (file: File) => {
    setError(null);
    setPhase('detecting');
    try {
      // Convert to data URL for display + face detection
      const dataUrl = await fileToDataUrl(file);
      setOriginalUrl(dataUrl);

      // Face detection — shows crop UI immediately, no bg removal yet
      const polygon = await detectHeadPolygon(dataUrl);
      setInitialPolygon(polygon ?? defaultPolygon());
      setPhase('crop');
    } catch (e) {
      setError(e instanceof Error ? e.message : '处理失败');
      setPhase('idle');
    }
  };

  const handleConfirm = async (points: Point[]) => {
    if (!originalUrl) return;
    setPhase('processing');
    try {
      // Polygon bounding box (normalized)
      const xs = points.map(p => p.x);
      const ys = points.map(p => p.y);
      const bx = Math.min(...xs), by = Math.min(...ys);
      const bw = Math.max(...xs) - bx, bh = Math.max(...ys) - by;

      // 1. Rectangular crop from original (clean image for bg removal)
      const rectBlob = await cropRectToBlob(originalUrl, bx, by, bw, bh);

      // 2. Remove background on the small rect crop (isnet_fp16: better quality)
      const removedBlob = await removeBackground(rectBlob, { model: 'isnet_fp16' });
      const removedUrl = URL.createObjectURL(removedBlob);

      // 3. Apply polygon mask (coords relative to bbox)
      const polyInBbox = points.map(p => ({ x: (p.x - bx) / bw, y: (p.y - by) / bh }));
      const base64 = await applyPolygonMask(removedUrl, polyInBbox);
      URL.revokeObjectURL(removedUrl);

      const ar = bw / bh;
      const layerH = Math.round(stageHeight * 0.35);
      const layerW = Math.round(layerH * ar);

      onAddLayer({
        id: `head-${Date.now()}`,
        type: 'image',
        src: base64,
        x: Math.round((stageWidth - layerW) / 2),
        y: Math.round((stageHeight - layerH) / 2),
        width: layerW,
        height: layerH,
      });
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : '处理失败');
      setPhase('crop');
    }
  };

  const reset = () => {
    setPhase('idle');
    setOriginalUrl(null);
    setError(null);
  };

  if (phase === 'idle' || phase === 'detecting') {
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-500">上传人物照片，自动识别头部区域（含发型、耳朵）并截取。</p>
        <p className="text-xs text-slate-400">建议：正面或略侧面人像，头部清晰完整，背景简洁，尽量减少衣领露出，避免多人合影或遮挡面部。</p>
        <button
          disabled={phase === 'detecting'}
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-6 text-sm text-slate-500 hover:border-[#00CDD4] hover:text-[#00CDD4] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {phase === 'detecting'
            ? <Loader2 size={16} className="animate-spin" />
            : <Upload size={16} />}
          {phase === 'detecting' ? '识别头部区域中…' : '点击上传照片'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  if ((phase === 'crop' || phase === 'processing') && originalUrl) {
    return (
      <PolygonCropSelector
        imgUrl={originalUrl}
        initialPoints={initialPolygon}
        onConfirm={handleConfirm}
        onReset={reset}
        processing={phase === 'processing'}
      />
    );
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
