import React, { useState } from 'react';
import { BudgetCategory, Transaction } from '../types/financial';
import {
  PieChart,
  Plus,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  Edit2,
  Save,
  X,
} from 'lucide-react';

interface BudgetViewProps {
  budgets: BudgetCategory[];
  transactions: Transaction[];
  onUpdateBudget: (updatedBudgets: BudgetCategory[]) => void;
  onOpenTraceModal: (title: string, amount: number, txs: Transaction[]) => void;
}

export const BudgetView: React.FC<BudgetViewProps> = ({
  budgets,
  transactions,
  onUpdateBudget,
  onOpenTraceModal,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempAmount, setTempAmount] = useState<number>(0);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatAmount, setNewCatAmount] = useState(1000);

  const totalAllocated = budgets.reduce((s, b) => s + b.allocated, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const remainingBudget = Math.max(0, totalAllocated - totalSpent);
  const overallUsedPct = totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0;

  const handleStartEdit = (b: BudgetCategory) => {
    setEditingId(b.id);
    setTempAmount(b.allocated);
  };

  const handleSaveEdit = (id: string) => {
    const updated = budgets.map((b) =>
      b.id === id ? { ...b, allocated: tempAmount } : b
    );
    onUpdateBudget(updated);
    setEditingId(null);
  };

  const handleApplySuggestion = (id: string, suggestion: number) => {
    const updated = budgets.map((b) =>
      b.id === id ? { ...b, allocated: suggestion } : b
    );
    onUpdateBudget(updated);
  };

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    const newEntry: BudgetCategory = {
      id: `b-custom-${Date.now()}`,
      category: newCatName.trim(),
      allocated: newCatAmount,
      spent: 0,
      suggestedAmount: newCatAmount,
    };
    onUpdateBudget([...budgets, newEntry]);
    setNewCatName('');
    setShowNewCategory(false);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>ניהול ובקרת תקציב</span>
            <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
              ספטמבר 2026
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            מעקב תכנון מול ביצוע, הצעות מבוססות היסטוריה, והתראות חריגה
          </p>
        </div>

        <button
          onClick={() => setShowNewCategory(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-emerald-900/30"
        >
          <Plus className="w-4 h-4" />
          <span>הוסף קטגוריית תקציב</span>
        </button>
      </div>

      {/* Top High-level summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400">תקציב מתוכנן כולל</span>
          <div className="text-2xl font-bold text-white font-mono mt-1">
            ₪{totalAllocated.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">הגדרת תקרה לחודש הנוכחי</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400">הוצאה בפועל</span>
          <div className="text-2xl font-bold text-rose-400 font-mono mt-1">
            ₪{totalSpent.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">עסקאות שאומתו עד כה</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400">יתרה זמינה להוצאה</span>
          <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
            ₪{remainingBudget.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">נותרו עוד 4 ימים לחודש</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400">שיעור ניצול כולל</span>
          <div
            className={`text-2xl font-bold font-mono mt-1 ${
              overallUsedPct > 90 ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            {overallUsedPct}%
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full ${overallUsedPct > 90 ? 'bg-amber-400' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, overallUsedPct)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Add New Category Modal / Row */}
      {showNewCategory && (
        <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-4 shadow-xl flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] text-slate-400 mb-1">שם הקטגוריה</label>
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="למשל: ספורט וכושר / קורסים"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="w-40">
            <label className="block text-[11px] text-slate-400 mb-1">תקציב חודשי (₪)</label>
            <input
              type="number"
              value={newCatAmount}
              onChange={(e) => setNewCatAmount(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex items-end gap-2 pt-5">
            <button
              onClick={handleAddCategory}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
            >
              הוסף
            </button>
            <button
              onClick={() => setShowNewCategory(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Categories Detailed Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {budgets.map((b) => {
          const usedPct = Math.round((b.spent / b.allocated) * 100);
          const isOver = usedPct > 100;
          const isClose = usedPct >= 85 && usedPct <= 100;
          const isEditing = editingId === b.id;

          const catTransactions = transactions.filter(
            (t) => t.category === b.category && !t.isInternalTransfer
          );

          return (
            <div
              key={b.id}
              className={`bg-slate-900/90 rounded-2xl border p-4.5 shadow-lg flex flex-col justify-between transition-all ${
                isOver
                  ? 'border-rose-500/40 bg-rose-500/5'
                  : isClose
                  ? 'border-amber-500/30'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">{b.category}</h3>
                    <button
                      onClick={() =>
                        onOpenTraceModal(
                          `הוצאות ${b.category}`,
                          b.spent,
                          catTransactions
                        )
                      }
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 mt-0.5 inline-block"
                    >
                      צפה ב-{catTransactions.length} עסקאות
                    </button>
                  </div>

                  <div className="text-left font-mono">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                        isOver
                          ? 'bg-rose-500/20 text-rose-300'
                          : isClose
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-emerald-500/10 text-emerald-400'
                      }`}
                    >
                      {usedPct}% נוצל
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-slate-800 rounded-full mt-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isOver ? 'bg-rose-500' : isClose ? 'bg-amber-400' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, usedPct)}%` }}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400 font-sans">הוצאה: ₪{b.spent.toLocaleString()}</span>
                  <span className="text-slate-300 font-sans">
                    יעד:{' '}
                    {isEditing ? (
                      <input
                        type="number"
                        value={tempAmount}
                        onChange={(e) => setTempAmount(Number(e.target.value))}
                        className="w-20 bg-slate-950 border border-emerald-500 rounded px-1.5 py-0.5 text-xs text-white font-mono"
                        autoFocus
                      />
                    ) : (
                      `₪${b.allocated.toLocaleString()}`
                    )}
                  </span>
                </div>

                {/* Suggestion pill if available */}
                {b.suggestedAmount && b.suggestedAmount !== b.allocated && (
                  <div className="mt-2.5 p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-indigo-300">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                      <span>הצעת מערכת: ₪{b.suggestedAmount.toLocaleString()}</span>
                    </div>
                    <button
                      onClick={() => handleApplySuggestion(b.id, b.suggestedAmount!)}
                      className="text-indigo-400 hover:text-indigo-200 underline font-semibold"
                    >
                      החל
                    </button>
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-500 text-[11px]">
                  {b.previousMonthSpent
                    ? `חודש שעבר: ₪${b.previousMonthSpent.toLocaleString()}`
                    : 'אין נתון היסטורי'}
                </span>

                <div>
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleSaveEdit(b.id)}
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1 text-[11px]"
                      >
                        <Save className="w-3 h-3" />
                        <span>שמור</span>
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-white text-[11px]"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleStartEdit(b)}
                      className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>ערוך יעד</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
