import React, { useState, useEffect, useRef } from 'react';
import { LearnedRule, UserProfile } from '../types/financial';
import { AppState } from '../services/storage';
import {
  generateBackupPayload,
  downloadBackupFile,
  readBackupFile,
  applyRestore,
  getPreRestoreSnapshot,
  rollbackPreRestoreSnapshot,
  ValidationResult,
  SnapshotRecord,
} from '../services/backupService';
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
  Download,
  Upload,
  Database,
  History,
  CheckCircle2,
  FileText,
  AlertCircle,
  X,
} from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { EditRuleModal } from '../components/EditRuleModal';

interface SettingsViewProps {
  appState?: AppState;
  onRestoreState?: (restoredState: AppState) => void;
  learnedRules: LearnedRule[];
  onUpdateRules: (rules: LearnedRule[]) => void;
  onResetDemoData: () => void;
  onClearAllData: () => void;
  userProfile?: UserProfile | null;
  onRequestAccountDeletion?: () => void;
  onCancelAccountDeletion?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  appState,
  onRestoreState,
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

  // Backup & Restore states
  const [backupExportMessage, setBackupExportMessage] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [restoreFeedback, setRestoreFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [preRestoreSnapshot, setPreRestoreSnapshot] = useState<SnapshotRecord | null>(null);
  const [showRestoreConfirmModal, setShowRestoreConfirmModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const snap = getPreRestoreSnapshot(userProfile?.id);
    setPreRestoreSnapshot(snap);
  }, [userProfile?.id]);

  const handleDeleteRule = (id: string) => {
    const updated = learnedRules.filter((r) => r.id !== id);
    onUpdateRules(updated);
  };

  const handleSaveEditedRule = (updatedRule: LearnedRule) => {
    const updated = learnedRules.map((r) => (r.id === updatedRule.id ? updatedRule : r));
    onUpdateRules(updated);
  };

