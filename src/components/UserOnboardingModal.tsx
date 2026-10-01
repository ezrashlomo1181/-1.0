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
import { updateUserProfileDoc } from '../services/firebase';

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
      await updateUserProfileDoc(userId, {
        name: userName.trim() || initialName,
        onboardingCompleted: true,
      });
    } catch (e) {
      console.warn('Could not update onboarding status in firestore', e);
    }
    onComplete(choice);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Progress Dots */}
        <div className="px-6 pt-5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step === i
                    ? 'w-7 bg-emerald-400'
                    : step > i
                    ? 'w-3.5 bg-emerald-600'
                    : 'w-2 bg-slate-800'
                }`}
              />
            ))}
          </div>
          <span className="text-[11px] font-mono text-slate-500">שלב {step} מתוך 4</span>
        </div>

        {/* STEP 1: WELCOME */}
        {step === 1 && (
          <div className="p-8 text-center space-y-5 animate-in fade-in">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-900/20">
              <Compass className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white tracking-wide">
                ברוכים הבאים למצפן
              </h2>
              <div className="text-sm font-light text-emerald-400 tracking-wider">
                Your Financial Compass
              </div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed pt-2">
                המטרה שלנו פשוטה: לעזור לך להבין את התמונה הפיננסית המלאה שלך, לעשות סדר אמיתי
                ולקבל החלטות מתוך ביטחון ובהירות – ללא שיפוטיות וללא עומס מיותר.
              </p>
            </div>

            <div className="pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-lg shadow-emerald-900/40 cursor-pointer flex items-center justify-center gap-2"
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
            <div className="space-y-2">
              <span className="text-[11px] text-emerald-400 font-bold tracking-wider uppercase">
                נעים להכיר
              </span>
              <h3 className="text-xl font-bold text-white">איך תרצה שנקרא לך?</h3>
              <p className="text-xs text-slate-400">
                נשתמש בשם זה כדי להתאים אישית את הפניות והדוחות במערכת.
              </p>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5" />
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="השם שלך"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-2xl pr-10 pl-4 py-3 text-sm text-white placeholder-slate-600 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
              >
                חזרה
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
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
              <span className="text-[11px] text-emerald-400 font-bold tracking-wider uppercase">
                הכיוון שלך
              </span>
              <h3 className="text-xl font-bold text-white">מה העיקר שתרצה להשיג?</h3>
              <p className="text-xs text-slate-400">
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
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-white font-bold'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
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
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
              >
                חזרה
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
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
              <h3 className="text-xl font-bold text-white">איך תרצה להתחיל?</h3>
              <p className="text-xs text-slate-400">
                בחר את הדרך הנוחה לך ביותר. תמיד תוכל להשלים ולשנות בהמשך:
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {/* Choice 1 */}
              <button
                type="button"
                onClick={() => handleFinish('upload')}
                className="w-full p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-emerald-500/60 transition-all text-right flex items-start gap-3.5 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
                    העלאת נתונים (מומלץ)
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    העלה קובץ אקסל, CSV או PDF מהבנק או כרטיס האשראי לסנכרון מיידי.
                  </p>
                </div>
              </button>

              {/* Choice 2 */}
              <button
                type="button"
                onClick={() => handleFinish('manual')}
                className="w-full p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-cyan-500/60 transition-all text-right flex items-start gap-3.5 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 flex-shrink-0 group-hover:scale-105 transition-transform">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                    הזנה ידנית
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    הגדרת חשבון ראשון, תקציב או יתרות בקצב שלך.
                  </p>
                </div>
              </button>

              {/* Choice 3 */}
              <button
                type="button"
                onClick={() => handleFinish('explore')}
                className="w-full p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/60 transition-all text-right flex items-start gap-3.5 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0 group-hover:scale-105 transition-transform">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                    רק להציץ בינתיים
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
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
