import React from 'react';
import { AnomalyAlert, Transaction } from '../types/financial';
import {
  LineChart,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Clock,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck,
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
  // Financial Timeline Events
  const timelineEvents = [
    {
      date: '2026-09-26',
      title: 'רכישת שובר לא מסווג (BUYME)',
      amount: 500,
      type: 'warning',
      desc: 'המערכת זיהתה שובר ללא פירוט וביקשה הבהרת המשתמש.',
    },
    {
      date: '2026-09-20',
      title: 'רכישה גדולה מעל הרגיל ב-AliExpress',
      amount: 890,
      type: 'spike',
      desc: 'עסקה בינלאומית הגבוהה פי 3.2 מהממוצע.',
    },
    {
      date: '2026-09-18',
      title: 'זיכוי החזר מס הכנסה',
      amount: 1200,
      type: 'income',
      desc: 'הפקדה חיובית חד-פעמית שסווגה ישירות להכנסות.',
    },
    {
      date: '2026-09-04',
      title: 'הוראת קבע להשקעות (מיטב טרייד)',
      amount: 2500,
      type: 'invest',
      desc: 'הפקדה חודשית לקרן מחקה S&P 500.',
    },
    {
      date: '2026-09-01',
      title: 'הפקדת משכורת הייטק',
      amount: 22400,
      type: 'income',
      desc: 'משכורת חודשית נטו שזוהתה בהצלחה.',
    },
    {
      date: '2026-08-15',
      title: 'פתיחת יעד קרן חירום',
      amount: 50000,
      type: 'goal',
      desc: 'הגדרת יעד של 6 חודשי קיום לפקדון נזיל.',
    },
  ];

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <LineChart className="w-5 h-5 text-emerald-400" />
            <span>ניתוחים, חריגות וציר זמן פיננסי</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            זיהוי שינויים מהותיים בהרגלי הצריכה, חריגות סטטיסטיות, והיסטוריית אירועים מרכזיים
          </p>
        </div>
      </div>

      {/* Anomaly Detection Section */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">מצאנו פעילות שכדאי לבדוק</h3>
            <p className="text-xs text-slate-400">
              זיהוי שינויים חריגים ביחס לממוצע 6 החודשים האחרונים (לא מוצג כהונאה, אלא כבקרה אישית)
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {anomalies
            .filter((a) => !a.isDismissed)
            .map((alert) => {
              const matchedTx = alert.transactionId
                ? transactions.find((t) => t.id === alert.transactionId)
                : null;

              return (
                <div
                  key={alert.id}
                  className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{alert.title}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{alert.date}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                      {alert.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto flex-shrink-0">
                    {matchedTx && (
                      <button
                        onClick={() => onOpenReviewModal(matchedTx)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
                      >
                        אמת עסקה
                      </button>
                    )}
                    <button
                      onClick={() => onDismissAnomaly(alert.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs border border-slate-700 transition-colors"
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
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-5 shadow-xl space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-400" />
          <span>ציר זמן פיננסי כרונולוגי</span>
        </h3>
        <p className="text-xs text-slate-400">
          אירועים מהותיים: הכנסות גבוהות, רכישות מיוחדות, יצירת יעדים והפקדות מפתח
        </p>

        <div className="relative border-r-2 border-slate-800 pr-5 space-y-6 pt-2">
          {timelineEvents.map((evt, idx) => (
            <div key={idx} className="relative space-y-1">
              {/* Dot on the timeline */}
              <div
                className={`absolute -right-[27px] top-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                  evt.type === 'income'
                    ? 'bg-emerald-400'
                    : evt.type === 'invest'
                    ? 'bg-cyan-400'
                    : evt.type === 'warning'
                    ? 'bg-amber-400'
                    : 'bg-indigo-400'
                }`}
              />

              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">{evt.title}</span>
                <span className="font-mono text-slate-400">{evt.date}</span>
              </div>
              <p className="text-xs text-slate-400">{evt.desc}</p>
              <div className="font-mono font-bold text-xs text-slate-200">
                ₪{evt.amount.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
