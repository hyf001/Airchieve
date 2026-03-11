import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: number;
  /** Tailwind color class, e.g. "text-[#00CDD4]" or "text-indigo-500" */
  color?: string;
  text?: string;
  /** Extra classes for the wrapping container */
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 32,
  color = 'text-[#00CDD4]',
  text,
  className = '',
}) => (
  <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
    <Loader2 size={size} className={`animate-spin ${color}`} />
    {text && <p className="text-slate-500 text-sm">{text}</p>}
  </div>
);

export default LoadingSpinner;
