import React from 'react';

interface ProgressCaterpillarProps {
  /** 0–100 */
  progress: number;
  showLabel?: boolean;
  className?: string;
}

const BRAND   = '#00CDD4';
const DARK    = '#008a90';
const CAT_W   = 72;
const CAT_H   = 30;
const HEAD_CX = 57; // head center x inside the SVG viewBox

const ProgressCaterpillar: React.FC<ProgressCaterpillarProps> = ({
  progress,
  showLabel = false,
  className = '',
}) => {
  const pct = Math.max(0, Math.min(100, progress));

  // Clamp caterpillar so it never overflows either edge
  const catLeft = `max(0px, min(calc(100% - ${CAT_W}px), calc(${pct}% - ${HEAD_CX}px)))`;

  return (
    <div className={`w-full ${className}`}>
      <style>{`
        @keyframes aich-bob {
          0%, 100% { transform: translateY(0);    }
          50%       { transform: translateY(-3px); }
        }
      `}</style>

      {/* Track + caterpillar container */}
      <div className="relative w-full" style={{ height: CAT_H + 12 }}>

        {/* Empty track */}
        <div
          className="absolute bottom-0 left-0 right-0 rounded-full"
          style={{ height: 8, background: '#e2e8f0' }}
        />

        {/* Filled track */}
        <div
          className="absolute bottom-0 left-0 rounded-full"
          style={{
            height: 8,
            width: `${pct}%`,
            background: BRAND,
            transition: 'width 0.4s ease-out',
          }}
        />

        {/* Caterpillar */}
        <div
          style={{
            position: 'absolute',
            bottom: 4,
            left: catLeft,
            width: CAT_W,
            height: CAT_H,
            transition: 'left 0.4s ease-out',
          }}
        >
          <svg width={CAT_W} height={CAT_H} viewBox="0 0 72 30" fill="none" xmlns="http://www.w3.org/2000/svg">

            {/* Tail */}
            <g style={{ animation: 'aich-bob 0.9s ease-in-out infinite', animationDelay: '0.36s' }}>
              <circle cx="7"  cy="22" r="5.5" fill={BRAND} opacity="0.5"  />
            </g>
            {/* Segment 3 */}
            <g style={{ animation: 'aich-bob 0.9s ease-in-out infinite', animationDelay: '0.27s' }}>
              <circle cx="18" cy="20" r="6.5" fill={BRAND} opacity="0.65" />
            </g>
            {/* Segment 2 */}
            <g style={{ animation: 'aich-bob 0.9s ease-in-out infinite', animationDelay: '0.18s' }}>
              <circle cx="30" cy="19" r="7"   fill={BRAND} opacity="0.8"  />
            </g>
            {/* Segment 1 */}
            <g style={{ animation: 'aich-bob 0.9s ease-in-out infinite', animationDelay: '0.09s' }}>
              <circle cx="43" cy="19" r="7.5" fill={BRAND} opacity="0.92" />
            </g>
            {/* Head */}
            <g style={{ animation: 'aich-bob 0.9s ease-in-out infinite', animationDelay: '0s' }}>
              <circle cx="57" cy="17" r="10" fill={BRAND} />
              {/* Eyes */}
              <circle cx="53"   cy="14"   r="1.6" fill="white" />
              <circle cx="61"   cy="14"   r="1.6" fill="white" />
              <circle cx="53.6" cy="14.6" r="0.7" fill={DARK}  />
              <circle cx="61.6" cy="14.6" r="0.7" fill={DARK}  />
              {/* Smile */}
              <path d="M53 20 Q57 23.5 61 20" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round" />
              {/* Antennae */}
              <line x1="53" y1="8"  x2="50.5" y2="2.5" stroke={DARK} strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="50"   cy="2"   r="1.5" fill={DARK} />
              <line x1="60" y1="8"  x2="62.5" y2="2.5" stroke={DARK} strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="63"   cy="2"   r="1.5" fill={DARK} />
            </g>

          </svg>
        </div>
      </div>

      {showLabel && (
        <div className="flex justify-end mt-1">
          <span className="text-xs text-slate-400 font-medium">{Math.round(pct)}%</span>
        </div>
      )}
    </div>
  );
};

export default ProgressCaterpillar;
