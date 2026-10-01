import React from 'react';
import { InvestmentAsset, Transaction } from '../types/financial';
import {
  PieChart,
  Info,
  ArrowUpRight,
} from 'lucide-react';

interface InvestmentsViewProps {
  investments: InvestmentAsset[];
  transactions: Transaction[];
  onOpenTraceModal: (title: string, amount: number, txs: Transaction[]) => void;
}

export const InvestmentsView: React.FC<InvestmentsViewProps> = ({
  investments,
  transactions,
  onOpenTraceModal,
}) => {
  const totalValue = investments.reduce((s, i) => s + i.currentValue, 0);
  const totalInvested = investments.reduce((s, i) => s + i.investedAmount, 0);
  const totalGain = investments.reduce((s, i) => s + i.unrealizedGain, 0);
  const gainPercentage = totalInvested > 0 ? ((totalGain / totalInvested) * 100).toFixed(1) : '0';

  const investmentTransactions = transactions.filter(
    (t) => t.type === 'investment_contribution' || t.category === 'השקעות'
  );

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>תיק השקעות וחיסכון פנסיוני</span>
            <span className="text-xs font-mono bg-slate-100 dark:bg-[#0B0F17] text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-[#1F2937]">
              ₪{totalValue.toLocaleString()}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            מעקב נכסים, הקצאות, והפקדות חודשיות מבוסס תדפיסים מאומתים
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              onOpenTraceModal(
                'הפקדות להשקעות מתועדות',
                totalInvested,
                investmentTransactions
              )
            }
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#0B0F17] dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-[#1F2937] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>היסטוריית הפקדות</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-4 shadow-xs transition-colors">
          <span className="text-xs text-slate-500 dark:text-slate-400">שווי שוק נוכחי</span>
          <div className="text-xl font-bold text-slate-900 dark:text-white font-mono mt-1">
            ₪{totalValue.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
            סך שווי הנכסים המדווחים
          </span>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-4 shadow-xs transition-colors">
          <span className="text-xs text-slate-500 dark:text-slate-400">קרן שהופקדה בפועל</span>
          <div className="text-xl font-bold text-slate-800 dark:text-slate-200 font-mono mt-1">
            ₪{totalInvested.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
            מתוך תדפיסי בנקים ובתי השקעות
          </span>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-4 shadow-xs transition-colors">
          <span className="text-xs text-slate-500 dark:text-slate-400">רווח הון לא ממומש</span>
          <div className="text-xl font-bold text-[#059669] dark:text-emerald-400 font-mono mt-1 flex items-center gap-1.5">
            <ArrowUpRight className="w-5 h-5" />
            <span>+₪{totalGain.toLocaleString()}</span>
          </div>
          <span className="text-[11px] text-[#059669] dark:text-emerald-400 font-mono mt-1 block font-medium">
            +{gainPercentage}% תשואה כוללת
          </span>
        </div>
      </div>

      {/* Data Source Transparency Note */}
      <div className="p-3 bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] rounded-xl flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-900 dark:text-white">יושרה פיננסית:</span>
          <p className="text-slate-500 dark:text-slate-400 mt-0.5">
            הנתונים מבוססים ישירות על תדפיסי המסחר ודוחות הקרנות. המערכת אינה מנחשת ביצועים ללא נתוני אמת.
          </p>
        </div>
      </div>

      {/* Asset Allocation Breakdown */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-5 shadow-xs space-y-4 transition-colors">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <PieChart className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <span>הקצאת נכסים לפי אפיקים</span>
        </h3>

        <div className="w-full h-2.5 bg-slate-100 dark:bg-[#0B0F17] rounded-full overflow-hidden flex">
          {investments.map((inv, idx) => (
            <div
              key={inv.id}
              style={{
                width: `${inv.allocationPercentage}%`,
                backgroundColor: ['#2563eb', '#059669', '#4f46e5', '#7c3aed'][idx % 4],
              }}
              title={`${inv.name}: ${inv.allocationPercentage}%`}
              className="h-full transition-all"
            />
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
          {investments.map((inv, idx) => (
            <div key={inv.id} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: ['#2563eb', '#059669', '#4f46e5', '#7c3aed'][idx % 4] }}
              />
              <div className="truncate">
                <div className="font-medium text-slate-800 dark:text-slate-200 truncate">{inv.name}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  {inv.allocationPercentage}% (₪{inv.currentValue.toLocaleString()})
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Asset Holdings Table */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl shadow-xs overflow-hidden transition-colors">
        <div className="p-3.5 border-b border-slate-200 dark:border-[#1F2937] font-bold text-slate-900 dark:text-white text-xs">
          פירוט נכסים וניירות ערך
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#1F2937] bg-slate-50 dark:bg-[#0B0F17] text-slate-600 dark:text-slate-400 font-medium">
                <th className="py-2.5 px-4 font-medium">נכס / נייר ערך</th>
                <th className="py-2.5 px-4 font-medium">חשבון ומתווך</th>
                <th className="py-2.5 px-4 font-medium">סוג נכס</th>
                <th className="py-2.5 px-4 font-medium text-left">קרן שהושקעה</th>
                <th className="py-2.5 px-4 font-medium text-left">שווי שוק עדכני</th>
                <th className="py-2.5 px-4 font-medium text-left">רווח / הפסד</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1F2937] font-mono">
              {investments.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-sans font-bold text-slate-900 dark:text-white">
                    <div>{inv.name}</div>
                    {inv.symbol && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded font-mono font-normal">
                        {inv.symbol}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-sans text-slate-600 dark:text-slate-300">{inv.accountName}</td>
                  <td className="py-3 px-4 font-sans text-slate-500 dark:text-slate-400">
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px]">
                      {inv.type === 'etf'
                        ? 'קרן סל מחקה'
                        : inv.type === 'provident_fund'
                        ? 'קרן השתלמות'
                        : inv.type === 'bonds'
                        ? 'איגרות חוב'
                        : 'מניות'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-left text-slate-600 dark:text-slate-300">
                    ₪{inv.investedAmount.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-left font-bold text-slate-900 dark:text-white">
                    ₪{inv.currentValue.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-left text-[#059669] dark:text-emerald-400 font-bold">
                    +₪{inv.unrealizedGain.toLocaleString()} (+{inv.gainPercentage}%)
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
