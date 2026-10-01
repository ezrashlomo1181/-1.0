import React, { useState } from 'react';
import { CategorySummary } from '../../services/financialCalculations';

interface ExpenseCategoryDonutProps {
  categories: CategorySummary[];
  onSelectCategory?: (category: CategorySummary) => void;
}

export const ExpenseCategoryDonut: React.FC<ExpenseCategoryDonutProps> = ({
  categories,
  onSelectCategory,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const totalExpense = categories.reduce((sum, c) => sum + c.amount, 0);

  // SVG parameters
  const size = 220;
  const radius = 85;
  const strokeWidth = 26;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-5 shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white">פילוח הוצאות לפי קטגוריות</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            לחץ על קטגוריה לצפייה במקור העסקאות המדויק
          </p>
        </div>
        <span className="text-xs font-mono font-medium text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700/50">
          ספטמבר 2026
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Donut Chart */}
        <div className="md:col-span-5 flex justify-center relative">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
            {/* Background ring */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke="#1e293b"
              strokeWidth={strokeWidth}
            />

            {/* Category Slices */}
            {categories.map((cat, idx) => {
              const strokeDasharray = `${(cat.percentage / 100) * circumference} ${circumference}`;
              const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
              accumulatedPercent += cat.percentage;
              const isHovered = hoveredIdx === idx;

              return (
                <circle
                  key={cat.category}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="transparent"
                  stroke={cat.color}
                  strokeWidth={isHovered ? strokeWidth + 5 : strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="cursor-pointer transition-all duration-200"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onClick={() => onSelectCategory?.(cat)}
                />
              );
            })}
          </svg>

          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            {hoveredIdx !== null && categories[hoveredIdx] ? (
              <>
                <span className="text-xs text-slate-400 truncate max-w-[110px]">
                  {categories[hoveredIdx].category}
                </span>
                <span className="text-lg font-bold text-white font-mono">
                  ₪{categories[hoveredIdx].amount.toLocaleString()}
                </span>
                <span className="text-[11px] font-medium text-emerald-400">
                  {categories[hoveredIdx].percentage}% מהסך
                </span>
              </>
            ) : (
              <>
                <span className="text-xs text-slate-400 font-medium">סך הוצאות</span>
                <span className="text-xl font-bold text-white font-mono">
                  ₪{totalExpense.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400">{categories.length} קטגוריות</span>
              </>
            )}
          </div>
        </div>

        {/* Categories Legend List */}
        <div className="md:col-span-7 space-y-1.5 max-h-[230px] overflow-y-auto pr-1">
          {categories.map((cat, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <div
                key={cat.category}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => onSelectCategory?.(cat)}
                className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors border ${
                  isHovered
                    ? 'bg-slate-800 border-slate-600'
                    : 'bg-slate-900/60 border-transparent hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-sm text-slate-200 font-medium truncate">
                    {cat.category}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    ({cat.count} עסקאות)
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-semibold text-slate-100">
                    ₪{cat.amount.toLocaleString()}
                  </span>
                  <span className="text-[11px] font-mono font-medium text-slate-400 w-8 text-left">
                    {cat.percentage}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
