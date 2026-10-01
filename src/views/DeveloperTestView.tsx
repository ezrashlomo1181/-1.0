import React, { useState } from 'react';
import { UserProfile, Transaction, Account, BudgetCategory, FinancialGoal } from '../types/financial';
import { areTestingToolsEnabled, TESTING_TOOLS_CONFIG } from '../config/testingConfig';
import {
  FlaskConical,
  Users,
  Database,
  FileCode,
  RotateCcw,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Download,
  UploadCloud,
  FileSpreadsheet,
  FileText,
  UserCheck,
  Lock,
  Sparkles,
} from 'lucide-react';

interface DeveloperTestViewProps {
  currentUser: UserProfile | null;
  onSwitchUser: (mockUser: UserProfile, mockData?: any) => void;
  onResetTestEnvironment: () => void;
  onInjectTestFile: (file: File) => void;
}

export const DeveloperTestView: React.FC<DeveloperTestViewProps> = ({
  currentUser,
  onSwitchUser,
  onResetTestEnvironment,
  onInjectTestFile,
}) => {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTestUser, setActiveTestUser] = useState<string>(currentUser?.id || 'real_user');

  if (!areTestingToolsEnabled()) {
    return (
      <div className="p-8 text-center text-slate-400">
        <Lock className="w-8 h-8 mx-auto mb-2 text-slate-600" />
        <p className="text-sm">כלי הפיתוח והבדיקות מושבתים בסביבת ייצור זו.</p>
      </div>
    );
  }

  // Pre-configured Demo Users
  const demoUsers: (UserProfile & { description: string })[] = [
    {
      id: 'demo-user-1',
      name: 'משפחת ישראלי (הכנסה בינונית, 2 כרטיסים)',
      email: 'demo1@matzpen.test',
      authProvider: 'password',
      createdAt: '2026-01-15T10:00:00Z',
      lastLogin: '2026-10-01T07:00:00Z',
      role: 'user',
      accountStatus: 'active',
      deletionStatus: 'none',
      deletionRequestedAt: null,
      scheduledDeletionDate: null,
      financialProfileCompletion: 85,
      onboardingCompleted: true,
      isDemoUser: true,
      description: 'חשבון עו״ש בנק הפועלים, כרטיס ישראכרט Gold, הוצאות משפחתיות וחיסכון לחופשה.',
    },
    {
      id: 'demo-user-2',
      name: 'דני רון (עצמאי, השקעות והוצאות גבוהות)',
      email: 'demo2@matzpen.test',
      authProvider: 'google.com',
      createdAt: '2026-03-20T14:30:00Z',
      lastLogin: '2026-10-01T06:30:00Z',
      role: 'user',
      accountStatus: 'active',
      deletionStatus: 'none',
      deletionRequestedAt: null,
      scheduledDeletionDate: null,
      financialProfileCompletion: 60,
      onboardingCompleted: true,
      isDemoUser: true,
      description: 'חשבון בנק לאומי, כרטיס MAX, תיק מסחר במיטב טרייד, הוצאות עסק ומסחר במניות.',
    },
    {
      id: 'demo-user-3',
      name: 'רוני כהן (סטודנטית, תקציב הדוק)',
      email: 'demo3@matzpen.test',
      authProvider: 'apple.com',
      createdAt: '2026-07-01T09:15:00Z',
      lastLogin: '2026-09-30T22:00:00Z',
      role: 'user',
      accountStatus: 'active',
      deletionStatus: 'none',
      deletionRequestedAt: null,
      scheduledDeletionDate: null,
      financialProfileCompletion: 40,
      onboardingCompleted: true,
      isDemoUser: true,
      description: 'חשבון בנק דיסקונט, מלגה חודשית, שכר דירה ותקציב סופר קפדני עם חריגות קלות.',
    },
  ];

  // Helper to generate CSV files
  const createMockCSVFile = (filename: string, content: string): File => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    return new File([blob], filename, { type: 'text/csv', lastModified: Date.now() });
  };

  // Generate Bank Statement CSV (12 months)
  const handleGenerateBankCSV = () => {
    const rows = [
      'תאריך,תיאור,סכום,חובה_זכות,קטגוריה',
      '01/09/2026,משכורת חודשית,16500,זכות,הכנסה',
      '03/09/2026,שכר דירה חודשי,-4800,חובה,דיור',
      '05/09/2026,שופרסל דיל,-740,חובה,מזון וסופר',
      '10/09/2026,חברת החשמל לישראל,-420,חובה,חשבונות',
      '15/09/2026,מי אביבים,-180,חובה,חשבונות',
      '20/09/2026,יוחננוף מזון,-580,חובה,מזון וסופר',
      '28/09/2026,העברה לחיסכון,-2500,חובה,השקעות',
    ];
    const file = createMockCSVFile('bank_hapoalim_statement_12m.csv', rows.join('\n'));
    onInjectTestFile(file);
    setSuccessMessage('נוצר והוזן קובץ תדפיס בנק (12 חודשים) למרכז הנתונים!');
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Generate Credit Card CSV
  const handleGenerateCardCSV = () => {
    const rows = [
      'תאריך רכישה,שם בית עסק,סכום מקורי,סכום לחיוב,מטבע,פירוט',
      '02/09/2026,סופר-פארם,189.50,189.50,ILS,קוסמטיקה ותרופות',
      '04/09/2026,קפה לנדוור,64.00,64.00,ILS,מסעדות ובתי קפה',
      '08/09/2026,רב-קו טעינה,100.00,100.00,ILS,תחבורה ציבורית',
      '14/09/2026,זארה ישראל,420.00,420.00,ILS,ביגוד והנעלה',
      '19/09/2026,וולט משלוחי אוכל,145.00,145.00,ILS,מסעדות',
      '25/09/2026,פז תחנת דלק,280.00,280.00,ILS,דלק ותחבורה',
    ];
    const file = createMockCSVFile('credit_card_isracard_gold.csv', rows.join('\n'));
    onInjectTestFile(file);
    setSuccessMessage('נוצר והוזן קובץ פירוט כרטיס אשראי למרכז הנתונים!');
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Generate Large File (500 rows)
  const handleGenerateLargeCSV = () => {
    const header = 'תאריך,בית עסק,סכום,קטגוריה';
    const rows = [header];
    const merchants = ['שופרסל', 'רמי לוי', 'וולט', 'דלק פז', 'קפה גרג', 'ביטוח ישיר', 'סופר פארם'];
    const categories = ['מזון וסופר', 'מזון וסופר', 'מסעדות', 'תחבורה', 'בילויים', 'ביטוח', 'בריאות'];

    for (let i = 1; i <= 350; i++) {
      const idx = i % merchants.length;
      const day = ((i % 28) + 1).toString().padStart(2, '0');
      const month = ((i % 9) + 1).toString().padStart(2, '0');
      const amount = -Math.round((i * 17) % 450 + 25);
      rows.push(`${day}/${month}/2026,${merchants[idx]},${amount},${categories[idx]}`);
    }

    const file = createMockCSVFile('large_dataset_500_transactions.csv', rows.join('\n'));
    onInjectTestFile(file);
    setSuccessMessage('נוצר קובץ נתונים גדול (350+ עסקאות) לבדיקת עומסים בתור!');
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Generate Ambiguous / Corrupted File
  const handleGenerateAmbiguousCSV = () => {
    const rows = [
      'תאריך,ספק,סכום,הערות',
      '01/09/2026,Z-PAY-TOKEN-491,-320,עסקה עמומה לבדיקת סיווג',
      '05/09/2026,QR_MERCHANT_XYZ,-145,ללא בית עסק מזוהה',
      '12/09/2026,TRANS-TEMP-HOLD,-999,אי-ודאות גבוהה',
      '18/09/2026,PAYPAL *UNKNOWN,-280,נדרש אימות אנושי',
    ];
    const file = createMockCSVFile('ambiguous_uncertainty_test.csv', rows.join('\n'));
    onInjectTestFile(file);
    setSuccessMessage('נוצר קובץ עם עסקאות עמומות לבדיקת מנגנון תור האימות (Review Queue)!');
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Generate Duplicate File (same name as previous)
  const handleGenerateDuplicateCSV = () => {
    const rows = [
      'תאריך,בית עסק,סכום',
      '01/09/2026,שופרסל דיל,-740',
      '03/09/2026,שכר דירה,-4800',
    ];
    const file = createMockCSVFile('bank_hapoalim_statement_12m.csv', rows.join('\n'));
    onInjectTestFile(file);
    setSuccessMessage('נוצר קובץ כפול (אותו שם וגודל) לבדיקת מנגנון Duplicate Detection!');
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Switch demo user session
  const handleSelectDemoUser = (user: UserProfile) => {
    setActiveTestUser(user.id);
    onSwitchUser(user);
    setSuccessMessage(`סביבת העבודה עברה אל: ${user.name}`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-mono font-bold">
              DEVELOPER & TESTING TOOLS
            </span>
            <span className="text-xs text-slate-500 font-mono">
              CONFIG: TESTING_TOOLS = ENABLED
            </span>
          </div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2 mt-1">
            <FlaskConical className="w-5 h-5 text-amber-400" />
            <span>סביבת בדיקות ופיתוח Multi-User</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            יצירת משתמשי בדיקה, הזרקת קבצי סימולציה, בדיקת בידוד נתונים ואיפוס סביבת בדיקות
          </p>
        </div>

        {/* Notice of Production Safety */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2 text-xs text-emerald-300 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>מוגן: איפוס משפיע אך ורק על משתמשי Test Data</span>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* 1. MULTI-USER ISOLATION TESTING (Section 15, 16) */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>משתמשי Demo ובדיקת בידוד הדדית (Multi-User Isolation)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              החלף משתמש פעיל כדי לוודא שדשבורד, עסקאות, חשבונות וקבצים של משתמש א' מבודדים לחלוטין ממשתמש ב'
            </p>
          </div>
          <span className="text-xs font-mono text-indigo-300 bg-indigo-500/15 px-2.5 py-1 rounded-lg border border-indigo-500/30 font-bold">
            משתמש נוכחי: {currentUser?.name || 'אורח'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {demoUsers.map((user) => {
            const isCurrent = currentUser?.id === user.id;

            return (
              <div
                key={user.id}
                className={`p-4 rounded-xl border transition-all text-xs flex flex-col justify-between gap-3 ${
                  isCurrent
                    ? 'bg-indigo-500/15 border-indigo-500/60 shadow-lg'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">{user.name.split('(')[0]}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      DEMO
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400" dir="ltr">
                    {user.email}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                    {user.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-emerald-400 font-mono">
                    פרופיל: {user.financialProfileCompletion}%
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSelectDemoUser(user)}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                      isCurrent
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    {isCurrent ? 'משתמש פעיל כעת' : 'התחבר כמשתמש זה'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. TEST FILE GENERATOR (Section 18) */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileCode className="w-4 h-4 text-emerald-400" />
            <span>מחולל קבצי בדיקה וסימולציה (Test File Generator)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            הזרק קבצים מדומים ישירות למרכז הנתונים כדי לבדוק את תור ההעלאה (Queue), זיהוי כפילויות, עומסים ואי-ודאות
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Bank Statement CSV */}
          <button
            type="button"
            onClick={handleGenerateBankCSV}
            className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-emerald-500/50 transition-all text-right group cursor-pointer"
          >
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs mb-1">
              <FileSpreadsheet className="w-4 h-4" />
              <span>תדפיס בנק CSV (12 חודשים)</span>
            </div>
            <p className="text-[11px] text-slate-400">
              משכורת חודשית, שכר דירה, סופר והוראות קבע.
            </p>
          </button>

          {/* Credit Card CSV */}
          <button
            type="button"
            onClick={handleGenerateCardCSV}
            className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-cyan-500/50 transition-all text-right group cursor-pointer"
          >
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs mb-1">
              <FileSpreadsheet className="w-4 h-4" />
              <span>פירוט כרטיס אשראי CSV</span>
            </div>
            <p className="text-[11px] text-slate-400">
              עסקאות מרובות בבתי עסק שונים, דלק וביגוד.
            </p>
          </button>

          {/* Large CSV */}
          <button
            type="button"
            onClick={handleGenerateLargeCSV}
            className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/50 transition-all text-right group cursor-pointer"
          >
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs mb-1">
              <Database className="w-4 h-4" />
              <span>קובץ ענק (350+ עסקאות)</span>
            </div>
            <p className="text-[11px] text-slate-400">
              בדיקת ביצועי עיבוד תור קבצים כבדים ורינדור.
            </p>
          </button>

          {/* Ambiguous / Corrupted CSV */}
          <button
            type="button"
            onClick={handleGenerateAmbiguousCSV}
            className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-amber-500/50 transition-all text-right group cursor-pointer"
          >
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span>קובץ עם אי-ודאות (לבדיקת אימות)</span>
            </div>
            <p className="text-[11px] text-slate-400">
              עסקאות ללא בית עסק ברור המפעילות את תור האימות.
            </p>
          </button>

          {/* Duplicate File */}
          <button
            type="button"
            onClick={handleGenerateDuplicateCSV}
            className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-rose-500/50 transition-all text-right group cursor-pointer"
          >
            <div className="flex items-center gap-2 text-rose-400 font-bold text-xs mb-1">
              <RotateCcw className="w-4 h-4" />
              <span>קובץ כפול (Duplicate Detection)</span>
            </div>
            <p className="text-[11px] text-slate-400">
              בדיקת התרעת כפילות ובחירת דלג / החלף / בדוק.
            </p>
          </button>
        </div>
      </div>

      {/* 3. TEST DATA RESET (Section 17, 20) */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-rose-400" />
              <span>איפוס סביבת בדיקות (Reset Test Environment)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              מחיקת כל משתמשי ה-Demo, קבצי הבדיקה והעסקאות הפיקטיביות כדי להתחיל בדיקה מחדש מסביבה נקייה
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs text-slate-300 space-y-1">
            <div className="font-bold text-amber-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>עקרון בטיחות מחמיר (Zero Production Danger)</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              מנגנון האיפוס מסנן ומוחק אך ורק רשומות המזוהות כ-Test Data (`isDemoUser === true`).
              הוא חסום לחלוטין מפגיעה בחשבונות משתמשים אמיתיים או במנהל המערכת.
            </p>
          </div>

          <button
            type="button"
            onClick={onResetTestEnvironment}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors shadow-md flex items-center gap-2 cursor-pointer self-start sm:self-auto whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4" />
            <span>אפס את כל נתוני הבדיקה (Reset Test)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
