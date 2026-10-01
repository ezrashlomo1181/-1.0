import React, { useState } from 'react';
import { MonthDataPoint } from '../../services/financialCalculations';

interface CashFlowChartProps {
  data: MonthDataPoint[];
  onMonthClick?: (month: MonthDataPoint) => void;
}

export const CashFlowChart: React.FC<CashFlowChartProps> = ({ data, onMonthClick }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [period, setPeriod] = useState<'6m' | '12m'>('6m');

  // SVG dimensions
  const width = 680;
  const height = 240;
  const paddingX = 45;
  const paddingTop = 25;
  const paddingBottom = 40;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.income, d.expense, d.savings)),
    28000
  ) * 1.1;

  const getX = (index: number) => {
    if (data.length <= 1) return paddingX;
    return paddingX + (index / (data.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    return paddingTop + chartHeight - (val / maxVal) * chartHeight;
  };

  // Generate SVG path for a line
  const createLinePath = (getter: (d: MonthDataPoint) => number) => {
    return data
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(getter(d))}`)
      .join(' ');
  };

  const createAreaPath = (getter: (d: MonthDataPoint) => number) => {
    const line = createLinePath(getter);
    const lastX = getX(data.length - 1);
    const firstX = getX(0);
    const bottomY = getY(0);
    return `${line} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  };

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-5 shadow-xl relative overflow-hidden backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <h3 className="text-base font-semibold text-white">תזרים חודשי: הכנסות, הוצאות וחיסכון</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            השוואת תזרים היסטורי מנוטרלת מהעברות פנימיות ופירעונות כפולים
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Legend */}
          <div className="flex items-center gap-3 text-xs ml-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-sm bg-emerald-400 inline-block"></span>
              <span className="text-slate-300">הכנסה</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-sm bg-rose-400 inline-block"></span>
              <span className="text-slate-300">הוצאה</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-sm bg-indigo-400 inline-block"></span>
              <span className="text-slate-300">חיסכון</span>
            </div>
          </div>

          <div className="flex rounded-lg border border-slate-700/60 bg-slate-800/60 p-0.5 text-xs">
            <button
              onClick={() => setPeriod('6m')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                period === '6m' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              6 חודשים
            </button>
            <button
              onClick={() => setPeriod('12m')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                period === '12m' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              12 חודשים
            </button>
          </div>
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[550px]"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = paddingTop + chartHeight * ratio;
            const val = Math.round(maxVal * (1 - ratio));
            return (
              <g key={i}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="#334155"
                  strokeDasharray="4 4"
                  strokeOpacity="0.35"
                />
                <text
                  x={paddingX - 8}
                  y={y + 4}
                  fill="#64748b"
                  fontSize="10"
                  textAnchor="end"
                  className="font-mono"
                >
                  ₪{(val / 1000).toFixed(0)}k
                </text>
              </g>
            );
          })}

          {/* Area Fills */}
          <path d={createAreaPath((d) => d.income)} fill="url(#incomeGrad)" />
          <path d={createAreaPath((d) => d.expense)} fill="url(#expenseGrad)" />

          {/* Lines */}
          <path
            d={createLinePath((d) => d.income)}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d={createLinePath((d) => d.expense)}
            fill="none"
            stroke="#f43f5e"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d={createLinePath((d) => d.savings)}
            fill="none"
            stroke="#818cf8"
            strokeWidth="2"
            strokeDasharray="5 3"
            strokeLinecap="round"
          />

          {/* Data Points and Interaction Circles */}
          {data.map((d, i) => {
            const x = getX(i);
            const isHovered = hoveredIdx === i;
            return (
              <g
                key={i}
                className="cursor-pointer transition-transform"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => onMonthClick?.(d)}
              >
                {/* Vertical hover line */}
                {isHovered && (
                  <line
                    x1={x}
                    y1={paddingTop}
                    x2={x}
                    y2={paddingTop + chartHeight}
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                )}

                {/* Circles for points */}
                <circle
                  cx={x}
                  cy={getY(d.income)}
                  r={isHovered ? 5.5 : 3.5}
                  fill="#10b981"
                  stroke="#0f172a"
                  strokeWidth="2"
                />
                <circle
                  cx={x}
                  cy={getY(d.expense)}
                  r={isHovered ? 5.5 : 3.5}
                  fill="#f43f5e"
                  stroke="#0f172a"
                  strokeWidth="2"
                />
                <circle
                  cx={x}
                  cy={getY(d.savings)}
                  r={isHovered ? 5 : 3}
                  fill="#818cf8"
                  stroke="#0f172a"
                  strokeWidth="1.5"
                />

                {/* X Axis Labels */}
                <text
                  x={x}
                  y={height - 12}
                  fill={isHovered ? '#f8fafc' : '#94a3b8'}
                  fontSize="11"
                  fontWeight={isHovered ? '600' : '400'}
                  textAnchor="middle"
                >
                  {d.monthLabel}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Box */}
        {hoveredIdx !== null && data[hoveredIdx] && (
          <div
            className="absolute top-2 left-6 bg-slate-800/95 border border-slate-700/80 rounded-xl p-3 shadow-2xl backdrop-blur-md pointer-events-none z-20 min-w-[170px]"
          >
            <div className="text-xs font-bold text-white border-b border-slate-700 pb-1 mb-2">
              {data[hoveredIdx].monthLabel} 2026
            </div>
            <div className="space-y-1 text-xs font-mono">
              <div className="flex justify-between items-center text-emerald-400">
                <span className="font-sans text-slate-300">הכנסה:</span>
                <span>₪{data[hoveredIdx].income.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-rose-400">
                <span className="font-sans text-slate-300">הוצאות:</span>
                <span>₪{data[hoveredIdx].expense.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-indigo-400 pt-1 border-t border-slate-700/60 font-semibold">
                <span className="font-sans text-slate-300">חיסכון נטו:</span>
                <span>₪{data[hoveredIdx].savings.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
