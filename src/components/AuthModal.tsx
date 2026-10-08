import React, { useState } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Compass,
  ShieldCheck,
  HardDrive,
} from 'lucide-react';
import { registerLocalUser, loginLocalUser } from '../services/localAuth';

interface AuthModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onClose?: () => void;
  canDismiss?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onSuccess,
  onClose,
  canDismiss = true,
}) => {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setErrorMessage(null);
    setSuccessNotice(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    const trimmedUsername = username.trim();

    if (tab === 'signup') {
      if (!trimmedUsername) {
        setErrorMessage('אנא הזן שם משתמש.');
        return;
      }
      if (trimmedUsername.length < 2) {
        setErrorMessage('שם המשתמש חייב להכיל לפחות 2 תווים.');
        return;
      }
      if (!password || password.length < 4) {
        setErrorMessage('הסיסמה חייבת להכיל לפחות 4 תווים.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('הסיסמאות אינן תואמות. אנא ודא שהקלדת אותה סיסמה בשני השדות.');
        return;
      }

      setIsLoading(true);
      try {
        const res = await registerLocalUser(trimmedUsername, password, confirmPassword);
        if (!res.success) {
          setErrorMessage(res.error || 'שגיאה ביצירת החשבון המקומי.');
        } else {
          setSuccessNotice('החשבון נוצר בהצלחה במחשב זה!');
          setTimeout(() => {
            resetForm();
            onSuccess();
          }, 600);
        }
      } catch (err: any) {
        console.error('Registration error:', err);
        setErrorMessage('שגיאה ביצירת החשבון.');
      } finally {
        setIsLoading(false);
      }
    } else {
      // Login
      if (!trimmedUsername || !password) {
        setErrorMessage('אנא הזן שם משתמש וסיסמה.');
        return;
      }

      setIsLoading(true);
      try {
        const res = await loginLocalUser(trimmedUsername, password);
        if (!res.success) {
          setErrorMessage(res.error || 'שם משתמש או סיסמה שגויים.');
        } else {
          setSuccessNotice('התחברת בהצלחה!');
          setTimeout(() => {
            resetForm();
            onSuccess();
          }, 400);
        }
      } catch (err: any) {
        console.error('Login error:', err);
        setErrorMessage('שגיאה בהתחברות למערכת.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col text-[#0F172A] dark:text-slate-100">
        {/* Brand Header */}
        <div className="p-6 bg-slate-50 dark:bg-[#0B0F17] border-b border-slate-200 dark:border-[#1F2937] text-center relative">
          {canDismiss && onClose && (
            <button
              onClick={() => {
                resetForm();
                onClose();
              }}
              className="absolute left-4 top-4 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white text-xs px-2.5 py-1 rounded-md bg-slate-200/60 dark:bg-slate-800/60 transition-colors"
            >
              סגור
            </button>
          )}

          <div className="w-11 h-11 rounded-xl bg-slate-900 dark:bg-slate-800 border border-slate-800 dark:border-slate-700 flex items-center justify-center text-white mx-auto mb-3 shadow-xs">
            <Compass className="w-6 h-6 stroke-[2.2] text-slate-200" />
          </div>

          <h2 className="text-lg font-bold text-[#0F172A] dark:text-white tracking-tight">
            מצפן פיננסי • <span className="text-slate-500 dark:text-slate-400 font-normal text-sm">חשבון מקומי</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {tab === 'login'
              ? 'התחבר לחשבונך המקומי השמור במחשב זה'
              : 'יצירת חשבון מקומי חדש (שם משתמש וסיסמה)'}
          </p>

          {/* Mode Switcher */}
          <div className="flex bg-slate-100 dark:bg-[#111827] p-1 rounded-lg border border-slate-200 dark:border-[#1F2937] mt-4">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setErrorMessage(null);
                setSuccessNotice(null);
              }}
              className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                tab === 'login'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              התחברות
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('signup');
                setErrorMessage(null);
                setSuccessNotice(null);
              }}
              className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                tab === 'signup'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              הרשמה
            </button>
          </div>
        </div>

        {/* Content Body Form */}
        <div className="p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Username Field */}
            <div>
              <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                שם משתמש
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="הזן שם משתמש"
                  autoComplete="username"
                  className="w-full bg-slate-50 dark:bg-[#0B0F17] border border-slate-300 dark:border-[#1F2937] focus:border-blue-600 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-600 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-colors"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                סיסמה
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3 top-2.5 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                  className="w-full bg-slate-50 dark:bg-[#0B0F17] border border-slate-300 dark:border-[#1F2937] focus:border-blue-600 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-600 rounded-xl pr-9 pl-9 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none text-left transition-colors"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Registration: Confirm Password */}
            {tab === 'signup' && (
              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  אימות סיסמה
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3 top-2.5 pointer-events-none" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="w-full bg-slate-50 dark:bg-[#0B0F17] border border-slate-300 dark:border-[#1F2937] focus:border-blue-600 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-600 rounded-xl pr-9 pl-9 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none text-left transition-colors"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Success Notice */}
            {successNotice && (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <span>{successNotice}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 font-semibold text-xs border border-slate-800 dark:border-slate-700 transition-colors shadow-xs disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : tab === 'login' ? (
                <span>התחבר לחשבון</span>
              ) : (
                <span>צור חשבון מקומי</span>
              )}
            </button>
          </form>

          {/* Local storage note */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-2.5">
            <HardDrive className="w-4 h-4 text-slate-500 dark:text-slate-400 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              החשבונות והנתונים הפיננסיים נשמרים מקומית על מחשבך בלבד. אין צורך בכתובת דוא״ל, אין שליחה לשרתים חיצוניים, וכל משתמש מבודד לחלוטין.
            </div>
          </div>
        </div>

        {/* Footer Privacy Guarantee */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-[#0B0F17] border-t border-slate-200 dark:border-[#1F2937] text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          <span>חשבון משתמש מקומי • בידוד מלא במחשב זה</span>
        </div>
      </div>
    </div>
  );
};