  const handleExportBackup = () => {
    if (!appState) return;
    try {
      const payload = generateBackupPayload(appState, userProfile);
      downloadBackupFile(payload);
      setBackupExportMessage(
        `קובץ הגיבוי הורד בהצלחה! (${payload.metadata.summary.transactionsCount} עסקאות, ${payload.metadata.summary.accountsCount} חשבונות)`
      );
      setTimeout(() => setBackupExportMessage(null), 5000);
    } catch (e: any) {
      setRestoreFeedback({ type: 'error', text: `שגיאה בייצוא: ${e.message || 'שגיאה לא ידועה'}` });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsReadingFile(true);
    setRestoreFeedback(null);
    try {
      const { result } = await readBackupFile(file);
      setValidationResult(result);
      if (result.isValid) {
        setShowRestoreConfirmModal(true);
      } else {
        setRestoreFeedback({
          type: 'error',
          text: result.errors.join(' | ') || 'קובץ הגיבוי שנבחר אינו תקין.',
        });
      }
    } catch (err: any) {
      setRestoreFeedback({ type: 'error', text: err.message || 'שגיאה בקריאת הקובץ.' });
    } finally {
      setIsReadingFile(false);
      e.target.value = '';
    }
  };

  const handleConfirmRestore = () => {
    if (!validationResult?.parsedPayload || !appState) return;
    try {
      const res = applyRestore(validationResult.parsedPayload, appState, userProfile?.id);
      if (res.success && res.restoredState) {
        onRestoreState?.(res.restoredState);
        setPreRestoreSnapshot(getPreRestoreSnapshot(userProfile?.id));
        setRestoreFeedback({
          type: 'success',
          text: `השחזור הושלם בהצלחה! שוחזרו ${res.restoredState.transactions.length} עסקאות ו-${res.restoredState.accounts.length} חשבונות. נוצר עותק בטיחות לשחזור לאחור.`,
        });
        setShowRestoreConfirmModal(false);
        setValidationResult(null);
        setTimeout(() => setRestoreFeedback(null), 6000);
      } else {
        setRestoreFeedback({ type: 'error', text: res.error || 'שגיאה במהלך השחזור.' });
      }
    } catch (e: any) {
      setRestoreFeedback({ type: 'error', text: `שגיאה במהלך השחזור: ${e.message}` });
    }
  };

  const handleRollbackSnapshot = () => {
    try {
      const res = rollbackPreRestoreSnapshot(userProfile?.id);
      if (res.success && res.rolledBackState) {
        onRestoreState?.(res.rolledBackState);
        setPreRestoreSnapshot(getPreRestoreSnapshot(userProfile?.id));
        setRestoreFeedback({
          type: 'success',
          text: `בוצע שחזור לאחור בהצלחה! שוחזרו הנתונים שקדמו לשחזור האחרון (${res.rolledBackState.transactions.length} עסקאות).`,
        });
        setTimeout(() => setRestoreFeedback(null), 5000);
      } else {
        setRestoreFeedback({ type: 'error', text: res.error || 'לא נמצא עותק בטיחות לשחזור לאחור.' });
      }
    } catch (e: any) {
      setRestoreFeedback({ type: 'error', text: `שגיאה בשחזור לאחור: ${e.message}` });
    }
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

      {/* 6. LOCAL BACKUP & RESTORE */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-5 shadow-xs space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>גיבוי ושחזור נתונים מקומי (JSON)</span>
          </h3>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
            פרטיות מלאה • עיבוד מקומי בלבד בדפדפן
          </span>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          באפשרותך לייצא את כל הנתונים הפיננסיים שלך, החשבונות, התקציבים, היעדים, והחוקים שנלמדו לקובץ גיבוי מאובטח במחשבך.
          לפני כל שחזור מקובץ גיבוי, המערכת תיצור אוטומטית עותק בטיחות מקומי המאפשר שחזור לאחור בכל עת.
        </p>

        {/* Status Feedbacks */}
        {backupExportMessage && (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{backupExportMessage}</span>
          </div>
        )}

        {restoreFeedback && (
          <div
            className={`p-3 rounded-lg border flex items-center gap-2.5 text-xs ${
              restoreFeedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/80 text-rose-800 dark:text-rose-300'
            }`}
          >
            {restoreFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{restoreFeedback.text}</span>
          </div>
        )}

        {/* Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
          {/* Export Action Card */}
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-[#0F172A] dark:text-white flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  ייצוא גיבוי מלא
                </span>
                <span className="text-[10px] text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded">
                  פורמט JSON
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                מצב נוכחי: {appState?.transactions.length || 0} עסקאות, {appState?.accounts.length || 0} חשבונות, {learnedRules.length} חוקים שמורים.
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportBackup}
              className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>הורד קובץ גיבוי</span>
            </button>
          </div>

          {/* Restore Action Card */}
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-[#0F172A] dark:text-white flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  שחזור מקובץ גיבוי
                </span>
                <span className="text-[10px] text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded">
                  בדיקה + אישור
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                טעינת נתונים מקובץ גיבוי קיים עם בדיקת תקינות מקיפה לפני החלה.
              </p>
            </div>

            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                disabled={isReadingFile}
                className="hidden"
                id="backup-file-input"
              />
              <label
                htmlFor="backup-file-input"
                className={`w-full py-2 px-3 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-medium text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer text-center ${
                  isReadingFile ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Upload className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>{isReadingFile ? 'בודק קובץ...' : 'בחר קובץ גיבוי לשחזור'}</span>
              </label>
            </div>
          </div>
        </div>

        {/* Safety Rollback Banner (Undo) */}
        {preRestoreSnapshot && (
          <div className="p-3.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-200 text-xs">
                <History className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>קיים עותק בטיחות לשחזור לאחור</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                נשמר ב-{new Date(preRestoreSnapshot.timestamp).toLocaleDateString('he-IL')} {new Date(preRestoreSnapshot.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} ({preRestoreSnapshot.summary.transactionsCount} עסקאות, {preRestoreSnapshot.summary.accountsCount} חשבונות).
              </p>
            </div>

            <button
              type="button"
              onClick={handleRollbackSnapshot}
              className="py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>שחזר למצב שקדם לשחזור</span>
            </button>
          </div>
        )}
      </div>

      {/* Restore Confirmation & Inspection Modal */}
      {showRestoreConfirmModal && validationResult && validationResult.parsedPayload && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-[#0F172A] dark:text-white font-bold text-base">
                <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>אישור שחזור נתונים מקובץ גיבוי</span>
              </div>
              <button
                type="button"
                onClick={() => setShowRestoreConfirmModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              הקובץ נבדק ואומת בהצלחה. להלן סיכום הנתונים שנמצאו בקובץ הגיבוי:
            </p>

            {/* Summary details */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 text-xs space-y-2">
              <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                <div>
                  <span className="text-slate-400 block text-[11px]">תאריך יצירת הגיבוי:</span>
                  <span className="font-semibold">
                    {validationResult.exportedAt
                      ? new Date(validationResult.exportedAt).toLocaleDateString('he-IL') +
                        ' ' +
                        new Date(validationResult.exportedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                      : 'לא צוין'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">עסקאות:</span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    {validationResult.summary?.transactionsCount || 0}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">חשבונות:</span>
                  <span className="font-semibold">{validationResult.summary?.accountsCount || 0}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">תקציבים ויעדים:</span>
                  <span className="font-semibold">
                    {(validationResult.summary?.budgetsCount || 0) + (validationResult.summary?.goalsCount || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">חוקי קטגוריות שנלמדו:</span>
                  <span className="font-semibold">{validationResult.summary?.rulesCount || 0}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">מסמכים שיובאו:</span>
                  <span className="font-semibold">{validationResult.summary?.documentsCount || 0}</span>
                </div>
              </div>
            </div>

            {/* Warnings list if any */}
            {validationResult.warnings && validationResult.warnings.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                <span className="font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  הערות ולידציה:
                </span>
                <ul className="list-disc list-inside text-[11px] space-y-0.5">
                  {validationResult.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Safety notice */}
            <div className="p-3 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-[11px] text-indigo-900 dark:text-indigo-300 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <span>
                שחזור נתונים יחליף את הנתונים המוצגים כרגע. עותק בטיחות מלא יישמר אוטומטית לפני ביצוע הפעולה, כך שתוכל לחזור למצב הנוכחי בלחיצת כפתור אחת.
              </span>
            </div>

            {/* Modal action buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowRestoreConfirmModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors cursor-pointer"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>אשר ושחזר נתונים</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. PRIVACY & LOCAL TESTING TOOLS */}
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
