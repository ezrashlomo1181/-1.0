import React, { useState } from 'react';
import { RecurringCommitment } from '../types/financial';
import {
  CalendarClock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Plus,
  Tv,
  CreditCard,
  Building,
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
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>התחייבויות, מנויים וחיובים חוזרים</span>
            <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-700">
              {commitments.length} זוהו במערכת
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            זיהוי אוטומטי של הוראות קבע, מנויי שירות, והלוואות חודשיות מתדפיסי הבנקים
          </p>
        </div>

        <div className="flex rounded-xl border border-slate-700/80 bg-slate-800/80 p-0.5 text-xs">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filterStatus === 'all' ? 'bg-slate-700 text-white font-semibold' : 'text-slate-400'
            }`}
          >
            הכל ({commitments.length})
          </button>
          <button
            onClick={() => setFilterStatus('active')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filterStatus === 'active' ? 'bg-slate-700 text-white font-semibold' : 'text-slate-400'
            }`}
          >
            פעילים בלבד
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs text-slate-400">עלות התחייבויות חודשית משוערת</span>
          <div className="text-2xl font-bold text-rose-400 font-mono mt-1">
            ₪{totalMonthlyCommitment.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            נגבה ישירות בהוראות קבע וכרטיסים
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs text-slate-400">עלות שנתית מצטברת</span>
          <div className="text-2xl font-bold text-slate-200 font-mono mt-1">
            ₪{totalAnnualCost.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            חישוב של 12 חודשי מנויים וחיובים קבועים
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs text-slate-400">מנויי תוכן ושירותים קלים</span>
          <div className="text-2xl font-bold text-indigo-300 font-mono mt-1">
            ₪{(54.9 + 39.9).toFixed(1)} / חודש
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Netflix, Spotify (ללא עליות מחיר לאחרונה)
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 font-bold text-white text-sm">
          רשימת החיובים החוזרים שזוהו
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold">
                <th className="py-3 px-4">בית עסק / שירות</th>
                <th className="py-3 px-4">קטגוריה</th>
                <th className="py-3 px-4">חשבון חיוב</th>
                <th className="py-3 px-4">תדירות</th>
                <th className="py-3 px-4">תאריך זיהוי ראשון</th>
                <th className="py-3 px-4 text-left">חיוב חודשי</th>
                <th className="py-3 px-4 text-left">הערכה שנתית</th>
                <th className="py-3 px-4 text-center">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-sans font-bold text-white">
                    {item.merchant}
                  </td>
                  <td className="py-3.5 px-4 font-sans text-slate-300">
                    <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px]">
                      {item.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-sans text-slate-400">{item.accountName}</td>
                  <td className="py-3.5 px-4 font-sans text-slate-400">
                    {item.frequency === 'monthly'
                      ? 'חודשי'
                      : item.frequency === 'bimonthly'
                      ? 'דו-חודשי'
                      : 'שנתי'}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500">{item.firstDetectedDate}</td>
                  <td className="py-3.5 px-4 text-left font-bold text-rose-400">
                    ₪{item.monthlyAmount.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-left text-slate-300">
                    ₪{item.estimatedAnnualCost.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-center font-sans">
                    {item.status === 'active' ? (
                      <button
                        onClick={() => handleToggleStatus(item.id, 'cancelled')}
                        className="text-[11px] text-slate-400 hover:text-rose-400 underline"
                      >
                        סמן כמבוטל
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleStatus(item.id, 'active')}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 underline"
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
