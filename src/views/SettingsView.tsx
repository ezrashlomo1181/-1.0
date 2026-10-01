import React, { useState } from 'react';
import { LearnedRule } from '../types/financial';
import {
  Settings,
  ShieldCheck,
  Trash2,
  Lock,
  RotateCcw,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Plus,
  CheckCircle,
} from 'lucide-react';

interface SettingsViewProps {
  learnedRules: LearnedRule[];
  onUpdateRules: (rules: LearnedRule[]) => void;
  onResetDemoData: () => void;
  onClearAllData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  learnedRules,
  onUpdateRules,
  onResetDemoData,
  onClearAllData,
}) => {
  // Personal custom rules toggles
  const [notifyLargeExpense, setNotifyLargeExpense] = useState(true);
  const [notifyNewRecurring, setNotifyNewRecurring] = useState(true);
  const [notifyRestaurantCap, setNotifyRestaurantCap] = useState(true);
  const [notifyLowBalance, setNotifyLowBalance] = useState(false);

  const handleDeleteRule = (id: string) => {
    const updated = learnedRules.filter((r) => r.id !== id);
    onUpdateRules(updated);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-400" />
            <span>הגדרות, חוקים ולמידת העדפות</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            ניהול כללי סיווג שנלמדו מהמשתמש, התראות אוטומטיות, ובקרת פרטיות
          </p>
        </div>
      </div>

      {/* 1. LEARNED RULES ENGINE (#23) */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>העדפות וסיווגים שלמדתי ממך</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              חוקים שנוצרו אך ורק לאחר אישורך המפורש. ניתן לערוך או למחוק כל חוק בכל עת.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
            {learnedRules.length} כללים פעילים
          </span>
        </div>

        {learnedRules.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            טרם נשמרו חוקי סיווג מותאמים. כשתאמת עסקאות עמומות תוכל לבחור לשמור כלל עתידי.
          </div>
        ) : (
          <div className="space-y-2.5">
            {learnedRules.map((rule) => (
              <div
                key={rule.id}
                className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">
                      תבנית: {rule.pattern}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-medium text-[11px]">
                      מסווג ל: {rule.assignedCategory}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      ({rule.applyTo === 'all_similar' || rule.applyTo === 'similar' ? 'כל דומה' : 'מדויק בלבד'})
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {rule.userPromptBasis} • הופעל בהצלחה {rule.timesApplied} פעמים
                  </p>
                </div>

                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                  title="מחק כלל זה"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. AUTOMATION & NOTIFICATION RULES (#20) */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          <span>מנוע חוקים והתראות חכמות</span>
        </h3>
        <p className="text-xs text-slate-400">
          הגדר מתי המערכת תתריע בפניך ותדרוש בדיקה
        </p>

        <div className="space-y-3">
          {[
            {
              title: 'התראה על עסקה חד-פעמית מעל ₪1,000',
              desc: 'אם מזוהה רכישה חריגה מעל ₪1,000 בעסק שאינו קבוע, דרוש אימות.',
              value: notifyLargeExpense,
              setter: setNotifyLargeExpense,
            },
            {
              title: 'התראה על חיוב חוזר חדש (מנוי חדש)',
              desc: 'התראה מיידית כאשר מופיע חיוב קבוע שלא הופיע ב-3 החודשים הקודמים.',
              value: notifyNewRecurring,
              setter: setNotifyNewRecurring,
            },
            {
              title: 'התראת גבול: הוצאות מסעדות מעל ₪1,500 בחודש',
              desc: 'עדכן אותי כאשר סך ההוצאות ב-Wolt ומסעדות מתקרב לתקרה המוגדרת.',
              value: notifyRestaurantCap,
              setter: setNotifyRestaurantCap,
            },
            {
              title: 'התראה כאשר היתרה הצפויה בעו״ש יורדת מ-₪5,000',
              desc: 'התרעה מוקדמת לפני פירעון כרטיסי אשראי כדי למנוע חריגה ממסגרת.',
              value: notifyLowBalance,
              setter: setNotifyLowBalance,
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-4 text-xs"
            >
              <div>
                <span className="font-bold text-white block text-sm">{item.title}</span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">{item.desc}</span>
              </div>
              <button
                onClick={() => item.setter(!item.value)}
                className="text-slate-400 hover:text-white"
              >
                {item.value ? (
                  <ToggleRight className="w-8 h-8 text-emerald-400" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-slate-600" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 3. PRIVACY, SECURITY & DATA MANAGEMENT (#28) */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Lock className="w-4 h-4 text-cyan-400" />
          <span>פרטיות ובקרת נתונים מלאה</span>
        </h3>
        <p className="text-xs text-slate-400">
          כל המידע הפיננסי נשמר באופן מאובטח. אין העברה של נתוני כרטיסים מלאים או שיתוף עם צד שלישי.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={onResetDemoData}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4 text-emerald-400" />
            <span>אפס לנתוני דוגמה ראשוניים</span>
          </button>

          <button
            onClick={onClearAllData}
            className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold border border-rose-500/30 transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>מחק את כל הנתונים השמורים</span>
          </button>
        </div>
      </div>
    </div>
  );
};
