import React from 'react';

interface LoadingSpinnerProps {
  size?: number;
  /** Kept for API compatibility, no longer used */
  color?: string;
  text?: string;
  className?: string;
}

const BRAND = '#00CDD4';
const DARK  = '#008a90';

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 32,
  text,
  className = '',
}) => {
  const scale = size / 32;

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <style>{`
        @keyframes aich-crawl {
          0%, 100% { transform: translateX(-10px); }
          50%       { transform: translateX(10px);  }
        }
        @keyframes aich-bob {
          0%, 100% { transform: translateY(0);    }
          50%       { transform: translateY(-3px); }
        }
      `}</style>

      {/* Scale wrapper — separate from animation to avoid transform override */}
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'center', display: 'inline-flex' }}>
        {/* Crawl wrapper */}
        <div style={{ animation: 'aich-crawl 2s ease-in-out infinite' }}>
          <svg width="90" height="38" viewBox="0 0 90 38" fill="none" xmlns="http://www.w3.org/2000/svg">

            {/* Tail segment */}
            <g style={{ animation: 'aich-bob 0.9s ease-in-out infinite', animationDelay: '0.36s' }}>
              <circle cx="10" cy="26" r="7" fill={BRAND} opacity="0.5" />
            </g>

            {/* Segment 3 */}
            <g style={{ animation: 'aich-bob 0.9s ease-in-out infinite', animationDelay: '0.27s' }}>
              <circle cx="23" cy="24" r="8" fill={BRAND} opacity="0.65" />
            </g>

            {/* Segment 2 */}
            <g style={{ animation: 'aich-bob 0.9s ease-in-out infinite', animationDelay: '0.18s' }}>
              <circle cx="37" cy="23" r="9" fill={BRAND} opacity="0.8" />
            </g>

            {/* Segment 1 */}
            <g style={{ animation: 'aich-bob 0.9s ease-in-out infinite', animationDelay: '0.09s' }}>
              <circle cx="52" cy="23" r="9.5" fill={BRAND} opacity="0.92" />
            </g>

            {/* Head */}
            <g style={{ animation: 'aich-bob 0.9s ease-in-out infinite', animationDelay: '0s' }}>
              <circle cx="68" cy="21" r="12" fill={BRAND} />
              {/* Eyes */}
              <circle cx="63.5" cy="18" r="2"   fill="white" />
              <circle cx="72"   cy="18" r="2"   fill="white" />
              <circle cx="64.2" cy="18.6" r="0.9" fill={DARK} />
              <circle cx="72.7" cy="18.6" r="0.9" fill={DARK} />
              {/* Smile */}
              <path d="M64 24 Q68 28 72 24" stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round" />
              {/* Antennae */}
              <line x1="63" y1="10" x2="60" y2="3" stroke={DARK} strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="59.5" cy="2" r="2" fill={DARK} />
              <line x1="71" y1="10" x2="74" y2="3" stroke={DARK} strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="74.5" cy="2" r="2" fill={DARK} />
            </g>

          </svg>
        </div>
      </div>

      {text && <p className="text-slate-500 text-sm">{text}</p>}
    </div>
  );
};

export default LoadingSpinner;
