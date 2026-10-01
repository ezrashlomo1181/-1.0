import React, { useState } from 'react';
import { Transaction } from '../types/financial';
import {
  Search,
  ShieldAlert,
  CheckCircle,
  HelpCircle,
  RefreshCw,
  Clock,
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
    <div className="space-y-5 pb-12 animate-in fade-in duration-200">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>יומן עסקאות ותנועות</span>
            <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
              {transactions.length} סה״כ
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            מעקב מדויק, זיהוי עסקאות וביטול ספירה כפולה של העברות פנימיות
          </p>
        </div>

        {/* Action / Review badge */}
        {needsReviewCount > 0 && (
          <button
            onClick={() => setOnlyNeedsReview(!onlyNeedsReview)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              onlyNeedsReview
                ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>
              {onlyNeedsReview
                ? `מציג ${needsReviewCount} עסקאות לאימות (לחץ לחזרה)`
                : `הצג ${needsReviewCount} עסקאות הדורשות אימות`}
            </span>
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1F2937] p-3 shadow-xs space-y-3 transition-colors">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="חיפוש לפי עסק, סכום, או תיאור..."
              className="w-full bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] rounded-lg pr-9 pl-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-slate-600 dark:focus:border-slate-500 transition-colors"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-600 dark:focus:border-slate-500 cursor-pointer"
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
              className="w-full bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-600 dark:focus:border-slate-500 cursor-pointer"
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
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1F2937] shadow-xs overflow-hidden transition-colors">
        {filtered.length === 0 ? (
          <div className="text-center py-12 px-4">
            <HelpCircle className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-700 dark:text-slate-300 font-semibold">לא נמצאו עסקאות תואמות לסינון</p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">נסה לאפס את החיפוש או לבחור קטגוריה אחרת.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#1F2937] bg-slate-50 dark:bg-[#0B0F17] text-slate-600 dark:text-slate-400 font-semibold">
                  <th className="py-2.5 px-4 font-medium">תאריך</th>
                  <th className="py-2.5 px-4 font-medium">בית עסק ותיאור</th>
                  <th className="py-2.5 px-4 font-medium">חשבון מקור</th>
                  <th className="py-2.5 px-4 font-medium">קטגוריה</th>
                  <th className="py-2.5 px-4 font-medium">סוג עסקה ורמת ביטחון</th>
                  <th className="py-2.5 px-4 font-medium text-left">סכום בש״ח</th>
                  <th className="py-2.5 px-4 font-medium text-center">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1F2937]/80">
                {filtered.map((tx) => {
                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                        tx.needsReview ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                      }`}
                    >
                      {/* Date */}
                      <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {tx.date}
                      </td>

                      {/* Merchant & Description */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-semibold text-[#0F172A] dark:text-white text-xs flex items-center gap-1.5">
                          <span>{tx.merchant}</span>
                          {tx.isRecurring && (
                            <span className="text-[10px] text-slate-700 dark:text-slate-300 font-normal bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                              קבוע
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {tx.description}
                        </div>
                      </td>

                      {/* Account */}
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <span className="text-xs">{tx.accountName}</span>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#1F2937] text-[11px] font-medium">
                          {tx.category}
                        </span>
                      </td>

                      {/* Status / Confidence */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {tx.isInternalTransfer ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-[#1F2937] px-2 py-0.5 rounded-md"
                            title="העברה פנימית שנוטרלה למניעת ספירה כפולה"
                          >
                            <RefreshCw className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                            <span>העברה פנימית</span>
                          </span>
                        ) : tx.needsReview ? (
                          <button
                            onClick={() => onOpenReviewModal(tx)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors cursor-pointer"
                          >
                            <ShieldAlert className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                            <span>דורש אימות</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                            <CheckCircle className="w-3 h-3 text-emerald-700 dark:text-emerald-500" />
                            <span>מאומת ({Math.round(tx.confidenceScore * 100)}%)</span>
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 text-left font-mono font-bold whitespace-nowrap text-xs">
                        <span
                          className={
                            tx.isInternalTransfer
                              ? 'text-slate-400 line-through'
                              : tx.type === 'income'
                              ? 'text-[#059669]'
                              : tx.type === 'refund'
                              ? 'text-[#059669]'
                              : 'text-[#BE123C]'
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
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => onOpenReviewModal(tx)}
                          className="px-2 py-1 rounded text-[11px] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-[#1F2937] transition-colors cursor-pointer"
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
