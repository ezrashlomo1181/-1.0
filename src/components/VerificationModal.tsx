import React, { useState, useEffect } from 'react';
import { Transaction, LearnedRule, TransactionType } from '../types/financial';
import { getFixedExpenseCategories } from '../services/categoriesService';
import { AlertCircle, CheckCircle2, ShieldCheck, Sparkles, X, ArrowLeft } from 'lucide-react';

interface VerificationModalProps {
  transaction: Transaction | null;
  onClose: () => void;
  onResolve: (
    transactionId: string,
    chosenCategory: string,
    userNotes: string,
    createRuleOption: 'all_similar' | 'exact_only' | 'none',
    chosenType?: TransactionType
  ) => void;
}

export function formatPaymentMethodLabel(method?: string): string {
  switch (method) {
    case 'credit_card': return 'כרטיס אשראי';
    case 'bank_transfer': return 'העברה בנקאית';
    case 'direct_debit': return 'הוראת קבע';
    case 'bit': return 'ביט';
    case 'paybox': return 'פייבוקס';
    case 'cash': return 'מזומן';
    default: return method || 'לא צוין';
  }
}

export const VerificationModal: React.FC<VerificationModalProps> = ({
  transaction,
  onClose,
  onResolve,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedType, setSelectedType] = useState<TransactionType>('expense');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [userNotes, setUserNotes] = useState<string>('');
  const [ruleOption, setRuleOption] = useState<'all_similar' | 'exact_only' | 'none'>('all_similar');
  const [step, setStep] = useState<'classify' | 'rule'>('classify');

  useEffect(() => {
    if (transaction) {
      if (transaction.type === 'income') setSelectedType('income');
      else if (transaction.type === 'transfer' || transaction.isInternalTransfer) setSelectedType('transfer');
      else if (transaction.type === 'refund') setSelectedType('refund');
      else if (transaction.amount < 0 || transaction.category?.includes('הכנס')) setSelectedType('income');
      else setSelectedType('expense');

      setSelectedCategory(
        transaction.category && !transaction.category.includes('ללא סיווג') && !transaction.category.includes('לבירור')
          ? transaction.category
          : ''
      );
      setCustomCategory('');
      setUserNotes(transaction.userNotes || '');
      setStep('classify');
    }
  }, [transaction?.id]);

  const getCurrencySymbol = (currency?: string): string => {
    switch (currency) {
      case 'USD': return '$';
      case 'EUR': return '€';
      case 'GBP': return '£';
      default: return '₪';
    }
  };

  if (!transaction) return null;

  const effectiveCategory = selectedCategory === 'other_custom' ? customCategory : selectedCategory;

  const handleSelectCategory = (cat: string) => {
    setSelectedCategory(cat);
    setCustomCategory('');
    if (cat === 'משכורת והכנסות' || cat === 'הכנסות') {
      setSelectedType('income');
    } else if (cat === 'העברות ומזומן' || cat === 'העברות פנימיות') {
      setSelectedType('transfer');
    } else if (cat === 'החזרים וזיכויים') {
      setSelectedType('refund');
    } else if (selectedType === 'income' && !cat.includes('הכנס')) {
      setSelectedType('expense');
    }
  };

  const handleClassifyNext = () => {
    if (!effectiveCategory) return;
    setStep('rule');
  };

  const handleFinalSubmit = () => {
    onResolve(transaction.id, effectiveCategory, userNotes, ruleOption, selectedType);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh] text-[#0F172A] dark:text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#0B0F17] border-b border-slate-200 dark:border-[#1F2937] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0F172A] dark:text-white">מצאנו עסקה שדורשת אימות</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">עקרון יסוד: כשאין ודאות - שואלים, לא ממציאים</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transaction Summary Card */}
        <div className="p-6 space-y-5 overflow-y-auto">
          <div className="bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400">בית עסק / תיאור מקורי</span>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{transaction.merchant}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">{transaction.description}</p>
              </div>
              <div className="text-left font-mono">
                <span className="text-xs text-slate-500 dark:text-slate-400 block">סכום העסקה</span>
                <span className={`text-xl font-bold ${
                  selectedType === 'income' || selectedType === 'refund'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-[#BE123C] dark:text-rose-400'
                }`}>
                  {getCurrencySymbol(transaction.currency)}{Math.abs(transaction.amount).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-[#1F2937] text-xs text-slate-600 dark:text-slate-300">
              <div>
                <span className="text-slate-500">חשבון: </span>
                <span>{transaction.accountName}</span>
              </div>
              <div>
                <span className="text-slate-500">תאריך עסקה: </span>
                <span className="font-mono">{transaction.date}</span>
              </div>
              {transaction.billingDate && (
                <div>
                  <span className="text-slate-500">תאריך חיוב בחשבון: </span>
                  <span className="font-mono">{transaction.billingDate}</span>
                </div>
              )}
              {transaction.paymentMethod && (
                <div>
                  <span className="text-slate-500">אמצעי תשלום: </span>
                  <span>{formatPaymentMethodLabel(transaction.paymentMethod)}</span>
                </div>
              )}
              {transaction.sourceDocument && (
                <div className="col-span-2 text-slate-500 dark:text-slate-400">
                  <span className="text-slate-500">קובץ מקור: </span>
                  <span className="font-mono text-[11px] bg-slate-200/70 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                    {transaction.sourceDocument}
                  </span>
                </div>
              )}
            </div>

            {/* AI Uncertainty reasoning */}
            <div className="bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/40 rounded-lg p-2.5 mt-2 flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
              <Sparkles className="w-4 h-4 text-amber-700 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-0.5">סיבת הבדיקה על ידי המערכת:</span>
                <span>{transaction.reviewReason || 'המערכת זיהתה אפשרויות סיווג מרובות ואינה מניחה הנחות.'}</span>
              </div>
            </div>
          </div>

          {step === 'classify' ? (
            <div className="space-y-4">
              {/* Transaction Type Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                  סוג התנועה:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { id: 'income', label: 'משכורת / הכנסה', desc: 'הכנסה חדשה' },
                    { id: 'expense', label: 'הוצאה', desc: 'תשלום שוטף' },
                    { id: 'refund', label: 'החזר / זיכוי', desc: 'הקטנת הוצאה' },
                    { id: 'transfer', label: 'העברה פנימית', desc: 'בין חשבונות' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedType(t.id as TransactionType)}
                      className={`p-2 rounded-xl border text-right transition-all cursor-pointer ${
                        selectedType === t.id
                          ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-500 dark:bg-slate-800 font-semibold shadow-xs'
                          : 'border-slate-200 dark:border-[#1F2937] bg-white dark:bg-[#0B0F17] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-medium">{t.label}</div>
                      <div className={`text-[10px] ${selectedType === t.id ? 'text-slate-300' : 'text-slate-400'}`}>
                        {t.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  לאיזו קטגוריה שייכת עסקה זו בפועל?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(transaction.reviewOptions || [
                    ...getFixedExpenseCategories().map((c) => c.name),
                    'משכורת והכנסות',
                    'העברות ומזומן',
                    'החזרים וזיכויים',
                    'השקעות',
                    'אחר / לבירור',
                  ]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => handleSelectCategory(opt)}
                      className={`text-right p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                        selectedCategory === opt
                          ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-600 dark:bg-slate-800 dark:text-white font-semibold shadow-xs'
                          : 'border-slate-200 dark:border-[#1F2937] bg-white dark:bg-[#0B0F17] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('other_custom')}
                    className={`text-right p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                      selectedCategory === 'other_custom'
                        ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-600 dark:bg-slate-800 dark:text-white font-semibold'
                        : 'border-slate-200 dark:border-[#1F2937] bg-white dark:bg-[#0B0F17] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    קטגוריה אחרת (הקלד ידנית)...
                  </button>
                </div>
              </div>

              {selectedCategory === 'other_custom' && (
                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">שם הקטגוריה המותאמת אישית:</label>
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="לדוגמה: הוצאות לחיות מחמד / ציוד משרדי"
                    className="w-full bg-slate-50 dark:bg-[#0B0F17] border border-slate-300 dark:border-[#1F2937] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-600"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  הערה אישית / הסבר למערכת (אופציונלי):
                </label>
                <input
                  type="text"
                  value={userNotes}
                  onChange={(e) => setUserNotes(e.target.value)}
                  placeholder="לדוגמה: שוברים לסופר שאני קונה בהנחה ממקום העבודה"
                  className="w-full bg-slate-50 dark:bg-[#0B0F17] border border-slate-300 dark:border-[#1F2937] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>
          ) : (
            /* Step 2: Learning Rule Confirmation */
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-slate-100 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] rounded-xl p-4 text-xs space-y-2">
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                  <span>למידת העדפות אישית</span>
                </div>
                <p className="text-slate-700 dark:text-slate-300">
                  סיווגת עסקה של <strong className="text-slate-900 dark:text-white">{transaction.merchant}</strong> כ-
                  <span className="text-[#059669] dark:text-emerald-400 font-bold px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 rounded mr-1">
                    {effectiveCategory}
                  </span>
                  {' '}
                  <span className="text-slate-500 font-mono text-[11px]">
                    ({selectedType === 'income' ? 'הכנסה' : selectedType === 'refund' ? 'החזר' : selectedType === 'transfer' ? 'העברה' : 'הוצאה'})
                  </span>.
                </p>
                <p className="text-slate-500 dark:text-slate-400">
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
                    className={`w-full text-right p-3 rounded-xl border text-xs transition-all flex items-start justify-between cursor-pointer ${
                      ruleOption === opt.id
                        ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-600 dark:bg-slate-800 dark:text-white font-medium'
                        : 'border-slate-200 dark:border-[#1F2937] bg-white dark:bg-[#0B0F17] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-sm mb-0.5">{opt.title}</div>
                      <div className={`text-[11px] ${ruleOption === opt.id ? 'text-slate-300 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>{opt.desc}</div>
                    </div>
                    {ruleOption === opt.id && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#0B0F17] border-t border-slate-200 dark:border-[#1F2937] flex items-center justify-between">
          {step === 'rule' ? (
            <button
              type="button"
              onClick={() => setStep('classify')}
              className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
              <span>חזור לבחירת קטגוריה</span>
            </button>
          ) : (
            <span className="text-xs text-slate-400">שלב 1 מתוך 2</span>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#1F2937] text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              ביטול
            </button>
            {step === 'classify' ? (
              <button
                type="button"
                disabled={!effectiveCategory}
                onClick={handleClassifyNext}
                className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 disabled:opacity-40 text-xs font-semibold transition-colors cursor-pointer"
              >
                המשך לקביעת כלל
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinalSubmit}
                className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 text-xs font-semibold transition-colors shadow-xs cursor-pointer"
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
