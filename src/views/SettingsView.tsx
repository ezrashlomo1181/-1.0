import React, { useState } from 'react';
import { LearnedRule, UserProfile } from '../types/financial';
import {
  Settings,
  ShieldCheck,
  Trash2,
  Lock,
  RotateCcw,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  User,
  Clock,
  CheckCircle,
  AlertTriangle,
  Mail,
  Calendar,
} from 'lucide-react';

interface SettingsViewProps {
  learnedRules: LearnedRule[];
  onUpdateRules: (rules: LearnedRule[]) => void;
  onResetDemoData: () => void;
  onClearAllData: () => void;
  userProfile?: UserProfile | null;
  onRequestAccountDeletion?: () => void;
  onCancelAccountDeletion?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  learnedRules,
  onUpdateRules,
  onResetDemoData,
  onClearAllData,
  userProfile,
  onRequestAccountDeletion,
  onCancelAccountDeletion,
}) => {
  const [notifyLargeExpense, setNotifyLargeExpense] = useState(true);
  const [notifyNewRecurring, setNotifyNewRecurring] = useState(true);
  const [notifyRestaurantCap, setNotifyRestaurantCap] = useState(true);
  const [notifyLowBalance, setNotifyLowBalance] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);

  const handleDeleteRule = (id: string) => {
    const updated = learnedRules.filter((r) => r.id !== id);
    onUpdateRules(updated);
  };

  const isPendingDeletion = userProfile?.deletionStatus === 'pending_deletion';

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-400" />
            <span>הגדרות, פרטיות וחשבון</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            ניהול זהות המשתמש, כללי סיווג אישיים ובקרת פרטיות מבודדת
          </p>
        </div>
      </div>

      {/* USER ACCOUNT IDENTITY CARD */}
      {userProfile && (
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <User className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">{userProfile.name}</h3>
                  {userProfile.role === 'admin' && (
                    <span className="text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.2 rounded">
                      ADMIN
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 font-mono flex items-center gap-1.5 mt-0.5" dir="ltr">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  <span>{userProfile.email}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                התחברות: {userProfile.authProvider.replace('.com', '')}
              </span>
              <span
                className={`text-xs px-2.5 py-1 rounded-xl font-medium border ${
                  userProfile.accountStatus === 'active'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }`}
              >
                {userProfile.accountStatus === 'active' ? 'חשבון פעיל' : 'חשבון מושבת'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 text-[11px] block">מזהה משתמש (UID)</span>
              <span className="font-mono text-slate-300 text-[11px] break-all">{userProfile.id}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 text-[11px] block">תאריך הרשמה</span>
              <span className="font-mono text-slate-300 text-[11px]">
                {userProfile.createdAt ? userProfile.createdAt.split('T')[0] : '—'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 text-[11px] block">השלמת פרופיל פיננסי</span>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-400 h-full rounded-full"
                    style={{ width: `${userProfile.financialProfileCompletion || 20}%` }}
                  />
                </div>
                <span className="font-mono text-emerald-400 font-bold text-[11px]">
                  {userProfile.financialProfileCompletion || 20}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. LEARNED RULES ENGINE */}
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
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    נוצר על בסיס: "{rule.userPromptBasis}" • הופעל בהצלחה {rule.timesApplied} פעמים
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  className="text-slate-400 hover:text-rose-400 p-1.5 transition-colors"
                  title="מחק חוק זה"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. AUTOMATED NOTIFICATIONS & WATCHERS */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>התראות אוטומטיות לזיהוי חריגות</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            המערכת תסמן חריגות ואי-סדירויות אך לעולם לא תשנה נתונים באופן עצמאי ללא אישורך
          </p>
        </div>

        <div className="space-y-2.5">
          {[
            {
              title: 'התראה על הוצאה חריגה ביחס לממוצע (זינוק חד)',
              desc: 'זיהוי הוצאות מעל פי 2.5 מהממוצע באותה קטגוריה ב-6 חודשים האחרונים.',
              value: notifyLargeExpense,
              setter: setNotifyLargeExpense,
            },
            {
              title: 'איתור מנוי או חיוב קבוע חדש',
              desc: 'זיהוי חיובים מחזוריים חדשים בחשבון כדי למנוע מנויים נשכחים.',
              value: notifyNewRecurring,
              setter: setNotifyNewRecurring,
            },
            {
              title: 'התראת עקיפת תקציב (80% ו-100%)',
              desc: 'הודעה מוקדמת כשההוצאות בקטגוריה מתקרבות לתקרת היעד החודשי.',
              value: notifyRestaurantCap,
              setter: setNotifyRestaurantCap,
            },
            {
              title: 'אזהרת יתרה נמוכה בחשבון העו״ש',
              desc: 'התראה כאשר היתרה הצפויה בסוף החודש יורדת מתחת לסף בטחון שהוגדר.',
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
                className="text-slate-400 hover:text-white cursor-pointer"
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

      {/* 3. ACCOUNT DELETION & GRACE PERIOD (#6) */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <span>מחיקת חשבון – תקופת חסד של 30 יום</span>
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          מחיקת חשבון אינה מיידית. עם הגשת הבקשה החשבון ייכנס לתקופת חסד של 30 יום שבה כל המידע
          שמור ומאובטח. ניתן להתחבר בכל עת במהלך 30 הימים ולבטל את המחיקה. רק בתום התקופה יימחקו
          החשבון וכל נתוניו הפיננסיים לצמיתות.
        </p>

        {isPendingDeletion ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs space-y-3">
            <div className="flex items-center gap-2 text-rose-300 font-bold">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>חשבונך מתוזמן למחיקה ב-{userProfile?.scheduledDeletionDate ? userProfile.scheduledDeletionDate.split('T')[0] : 'עוד 30 יום'}</span>
            </div>
            <p className="text-[11px] text-slate-300">
              כל המידע שלך עדיין שמור במלואו. תוכל להמשיך להשתמש במערכת או לבטל את הבקשה עכשיו:
            </p>
            <button
              type="button"
              onClick={onCancelAccountDeletion}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors"
            >
              בטל בקשת מחיקה והחזר חשבון לפעיל
            </button>
          </div>
        ) : (
          <div>
            {!confirmDeleteAccount ? (
              <button
                type="button"
                onClick={() => setConfirmDeleteAccount(true)}
                className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold border border-rose-500/30 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>בקש מחיקת חשבון (30 ימי חסד)</span>
              </button>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950 border border-rose-500/40 space-y-3">
                <p className="text-xs text-rose-300 font-medium">
                  האם אתה בטוח שברצונך לתזמן את מחיקת החשבון? החשבון יימחק סופית בעוד 30 יום.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onRequestAccountDeletion?.();
                      setConfirmDeleteAccount(false);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
                  >
                    כן, תזמן מחיקה ל-30 יום
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteAccount(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. PRIVACY & LOCAL TESTING TOOLS */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-3">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Lock className="w-4 h-4 text-cyan-400" />
          <span>אבטחה והתנסות</span>
        </h3>
        <p className="text-xs text-slate-400">
          כל המידע מבודד לחלוטין ברמת ה-Database. אין שום גישה למשתמש אחר או למנהל לנתונים הפיננסיים.
        </p>

        <div className="flex flex-wrap gap-3 pt-1">
          <button
            onClick={onResetDemoData}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4 text-emerald-400" />
            <span>טען נתוני דוגמה להתנסות</span>
          </button>

          <button
            onClick={onClearAllData}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4 text-slate-400" />
            <span>נקה נתונים להתחלה נקייה</span>
          </button>
        </div>
      </div>
    </div>
  );
};
