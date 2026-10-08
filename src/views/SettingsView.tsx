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
  AlertTriangle,
  Mail,
  Palette,
  Edit3,
} from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { EditRuleModal } from '../components/EditRuleModal';

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
  const [editingRule, setEditingRule] = useState<LearnedRule | null>(null);

  const handleDeleteRule = (id: string) => {
    const updated = learnedRules.filter((r) => r.id !== id);
    onUpdateRules(updated);
  };

  const handleSaveEditedRule = (updatedRule: LearnedRule) => {
    const updated = learnedRules.map((r) => (r.id === updatedRule.id ? updatedRule : r));
    onUpdateRules(updated);
  };

  const isPendingDeletion = userProfile?.deletionStatus === 'pending_deletion';

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>הגדרות, פרטיות וחשבון</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            ניהול זהות המשתמש, ערכת נושא, כללי סיווג אישיים ובקרת פרטיות
          </p>
        </div>
      </div>

      {/* 1. THEME & APPEARANCE (Light / Dark / System) */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-5 shadow-xs space-y-3 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 flex-shrink-0">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">ערכת נושא ומראה המערכת</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                בחר בין מצב בהיר, כהה עמוק, או התאמה אוטומטית למערכת ההפעלה
              </p>
            </div>
          </div>
          <div>
            <ThemeToggle compact={false} />
          </div>
        </div>
      </div>

      {/* 2. USER ACCOUNT IDENTITY CARD */}
      {userProfile && (
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-5 shadow-xs space-y-4 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#1F2937] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-800 dark:text-slate-200 font-bold text-sm">
                {userProfile.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">{userProfile.name}</h3>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>@{userProfile.username || userProfile.name}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-[#1F2937] text-slate-600 dark:text-slate-300 font-mono">
                אימות מקומי
              </span>
              <span
                className={`text-xs px-2.5 py-1 rounded-lg font-medium border ${
                  userProfile.accountStatus === 'active'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                }`}
              >
                {userProfile.accountStatus === 'active' ? 'חשבון פעיל' : 'חשבון מושבת'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937]">
              <span className="text-slate-500 dark:text-slate-400 text-[11px] block">מזהה משתמש (UID)</span>
              <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px] break-all">{userProfile.id}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937]">
              <span className="text-slate-500 dark:text-slate-400 text-[11px] block">תאריך הרשמה</span>
              <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px]">
                {userProfile.createdAt ? userProfile.createdAt.split('T')[0] : '—'}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937]">
              <span className="text-slate-500 dark:text-slate-400 text-[11px] block">השלמת פרופיל פיננסי</span>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 dark:bg-emerald-500 h-full rounded-full"
                    style={{ width: `${userProfile.financialProfileCompletion || 20}%` }}
                  />
                </div>
                <span className="font-mono text-[#059669] dark:text-emerald-400 font-bold text-[11px]">
                  {userProfile.financialProfileCompletion || 20}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. LEARNED RULES ENGINE */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-5 shadow-xs space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span>העדפות וסיווגים שלמדתי ממך</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              חוקים שנוצרו אך ורק לאחר אישורך המפורש. ניתן לערוך או למחוק כל חוק בכל עת.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
            {learnedRules.length} כללים פעילים
          </span>
        </div>

        {learnedRules.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500 dark:text-slate-400">
            טרם נשמרו חוקי סיווג מותאמים. כשתאמת עסקאות תוכל לבחור לשמור כלל עתידי.
          </div>
        ) : (
          <div className="space-y-2">
            {learnedRules.map((rule) => (
              <div
                key={rule.id}
                className="p-3 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#0F172A] dark:text-white text-xs">
                      תבנית: {rule.pattern}
                    </span>
                    <span className="px-2 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                      מסווג ל: {rule.assignedCategory}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    נוצר על בסיס: "{rule.userPromptBasis}" • הופעל {rule.timesApplied} פעמים
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingRule(rule)}
                    className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-1.5 transition-colors cursor-pointer"
                    title="ערוך כלל זה"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 transition-colors cursor-pointer"
                    title="מחק חוק זה"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <EditRuleModal
          rule={editingRule}
          isOpen={editingRule !== null}
          onClose={() => setEditingRule(null)}
          onSave={handleSaveEditedRule}
        />
      </div>

      {/* 4. AUTOMATED NOTIFICATIONS & WATCHERS */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-5 shadow-xs space-y-4 transition-colors">
        <div>
          <h3 className="text-sm font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>התראות אוטומטיות לזיהוי חריגות</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            המערכת תסמן חריגות ואי-סדירויות אך לעולם לא תשנה נתונים באופן עצמאי ללא אישורך
          </p>
        </div>

        <div className="space-y-2">
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
              className="p-3 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] flex items-center justify-between gap-4 text-xs"
            >
              <div>
                <span className="font-semibold text-[#0F172A] dark:text-white block text-xs">{item.title}</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">{item.desc}</span>
              </div>
              <button
                onClick={() => item.setter(!item.value)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                {item.value ? (
                  <ToggleRight className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                ) : (
                  <ToggleLeft className="w-7 h-7 text-slate-400 dark:text-slate-600" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 5. ACCOUNT DELETION & GRACE PERIOD (#6) */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-5 shadow-xs space-y-4 transition-colors">
        <h3 className="text-sm font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>מחיקת חשבון – תקופת חסד של 30 יום</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          מחיקת חשבון אינה מיידית. עם הגשת הבקשה החשבון ייכנס לתקופת חסד של 30 יום שבה כל המידע
          שמור ומאובטח. ניתן להתחבר בכל עת במהלך 30 הימים ולבטל את המחיקה. רק בתום התקופה יימחקו
          החשבון וכל נתוניו הפיננסיים לצמיתות.
        </p>

        {isPendingDeletion ? (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs space-y-3">
            <div className="flex items-center gap-2 text-rose-900 dark:text-rose-200 font-bold">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <span>חשבונך מתוזמן למחיקה ב-{userProfile?.scheduledDeletionDate ? userProfile.scheduledDeletionDate.split('T')[0] : 'עוד 30 יום'}</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300">
              כל המידע שלך עדיין שמור במלואו. תוכל להמשיך להשתמש במערכת או לבטל את הבקשה עכשיו:
            </p>
            <button
              type="button"
              onClick={onCancelAccountDeletion}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 font-bold text-xs transition-colors cursor-pointer"
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
                className="px-3.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 text-rose-800 dark:text-rose-300 text-xs font-semibold border border-rose-200 dark:border-rose-800/60 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>בקש מחיקת חשבון (30 ימי חסד)</span>
              </button>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0B0F17] border border-rose-300 dark:border-rose-800/80 space-y-3">
                <p className="text-xs text-rose-800 dark:text-rose-300 font-medium">
                  האם אתה בטוח שברצונך לתזמן את מחיקת החשבון? החשבון יימחק סופית בעוד 30 יום.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onRequestAccountDeletion?.();
                      setConfirmDeleteAccount(false);
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs cursor-pointer"
                  >
                    כן, תזמן מחיקה ל-30 יום
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteAccount(false)}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs cursor-pointer"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 6. PRIVACY & LOCAL TESTING TOOLS */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-5 shadow-xs space-y-3 transition-colors">
        <h3 className="text-sm font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
          <Lock className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          <span>אבטחה והתנסות</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          כל המידע מבודד לחלוטין ברמת ה-Database. אין שום גישה למשתמש אחר או למנהל לנתונים הפיננסיים.
        </p>

        <div className="flex flex-wrap gap-2.5 pt-1">
          <button
            onClick={onResetDemoData}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
            <span>טען נתוני דוגמה להתנסות</span>
          </button>

          <button
            onClick={onClearAllData}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-500" />
            <span>נקה נתונים להתחלה נקייה</span>
          </button>
        </div>
      </div>
    </div>
  );
};
