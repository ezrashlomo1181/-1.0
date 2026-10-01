import React, { useState } from 'react';
import { Sparkles, UploadCloud, ShieldAlert, Target, Compass, ArrowLeft, ArrowRight, Check } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDataCenter: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onOpenDataCenter,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const steps = [
    {
      icon: Compass,
      iconColor: 'text-blue-600 dark:text-blue-400',
      title: 'ברוכים הבאים ל״מצפן פיננסי״',
      subtitle: 'פילוסופיית המוצר: לא להקליד הכל ידנית, אלא לייבא, להבין ולתכנן',
      content: (
        <div className="space-y-3 text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
          <p>
            מרבית האפליקציות הפיננסיות דורשות ממך להזין כל כוס קפה או קנייה באופן ידני. ב״מצפן פיננסי״, נקודת המוצא הפוכה:
          </p>
          <div className="p-3.5 bg-slate-50 dark:bg-[#0B0F17] rounded-xl border border-slate-200 dark:border-[#1F2937] text-slate-800 dark:text-slate-200 font-medium">
            💡 מעלים תדפיסים וייצואים מהבנקים וכרטיסי האשראי — והבינה הפיננסית מנרמלת, מסווגת ובונה תמונה אחודה בתוך שניות.
          </div>
        </div>
      ),
    },
    {
      icon: ShieldAlert,
      iconColor: 'text-amber-600 dark:text-amber-400',
      title: 'עקרון הברזל: אי-ודאות דורשת שאלה, לא המצאה',
      subtitle: 'Never assume when uncertain. When uncertain, ask.',
      content: (
        <div className="space-y-3 text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
          <p>
            בינה מלאכותית נוטה לפעמים "לנחש" או להמציא סיווגים. כאן החוק ברור:
          </p>
          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-300">
              <strong>ביטחון גבוה (95%+):</strong> משכורת, ארנונה, שופרסל, וולט — מסווגים אוטומטית.
            </div>
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-300">
              <strong>עסקה עמומה (BUYME, Bit לחבר):</strong> המערכת מסמנת ב"דורש בדיקה", שואלת אותך פעם אחת, ומבקשת אישור מפורש לשמירת כלל עתידי.
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: Target,
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      title: 'תכנון עתידי: מעבדת סימולציות ומטרות',
      subtitle: 'לא רק מה קרה בעבר — אלא מה יקרה מחר',
      content: (
        <div className="space-y-3 text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
          <p>
            בדוק תרחישי «מה יקרה אם»:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-600 dark:text-slate-300 pr-1">
            <li><strong>השקעות בריבית דריבית:</strong> כיצד שקל נוסף בחודש יתפתח על פני 10-30 שנה.</li>
            <li><strong>שכירות מול קנייה:</strong> השוואה מתמטית בין משכנתא לבין השקעת ההון העצמי.</li>
            <li><strong>«האם אני יכול להרשות לעצמי את זה?»:</strong> הזן הוצאה מתוכננת וגלה את ההשפעה על כרית הביטחון וזמן ההתאוששות.</li>
          </ul>
        </div>
      ),
    },
    {
      icon: UploadCloud,
      iconColor: 'text-blue-600 dark:text-blue-400',
      title: 'איך מתחילים עכשיו?',
      subtitle: 'המסלול: העלאה → ניתוח → אימות → תכנון',
      content: (
        <div className="space-y-4 text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
          <p>
            כרגע טענו עבורך <strong>נתוני דוגמה ריאליסטיים</strong> (חשבונות, כרטיסים, השקעות ומטרות) כדי שתוכל להתנסות בכל הכלים.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              onClick={() => {
                onClose();
                onOpenDataCenter();
              }}
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>עבור למרכז הנתונים לייבוא ראשון</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0B0F17] dark:hover:bg-slate-800 border border-slate-200 dark:border-[#1F2937] text-slate-700 dark:text-slate-200 font-medium text-xs transition-colors cursor-pointer"
            >
              המשך לחקור את נתוני הדוגמה
            </button>
          </div>
        </div>
      ),
    },
  ];

  const curr = steps[currentStep];
  const StepIcon = curr.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 pb-2 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] flex items-center justify-center flex-shrink-0">
            <StepIcon className={`w-6 h-6 ${curr.iconColor}`} />
          </div>
          <div className="flex-1">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">שלב {currentStep + 1} מתוך {steps.length}</span>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{curr.title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{curr.subtitle}</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 pt-3 flex-1">{curr.content}</div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#0B0F17] border-t border-slate-200 dark:border-[#1F2937] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentStep ? 'w-6 bg-slate-900 dark:bg-slate-100' : 'w-2 bg-slate-300 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#1F2937] text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                הקודם
              </button>
            )}
            {currentStep < steps.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>הבא</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 text-xs font-semibold transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <span>הבנתי, בוא נתחיל!</span>
                <Check className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
