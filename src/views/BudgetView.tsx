import React, { useState } from 'react';
import { BudgetCategory, Transaction } from '../types/financial';
import { calculateCashFlowForPeriod } from '../services/financialCalculations';
import { resolveToCanonicalExpenseCategory } from '../services/categoriesService';
import {
  Plus,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  Edit2,
  Save,
  X,
  FileSearch,
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

  const activePeriod = calculateCashFlowForPeriod(transactions);
  const monthLabel = activePeriod.monthLabel;

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
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>ניהול ובקרת תקציב</span>
            <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
              {monthLabel}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            מעקב תכנון מול ביצוע, הצעות מבוססות היסטוריה, והתראות חריגה
          </p>
        </div>

        <button
          onClick={() => setShowNewCategory(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 font-medium text-xs transition-colors shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>הוסף קטגוריית תקציב</span>
        </button>
      </div>

      {/* Top High-level summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-4 shadow-xs transition-colors">
          <span className="text-xs text-slate-500 dark:text-slate-400">תקציב מתוכנן כולל</span>
          <div className="text-xl font-bold text-[#0F172A] dark:text-white font-mono mt-1">
            ₪{totalAllocated.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">תקרה לחודש הנוכחי</span>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-4 shadow-xs transition-colors">
          <span className="text-xs text-slate-500 dark:text-slate-400">הוצאה בפועל</span>
          <div className="text-xl font-bold text-[#BE123C] font-mono mt-1">
            ₪{totalSpent.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">עסקאות שאומתו עד כה</span>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-4 shadow-xs transition-colors">
          <span className="text-xs text-slate-500 dark:text-slate-400">יתרה זמינה להוצאה</span>
          <div className="text-xl font-bold text-[#059669] font-mono mt-1">
            ₪{remainingBudget.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">עד לסוף החודש</span>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-4 shadow-xs transition-colors">
          <span className="text-xs text-slate-500 dark:text-slate-400">שיעור ניצול כולל</span>
          <div
            className={`text-xl font-bold font-mono mt-1 ${
              overallUsedPct > 90 ? 'text-amber-700 dark:text-amber-400' : 'text-[#059669]'
            }`}
          >
            {overallUsedPct}%
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                overallUsedPct > 90 ? 'bg-amber-600 dark:bg-amber-500' : 'bg-emerald-600 dark:bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, overallUsedPct)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Add New Category Modal / Row */}
      {showNewCategory && (
        <div className="bg-white dark:bg-[#111827] border border-slate-300 dark:border-[#1F2937] rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-3 transition-colors">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-medium">שם הקטגוריה</label>
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="למשל: ספורט וכושר / קורסים"
              className="w-full bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
            />
          </div>
          <div className="w-36">
            <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-medium">תקציב חודשי (₪)</label>
            <input
              type="number"
              value={newCatAmount}
              onChange={(e) => setNewCatAmount(Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-600"
            />
          </div>
          <div className="flex items-end gap-2 pt-4">
            <button
              onClick={handleAddCategory}
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 text-xs font-semibold cursor-pointer"
            >
              הוסף
            </button>
            <button
              onClick={() => setShowNewCategory(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 text-xs cursor-pointer border border-slate-200 dark:border-slate-700"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Categories Detailed Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {budgets.map((b) => {
          const usedPct = Math.round((b.spent / b.allocated) * 100);
          const isOver = usedPct > 100;
          const isClose = usedPct >= 85 && usedPct <= 100;
          const isEditing = editingId === b.id;

          const catTransactions = transactions.filter(
            (t) =>
              (t.category === b.category ||
                resolveToCanonicalExpenseCategory(t.category) === b.category) &&
              !t.isInternalTransfer
          );

          return (
            <div
              key={b.id}
              className={`bg-white dark:bg-[#111827] rounded-xl border p-4 shadow-xs flex flex-col justify-between transition-colors ${
                isOver
                  ? 'border-rose-300 dark:border-rose-900/60'
                  : isClose
                  ? 'border-amber-300 dark:border-amber-900/60'
                  : 'border-slate-200 dark:border-[#1F2937]'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">{b.category}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        נוצלו ₪{b.spent.toLocaleString()} מתוך ₪{b.allocated.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="text-left font-mono">
                    <span
                      className={`text-sm font-bold ${
                        isOver
                          ? 'text-[#BE123C] dark:text-rose-400'
                          : isClose
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {usedPct}%
                    </span>
                    {isOver && (
                      <span className="text-[10px] text-[#BE123C] dark:text-rose-400 block font-semibold">
                        חריגה!
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isOver
                        ? 'bg-rose-600 dark:bg-rose-500'
                        : isClose
                        ? 'bg-amber-600 dark:bg-amber-500'
                        : 'bg-emerald-600 dark:bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, usedPct)}%` }}
                  />
                </div>

                {/* Edit inline */}
                {isEditing ? (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-[#1F2937]">
                    <input
                      type="number"
                      value={tempAmount}
                      onChange={(e) => setTempAmount(Number(e.target.value))}
                      className="w-28 bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] rounded-md px-2 py-1 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-600"
                    />
                    <button
                      onClick={() => handleSaveEdit(b.id)}
                      className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 cursor-pointer"
                      title="שמור תקציב"
                    >
                      <Save className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer"
                      title="ביטול"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#1F2937]/80 text-xs">
                    <button
                      onClick={() => handleStartEdit(b)}
                      className="text-[11px] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>ערוך תקרה</span>
                    </button>

                    <button
                      onClick={() =>
                        onOpenTraceModal(
                          `עסקאות חודשיות: ${b.category}`,
                          b.spent,
                          catTransactions
                        )
                      }
                      className="text-[11px] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <FileSearch className="w-3 h-3" />
                      <span>{catTransactions.length} עסקאות</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Suggestion pill if available */}
              {b.suggestedAmount && b.suggestedAmount !== b.allocated && (
                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-[#1F2937]/80 flex items-center justify-between text-[11px] bg-slate-50 dark:bg-[#0B0F17] -mx-4 -mb-4 p-2.5 rounded-b-xl">
                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                    <span>הצעה: ₪{b.suggestedAmount.toLocaleString()}</span>
                  </span>
                  <button
                    onClick={() => handleApplySuggestion(b.id, b.suggestedAmount!)}
                    className="text-slate-700 dark:text-slate-300 font-semibold hover:underline cursor-pointer"
                  >
                    החל הצעה
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
