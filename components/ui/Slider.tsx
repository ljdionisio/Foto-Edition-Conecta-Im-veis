import React from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
  resetValue?: number;
}

const Slider: React.FC<SliderProps> = ({ label, value, min, max, step = 1, onChange, resetValue }) => {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <label className="text-xs font-medium text-gray-300 uppercase tracking-wider">{label}</label>
        <div className="flex items-center gap-2">
            <span className="text-xs text-white font-mono bg-white/10 px-1.5 rounded">{value}</span>
            {resetValue !== undefined && value !== resetValue && (
                <button 
                    onClick={() => onChange(resetValue)}
                    className="text-[10px] text-violet-400 hover:text-violet-300"
                >
                    Redefinir
                </button>
            )}
        </div>
      </div>
      <div className="relative w-full h-6 flex items-center">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-violet-500 hover:accent-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
        />
      </div>
    </div>
  );
};

export default Slider;