import React, { useState } from 'react';
import { Transaction } from '../types/financial';
import {
  Search,
  Filter,
  ShieldAlert,
  CheckCircle,
  HelpCircle,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  FileText,
  Tag,
  AlertCircle,
} from 'lucide-react';

interface TransactionsViewProps {
  transactions: Transaction[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenReviewModal: (tx: Transaction) => void;
  onOpenTraceModal: (title: string, amount: number, txList: Transaction[]) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  searchQuery,
  onSearchChange,
  onOpenReviewModal,
  onOpenTraceModal,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [onlyNeedsReview, setOnlyNeedsReview] = useState<boolean>(false);

  // Extract unique categories
  const categories = Array.from(new Set(transactions.map((t) => t.category).filter(Boolean)));

  // Filter transactions
  const filtered = transactions.filter((tx) => {
    if (onlyNeedsReview && !tx.needsReview) return false;
    if (selectedCategory !== 'all' && tx.category !== selectedCategory) return false;
    if (selectedType !== 'all') {
      if (selectedType === 'internal' && !tx.isInternalTransfer) return false;
      if (selectedType === 'income' && tx.type !== 'income') return false;
      if (selectedType === 'expense' && (tx.type !== 'expense' || tx.isInternalTransfer)) return false;
      if (selectedType === 'refund' && tx.type !== 'refund') return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchMerchant = tx.merchant.toLowerCase().includes(q);
      const matchDesc = tx.description.toLowerCase().includes(q);
      const matchCat = tx.category.toLowerCase().includes(q);
      const matchAmount = tx.amount.toString().includes(q);
      return matchMerchant || matchDesc || matchCat || matchAmount;
    }
    return true;
  });

  const needsReviewCount = transactions.filter((t) => t.needsReview).length;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>יומן עסקאות ותנועות</span>
            <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
              {transactions.length} סה״כ
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            מעקב מדויק, זיהוי כפילויות וביטול ספירה כפולה של העברות פנימיות
          </p>
        </div>

        {/* Action / Review badge */}
        {needsReviewCount > 0 && (
          <button
            onClick={() => setOnlyNeedsReview(!onlyNeedsReview)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              onlyNeedsReview
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-lg shadow-amber-900/30'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>
              {onlyNeedsReview
                ? `מציג ${needsReviewCount} עסקאות לבדיקה (לחץ לביטול)`
                : `הצג ${needsReviewCount} עסקאות הדורשות אימות`}
            </span>
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-4 shadow-xl space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="חיפוש לפי עסק, סכום, או תיאור..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="all">כל הקטגוריות</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="all">כל סוגי הפעולות</option>
              <option value="expense">הוצאות רגילות</option>
              <option value="income">הכנסות</option>
              <option value="refund">זיכויים והחזרים</option>
              <option value="internal">העברות פנימיות מנוטרלות</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Table Card */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800/80 shadow-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 px-4">
            <HelpCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-300 font-semibold">לא נמצאו עסקאות תואמות לסינון</p>
            <p className="text-xs text-slate-500 mt-1">נסה לאפס את החיפוש או לבחור קטגוריה אחרת.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 font-semibold">
                  <th className="py-3 px-4">תאריך</th>
                  <th className="py-3 px-4">בית עסק ותיאור</th>
                  <th className="py-3 px-4">חשבון מקור</th>
                  <th className="py-3 px-4">קטגוריה</th>
                  <th className="py-3 px-4">סוג עסקה ורמת ביטחון</th>
                  <th className="py-3 px-4 text-left">סכום בש״ח</th>
                  <th className="py-3 px-4 text-center">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((tx) => {
                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        tx.needsReview ? 'bg-amber-500/10' : ''
                      }`}
                    >
                      {/* Date */}
                      <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                        {tx.date}
                      </td>

                      {/* Merchant & Description */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-bold text-white text-sm flex items-center gap-1.5">
                          <span>{tx.merchant}</span>
                          {tx.isRecurring && (
                            <span className="text-[10px] text-cyan-400 font-normal bg-cyan-500/10 px-1.5 py-0.2 rounded border border-cyan-500/20">
                              הוראת קבע
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {tx.description}
                        </div>
                        {tx.aiReasoning && (
                          <div className="text-[10px] text-slate-500 italic mt-0.5">
                            בינה: {tx.aiReasoning}
                          </div>
                        )}
                      </td>

                      {/* Account */}
                      <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                        <span className="text-xs">{tx.accountName}</span>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 border border-slate-700/60 font-medium">
                          {tx.category}
                        </span>
                      </td>

                      {/* Status / Confidence */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {tx.isInternalTransfer ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md"
                            title="העברה פנימית שנוטרלה מההכנסות וההוצאות כדי למנוע ספירה כפולה"
                          >
                            <RefreshCw className="w-3 h-3 text-cyan-400" />
                            <span>העברה פנימית (נוטרלה)</span>
                          </span>
                        ) : tx.needsReview ? (
                          <button
                            onClick={() => onOpenReviewModal(tx)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all animate-pulse"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>דורש אימות שלך</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>מאומת ({Math.round(tx.confidenceScore * 100)}%)</span>
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-left font-mono font-bold whitespace-nowrap text-sm">
                        <span
                          className={
                            tx.isInternalTransfer
                              ? 'text-slate-400 line-through'
                              : tx.type === 'income'
                              ? 'text-emerald-400'
                              : tx.type === 'refund'
                              ? 'text-cyan-400'
                              : 'text-white'
                          }
                        >
                          {tx.type === 'income'
                            ? '+'
                            : tx.type === 'refund'
                            ? 'זיכוי +'
                            : '-'}
                          ₪{Math.abs(tx.amount).toLocaleString()}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => onOpenReviewModal(tx)}
                          className="px-2.5 py-1 rounded-md text-[11px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
                        >
                          ערוך / אמת
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
