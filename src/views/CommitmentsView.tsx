import React, { useState } from 'react';
import { RecurringCommitment } from '../types/financial';
import {
  CalendarClock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

interface CommitmentsViewProps {
  commitments: RecurringCommitment[];
  onUpdateCommitments: (updated: RecurringCommitment[]) => void;
}

export const CommitmentsView: React.FC<CommitmentsViewProps> = ({
  commitments,
  onUpdateCommitments,
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'review'>('all');

  const totalMonthlyCommitment = commitments
    .filter((c) => c.status === 'active')
    .reduce((sum, c) => sum + c.monthlyAmount, 0);

  const totalAnnualCost = commitments
    .filter((c) => c.status === 'active')
    .reduce((sum, c) => sum + c.estimatedAnnualCost, 0);

  const filtered = commitments.filter((c) => {
    if (filterStatus === 'all') return true;
    return c.status === filterStatus;
  });

  const handleToggleStatus = (id: string, newStatus: 'active' | 'cancelled') => {
    const updated = commitments.map((c) => (c.id === id ? { ...c, status: newStatus } : c));
    onUpdateCommitments(updated);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>התחייבויות, מנויים וחיובים חוזרים</span>
            <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
              {commitments.length} זוהו במערכת
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            זיהוי אוטומטי של הוראות קבע, מנויי שירות, והלוואות חודשיות מתדפיסי הבנקים
          </p>
        </div>

        <div className="flex rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 p-0.5 text-xs">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              filterStatus === 'all'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            הכל ({commitments.length})
          </button>
          <button
            onClick={() => setFilterStatus('active')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              filterStatus === 'active'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            פעילים ({commitments.filter((c) => c.status === 'active').length})
          </button>
          <button
            onClick={() => setFilterStatus('review')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              filterStatus === 'review'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            דורשים בדיקה ({commitments.filter((c) => c.status === 'review').length})
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-4 shadow-xs transition-colors">
          <span className="text-xs text-slate-500 dark:text-slate-400">סך התחייבויות חודשיות</span>
          <div className="text-xl font-bold text-[#BE123C] dark:text-rose-400 font-mono mt-1">
            ₪{totalMonthlyCommitment.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
            יורד אוטומטית בכל חודש
          </span>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-4 shadow-xs transition-colors">
          <span className="text-xs text-slate-500 dark:text-slate-400">עלות שנתית כוללת מוערכת</span>
          <div className="text-xl font-bold text-[#0F172A] dark:text-white font-mono mt-1">
            ₪{totalAnnualCost.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
            חישוב של 12 חודשי פעילות
          </span>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-4 shadow-xs transition-colors">
          <span className="text-xs text-slate-500 dark:text-slate-400">מספר חיובים קבועים</span>
          <div className="text-xl font-bold text-[#0F172A] dark:text-white font-mono mt-1">
            {commitments.filter((c) => c.status === 'active').length} פעילים
          </div>
          <span className="text-[11px] text-[#059669] dark:text-emerald-400 mt-1 block font-medium">
            ללא זיהוי חיובים כפולים
          </span>
        </div>
      </div>

      {/* Commitments Table */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl shadow-xs overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#1F2937] bg-slate-50 dark:bg-[#0B0F17] text-slate-600 dark:text-slate-400 font-medium">
                <th className="py-2.5 px-4 font-medium">ספק / מנוי</th>
                <th className="py-2.5 px-4 font-medium">חשבון משלם</th>
                <th className="py-2.5 px-4 font-medium">קטגוריה</th>
                <th className="py-2.5 px-4 font-medium">יום חיוב בחודש</th>
                <th className="py-2.5 px-4 font-medium text-left">סכום חודשי</th>
                <th className="py-2.5 px-4 font-medium text-left">עלות שנתית</th>
                <th className="py-2.5 px-4 font-medium text-center">סטטוס</th>
                <th className="py-2.5 px-4 font-medium text-center">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1F2937]/70">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-semibold text-[#0F172A] dark:text-white">
                    <div>{c.merchant}</div>
                    {c.serviceDetails && (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                        {c.serviceDetails}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{c.accountName}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#1F2937] text-[11px]">
                      {c.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">
                    {c.billingDayInMonth ? `ב-${c.billingDayInMonth} לחודש` : '—'}
                  </td>
                  <td className="py-3 px-4 text-left font-mono font-bold text-[#BE123C] dark:text-rose-400">
                    ₪{c.monthlyAmount.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-left font-mono text-slate-600 dark:text-slate-300">
                    ₪{c.estimatedAnnualCost.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {c.status === 'active' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#059669] dark:text-emerald-400 font-medium">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>פעיל</span>
                      </span>
                    ) : c.status === 'review' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>לבדיקה</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>בוטל</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    {c.status === 'active' ? (
                      <button
                        onClick={() => handleToggleStatus(c.id, 'cancelled')}
                        className="px-2 py-1 rounded text-[11px] text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 transition-colors cursor-pointer"
                      >
                        סמן כבוטל
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleStatus(c.id, 'active')}
                        className="px-2 py-1 rounded text-[11px] text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 transition-colors cursor-pointer"
                      >
                        הפעל מחדש
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
