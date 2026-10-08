import React from 'react';
import { AnomalyAlert, Transaction } from '../types/financial';
import {
  LineChart,
  AlertTriangle,
  Clock,
} from 'lucide-react';

interface AnalyticsViewProps {
  anomalies: AnomalyAlert[];
  transactions: Transaction[];
  onDismissAnomaly: (id: string) => void;
  onOpenReviewModal: (tx: Transaction) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  anomalies,
  transactions,
  onDismissAnomaly,
  onOpenReviewModal,
}) => {
  const timelineEvents = React.useMemo(() => {
    if (!transactions || transactions.length === 0) return [];

    const events: {
      date: string;
      title: string;
      amount: number;
      type: 'income' | 'invest' | 'warning' | 'spike' | 'refund' | 'expense';
      desc: string;
    }[] = [];

    // 1. High value incomes
    const incomes = transactions
      .filter((t) => t.type === 'income' && t.amount >= 500)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3);
    for (const inc of incomes) {
      events.push({
        date: inc.date,
        title: `הפקדה / הכנסה: ${inc.merchant}`,
        amount: inc.amount,
        type: 'income',
        desc: inc.category === 'משכורת והכנסות' ? 'הפקדת משכורת או תקבול שנקלט בהצלחה' : 'הכנסה שנקלטה במסמכי המקור',
      });
    }

    // 2. Refunds
    const refunds = transactions
      .filter((t) => t.type === 'refund')
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3);
    for (const ref of refunds) {
      events.push({
        date: ref.date,
        title: `זיכוי / החזר כספי: ${ref.merchant}`,
        amount: ref.amount,
        type: 'refund',
        desc: 'החזר כספי שהקטין הוצאה (ולא נספר כהכנסה)',
      });
    }

    // 3. Transactions needing review
    const reviews = transactions
      .filter((t) => t.needsReview)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 2);
    for (const rev of reviews) {
      events.push({
        date: rev.date,
        title: `עסקה לאימות: ${rev.merchant}`,
        amount: rev.amount,
        type: 'warning',
        desc: rev.reviewReason || 'דרוש אימות סיווג קטגוריה וסוג תנועה',
      });
    }

    // 4. Significant expenses
    const topExpenses = transactions
      .filter((t) => (t.type === 'expense' || t.type === 'fee') && t.amount >= 400)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3);
    for (const exp of topExpenses) {
      events.push({
        date: exp.date,
        title: `הוצאה מהותית: ${exp.merchant}`,
        amount: exp.amount,
        type: 'expense',
        desc: `הוצאה בקטגוריית ${exp.category}`,
      });
    }

    return events.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  }, [transactions]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>ניתוחים, חריגות וציר זמן פיננסי</span>
            <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
              בקרה שוטפת
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            זיהוי שינויים מהותיים בהרגלי הצריכה, חריגות סטטיסטיות, והיסטוריית אירועים מרכזיים
          </p>
        </div>
      </div>

      {/* Anomaly Detection Section */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1F2937] p-5 shadow-xs space-y-4 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">מצאנו פעילות שכדאי לבדוק</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              זיהוי שינויים חריגים ביחס לממוצע 6 החודשים האחרונים (לבקרה אישית בלבד)
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          {anomalies
            .filter((a) => !a.isDismissed)
            .map((alert) => {
              const matchedTx = alert.transactionId
                ? transactions.find((t) => t.id === alert.transactionId)
                : null;

              return (
                <div
                  key={alert.id}
                  className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#0F172A] dark:text-white">{alert.title}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{alert.date}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                      {alert.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto flex-shrink-0">
                    {matchedTx && (
                      <button
                        onClick={() => onOpenReviewModal(matchedTx)}
                        className="px-3 py-1.5 rounded-lg bg-amber-800 hover:bg-amber-900 text-white font-semibold text-xs transition-colors cursor-pointer"
                      >
                        אמת עסקה
                      </button>
                    )}
                    <button
                      onClick={() => onDismissAnomaly(alert.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                    >
                      התעלם (הכל תקין)
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Financial Timeline */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1F2937] p-5 shadow-xs space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span>ציר זמן פיננסי כרונולוגי</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              אירועים מהותיים: הכנסות, רכישות מיוחדות, יעדים והפקדות מפתח
            </p>
          </div>
        </div>

        {timelineEvents.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            טרם נקלטו עסקאות או אירועים פיננסיים בציר הזמן.
          </p>
        ) : (
          <div className="relative border-r-2 border-slate-200 dark:border-[#1F2937] pr-5 space-y-5 pt-2">
            {timelineEvents.map((evt, idx) => (
              <div key={idx} className="relative space-y-0.5">
                {/* Dot on the timeline */}
                <div
                  className={`absolute -right-[27px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#111827] ${
                    evt.type === 'income'
                      ? 'bg-emerald-600 dark:bg-emerald-500'
                      : evt.type === 'invest'
                      ? 'bg-blue-600 dark:bg-blue-400'
                      : evt.type === 'warning'
                      ? 'bg-amber-600 dark:bg-amber-400'
                      : 'bg-slate-600 dark:bg-slate-400'
                  }`}
                />

                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#0F172A] dark:text-white">{evt.title}</span>
                  <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">{evt.date}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{evt.desc}</p>
                <div className="font-mono font-bold text-xs text-[#0F172A] dark:text-slate-100">
                  ₪{evt.amount.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
