import React, { useState } from 'react';
import { MonthDataPoint } from '../../services/financialCalculations';

interface CashFlowChartProps {
  data: MonthDataPoint[];
  onMonthClick?: (month: MonthDataPoint) => void;
  personalAverageExpense?: number;
  budgetTargetExpense?: number;
}

export const CashFlowChart: React.FC<CashFlowChartProps> = ({
  data,
  onMonthClick,
  personalAverageExpense,
  budgetTargetExpense,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [period, setPeriod] = useState<'6m' | '12m'>('6m');

  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1F2937] p-8 shadow-xs text-center transition-colors">
        <h3 className="text-sm font-bold text-[#0F172A] dark:text-white mb-1">
          תזרים חודשי: הכנסות, הוצאות וחיסכון
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-2">
          עדיין אין מספיק עסקאות להצגת מגמת תזרים חודשי. לאחר ייבוא תדפיסי בנק או כרטיסי אשראי, התזרים ההיסטורי יחושב ויוצג כאן אוטומטית.
        </p>
      </div>
    );
  }

  // Slice data based on selected period
  const displayData = period === '6m' ? data.slice(-6) : data.slice(-12);

  // SVG dimensions
  const width = 680;
  const height = 250;
  const paddingX = 45;
  const paddingTop = 25;
  const paddingBottom = 45;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingTop - paddingBottom;

  const allValues = [
    ...displayData.map((d) => Math.max(d.income, d.expense, d.savings)),
    personalAverageExpense || 0,
    budgetTargetExpense || 0,
    25000,
  ];
  const maxVal = Math.max(...allValues) * 1.12;

  const getX = (index: number) => {
    if (displayData.length <= 1) return paddingX + chartWidth / 2;
    return paddingX + (index / (displayData.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    return paddingTop + chartHeight - (val / maxVal) * chartHeight;
  };

  const createLinePath = (getter: (d: MonthDataPoint) => number) => {
    return displayData
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(getter(d))}`)
      .join(' ');
  };

  const createAreaPath = (getter: (d: MonthDataPoint) => number) => {
    const line = createLinePath(getter);
    const lastX = getX(displayData.length - 1);
    const firstX = getX(0);
    const bottomY = getY(0);
    return `${line} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  };

  return (
    <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1F2937] p-5 shadow-xs relative overflow-hidden transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">
            תזרים חודשי: הכנסות, הוצאות וחיסכון
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            השוואת תזרים היסטורי מנוטרלת מהעברות פנימיות
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#059669] inline-block"></span>
              <span className="text-slate-600 dark:text-slate-300 font-medium">הכנסה</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#BE123C] inline-block"></span>
              <span className="text-slate-600 dark:text-slate-300 font-medium">הוצאה</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500 dark:bg-slate-400 inline-block"></span>
              <span className="text-slate-600 dark:text-slate-300 font-medium">חיסכון</span>
            </div>
            {Boolean(personalAverageExpense && personalAverageExpense > 0) && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-dashed border-amber-500 inline-block"></span>
                <span className="text-amber-700 dark:text-amber-400 text-[11px] font-medium">ממוצע אישי</span>
              </div>
            )}
            {Boolean(budgetTargetExpense && budgetTargetExpense > 0) && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-dotted border-indigo-500 inline-block"></span>
                <span className="text-indigo-700 dark:text-indigo-400 text-[11px] font-medium">תקציב יעד</span>
              </div>
            )}
          </div>

          <div className="flex rounded-lg border border-slate-200 dark:border-[#1F2937] bg-slate-100 dark:bg-[#0B0F17] p-0.5 text-xs">
            <button
              onClick={() => setPeriod('6m')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                period === '6m'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              6 חודשים
            </button>
            <button
              onClick={() => setPeriod('12m')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                period === '12m'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              כל ההיסטוריה
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
              <stop offset="0%" stopColor="#059669" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#BE123C" stopOpacity="0.07" />
              <stop offset="100%" stopColor="#BE123C" stopOpacity="0.0" />
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
                  className="stroke-slate-200 dark:stroke-[#1F2937]"
                  strokeDasharray="3 3"
                />
                <text
                  x={paddingX - 8}
                  y={y + 4}
                  className="fill-slate-400 dark:fill-slate-500 font-mono text-[10px]"
                  textAnchor="end"
                >
                  ₪{(val / 1000).toFixed(0)}k
                </text>
              </g>
            );
          })}

          {/* Reference Line: Personal Average Expense */}
          {Boolean(personalAverageExpense && personalAverageExpense > 0) && (
            <g>
              <line
                x1={paddingX}
                y1={getY(personalAverageExpense!)}
                x2={width - paddingX}
                y2={getY(personalAverageExpense!)}
                stroke="#F59E0B"
                strokeWidth="1.5"
                strokeDasharray="5 4"
              />
              <text
                x={width - paddingX}
                y={getY(personalAverageExpense!) - 5}
                className="fill-amber-600 dark:fill-amber-400 font-mono text-[10px]"
                textAnchor="end"
              >
                ממוצע אישי: ₪{personalAverageExpense!.toLocaleString()}
              </text>
            </g>
          )}

          {/* Reference Line: Budget Target */}
          {Boolean(budgetTargetExpense && budgetTargetExpense > 0) && (
            <g>
              <line
                x1={paddingX}
                y1={getY(budgetTargetExpense!)}
                x2={width - paddingX}
                y2={getY(budgetTargetExpense!)}
                stroke="#6366F1"
                strokeWidth="1.5"
                strokeDasharray="2 3"
              />
              <text
                x={paddingX + 6}
                y={getY(budgetTargetExpense!) - 5}
                className="fill-indigo-600 dark:fill-indigo-400 font-mono text-[10px]"
                textAnchor="start"
              >
                תקציב יעד: ₪{budgetTargetExpense!.toLocaleString()}
              </text>
            </g>
          )}

          {/* Area Fills */}
          <path d={createAreaPath((d) => d.income)} fill="url(#incomeGrad)" />
          <path d={createAreaPath((d) => d.expense)} fill="url(#expenseGrad)" />

          {/* Lines */}
          <path
            d={createLinePath((d) => d.income)}
            fill="none"
            className="stroke-[#059669]"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d={createLinePath((d) => d.expense)}
            fill="none"
            className="stroke-[#BE123C]"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d={createLinePath((d) => d.savings)}
            fill="none"
            className="stroke-slate-500 dark:stroke-slate-400"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            strokeLinecap="round"
          />

          {/* Data Points and Interaction Circles */}
          {displayData.map((d, i) => {
            const x = getX(i);
            const isHovered = hoveredIdx === i;
            return (
              <g
                key={i}
                className="cursor-pointer"
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
                    className="stroke-slate-400 dark:stroke-slate-600"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                )}

                {/* Circles for points */}
                <circle
                  cx={x}
                  cy={getY(d.income)}
                  r={isHovered ? 4.5 : 2.5}
                  className="fill-[#059669] stroke-white dark:stroke-[#111827]"
                  strokeWidth="2"
                />
                <circle
                  cx={x}
                  cy={getY(d.expense)}
                  r={isHovered ? 4.5 : 2.5}
                  className="fill-[#BE123C] stroke-white dark:stroke-[#111827]"
                  strokeWidth="2"
                />
                <circle
                  cx={x}
                  cy={getY(d.savings)}
                  r={isHovered ? 4 : 2}
                  className="fill-slate-500 dark:fill-slate-400 stroke-white dark:stroke-[#111827]"
                  strokeWidth="1.5"
                />

                {/* X Axis Labels */}
                <text
                  x={x}
                  y={height - 12}
                  className={`text-[11px] ${
                    isHovered
                      ? 'fill-slate-900 dark:fill-white font-semibold'
                      : 'fill-slate-500 dark:fill-slate-400 font-normal'
                  }`}
                  textAnchor="middle"
                >
                  {d.monthLabel}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Box */}
        {hoveredIdx !== null && displayData[hoveredIdx] && (
          <div className="absolute top-2 left-6 bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-3 shadow-md pointer-events-none z-20 min-w-[170px]">
            <div className="text-xs font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-[#1F2937] pb-1 mb-2">
              {displayData[hoveredIdx].monthLabel}
            </div>
            <div className="space-y-1 text-xs font-mono">
              <div className="flex justify-between items-center text-[#059669] dark:text-emerald-400">
                <span>הכנסה:</span>
                <span className="font-bold">₪{displayData[hoveredIdx].income.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-[#BE123C] dark:text-rose-400">
                <span>הוצאה:</span>
                <span className="font-bold">₪{displayData[hoveredIdx].expense.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                <span>חיסכון נטו:</span>
                <span className="font-bold">₪{displayData[hoveredIdx].savings.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
