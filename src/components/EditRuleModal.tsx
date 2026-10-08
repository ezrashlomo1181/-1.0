import React, { useState } from 'react';
import { LearnedRule, TransactionType } from '../types/financial';
import { X, Sparkles, Check, AlertCircle } from 'lucide-react';

interface EditRuleModalProps {
  rule: LearnedRule | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedRule: LearnedRule) => void;
}

export const EditRuleModal: React.FC<EditRuleModalProps> = ({
  rule,
  isOpen,
  onClose,
  onSave,
}) => {
  if (!isOpen || !rule) return null;

  const [pattern, setPattern] = useState(rule.pattern);
  const [assignedCategory, setAssignedCategory] = useState(rule.assignedCategory);
  const [assignedType, setAssignedType] = useState<TransactionType>(rule.assignedType || 'expense');
  const [applyTo, setApplyTo] = useState<'all_similar' | 'exact_only'>(
    rule.applyTo === 'exact_only' ? 'exact_only' : 'all_similar'
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pattern.trim() || !assignedCategory.trim()) return;

    onSave({
      ...rule,
      pattern: pattern.trim(),
      assignedCategory: assignedCategory.trim(),
      assignedType,
      applyTo,
      userPromptBasis: `עודכן ידנית על ידך (${new Date().toLocaleDateString('he-IL')})`,
    });
    onClose();
  };

  const categories = [
    'מזון וסופר',
    'מסעדות ובילויים',
    'משכורת והכנסות',
    'קניות וביגוד',
    'תחבורה ורכב',
    'דיור וחשבונות',
    'תקשורת וטכנולוגיה',
    'בריאות ופארם',
    'חינוך וילדים',
    'ביטוח ופיננסים',
    'השקעות וחיסכון',
    'העברות ומזומן',
    'לא ידוע / לבירור',
    'אחר / כללי',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150" dir="rtl">
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col text-[#0F172A] dark:text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 dark:bg-[#0B0F17] border-b border-slate-200 dark:border-[#1F2937] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">עריכת כלל אישי</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">כלל זה מקבל עדיפות עליונה על פני סיווג אוטומטי</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
              תבנית מזהה (טקסט או שם עסק):
            </label>
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="למשל: Bit, Wolt, משכורת..."
              required
              className="w-full bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
            />
            <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
              כל עסקה שתכיל מחרוזת זו תסווג לפי כלל זה.
            </span>
          </div>

          <div>
            <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
              קטגוריה משויכת:
            </label>
            <select
              value={assignedCategory}
              onChange={(e) => setAssignedCategory(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 cursor-pointer"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
              סוג פעולה:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'expense', label: 'הוצאה' },
                { id: 'income', label: 'הכנסה' },
                { id: 'transfer', label: 'העברה' },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setAssignedType(opt.id as TransactionType)}
                  className={`py-1.5 px-2 rounded-lg border text-center transition-colors cursor-pointer ${
                    assignedType === opt.id
                      ? 'bg-slate-900 text-white dark:bg-slate-800 dark:text-white border-slate-900 dark:border-slate-700 font-semibold'
                      : 'bg-white dark:bg-[#0B0F17] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#1F2937] hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
              אופן ההחלה:
            </label>
            <div className="space-y-1.5">
              {[
                {
                  id: 'all_similar',
                  title: 'החל על כל עסקאות דומות שמכילות את התבנית',
                  desc: 'מתאים למשל ל-Bit, סופרפארם, וולט וכדומה',
                },
                {
                  id: 'exact_only',
                  title: 'החל אך ורק על התאמה מדויקת של שם העסק',
                  desc: 'רק שורות זהות לחלוטין יסווגו לפיו',
                },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    applyTo === opt.id
                      ? 'bg-slate-100 dark:bg-slate-800/60 border-slate-400 dark:border-slate-600'
                      : 'border-slate-200 dark:border-[#1F2937] hover:bg-slate-50 dark:hover:bg-slate-800/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="applyTo"
                    checked={applyTo === opt.id}
                    onChange={() => setApplyTo(opt.id as any)}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="font-semibold block text-slate-900 dark:text-white">{opt.title}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{opt.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Footer actions */}
          <div className="pt-3 border-t border-slate-200 dark:border-[#1F2937] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#1F2937] text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              ביטול
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>שמור שינויים</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
