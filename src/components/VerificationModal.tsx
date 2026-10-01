import React, { useState } from 'react';
import { Transaction, LearnedRule } from '../types/financial';
import { AlertCircle, CheckCircle2, ShieldCheck, Sparkles, X, ArrowLeft } from 'lucide-react';

interface VerificationModalProps {
  transaction: Transaction | null;
  onClose: () => void;
  onResolve: (
    transactionId: string,
    chosenCategory: string,
    userNotes: string,
    createRuleOption: 'all_similar' | 'exact_only' | 'none'
  ) => void;
}

export const VerificationModal: React.FC<VerificationModalProps> = ({
  transaction,
  onClose,
  onResolve,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [userNotes, setUserNotes] = useState<string>('');
  const [ruleOption, setRuleOption] = useState<'all_similar' | 'exact_only' | 'none'>('all_similar');
  const [step, setStep] = useState<'classify' | 'rule'>('classify');

  if (!transaction) return null;

  const effectiveCategory = selectedCategory === 'other_custom' ? customCategory : selectedCategory;

  const handleClassifyNext = () => {
    if (!effectiveCategory) return;
    setStep('rule');
  };

  const handleFinalSubmit = () => {
    onResolve(transaction.id, effectiveCategory, userNotes, ruleOption);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">מצאנו עסקה שדורשת אימות</h3>
              <p className="text-xs text-slate-400">עקרון יסוד: כשאין ודאות - שואלים, לא ממציאים</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transaction Summary Card */}
        <div className="p-6 space-y-5 overflow-y-auto">
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs text-slate-400">בית עסק / תיאור מקורי</span>
                <h4 className="text-lg font-bold text-white mt-0.5">{transaction.merchant}</h4>
                <p className="text-xs text-slate-400">{transaction.description}</p>
              </div>
              <div className="text-left font-mono">
                <span className="text-xs text-slate-400 block">סכום העסקה</span>
                <span className="text-xl font-bold text-rose-400">
                  ₪{Math.abs(transaction.amount).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs text-slate-300">
              <div>
                <span className="text-slate-500">חשבון: </span>
                <span>{transaction.accountName}</span>
              </div>
              <div>
                <span className="text-slate-500">תאריך: </span>
                <span className="font-mono">{transaction.date}</span>
              </div>
              {transaction.sourceDocument && (
                <div className="col-span-2 text-slate-400">
                  <span className="text-slate-500">קובץ מקור: </span>
                  <span className="font-mono text-[11px] bg-slate-800/80 px-1.5 py-0.5 rounded">
                    {transaction.sourceDocument}
                  </span>
                </div>
              )}
            </div>

            {/* AI Uncertainty reasoning */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 mt-2 flex items-start gap-2 text-xs text-amber-200">
              <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-0.5">סיבת הבדיקה על ידי המערכת:</span>
                <span>{transaction.reviewReason || 'המערכת זיהתה אפשרויות סיווג מרובות ואינה מניחה הנחות.'}</span>
              </div>
            </div>
          </div>

          {step === 'classify' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  לאיזו קטגוריה שייכת עסקה זו בפועל?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(transaction.reviewOptions || [
                    'מזון וסופר',
                    'מסעדות ומשלוחים',
                    'קניות',
                    'בילויים ופנאי',
                    'מתנות',
                  ]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(opt);
                        setCustomCategory('');
                      }}
                      className={`text-right p-3 rounded-xl border text-xs font-medium transition-all ${
                        selectedCategory === opt
                          ? 'border-emerald-500 bg-emerald-500/15 text-emerald-200 font-semibold shadow-sm'
                          : 'border-slate-800 bg-slate-800/50 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('other_custom')}
                    className={`text-right p-3 rounded-xl border text-xs font-medium transition-all ${
                      selectedCategory === 'other_custom'
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-200 font-semibold'
                        : 'border-slate-800 bg-slate-800/50 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    קטגוריה אחרת (הקלד ידנית)...
                  </button>
                </div>
              </div>

              {selectedCategory === 'other_custom' && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">שם הקטגוריה המותאמת אישית:</label>
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="לדוגמה: הוצאות לחיות מחמד / ציוד משרדי"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  הערה אישית / הסבר למערכת (אופציונלי):
                </label>
                <input
                  type="text"
                  value={userNotes}
                  onChange={(e) => setUserNotes(e.target.value)}
                  placeholder="לדוגמה: שוברים לסופר שאני קונה בהנחה ממקום העבודה"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          ) : (
            /* Step 2: Learning Rule Confirmation */
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4 text-xs space-y-2">
                <div className="flex items-center gap-2 text-indigo-300 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <span>למידת העדפות אישית</span>
                </div>
                <p className="text-slate-300">
                  סיווגת עסקה של <strong className="text-white">{transaction.merchant}</strong> כ-
                  <span className="text-emerald-400 font-bold px-1.5 py-0.5 bg-emerald-500/10 rounded mr-1">
                    {effectiveCategory}
                  </span>.
                </p>
                <p className="text-slate-400">
                  האם להחיל את הסיווג הזה על עסקאות דומות בעתיד?
                </p>
              </div>

              <div className="space-y-2">
                {[
                  {
                    id: 'all_similar',
                    title: `כן, לכל עסקאות ${transaction.merchant.split(' ')[0]} הדומות`,
                    desc: 'סיווג אוטומטי עתידי לקטגוריה זו בלבד לאחר בדיקת התאמה.',
                  },
                  {
                    id: 'exact_only',
                    title: 'כן, אך רק לעסקאות זהות לחלוטין',
                    desc: 'יופעל רק אם הסכום והתיאור תואמים במדויק.',
                  },
                  {
                    id: 'none',
                    title: 'לא, זו החלטה חד-פעמית לעסקה ספציפית זו',
                    desc: 'אל תייצר חוק קבוע, שאל אותי שוב בפעם הבאה.',
                  },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setRuleOption(opt.id as any)}
                    className={`w-full text-right p-3 rounded-xl border text-xs transition-all flex items-start justify-between ${
                      ruleOption === opt.id
                        ? 'border-indigo-500 bg-indigo-500/15 text-white font-medium'
                        : 'border-slate-800 bg-slate-800/40 text-slate-300 hover:bg-slate-800/70'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-sm mb-0.5">{opt.title}</div>
                      <div className="text-[11px] text-slate-400">{opt.desc}</div>
                    </div>
                    {ruleOption === opt.id && (
                      <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-slate-800/60 border-t border-slate-700/60 flex items-center justify-between">
          {step === 'rule' ? (
            <button
              type="button"
              onClick={() => setStep('classify')}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
              <span>חזור לבחירת קטגוריה</span>
            </button>
          ) : (
            <span className="text-xs text-slate-500">שלב 1 מתוך 2</span>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              ביטול
            </button>
            {step === 'classify' ? (
              <button
                type="button"
                disabled={!effectiveCategory}
                onClick={handleClassifyNext}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-xs font-semibold text-white transition-colors"
              >
                המשך לקביעת כלל
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinalSubmit}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors shadow-lg shadow-emerald-900/30"
              >
                שמור והחל סיווג
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
