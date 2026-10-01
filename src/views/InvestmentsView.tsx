import React, { useState } from 'react';
import { InvestmentAsset, Transaction } from '../types/financial';
import {
  TrendingUp,
  PieChart,
  ShieldCheck,
  Plus,
  ArrowUpRight,
  Info,
  Building,
  DollarSign,
  AlertCircle,
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
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>תיק השקעות וחיסכון פנסיוני</span>
            <span className="text-xs font-mono bg-slate-800 text-cyan-400 px-2.5 py-0.5 rounded-full border border-slate-700">
              ₪{totalValue.toLocaleString()}
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
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
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <span>היסטוריית הפקדות</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs text-slate-400">שווי שוק נוכחי</span>
          <div className="text-2xl font-extrabold text-white font-mono mt-1">
            ₪{totalValue.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            סך שווי הנכסים המדווחים
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs text-slate-400">קרן שהופקדה בפועל</span>
          <div className="text-2xl font-extrabold text-slate-200 font-mono mt-1">
            ₪{totalInvested.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            מתוך תדפיסי בנקים ובתי השקעות
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs text-slate-400">רווח הון לא ממומש</span>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-1 flex items-center gap-1.5">
            <ArrowUpRight className="w-6 h-6" />
            <span>+₪{totalGain.toLocaleString()}</span>
          </div>
          <span className="text-[11px] text-emerald-400 font-mono mt-1 block font-semibold">
            +{gainPercentage}% תשואה כוללת
          </span>
        </div>
      </div>

      {/* Data Source Transparency Note */}
      <div className="p-3.5 bg-cyan-950/20 border border-cyan-800/40 rounded-2xl flex items-start gap-3 text-xs text-cyan-200">
        <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">עקרון יושרה פיננסית:</span>
          <p className="text-cyan-300/80 mt-0.5">
            הנתונים להלן מבוססים ישירות על תדפיסי המסחר ממיטב טרייד ודוח השתלמות אלטשולר שחם. המערכת אינה מנחשת ביצועים ללא נתוני אמת.
          </p>
        </div>
      </div>

      {/* Asset Allocation Breakdown */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <PieChart className="w-4 h-4 text-cyan-400" />
          <span>הקצאת נכסים לפי אפיקים</span>
        </h3>

        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex">
          {investments.map((inv, idx) => (
            <div
              key={inv.id}
              style={{
                width: `${inv.allocationPercentage}%`,
                backgroundColor: ['#06b6d4', '#3b82f6', '#10b981', '#a855f7'][idx % 4],
              }}
              title={`${inv.name}: ${inv.allocationPercentage}%`}
              className="h-full transition-all"
            />
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2">
          {investments.map((inv, idx) => (
            <div key={inv.id} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: ['#06b6d4', '#3b82f6', '#10b981', '#a855f7'][idx % 4] }}
              />
              <div className="truncate">
                <div className="font-semibold text-slate-200 truncate">{inv.name}</div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {inv.allocationPercentage}% (₪{inv.currentValue.toLocaleString()})
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Asset Holdings Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 font-bold text-white text-sm">
          פירוט נכסים וניירות ערך
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400">
                <th className="py-3 px-4">נכס / נייר ערך</th>
                <th className="py-3 px-4">חשבון ומתווך</th>
                <th className="py-3 px-4">סוג נכס</th>
                <th className="py-3 px-4 text-left">קרן שהושקעה</th>
                <th className="py-3 px-4 text-left">שווי שוק עדכני</th>
                <th className="py-3 px-4 text-left">רווח / הפסד</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {investments.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-sans font-bold text-white">
                    <div>{inv.name}</div>
                    {inv.symbol && (
                      <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                        {inv.symbol}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-sans text-slate-300">{inv.accountName}</td>
                  <td className="py-3.5 px-4 font-sans text-slate-400">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px]">
                      {inv.type === 'etf'
                        ? 'קרן סל מחקה'
                        : inv.type === 'provident_fund'
                        ? 'קרן השתלמות'
                        : inv.type === 'bonds'
                        ? 'איגרות חוב'
                        : 'מניות'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-left text-slate-300">
                    ₪{inv.investedAmount.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-left font-bold text-white">
                    ₪{inv.currentValue.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-left text-emerald-400 font-bold">
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
