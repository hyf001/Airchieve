import React from 'react';
import { ImageFilters, DEFAULT_FILTERS } from '../types';

interface FilterToolProps {
  filters: ImageFilters;
  onChange: (filters: ImageFilters) => void;
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}

const Slider: React.FC<SliderProps> = ({ label, value, min, max, step = 1, unit = '', onChange }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-xs text-slate-500">
      <span>{label}</span>
      <span>{value}{unit}</span>
    </div>
    <input
      type="range"
      min={min} max={max} step={step}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full accent-[#00CDD4]"
    />
  </div>
);

const FilterTool: React.FC<FilterToolProps> = ({ filters, onChange }) => {
  const set = (key: keyof ImageFilters) => (v: number) => onChange({ ...filters, [key]: v });

  return (
    <div className="space-y-4">
      <Slider label="亮度" value={filters.brightness} min={50} max={150} unit="%" onChange={set('brightness')} />
      <Slider label="对比度" value={filters.contrast} min={50} max={150} unit="%" onChange={set('contrast')} />
      <Slider label="饱和度" value={filters.saturation} min={0} max={200} unit="%" onChange={set('saturation')} />
      <Slider label="模糊" value={filters.blur} min={0} max={10} step={0.5} unit="px" onChange={set('blur')} />

      <button
        onClick={() => onChange(DEFAULT_FILTERS)}
        className="w-full text-xs text-slate-500 border border-slate-200 rounded-lg py-1.5 hover:bg-slate-50 transition-colors"
      >
        重置滤镜
      </button>
    </div>
  );
};

export default FilterTool;
