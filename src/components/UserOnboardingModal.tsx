import React, { useState } from 'react';
import {
  Compass,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  UploadCloud,
  Edit3,
  Eye,
  User,
} from 'lucide-react';
import { updateLocalUserProfile } from '../services/localAuth';

interface UserOnboardingModalProps {
  isOpen: boolean;
  initialName: string;
  userId: string;
  onComplete: (startChoice: 'upload' | 'manual' | 'explore') => void;
}

export const UserOnboardingModal: React.FC<UserOnboardingModalProps> = ({
  isOpen,
  initialName,
  userId,
  onComplete,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [userName, setUserName] = useState(initialName || 'חבר/ה');
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  if (!isOpen) return null;

  const goalOptions = [
    'להבין לאן הכסף שלי הולך',
    'להפסיק לחרוג מהתקציב',
    'להתחיל לחסוך באופן עקבי',
    'לצאת מחובות והלוואות',
    'לנהל טוב יותר את הכסף',
    'להתחיל להשקיע בצורה מושכלת',
    'פשוט לעשות סדר ולהיות רגוע/ה',
  ];

  const toggleGoal = (goal: string) => {
    if (selectedGoals.includes(goal)) {
      setSelectedGoals(selectedGoals.filter((g) => g !== goal));
    } else {
      setSelectedGoals([...selectedGoals, goal]);
    }
  };

  const handleFinish = async (choice: 'upload' | 'manual' | 'explore') => {
    try {
      updateLocalUserProfile(userId, {
        name: userName.trim() || initialName,
        onboardingCompleted: true,
      });
    } catch (e) {
      console.warn('Could not update onboarding status locally', e);
    }
    onComplete(choice);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col text-[#0F172A] dark:text-slate-100">
        {/* Progress Dots */}
        <div className="px-6 pt-5 flex items-center justify-between border-b border-slate-100 dark:border-[#1F2937]/50 pb-4">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step === i
                    ? 'w-7 bg-slate-900 dark:bg-slate-200'
                    : step > i
                    ? 'w-3.5 bg-slate-400 dark:bg-slate-600'
                    : 'w-2 bg-slate-200 dark:bg-slate-800'
                }`}
              />
            ))}
          </div>
          <span className="text-[11px] font-mono text-slate-500">שלב {step} מתוך 4</span>
        </div>

        {/* STEP 1: WELCOME */}
        {step === 1 && (
          <div className="p-8 text-center space-y-5 animate-in fade-in">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-800 dark:text-slate-200 mx-auto shadow-xs">
              <Compass className="w-8 h-8 stroke-[2.2]" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-[#0F172A] dark:text-white tracking-wide">
                ברוכים הבאים למצפן
              </h2>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
                Your Financial Compass
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto leading-relaxed pt-2">
                המטרה שלנו פשוטה: לעזור לך להבין את התמונה הפיננסית המלאה שלך, לעשות סדר אמיתי
                ולקבל החלטות מתוך ביטחון ובהירות – ללא שיפוטיות וללא עומס מיותר.
              </p>
            </div>

            <div className="pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 font-semibold text-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2"
              >
                <span>בואו נתחיל</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: NAME */}
        {step === 2 && (
          <div className="p-8 space-y-6 animate-in fade-in">
            <div className="space-y-1">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold tracking-wider uppercase">
                נעים להכיר
              </span>
              <h3 className="text-xl font-bold text-[#0F172A] dark:text-white">איך תרצה שנקרא לך?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                נשתמש בשם זה כדי להתאים אישית את הפניות והדוחות במערכת.
              </p>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3.5 top-3" />
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="השם שלך"
                  className="w-full bg-slate-50 dark:bg-[#0B0F17] border border-slate-300 dark:border-[#1F2937] focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                חזרה
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 font-semibold text-xs transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>המשך</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: GOALS (OPTIONAL) */}
        {step === 3 && (
          <div className="p-8 space-y-5 animate-in fade-in">
            <div className="space-y-1">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold tracking-wider uppercase">
                הכיוון שלך
              </span>
              <h3 className="text-xl font-bold text-[#0F172A] dark:text-white">מה העיקר שתרצה להשיג?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                בחר אפשרויות שמתאימות לך כרגע (אפשר לסמן יותר מאחת או לדלג):
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
              {goalOptions.map((g) => {
                const isSelected = selectedGoals.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGoal(g)}
                    className={`p-3 rounded-xl text-right text-xs font-medium transition-all flex items-center justify-between border cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-800 dark:border-slate-600 dark:text-white font-bold'
                        : 'bg-slate-50 dark:bg-[#0B0F17] border-slate-200 dark:border-[#1F2937] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <span>{g}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                חזרה
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="flex-1 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 font-semibold text-xs transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>המשך לבחירת התחלה</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: CHOOSE HOW TO START */}
        {step === 4 && (
          <div className="p-8 space-y-5 animate-in fade-in">
            <div className="space-y-1 text-center">
              <h3 className="text-xl font-bold text-[#0F172A] dark:text-white">איך תרצה להתחיל?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                בחר את הדרך הנוחה לך ביותר. תמיד תוכל להשלים ולשנות בהמשך:
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {/* Choice 1 */}
              <button
                type="button"
                onClick={() => handleFinish('upload')}
                className="w-full p-4 rounded-xl bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] hover:border-slate-300 dark:hover:border-slate-600 transition-all text-right flex items-start gap-3.5 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 flex-shrink-0 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0F172A] dark:text-white transition-colors">
                    העלאת נתונים (מומלץ)
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    העלה קובץ אקסל, CSV או PDF מהבנק או כרטיס האשראי לסנכרון מיידי.
                  </p>
                </div>
              </button>

              {/* Choice 2 */}
              <button
                type="button"
                onClick={() => handleFinish('manual')}
                className="w-full p-4 rounded-xl bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] hover:border-slate-300 dark:hover:border-slate-600 transition-all text-right flex items-start gap-3.5 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 flex-shrink-0 group-hover:scale-105 transition-transform">
                  <Edit3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0F172A] dark:text-white transition-colors">
                    הזנה ידנית
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    הגדרת חשבון ראשון, תקציב או יתרות בקצב שלך.
                  </p>
                </div>
              </button>

              {/* Choice 3 */}
              <button
                type="button"
                onClick={() => handleFinish('explore')}
                className="w-full p-4 rounded-xl bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] hover:border-slate-300 dark:hover:border-slate-600 transition-all text-right flex items-start gap-3.5 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 flex-shrink-0 group-hover:scale-105 transition-transform">
                  <Eye className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0F172A] dark:text-white transition-colors">
                    רק להציץ בינתיים
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    כניסה ישירה ללוח הבקרה והתרשמות מהאפשרויות במערכת.
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
