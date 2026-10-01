import React, { useState } from 'react';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  auth,
  googleProvider,
  appleProvider,
  createOrUpdateUserProfile,
} from '../services/firebase';
import {
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Compass,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

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
  canDismiss = false,
}) => {
  const [tab, setTab] = useState<'login' | 'signup' | 'forgot'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await createOrUpdateUserProfile(result.user, undefined, 'google.com');
      onSuccess();
    } catch (err: any) {
      console.error('Google Sign In error:', err);
      setErrorMessage(
        err.code === 'auth/popup-closed-by-user'
          ? 'חלון ההתחברות נסגר. אנא נסה שוב.'
          : 'שגיאה בהתחברות עם Google. אנא נסה שוב או השתמש בדוא״ל וסיסמה.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await signInWithPopup(auth, appleProvider);
      await createOrUpdateUserProfile(result.user, undefined, 'apple.com');
      onSuccess();
    } catch (err: any) {
      console.error('Apple Sign In error:', err);
      setErrorMessage('התחברות עם Apple: אנא וודא שהשירות מופעל בחשבונך או התחבר באמצעות Google / דוא״ל.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    if (tab === 'signup') {
      if (!name.trim()) {
        setErrorMessage('אנא הזן את שמך.');
        return;
      }
      if (password.length < 6) {
        setErrorMessage('הסיסמה חייבת להכיל לפחות 6 תווים.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('הסיסמאות אינן תואמות.');
        return;
      }

      setIsLoading(true);
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await createOrUpdateUserProfile(cred.user, name, 'password');
        try {
          await sendEmailVerification(cred.user);
          setSuccessNotice('חשבונך נוצר בהצלחה! שלחנו מייל לאימות הכתובת.');
        } catch {
          // Verification optional in dev
        }
        setTimeout(() => {
          onSuccess();
        }, 1200);
      } catch (err: any) {
        console.error('Sign up error:', err);
        if (err.code === 'auth/email-already-in-use') {
          setErrorMessage('כתובת אימייל זו כבר רשומה במערכת. אנא התחבר.');
        } else if (err.code === 'auth/invalid-email') {
          setErrorMessage('כתובת אימייל לא חוקית.');
        } else if (err.code === 'auth/weak-password') {
          setErrorMessage('הסיסמה חלשה מדי. אנא בחר סיסמה חזקה יותר.');
        } else {
          setErrorMessage('שגיאה ביצירת החשבון. אנא נסה שוב.');
        }
      } finally {
        setIsLoading(false);
      }
    } else if (tab === 'login') {
      setIsLoading(true);
      try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        await createOrUpdateUserProfile(cred.user, undefined, 'password');
        onSuccess();
      } catch (err: any) {
        console.error('Sign in error:', err);
        if (
          err.code === 'auth/user-not-found' ||
          err.code === 'auth/wrong-password' ||
          err.code === 'auth/invalid-credential'
        ) {
          setErrorMessage('פרטי ההתחברות אינם נכונים. אנא בדוק את המייל והסיסמה.');
        } else {
          setErrorMessage('שגיאה בהתחברות למערכת. אנא נסה שוב.');
        }
      } finally {
        setIsLoading(false);
      }
    } else if (tab === 'forgot') {
      if (!email.trim()) {
        setErrorMessage('אנא הזן את כתובת האימייל שלך.');
        return;
      }
      setIsLoading(true);
      try {
        await sendPasswordResetEmail(auth, email);
        setSuccessNotice('קישור לאיפוס סיסמה נשלח לתיבת הדוא״ל שלך.');
      } catch (err: any) {
        setErrorMessage('שגיאה בשליחת קישור איפוס. ודא שכתובת המייל נכונה.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Brand Header */}
        <div className="p-6 bg-gradient-to-b from-slate-800/80 to-slate-900/90 border-b border-slate-800 text-center relative">
          {canDismiss && onClose && (
            <button
              onClick={onClose}
              className="absolute left-4 top-4 text-slate-400 hover:text-white text-xs px-2 py-1 rounded-lg bg-slate-800/60"
            >
              סגור
            </button>
          )}

          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto mb-3">
            <Compass className="w-7 h-7" />
          </div>

          <h2 className="text-xl font-bold text-white tracking-wide">
            מצפן • <span className="text-emerald-400 font-light text-base">Your Financial Compass</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            סביבה פיננסית אישית, מבודדת ומאובטחת מקצה לקצה
          </p>

          {/* Mode Switcher */}
          <div className="flex bg-slate-950/60 p-1 rounded-xl border border-slate-800 mt-5">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setErrorMessage(null);
                setSuccessNotice(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tab === 'login'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
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
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tab === 'signup'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              הרשמה
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {/* Social OAuth Buttons */}
          {tab !== 'forgot' && (
            <div className="space-y-2">
              <button
                type="button"
                disabled={isLoading}
                onClick={handleGoogleSignIn}
                className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-medium text-xs flex items-center justify-center gap-3 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>המשך באמצעות Google</span>
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={handleAppleSignIn}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs flex items-center justify-center gap-3 transition-colors border border-slate-700 disabled:opacity-50 cursor-pointer"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.84c.66-.82 1.11-1.96.99-3.1-.95.04-2.1.64-2.78 1.44-.59.68-1.12 1.84-.98 2.94 1.05.08 2.11-.46 2.77-1.28z" />
                </svg>
                <span>המשך באמצעות Apple</span>
              </button>

              <div className="relative py-2 flex items-center justify-center">
                <div className="border-t border-slate-800 w-full" />
                <span className="bg-slate-900 px-3 text-[11px] text-slate-500 absolute">
                  או עם דוא״ל וסיסמה
                </span>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleEmailAuth} className="space-y-3">
            {tab === 'signup' && (
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  שם מלא
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ישראל ישראלי"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-600 outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                דואר אלקטרוני
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@domain.com"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-600 outline-none text-left"
                  dir="ltr"
                />
              </div>
            </div>

            {tab !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-slate-300">
                    סיסמה
                  </label>
                  {tab === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setTab('forgot');
                        setErrorMessage(null);
                        setSuccessNotice(null);
                      }}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300"
                    >
                      שכחת סיסמה?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl pr-9 pl-9 py-2 text-xs text-white placeholder-slate-600 outline-none text-left"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {tab === 'signup' && (
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  אימות סיסמה
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-600 outline-none text-left"
                    dir="ltr"
                  />
                </div>
              </div>
            )}

            {/* Error & Success Messages */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successNotice && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{successNotice}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-lg shadow-emerald-900/30 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : tab === 'login' ? (
                <span>התחבר למערכת</span>
              ) : tab === 'signup' ? (
                <span>צור חשבון מאובטח</span>
              ) : (
                <span>שלח קישור איפוס</span>
              )}
            </button>

            {tab === 'forgot' && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setErrorMessage(null);
                    setSuccessNotice(null);
                  }}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  חזרה להתחברות
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Footer Privacy Guarantee */}
        <div className="px-6 py-3 bg-slate-950/70 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>אבטחה והפרדה ברמת שרת. הנתונים הפיננסיים שלך מבודדים לחלוטין.</span>
        </div>
      </div>
    </div>
  );
};
