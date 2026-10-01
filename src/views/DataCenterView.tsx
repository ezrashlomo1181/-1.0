import React, { useState } from 'react';
import { DataQualityReport, Transaction } from '../types/financial';
import {
  FolderInput,
  UploadCloud,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Building,
  CreditCard,
  TrendingUp,
  Info,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  Database,
} from 'lucide-react';

interface DataCenterViewProps {
  dataQuality: DataQualityReport;
  onImportSimulatedFile: (fileName: string, type: 'bank' | 'card' | 'invest') => void;
}

export const DataCenterView: React.FC<DataCenterViewProps> = ({
  dataQuality,
  onImportSimulatedFile,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<string>('isracard');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [lastImportResult, setLastImportResult] = useState<string | null>(null);

  const guides: Record<
    string,
    { name: string; type: string; steps: string[]; recommended: string }
  > = {
    isracard: {
      name: 'ישראכרט (Isracard)',
      type: 'כרטיסי אשראי',
      steps: [
        'התחבר לאתר או לאפליקציית ישראכרט באמצעות קוד חד-פעמי או סיסמה.',
        'בתפריט העליון לחץ על «פירוט חיובים ועסקאות».',
        'בחר טווח תאריכים מבוקש (מומלץ 6 עד 12 חודשים אחרונים).',
        'לחץ על כפתור «ייצוא לקובץ Excel» (או הורדת PDF חודשי).',
        'גרור את הקובץ שהורד לאזור ההעלאה שלמעלה.',
      ],
      recommended: 'מומלץ להעלות לפחות 6 חודשים של מידע, ואם אפשר 12 חודשים.',
    },
    hapoalim: {
      name: 'בנק הפועלים',
      type: 'בנקים',
      steps: [
        'התחבר לאתר בנק הפועלים באינטרנט.',
        'היכנס לחשבון העו״ש ולחץ על «תנועות בחשבון».',
        'הגדר תאריכי סינון: בחר «שנה אחרונה» או טווח מותאם אישית.',
        'לחץ על סמל ההורדה ובחר «ייצוא לאקסל» (פורמט XLS / XLSX / CSV).',
        'העלה את הקובץ למערכת «מצפן פיננסי».',
      ],
      recommended: '12 חודשים מומלצים לזיהוי מדויק של שכר והוראות קבע שנתיות.',
    },
    leumi: {
      name: 'בנק לאומי',
      type: 'בנקים',
      steps: [
        'היכנס לאתר לאומי באמצעות תעודת זהות וסיסמה.',
        'עבור ללשונית «עו״ש» ובחר «תנועות אחרונות».',
        'לחץ על «חיפוש מתקדם» והגדר טווח של 12 חודשים.',
        'לחץ על כפתור «הורד לאקסל».',
        'גרור לכאן את הקובץ.',
      ],
      recommended: 'מומלץ לייצא גם דוח פקדונות וחסכונות.',
    },
    max: {
      name: 'MAX (לאומי קארד לשעבר)',
      type: 'כרטיסי אשראי',
      steps: [
        'התחבר לחשבונך באתר MAX.',
        'לחץ על «פירוט עסקאות» ובחר את כל הכרטיסים הפעילים.',
        'בחר תקופה של 6-12 חודשים אחרונים.',
        'הורד את קובץ האקסל או דוח PDF מרוכז.',
        'העלה את הקובץ לאזור הגרירה.',
      ],
      recommended: 'וודא שהדוח כולל עסקאות חו״ל והוראות קבע.',
    },
    cal: {
      name: 'כרטיסי אשראי לישראל (Cal)',
      type: 'כרטיסי אשראי',
      steps: [
        'התחבר לאתר כאל (Cal Online).',
        'עבור ל«עסקאות וחיובים» ובחר «עסקאות שחויבו בעבר».',
        'סמן את טווח החודשים המבוקש.',
        'לחץ על כפתור «ייצוא ל-Excel».',
        'העלה את הקובץ כאן.',
      ],
      recommended: 'מומלץ לייצא לפחות 6 חודשים.',
    },
    meitav: {
      name: 'מיטב טרייד / בתי השקעות',
      type: 'השקעות',
      steps: [
        'התחבר למערכת המסחר העצמאית (Spark / Trade).',
        'עבור ל«דוחות» ולחץ על «דוח יתרות והחזקות» וכן «תנועות כספיות».',
        'ייצא כקובץ Excel או PDF שנתי.',
        'העלה למערכת לסנכרון שווי ורווחי הון.',
      ],
      recommended: 'דוח שנתי מלא מאפשר חישוב תשואה אמיתי ללא הערכות שווא.',
    },
  };

  const handleSimulateUpload = (fileName: string, type: 'bank' | 'card' | 'invest') => {
    setIsProcessing(true);
    setProcessingStage('קורא את הקובץ ומחלץ תנועות...');

    setTimeout(() => {
      setProcessingStage('מנרמל שמות בתי עסק ומסווג קטגוריות...');
    }, 700);

    setTimeout(() => {
      setProcessingStage('מאתר ומנטרל העברות פנימיות למניעת ספירה כפולה...');
    }, 1400);

    setTimeout(() => {
      setProcessingStage('בודק אי-ודאות בעסקאות (זיהוי פריטים לבדיקת משתמש)...');
    }, 2100);

    setTimeout(() => {
      setIsProcessing(false);
      setLastImportResult(`הקובץ "${fileName}" נקלט בהצלחה! 38 עסקאות חדשות נוספו, 2 זוהו כדורשות אימות.`);
      onImportSimulatedFile(fileName, type);
    }, 2800);
  };

  const currentGuide = guides[selectedProvider] || guides.isracard;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FolderInput className="w-5 h-5 text-emerald-400" />
            <span>מרכז הנתונים וייבוא תדפיסים</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            העלאת קבצי PDF, Excel ו-CSV מבנקים וכרטיסי אשראי ללא צורך בהקלדה ידנית
          </p>
        </div>

        {/* Philosophy Badge */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-1.5 text-xs text-emerald-300 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>חילוץ אוטומטי + אימות אנושי בעת אי-ודאות</span>
        </div>
      </div>

      {/* 1. DATA QUALITY & HEALTH REPORT (#9) */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400 font-mono text-lg">
              {dataQuality.overallScore}%
            </div>
            <div>
              <h3 className="text-base font-bold text-white">מדד שלמות הנתונים וכיסוי היסטורי</h3>
              <p className="text-xs text-slate-400">
                המערכת אינה מעמידה פנים שיש לה מידע מלא אם חסרים חודשים או תדפיסים
              </p>
            </div>
          </div>
          <span className="text-xs font-medium text-slate-300 bg-slate-800 px-3 py-1 rounded-xl self-start sm:self-auto">
            מצב: כיסוי טוב מאוד (87%)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {dataQuality.institutions.map((inst, i) => (
            <div
              key={i}
              className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">{inst.name}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    inst.status === 'good'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {inst.monthsCovered}/{inst.recommendedMonths} חודשים
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">{inst.notes}</p>
            </div>
          ))}
        </div>

        <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/80 text-xs text-slate-300 space-y-1">
          <span className="font-bold text-emerald-400 block">המלצות להשלמת דיוק:</span>
          {dataQuality.recommendations.map((rec, i) => (
            <div key={i} className="flex items-center gap-2 text-slate-400 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{rec}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. UPLOAD ZONE (#4 & #6) */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <UploadCloud className="w-5 h-5 text-emerald-400" />
          <span>העלאת קבצים חדשים</span>
        </h3>

        {/* Drag & Drop Area */}
        <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-2xl p-8 text-center bg-slate-950/50 transition-colors flex flex-col items-center justify-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
            <UploadCloud className="w-7 h-7" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">גרור לכאן קבצי תדפיסים מהבנק או האשראי</div>
            <p className="text-xs text-slate-400 mt-1">
              תומך בקבצי Excel (XLSX, XLS), CSV, ודוחות PDF חודשיים
            </p>
          </div>

          {/* Quick simulation buttons for the user to try importing files right away */}
          <div className="pt-2 flex flex-wrap justify-center gap-2">
            <button
              disabled={isProcessing}
              onClick={() =>
                handleSimulateUpload('תדפיס_עוש_בנק_לאומי_12חודשים.xlsx', 'bank')
              }
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>דמה ייבוא: תדפיס עו״ש בנק לאומי</span>
            </button>
            <button
              disabled={isProcessing}
              onClick={() =>
                handleSimulateUpload('פירוט_ישראכרט_ספטמבר_2026.xlsx', 'card')
              }
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
              <span>דמה ייבוא: פירוט ישראכרט חודשי</span>
            </button>
            <button
              disabled={isProcessing}
              onClick={() =>
                handleSimulateUpload('דוח_יתרות_מיטב_טרייד_2026.pdf', 'invest')
              }
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>דמה ייבוא: דוח השקעות PDF</span>
            </button>
          </div>
        </div>

        {/* Processing State Indicator */}
        {isProcessing && (
          <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-2 animate-in fade-in">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span>{processingStage}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full animate-pulse w-3/4" />
            </div>
          </div>
        )}

        {/* Success Alert */}
        {lastImportResult && !isProcessing && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{lastImportResult}</span>
          </div>
        )}
      </div>

      {/* 3. IMPORT GUIDES (#5) */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400" />
            <span>מדריכי ייצוא לפי מוסד פיננסי</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            הסבר שלב-אחר-שלב כיצד לייצא נתונים מהבנק או מחברת האשראי שלך
          </p>
        </div>

        {/* Institution Selector Pills */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(guides).map(([key, g]) => (
            <button
              key={key}
              onClick={() => setSelectedProvider(key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                selectedProvider === key
                  ? 'bg-emerald-600 text-white font-bold shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>

        {/* Guide Steps Card */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-xs text-slate-400">{currentGuide.type}</span>
              <h4 className="text-base font-bold text-white">{currentGuide.name}</h4>
            </div>
            <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20 font-medium">
              {currentGuide.recommended}
            </span>
          </div>

          <div className="space-y-3">
            {currentGuide.steps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-3 text-xs">
                <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                  {idx + 1}
                </span>
                <span className="text-slate-300 mt-0.5 leading-relaxed">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
