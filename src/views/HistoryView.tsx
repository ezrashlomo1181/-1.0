import React, { useState, useMemo } from 'react';
import { Transaction, FinancialCycleConfig, FinancialCycleSuggestion } from '../types/financial';
import {
  formatMonthKeyLabel,
  getTransactionCyclePeriod,
  detectFinancialCyclePattern,
  getCategoryColor,
} from '../services/financialCalculations';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Receipt,
  Sparkles,
  CheckCircle2,
  X,
  PieChart,
  HelpCircle,
  Clock,
  Layers,
} from 'lucide-react';

interface HistoryViewProps {
  transactions: Transaction[];
  financialCycle?: FinancialCycleConfig | null;
  onApproveCycle: (config: FinancialCycleConfig) => void;
  onDismissCycle: () => void;
  onOpenReviewModal: (tx: Transaction) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  transactions,
  financialCycle,
  onApproveCycle,
  onDismissCycle,
  onOpenReviewModal,
}) => {
  // Filter out internal transfers from pure financial reporting
  const validTransactions = useMemo(
    () => transactions.filter((t) => !t.isInternalTransfer && t.type !== 'transfer'),
    [transactions]
  );

  // Extract all distinct calendar months present in real data
  const calendarMonths = useMemo(() => {
    const set = new Set<string>();
    for (const t of validTransactions) {
      if (t.date && t.date.length >= 7) {
        set.add(t.date.substring(0, 7)); // YYYY-MM
      }
    }
    // Sort descending (latest month first)
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [validTransactions]);

  // Selected view mode: calendar vs cycle
  const [viewMode, setViewMode] = useState<'calendar' | 'cycle'>('calendar');

  // Currently selected month (defaults to newest month available)
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => {
    return calendarMonths.length > 0 ? calendarMonths[0] : new Date().toISOString().substring(0, 7);
  });

  // Keep selected month in sync if calendarMonths changes
  React.useEffect(() => {
    if (calendarMonths.length > 0 && !calendarMonths.includes(selectedMonthKey)) {
      setSelectedMonthKey(calendarMonths[0]);
    }
  }, [calendarMonths, selectedMonthKey]);

  // Extract distinct cycle periods if financialCycle is active
  const cyclePeriods = useMemo(() => {
    if (!financialCycle || !financialCycle.isApprovedByUser) return [];
    const map = new Map<string, string>();
    for (const t of validTransactions) {
      if (t.date && t.date.length >= 10) {
        const { periodKey, periodLabel } = getTransactionCyclePeriod(t.date, financialCycle.startDay);
        map.set(periodKey, periodLabel);
      }
    }
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [validTransactions, financialCycle]);

  const [selectedCycleKey, setSelectedCycleKey] = useState<string>(() => {
    return cyclePeriods.length > 0 ? cyclePeriods[0].key : '';
  });

  React.useEffect(() => {
    if (cyclePeriods.length > 0 && (!selectedCycleKey || !cyclePeriods.some((c) => c.key === selectedCycleKey))) {
      setSelectedCycleKey(cyclePeriods[0].key);
    }
  }, [cyclePeriods, selectedCycleKey]);

  // Check for auto-detection of Financial Cycle if not yet approved
  const cycleSuggestion: FinancialCycleSuggestion | null = useMemo(() => {
    if (financialCycle && financialCycle.isApprovedByUser) return null;
    return detectFinancialCyclePattern(validTransactions);
  }, [validTransactions, financialCycle]);

  const [isSuggestionDismissed, setIsSuggestionDismissed] = useState(false);

  // Filter transactions for the selected period
  const periodTransactions = useMemo(() => {
    if (viewMode === 'cycle' && financialCycle?.isApprovedByUser && selectedCycleKey) {
      return validTransactions
        .filter((t) => {
          if (!t.date || t.date.length < 10) return false;
          const { periodKey } = getTransactionCyclePeriod(t.date, financialCycle.startDay);
          return periodKey === selectedCycleKey;
        })
        .sort((a, b) => b.date.localeCompare(a.date));
    }

    // Default: calendar month
    return validTransactions
      .filter((t) => t.date && t.date.startsWith(selectedMonthKey))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [validTransactions, viewMode, financialCycle, selectedCycleKey, selectedMonthKey]);

  // Calculations for selected period
  const totalIncome = useMemo(() => {
    return periodTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [periodTransactions]);

  const totalExpense = useMemo(() => {
    return periodTransactions
      .filter((t) => t.type === 'expense' || t.type === 'fee' || t.type === 'loan_payment')
      .reduce((sum, t) => sum + t.amount, 0) -
      periodTransactions
        .filter((t) => t.type === 'refund')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }, [periodTransactions]);

  const netCashFlow = totalIncome - Math.max(0, totalExpense);

  // Breakdown by category (Expenses)
  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of periodTransactions) {
      if (t.type === 'expense' || t.type === 'fee' || t.type === 'loan_payment') {
        const cat = t.category || 'אחר';
        map.set(cat, (map.get(cat) || 0) + t.amount);
      }
    }
    const arr = Array.from(map.entries()).map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
      color: getCategoryColor(category),
    }));
    return arr.sort((a, b) => b.amount - a.amount);
  }, [periodTransactions, totalExpense]);

  // Breakdown by category (Income)
  const incomeByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of periodTransactions) {
      if (t.type === 'income') {
        const cat = t.category || 'משכורת והכנסות';
        map.set(cat, (map.get(cat) || 0) + t.amount);
      }
    }
    const arr = Array.from(map.entries()).map(([category, amount]) => ({
      category,
      amount,
      percentage: totalIncome > 0 ? Math.round((amount / totalIncome) * 100) : 0,
      color: '#059669',
    }));
    return arr.sort((a, b) => b.amount - a.amount);
  }, [periodTransactions, totalIncome]);

  // Navigation handlers
  const currentMonthIdx = calendarMonths.indexOf(selectedMonthKey);
  const hasNextMonth = currentMonthIdx > 0; // newer
  const hasPrevMonth = currentMonthIdx < calendarMonths.length - 1; // older

  const handlePrevMonth = () => {
    if (hasPrevMonth) setSelectedMonthKey(calendarMonths[currentMonthIdx + 1]);
  };
  const handleNextMonth = () => {
    if (hasNextMonth) setSelectedMonthKey(calendarMonths[currentMonthIdx - 1]);
  };

  const handleApproveSuggestedCycle = () => {
    if (!cycleSuggestion) return;
    const endDay = cycleSuggestion.suggestedStartDay - 1;
    onApproveCycle({
      startDay: cycleSuggestion.suggestedStartDay,
      label: `מחזור ה-${cycleSuggestion.suggestedStartDay} בחודש עד ה-${endDay} בחודש העוקב`,
      basis: cycleSuggestion.reasoning,
      isApprovedByUser: true,
      detectedAt: new Date().toISOString(),
    });
    setViewMode('cycle');
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200" dir="rtl">
      {/* Header and Period Navigator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>היסטוריה חודשית</span>
            <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
              {calendarMonths.length} חודשים מזוהים
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            מעקב תזרים, הכנסות והוצאות מבוסס על תאריך העסקה האמיתי שנשלף מהמסמכים
          </p>
        </div>

        {/* View mode toggle (Calendar vs Cycle) */}
        {financialCycle?.isApprovedByUser && (
          <div className="flex rounded-lg border border-slate-200 dark:border-[#1F2937] bg-slate-100 dark:bg-[#0B0F17] p-0.5 text-xs">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              חודש קלנדרי
            </button>
            <button
              onClick={() => setViewMode('cycle')}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                viewMode === 'cycle'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              מחזור אישי ({financialCycle.startDay} לחודש)
            </button>
          </div>
        )}
      </div>

      {/* Financial Cycle Suggestion Banner (Detect -> Analyze -> Suggest -> Apply) */}
      {cycleSuggestion && !isSuggestionDismissed && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>זיהוי דפוס מחזור פיננסי אישי ({cycleSuggestion.suggestedStartDay} לחודש)</span>
                <span className="text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 px-1.5 py-0.2 rounded font-mono">
                  {Math.round(cycleSuggestion.confidenceScore * 100)}% התאמה
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 mt-1">
                {cycleSuggestion.reasoning} נראה שההתנהלות הפיננסית שלך מתאימה למחזור שמתחיל ב-
                <strong>{cycleSuggestion.suggestedStartDay} בחודש</strong> ומסתיים ב-
                <strong>{cycleSuggestion.suggestedStartDay - 1} בחודש הבא</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
            <button
              onClick={() => {
                setIsSuggestionDismissed(true);
                onDismissCycle();
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors cursor-pointer"
            >
              התעלם כעת
            </button>
            <button
              onClick={handleApproveSuggestedCycle}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>הפעל מחזור פיננסי</span>
            </button>
          </div>
        </div>
      )}

      {/* Period Selector Card */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1F2937] p-4 shadow-xs transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {viewMode === 'calendar' ? (
          <>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                disabled={!hasPrevMonth}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-[#1F2937] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="חודש קודם"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  {formatMonthKeyLabel(selectedMonthKey)}
                </span>
              </div>

              <button
                onClick={handleNextMonth}
                disabled={!hasNextMonth}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-[#1F2937] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="חודש הבא"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Month Dropdown */}
            {calendarMonths.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400">בחר חודש:</span>
                <select
                  value={selectedMonthKey}
                  onChange={(e) => setSelectedMonthKey(e.target.value)}
                  className="bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  {calendarMonths.map((m) => (
                    <option key={m} value={m}>
                      {formatMonthKeyLabel(m)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="font-bold text-sm text-slate-900 dark:text-white">
                מחזור פיננסי אישי ({financialCycle?.startDay} לחודש)
              </span>
            </div>

            {cyclePeriods.length > 0 && (
              <select
                value={selectedCycleKey}
                onChange={(e) => setSelectedCycleKey(e.target.value)}
                className="bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:border-blue-600 cursor-pointer"
              >
                {cyclePeriods.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {periodTransactions.length === 0 ? (
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1F2937] p-12 text-center shadow-xs">
          <HelpCircle className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            אין עסקאות רשומות בתקופה זו
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            לא נמצאו עסקאות עם תאריך בחודש זה. בחר חודש אחר או ייבא קבצים נוספים ממרכז הנתונים.
          </p>
        </div>
      ) : (
        <>
          {/* 4 Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Income */}
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                <span>סך הכנסות החודש</span>
                <TrendingUp className="w-4 h-4 text-[#059669]" />
              </div>
              <div className="text-xl font-bold font-mono text-[#059669]">
                +₪{totalIncome.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {periodTransactions.filter((t) => t.type === 'income').length} פעולות זכות
              </div>
            </div>

            {/* Expenses */}
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                <span>סך הוצאות החודש</span>
                <TrendingDown className="w-4 h-4 text-[#BE123C]" />
              </div>
              <div className="text-xl font-bold font-mono text-[#BE123C]">
                -₪{Math.abs(totalExpense).toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {periodTransactions.filter((t) => t.type === 'expense').length} פעולות חובה
              </div>
            </div>

            {/* Net Cash Flow */}
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                <span>תזרים נטו (חיסכון)</span>
                <ArrowRightLeft className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div
                className={`text-xl font-bold font-mono ${
                  netCashFlow >= 0 ? 'text-[#059669]' : 'text-[#BE123C]'
                }`}
              >
                {netCashFlow >= 0 ? '+' : ''}₪{netCashFlow.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {totalIncome > 0
                  ? `שיעור חיסכון: ${Math.round((Math.max(0, netCashFlow) / totalIncome) * 100)}%`
                  : 'ללא הכנסות בחודש זה'}
              </div>
            </div>

            {/* Transactions Count */}
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                <span>סה״כ עסקאות</span>
                <Receipt className="w-4 h-4 text-slate-500" />
              </div>
              <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                {periodTransactions.length}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                עסקאות אמיתיות מקובצי המקור
              </div>
            </div>
          </div>

          {/* Category Breakdown Sections (Expenses & Income) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Expenses by Category */}
            <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1F2937] p-5 shadow-xs transition-colors space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>הוצאות לפי קטגוריה</span>
                </h3>
                <span className="text-xs font-mono font-semibold text-rose-700 dark:text-rose-400">
                  ₪{Math.abs(totalExpense).toLocaleString()}
                </span>
              </div>

              {expenseByCategory.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">אין הוצאות בחודש זה</p>
              ) : (
                <div className="space-y-2">
                  {expenseByCategory.map((cat) => (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-800 dark:text-slate-200">{cat.category}</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-bold text-slate-900 dark:text-white">₪{cat.amount.toLocaleString()}</span>
                          <span className="text-[10px] text-slate-400 w-8 text-left">{cat.percentage}%</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${cat.percentage}%`,
                            backgroundColor: cat.color || '#BE123C',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Income by Category */}
            <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1F2937] p-5 shadow-xs transition-colors space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>הכנסות לפי קטגוריה</span>
                </h3>
                <span className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                  ₪{totalIncome.toLocaleString()}
                </span>
              </div>

              {incomeByCategory.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">אין הכנסות בחודש זה</p>
              ) : (
                <div className="space-y-2">
                  {incomeByCategory.map((cat) => (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-800 dark:text-slate-200">{cat.category}</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-bold text-slate-900 dark:text-white">₪{cat.amount.toLocaleString()}</span>
                          <span className="text-[10px] text-slate-400 w-8 text-left">{cat.percentage}%</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#059669] transition-all duration-300"
                          style={{ width: `${cat.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Table of Transactions for this Month */}
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1F2937] shadow-xs overflow-hidden transition-colors">
            <div className="px-5 py-3 border-b border-slate-200 dark:border-[#1F2937] flex items-center justify-between bg-slate-50/50 dark:bg-[#0B0F17]/50">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                עסקאות {viewMode === 'calendar' ? formatMonthKeyLabel(selectedMonthKey) : 'במחזור הנבחר'} ({periodTransactions.length})
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                ממוינות מהחדש לישן
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#1F2937] bg-slate-50 dark:bg-[#0B0F17] text-slate-600 dark:text-slate-400 font-semibold">
                    <th className="py-2.5 px-4 font-medium">תאריך</th>
                    <th className="py-2.5 px-4 font-medium">בית עסק ותיאור</th>
                    <th className="py-2.5 px-4 font-medium">חשבון</th>
                    <th className="py-2.5 px-4 font-medium">קטגוריה</th>
                    <th className="py-2.5 px-4 font-medium text-left">סכום</th>
                    <th className="py-2.5 px-4 font-medium text-center">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1F2937]/80">
                  {periodTransactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <div>{tx.date}</div>
                        {tx.billingDate && tx.billingDate !== tx.date && (
                          <div className="text-[10px] text-slate-400 font-mono">חיוב: {tx.billingDate}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 max-w-xs">
                        <div className="font-semibold text-slate-900 dark:text-white">{tx.merchant}</div>
                        <div className="text-[11px] text-slate-500 truncate">{tx.description}</div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {tx.accountName}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px]">
                          {tx.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-left font-mono font-bold whitespace-nowrap text-xs">
                        <span className={tx.type === 'income' ? 'text-[#059669]' : tx.type === 'refund' ? 'text-[#059669]' : 'text-[#BE123C]'}>
                          {tx.type === 'income' ? '+' : tx.type === 'refund' ? 'זיכוי +' : '-'}₪{Math.abs(tx.amount).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => onOpenReviewModal(tx)}
                          className="px-2 py-1 rounded text-[11px] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-[#1F2937] transition-colors cursor-pointer"
                        >
                          ערוך / אמת
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
