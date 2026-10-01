import React from 'react';
import { Transaction } from '../types/financial';
import { X, Search, FileText, CheckCircle, ShieldAlert, ArrowDownRight } from 'lucide-react';

interface DataTraceModalProps {
  title: string;
  totalAmount: number;
  transactions: Transaction[];
  onClose: () => void;
  onSelectTransactionForReview?: (tx: Transaction) => void;
}

export const DataTraceModal: React.FC<DataTraceModalProps> = ({
  title,
  totalAmount,
  transactions,
  onClose,
  onSelectTransactionForReview,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-2xl w-full max-w-3xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] text-[#0F172A] dark:text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#0B0F17] border-b border-slate-200 dark:border-[#1F2937] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <h3 className="text-base font-bold text-[#0F172A] dark:text-white">שקיפות חישוב: {title}</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              פירוט מלא של {transactions.length} העסקאות המרכיבות סך של{' '}
              <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                ₪{Math.abs(totalAmount).toLocaleString()}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transactions Table */}
        <div className="p-4 overflow-y-auto flex-1">
          {transactions.length === 0 ? (
            <div className="text-center py-10 text-slate-500 dark:text-slate-400 text-sm">
              לא נמצאו עסקאות פרטניות בקבוצה זו.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#1F2937] bg-slate-50 dark:bg-[#0B0F17] text-slate-600 dark:text-slate-400 font-semibold">
                    <th className="py-2.5 px-3 font-medium">תאריך</th>
                    <th className="py-2.5 px-3 font-medium">בית עסק / תיאור</th>
                    <th className="py-2.5 px-3 font-medium">חשבון מקור</th>
                    <th className="py-2.5 px-3 font-medium">קטגוריה</th>
                    <th className="py-2.5 px-3 font-medium">רמת ביטחון</th>
                    <th className="py-2.5 px-3 text-left font-medium">סכום</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1F2937]/70">
                  {transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                        tx.needsReview ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                      }`}
                    >
                      <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {tx.date}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-[#0F172A] dark:text-white">{tx.merchant}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xs">
                          {tx.description}
                        </div>
                        {tx.sourceDocument && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                            קובץ: {tx.sourceDocument}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {tx.accountName}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-[#1F2937] text-slate-700 dark:text-slate-300">
                          {tx.category}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {tx.needsReview ? (
                          <button
                            onClick={() => {
                              onClose();
                              onSelectTransactionForReview?.(tx);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/50 cursor-pointer"
                          >
                            <ShieldAlert className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                            <span>דורש בדיקה</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 text-[11px]">
                            <CheckCircle className="w-3 h-3 text-emerald-700 dark:text-emerald-500" />
                            <span>מאומת ({Math.round(tx.confidenceScore * 100)}%)</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-left font-mono font-bold whitespace-nowrap">
                        <span
                          className={
                            tx.type === 'income'
                              ? 'text-[#059669]'
                              : tx.type === 'refund'
                              ? 'text-[#059669]'
                              : 'text-[#BE123C]'
                          }
                        >
                          {tx.type === 'refund' ? '+' : ''}₪{Math.abs(tx.amount).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-[#0B0F17] border-t border-slate-200 dark:border-[#1F2937] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div>
            <span>כלל מערכת: </span>
            <span className="text-slate-700 dark:text-slate-300">
              העברות בין חשבונותיך ופירעונות כרטיסי אשראי נוטרלו מהספירה הכוללת למניעת כפילות.
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 font-semibold transition-colors cursor-pointer"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
};
