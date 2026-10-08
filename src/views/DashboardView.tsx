import React from 'react';
import {
  Account,
  Transaction,
  BudgetCategory,
  FinancialGoal,
  InvestmentAsset,
  RecurringCommitment,
  AnomalyAlert,
} from '../types/financial';
import {
  calculateNetWorth,
  calculateMonthlyCashFlow,
  getCashFlowHistory,
  calculateCashFlowForPeriod,
  calculatePersonalHistoricalAverages,
  CURRENT_APP_MONTH,
  CategorySummary,
  MonthDataPoint,
} from '../services/financialCalculations';
import { CashFlowChart } from '../components/charts/CashFlowChart';
import { ExpenseCategoryDonut } from '../components/charts/ExpenseCategoryDonut';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  BadgePercent,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  ChevronLeft,
  Calendar,
  FileSearch,
  CheckCircle2,
  Sparkles,
  ArrowRightLeft,
} from 'lucide-react';

interface DashboardViewProps {
  accounts: Account[];
  transactions: Transaction[];
  budgets: BudgetCategory[];
  goals: FinancialGoal[];
  investments: InvestmentAsset[];
  recurring: RecurringCommitment[];
  anomalies: AnomalyAlert[];
  onNavigateToSection: (section: any) => void;
  onOpenTraceModal: (title: string, amount: number, transactions: Transaction[]) => void;
  onOpenReviewTransaction: (tx: Transaction) => void;
  financialProfileCompletion?: number;
  onLoadDemoData?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  accounts,
  transactions,
  budgets,
  goals,
  investments,
  recurring,
  anomalies,
  onNavigateToSection,
  onOpenTraceModal,
  onOpenReviewTransaction,
  financialProfileCompletion = 15,
  onLoadDemoData,
}) => {
  const isCompletelyEmpty = accounts.length === 0 && transactions.length === 0;

  if (isCompletelyEmpty) {
    return (
      <div className="space-y-6 pb-12 animate-in fade-in duration-200">
        {/* Profile Completion Indicator */}
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold font-mono text-sm">
              {financialProfileCompletion}%
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">השלמת תמונת מצב פיננסית</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                חשבונך פעיל ומאובטח. הוספת חשבון או ייבוא תדפיס תבנה את התמונה המלאה.
              </p>
            </div>
          </div>
          <div className="w-full sm:w-48 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-600 dark:bg-emerald-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${financialProfileCompletion}%` }}
            />
          </div>
        </div>

        {/* Empty State Hero Card */}
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-xs space-y-6 transition-colors">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-emerald-700 dark:text-emerald-400 mx-auto">
            <Wallet className="w-7 h-7" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              עדיין אין לנו מספיק מידע כדי להציג את התמונה הפיננסית שלך
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              המערכת מבוססת על נתונים אמיתיים בלבד. בחר את הצעד הראשון כדי להתחיל לעשות סדר:
            </p>
          </div>

          {/* Action Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-right">
            <button
              onClick={() => onNavigateToSection('datacenter')}
              className="p-4 rounded-xl bg-slate-50 hover:bg-slate-100/80 dark:bg-[#0B0F17] dark:hover:bg-slate-800/80 border border-slate-200 dark:border-[#1F2937] transition-colors flex items-start gap-3 cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center flex-shrink-0">
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-300 block">
                  ייבא תדפיס בנק / אשראי
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                  קליטה וסיווג אוטומטי של קובץ Excel, CSV או PDF
                </span>
              </div>
            </button>

            <button
              onClick={() => onNavigateToSection('transactions')}
              className="p-4 rounded-xl bg-slate-50 hover:bg-slate-100/80 dark:bg-[#0B0F17] dark:hover:bg-slate-800/80 border border-slate-200 dark:border-[#1F2937] transition-colors flex items-start gap-3 cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 flex items-center justify-center flex-shrink-0">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300 block">
                  הוסף חשבון ראשון
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                  הזנה ידנית מהירה של יתרה, עו״ש או כרטיס
                </span>
              </div>
            </button>

            <button
              onClick={() => onNavigateToSection('budget')}
              className="p-4 rounded-xl bg-slate-50 hover:bg-slate-100/80 dark:bg-[#0B0F17] dark:hover:bg-slate-800/80 border border-slate-200 dark:border-[#1F2937] transition-colors flex items-start gap-3 cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 flex items-center justify-center flex-shrink-0">
                <BadgePercent className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300 block">
                  הגדר תקרת תקציב
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                  מגבלות הוצאה חודשיות לפי קטגוריות
                </span>
              </div>
            </button>

            <button
              onClick={() => onNavigateToSection('goals')}
              className="p-4 rounded-xl bg-slate-50 hover:bg-slate-100/80 dark:bg-[#0B0F17] dark:hover:bg-slate-800/80 border border-slate-200 dark:border-[#1F2937] transition-colors flex items-start gap-3 cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center flex-shrink-0">
                <PiggyBank className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-300 block">
                  הגדר יעד פיננסי
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                  קרן חירום, חופשה, דירה או יעד חיסכון
                </span>
              </div>
            </button>
          </div>

          {onLoadDemoData && (
            <div className="pt-4 border-t border-slate-200 dark:border-[#1F2937] text-center">
              <button
                type="button"
                onClick={onLoadDemoData}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 underline transition-colors cursor-pointer"
              >
                רוצה קודם לראות איך המערכת עובדת? לחץ כאן לטעינת נתוני דוגמה
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Real calculations
  const netWorth = calculateNetWorth(accounts);
  const latestPeriod = calculateCashFlowForPeriod(transactions);
  const cashFlowHistory = getCashFlowHistory(transactions, 8);

  // Distinct available months strictly bounded
  const validNonTransfer = transactions.filter(
    (t) => !t.isInternalTransfer && t.type !== 'transfer' && t.date
  );
  const distinctMonths = Array.from(
    new Set(validNonTransfer.map((t) => t.date.substring(0, 7)).filter((k) => k <= CURRENT_APP_MONTH))
  ).sort((a, b) => b.localeCompare(a));

  const currentPeriodKey = latestPeriod.monthKey;
  const prevMonthKey = distinctMonths.find((m) => m < currentPeriodKey);
  const prevPeriod = prevMonthKey ? calculateCashFlowForPeriod(transactions, prevMonthKey) : null;
  const personalAverages = calculatePersonalHistoricalAverages(transactions, currentPeriodKey);

  // Diffs vs previous month
  const expenseDiffVsPrev = prevPeriod ? latestPeriod.expenses - prevPeriod.expenses : null;
  const expensePctVsPrev =
    prevPeriod && prevPeriod.expenses > 0
      ? Math.round(((latestPeriod.expenses - prevPeriod.expenses) / prevPeriod.expenses) * 100)
      : null;

  const incomeDiffVsPrev = prevPeriod ? latestPeriod.income - prevPeriod.income : null;
  const incomePctVsPrev =
    prevPeriod && prevPeriod.income > 0
      ? Math.round(((latestPeriod.income - prevPeriod.income) / prevPeriod.income) * 100)
      : null;

  const savingsDiffVsPrev = prevPeriod ? latestPeriod.netCashFlow - prevPeriod.netCashFlow : null;

  // Diffs vs personal historical average
  const expenseDiffVsAvg = personalAverages.hasSufficientHistory
    ? latestPeriod.expenses - personalAverages.averageMonthlyExpenses
    : null;
  const expensePctVsAvg =
    personalAverages.hasSufficientHistory && personalAverages.averageMonthlyExpenses > 0
      ? Math.round(
          ((latestPeriod.expenses - personalAverages.averageMonthlyExpenses) /
            personalAverages.averageMonthlyExpenses) *
            100
        )
      : null;

  // Budget overall calculation
  const totalBudgeted = budgets.reduce((sum, b) => sum + b.allocated, 0);
  const totalBudgetSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
  const budgetPercentUsed = totalBudgeted > 0 ? Math.round((totalBudgetSpent / totalBudgeted) * 100) : 0;

  // Investment totals
  const totalInvestedPrincipal = investments.reduce((sum, i) => sum + i.investedAmount, 0);
  const totalUnrealizedGain = investments.reduce((sum, i) => sum + i.unrealizedGain, 0);
  const overallPortfolioReturn =
    totalInvestedPrincipal > 0 ? ((totalUnrealizedGain / totalInvestedPrincipal) * 100).toFixed(1) : '0';

  // Find any transactions that need review
  const pendingReviews = transactions.filter((t) => t.needsReview);

  // Real dynamic "What Changed" / Anomaly highlights
  interface DynamicInsight {
    id: string;
    type: 'increase' | 'decrease' | 'refund' | 'review' | 'savings' | 'neutral';
    title: string;
    description: string;
    badge?: string;
    badgeColor?: 'rose' | 'emerald' | 'amber' | 'blue' | 'slate';
    transactionsToTrace?: Transaction[];
    amountToTrace?: number;
    traceTitle?: string;
    actionText?: string;
    onAction?: () => void;
  }

  const dynamicInsights: DynamicInsight[] = [];

  // 1. Pending reviews alert
  if (pendingReviews.length > 0) {
    dynamicInsights.push({
      id: 'pending-reviews',
      type: 'review',
      title: `זוהו ${pendingReviews.length} עסקאות ללא ודאות סיווג מלאה`,
      description: `עקרון המערכת: כשאין ודאות מלאה – שואלים אותך במקום לנחש. עסקאות אלו דורשות אימות ידני קצר.`,
      badge: 'דורש אימות',
      badgeColor: 'amber',
      actionText: 'אמת עסקאות',
      onAction: () => onOpenReviewTransaction(pendingReviews[0]),
    });
  }

  // 2. Refunds that reduced expenses
  if (latestPeriod.refunds > 0) {
    const refundTxs = latestPeriod.transactions.filter((t) => t.type === 'refund');
    dynamicInsights.push({
      id: 'refunds-detected',
      type: 'refund',
      title: `נקלטו ₪${latestPeriod.refunds.toLocaleString()} כזיכויים והחזרים שהקטינו הוצאות`,
      description: `החזרים מבתי עסק הופחתו אוטומטית מסך ההוצאות החודשיות (במקום להיספר כהכנסה כוזבת).`,
      badge: 'זיכוי מקטין הוצאה',
      badgeColor: 'emerald',
      transactionsToTrace: refundTxs,
      amountToTrace: latestPeriod.refunds,
      traceTitle: `החזרים וזיכויים בחודש ${latestPeriod.monthLabel}`,
    });
  }

  // 3. Significant category shifts vs previous month or personal average
  for (const cat of latestPeriod.categoryBreakdown) {
    const prevCatAmount = prevPeriod
      ? prevPeriod.categoryBreakdown.find((c) => c.category === cat.category)?.amount || 0
      : personalAverages.averageCategorySpending[cat.category] || 0;

    if (prevCatAmount > 0) {
      const diff = cat.amount - prevCatAmount;
      const pct = Math.round((diff / prevCatAmount) * 100);

      if (pct >= 20 && Math.abs(diff) >= 200) {
        dynamicInsights.push({
          id: `cat-increase-${cat.category}`,
          type: 'increase',
          title: `עלייה של ${pct}% בהוצאות ${cat.category}`,
          description: `ההוצאות עמדו על ₪${cat.amount.toLocaleString()} לעומת ₪${prevCatAmount.toLocaleString()} ${
            prevPeriod ? 'בחודש הקודם' : 'בממוצע האישי'
          }.`,
          badge: `+₪${diff.toLocaleString()}`,
          badgeColor: 'rose',
          transactionsToTrace: cat.transactions,
          amountToTrace: cat.amount,
          traceTitle: `הוצאות ${cat.category} בחודש ${latestPeriod.monthLabel}`,
        });
      } else if (pct <= -20 && Math.abs(diff) >= 200) {
        dynamicInsights.push({
          id: `cat-decrease-${cat.category}`,
          type: 'decrease',
          title: `ירידה וחיסכון של ${Math.abs(pct)}% בהוצאות ${cat.category}`,
          description: `ההוצאות הצטמצמו ל-₪${cat.amount.toLocaleString()} לעומת ₪${prevCatAmount.toLocaleString()} ${
            prevPeriod ? 'בחודש הקודם' : 'בממוצע האישי'
          }.`,
          badge: `-₪${Math.abs(diff).toLocaleString()}`,
          badgeColor: 'emerald',
          transactionsToTrace: cat.transactions,
          amountToTrace: cat.amount,
          traceTitle: `הוצאות ${cat.category} בחודש ${latestPeriod.monthLabel}`,
        });
      }
    }
  }

  // 4. Savings rate shift
  if (latestPeriod.income > 0 && prevPeriod && prevPeriod.income > 0) {
    const rateDiff = latestPeriod.savingsRate - prevPeriod.savingsRate;
    if (Math.abs(rateDiff) >= 4) {
      dynamicInsights.push({
        id: 'savings-rate-shift',
        type: rateDiff > 0 ? 'savings' : 'neutral',
        title: rateDiff > 0 ? `שיפור בשיעור החיסכון: ${latestPeriod.savingsRate}%` : `שיעור החיסכון עומד על ${latestPeriod.savingsRate}%`,
        description: `שיעור החיסכון ${rateDiff > 0 ? 'עלה' : 'השתנה'} ב-${Math.abs(rateDiff)}% ביחס לחודש ${
          prevPeriod.monthLabel
        } (${prevPeriod.savingsRate}%).`,
        badge: `${rateDiff > 0 ? '+' : ''}${rateDiff}%`,
        badgeColor: rateDiff > 0 ? 'emerald' : 'slate',
        transactionsToTrace: latestPeriod.transactions,
        amountToTrace: latestPeriod.netCashFlow,
        traceTitle: `תזרים וחיסכון בחודש ${latestPeriod.monthLabel}`,
      });
    }
  }

  // 5. Fallback reassurance if no anomalies
  if (dynamicInsights.length === 0) {
    dynamicInsights.push({
      id: 'stable-cashflow',
      type: 'neutral',
      title: `תזרים יציב ומאוזן בחודש ${latestPeriod.monthLabel}`,
      description: personalAverages.hasSufficientHistory
        ? `סך ההוצאות החודש (₪${latestPeriod.expenses.toLocaleString()}) תואם את הממוצע האישי שלך (₪${personalAverages.averageMonthlyExpenses.toLocaleString()}).`
        : `הנתונים מחושבים ישירות ובאופן שקוף מקובצי המקור שייבאת.`,
      badge: '100% נתוני אמת',
      badgeColor: 'slate',
    });
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Banner if items need review */}
      {pendingReviews.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs transition-colors">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100/80 dark:bg-amber-900/30 border border-amber-200/80 dark:border-amber-800/40 flex items-center justify-center flex-shrink-0 text-amber-900 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                זוהו {pendingReviews.length} עסקאות ללא ודאות סיווג (למשל: {pendingReviews[0].merchant})
              </h4>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/70 mt-0.5">
                עקרון המערכת: כשאין ודאות מלאה – שואלים אותך במקום לנחש.
              </p>
            </div>
          </div>
          <button
            onClick={() => onOpenReviewTransaction(pendingReviews[0])}
            className="px-3.5 py-1.5 rounded-lg bg-amber-800 hover:bg-amber-900 dark:bg-amber-900/80 dark:hover:bg-amber-800 text-white font-semibold text-xs border border-amber-900 dark:border-amber-700/60 transition-colors flex items-center justify-center gap-1.5 self-start sm:self-auto cursor-pointer shadow-xs"
          >
            <span>אמת עכשיו</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. FINANCIAL SNAPSHOT FOR CURRENT / ACTIVE PERIOD */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#0F172A] dark:text-white flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span>תמונת מצב חודשית: {latestPeriod.monthLabel}</span>
            </h2>
            <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
              {latestPeriod.transactionCount} עסקאות
            </span>
          </div>
          <button
            onClick={() =>
              onOpenTraceModal(
                `תזרים חודש ${latestPeriod.monthLabel}`,
                latestPeriod.expenses,
                latestPeriod.transactions
              )
            }
            className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 font-medium cursor-pointer"
          >
            <FileSearch className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            <span>שקיפות חישוב החודש</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Income Card */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-5 shadow-xs transition-colors">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>הכנסות החודש</span>
              {incomePctVsPrev !== null && (
                <span
                  className={`font-mono font-medium px-1.5 py-0.2 rounded text-[11px] border ${
                    incomePctVsPrev >= 0
                      ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/40'
                      : 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/40'
                  }`}
                >
                  {incomePctVsPrev >= 0 ? '+' : ''}
                  {incomePctVsPrev}% מחודש קודם
                </span>
              )}
            </div>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 font-mono mt-1">
              ₪{latestPeriod.income.toLocaleString()}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-[#1F2937] text-[11px] text-slate-500 dark:text-slate-400">
              {latestPeriod.incomeBreakdown.length > 0 ? (
                <span>מקור מוביל: {latestPeriod.incomeBreakdown[0].source}</span>
              ) : (
                <span>משכורת והפקדות תקבולים</span>
              )}
            </div>
          </div>

          {/* Net Expenses Card */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-5 shadow-xs transition-colors">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>הוצאות החודש (נטו)</span>
              {expensePctVsPrev !== null && (
                <span
                  className={`font-mono font-medium px-1.5 py-0.2 rounded text-[11px] border ${
                    expensePctVsPrev <= 0
                      ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/40'
                      : 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-100 dark:border-rose-900/40'
                  }`}
                >
                  {expensePctVsPrev > 0 ? '+' : ''}
                  {expensePctVsPrev}% מחודש קודם
                </span>
              )}
            </div>
            <div className="text-2xl font-bold text-rose-700 dark:text-rose-400 font-mono mt-1">
              ₪{latestPeriod.expenses.toLocaleString()}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-[#1F2937] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>ברוטו: ₪{latestPeriod.grossExpenses.toLocaleString()}</span>
              {latestPeriod.refunds > 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  זיכויים: -₪{latestPeriod.refunds.toLocaleString()}
                </span>
              ) : (
                <span>ללא זיכויים</span>
              )}
            </div>
          </div>

          {/* Net Cash Flow / Savings Card */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-5 shadow-xs transition-colors">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>תזרים פנוי (חיסכון)</span>
              <ArrowRightLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </div>
            <div
              className={`text-2xl font-bold font-mono mt-1 ${
                latestPeriod.netCashFlow >= 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-rose-700 dark:text-rose-400'
              }`}
            >
              {latestPeriod.netCashFlow >= 0 ? '+' : ''}₪{latestPeriod.netCashFlow.toLocaleString()}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-[#1F2937] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>שיעור חיסכון: {latestPeriod.savingsRate}%</span>
              {savingsDiffVsPrev !== null && (
                <span className={savingsDiffVsPrev >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                  {savingsDiffVsPrev >= 0 ? '+' : ''}₪{savingsDiffVsPrev.toLocaleString()} מחודש קודם
                </span>
              )}
            </div>
          </div>

          {/* Personal Average Comparison / Net Worth Card */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-5 shadow-xs transition-colors">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>ממוצע אישי חודשי</span>
              <BadgePercent className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-[#0F172A] dark:text-white font-mono mt-1">
              {personalAverages.hasSufficientHistory
                ? `₪${personalAverages.averageMonthlyExpenses.toLocaleString()}`
                : `₪${latestPeriod.expenses.toLocaleString()}`}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-[#1F2937] text-[11px] text-slate-500 dark:text-slate-400">
              {personalAverages.hasSufficientHistory ? (
                <span>
                  הפרש החודש מהממוצע:{' '}
                  <strong
                    className={
                      expenseDiffVsAvg !== null && expenseDiffVsAvg > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }
                  >
                    {expenseDiffVsAvg !== null && expenseDiffVsAvg > 0 ? '+' : ''}
                    ₪{expenseDiffVsAvg?.toLocaleString()}
                  </strong>
                </span>
              ) : (
                <span>נצבר היסטוריה של {personalAverages.completedMonthsCount} חודשים</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. CASH FLOW TREND & EXPENSE BREAKDOWN CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <CashFlowChart
            data={cashFlowHistory}
            personalAverageExpense={
              personalAverages.hasSufficientHistory ? personalAverages.averageMonthlyExpenses : undefined
            }
            budgetTargetExpense={totalBudgeted > 0 ? totalBudgeted : undefined}
            onMonthClick={(m: MonthDataPoint) => {
              onOpenTraceModal(
                `תזרים חודש ${m.monthLabel}`,
                m.expense,
                transactions.filter((t) => !t.isInternalTransfer && t.date && t.date.startsWith(m.monthKey))
              );
            }}
          />
        </div>
        <div className="lg:col-span-5">
          <ExpenseCategoryDonut
            categories={latestPeriod.categoryBreakdown}
            onSelectCategory={(cat: CategorySummary) => {
              onOpenTraceModal(
                `הוצאות בקטגוריית ${cat.category} (${latestPeriod.monthLabel})`,
                cat.amount,
                cat.transactions
              );
            }}
          />
        </div>
      </div>

      {/* 3. DYNAMIC "WHAT CHANGED" & ANOMALY HIGHLIGHTS */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1F2937] p-5 shadow-xs transition-colors space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">
              מה השתנה החודש? (תובנות ושינויים מבוססי נתונים)
            </h3>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
            השוואה מול חודש קודם וממוצע אישי
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {dynamicInsights.map((insight) => (
            <div
              key={insight.id}
              onClick={() => {
                if (insight.onAction) {
                  insight.onAction();
                } else if (insight.transactionsToTrace) {
                  onOpenTraceModal(
                    insight.traceTitle || insight.title,
                    insight.amountToTrace || 0,
                    insight.transactionsToTrace
                  );
                }
              }}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                insight.badgeColor === 'rose'
                  ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 hover:border-rose-300'
                  : insight.badgeColor === 'emerald'
                  ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 hover:border-emerald-300'
                  : insight.badgeColor === 'amber'
                  ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 hover:border-amber-300'
                  : 'bg-slate-50 dark:bg-[#0B0F17] border-slate-200 dark:border-[#1F2937] hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-xs font-bold text-[#0F172A] dark:text-white leading-tight">
                  {insight.title}
                </h4>
                {insight.badge && (
                  <span
                    className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                      insight.badgeColor === 'rose'
                        ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300'
                        : insight.badgeColor === 'emerald'
                        ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300'
                        : insight.badgeColor === 'amber'
                        ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {insight.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {insight.description}
              </p>
              <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                <span>{insight.actionText || 'צפה בפירוט העסקאות'}</span>
                <ChevronLeft className="w-3 h-3" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. BUDGET STATUS & ACTIVE GOALS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Budget Status */}
        <div className="lg:col-span-6 bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1F2937] p-5 shadow-xs transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">סטטוס תקציב חודשי</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                נוצלו ₪{totalBudgetSpent.toLocaleString()} מתוך ₪{totalBudgeted.toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => onNavigateToSection('budget')}
              className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 font-medium cursor-pointer"
            >
              <span>ניהול תקציב</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Main Progress Bar */}
          <div className="space-y-1.5 mb-4">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-300">ניצול כולל החודש</span>
              <span
                className={`font-mono font-bold ${
                  budgetPercentUsed > 90 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {budgetPercentUsed}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  budgetPercentUsed > 90 ? 'bg-amber-600 dark:bg-amber-500' : 'bg-emerald-600 dark:bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, budgetPercentUsed)}%` }}
              />
            </div>
          </div>

          {/* Top Categories */}
          <div className="space-y-2.5">
            {budgets.slice(0, 4).map((b) => {
              const pct = Math.round((b.spent / b.allocated) * 100);
              const isOver = pct > 95;
              return (
                <div key={b.id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{b.category}</span>
                    <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      ₪{b.spent.toLocaleString()} / ₪{b.allocated.toLocaleString()} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        isOver ? 'bg-rose-700 dark:bg-rose-600' : 'bg-slate-400 dark:bg-slate-500'
                      }`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Goals Progress */}
        <div className="lg:col-span-6 bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1F2937] p-5 shadow-xs transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">התקדמות במטרות וחסכונות</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">מעקב חי דינמי בהתאם לחסכונות בפועל</p>
            </div>
            <button
              onClick={() => onNavigateToSection('goals')}
              className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 font-medium cursor-pointer"
            >
              <span>כל המטרות</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {goals.slice(0, 3).map((goal) => {
              const progress = Math.round((goal.currentAmount / goal.targetAmount) * 100);
              return (
                <div
                  key={goal.id}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] space-y-1.5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-bold text-[#0F172A] dark:text-white">{goal.name}</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        הפקדה חודשית: ₪{goal.monthlyContribution.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-left font-mono">
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{progress}%</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                        ₪{goal.currentAmount.toLocaleString()} / ₪{goal.targetAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-700 dark:bg-emerald-600 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, progress)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

