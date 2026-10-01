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
  const size = 200;
  const radius = 78;
  const strokeWidth = 22;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1F2937] p-5 shadow-xs transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">פילוח הוצאות לפי קטגוריות</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            לחץ על קטגוריה לצפייה במקור העסקאות
          </p>
        </div>
        <span className="text-xs font-mono font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-[#0B0F17] px-2 py-0.5 rounded-md border border-slate-200 dark:border-[#1F2937]">
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
              className="stroke-slate-100 dark:stroke-[#1F2937]"
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
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="cursor-pointer transition-all duration-150"
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
                <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[110px]">
                  {categories[hoveredIdx].category}
                </span>
                <span className="text-base font-bold text-slate-900 dark:text-white font-mono">
                  ₪{categories[hoveredIdx].amount.toLocaleString()}
                </span>
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  {categories[hoveredIdx].percentage}%
                </span>
              </>
            ) : (
              <>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">סך הוצאות</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                  ₪{totalExpense.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  {categories.length} קטגוריות
                </span>
              </>
            )}
          </div>
        </div>

        {/* Legend / Breakdown List */}
        <div className="md:col-span-7 space-y-2">
          {categories.slice(0, 5).map((cat, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <div
                key={cat.category}
                onClick={() => onSelectCategory?.(cat)}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`p-2 rounded-lg cursor-pointer transition-colors flex items-center justify-between text-xs ${
                  isHovered
                    ? 'bg-slate-100 dark:bg-slate-800'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                    {cat.category}
                  </span>
                </div>

                <div className="flex items-center gap-3 font-mono">
                  <span className="text-slate-500 dark:text-slate-400 text-[11px] w-8 text-left">
                    {cat.percentage}%
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    ₪{cat.amount.toLocaleString()}
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
