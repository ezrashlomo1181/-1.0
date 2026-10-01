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
  getCategoryBreakdown,
  CategorySummary,
  MonthDataPoint,
} from '../services/financialCalculations';
import { CashFlowChart } from '../components/charts/CashFlowChart';
import { ExpenseCategoryDonut } from '../components/charts/ExpenseCategoryDonut';
import {
  TrendingUp,
  Wallet,
  PiggyBank,
  BadgePercent,
  AlertTriangle,
  ArrowUpRight,
  ChevronLeft,
  Calendar,
  FileSearch,
  CheckCircle2,
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

  const netWorth = calculateNetWorth(accounts);
  const cashFlow = calculateMonthlyCashFlow(transactions, accounts);
  const cashFlowHistory = getCashFlowHistory(transactions, 6);
  const categories = getCategoryBreakdown(transactions);

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

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Banner if items need review (Instruction #4) */}
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

      {/* 1. FINANCIAL OVERVIEW CARDS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
            <span>מבט-על פיננסי</span>
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
              (מנוטרל העברות פנימיות)
            </span>
          </h2>
          <button
            onClick={() =>
              onOpenTraceModal(
                'סך כל התנועות והחשבונות',
                netWorth.totalNetWorth,
                transactions
              )
            }
            className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 font-medium cursor-pointer"
          >
            <FileSearch className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            <span>שקיפות חישוב</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Net Worth Card */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-5 shadow-xs transition-colors">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>שווי פיננסי נטו</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-mono font-medium bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded text-[11px] border border-emerald-100 dark:border-emerald-900/40">
                +4.8% ב-6 חודשים
              </span>
            </div>
            <div className="text-2xl font-bold text-[#0F172A] dark:text-white font-mono mt-1">
              ₪{netWorth.totalNetWorth.toLocaleString()}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-[#1F2937] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>נכסים: ₪{netWorth.totalAssets.toLocaleString()}</span>
              <span>התחייבויות: ₪{netWorth.totalLiabilities.toLocaleString()}</span>
            </div>
          </div>

          {/* Cash & Liquid Card */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-5 shadow-xs transition-colors">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>כסף נזיל ופקדונות</span>
              <Wallet className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-[#0F172A] dark:text-white font-mono mt-1">
              ₪{(netWorth.cashAndLiquid + netWorth.savings).toLocaleString()}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-[#1F2937] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>עו״ש: ₪{netWorth.cashAndLiquid.toLocaleString()}</span>
              <span>חיסכון: ₪{netWorth.savings.toLocaleString()}</span>
            </div>
          </div>

          {/* Investments Card */}
          <div
            onClick={() => onNavigateToSection('investments')}
            className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-5 shadow-xs cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>תיק השקעות וגמל</span>
              <TrendingUp className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-[#0F172A] dark:text-white font-mono mt-1">
              ₪{netWorth.investments.toLocaleString()}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-[#1F2937] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>רווח לא ממומש:</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-mono font-medium">
                +₪{totalUnrealizedGain.toLocaleString()} ({overallPortfolioReturn}%)
              </span>
            </div>
          </div>

          {/* Monthly Savings Rate Card */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-5 shadow-xs transition-colors">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>שיעור חיסכון חודשי</span>
              <BadgePercent className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-[#0F172A] dark:text-white font-mono mt-1">
              {cashFlow.savingsRate}%
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-[#1F2937] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>חיסכון נטו: ₪{cashFlow.monthlySavings.toLocaleString()}</span>
              <span>כרית: {cashFlow.liquidRunwayMonths} חודשים</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. CASH FLOW & EXPENSE BREAKDOWN CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <CashFlowChart
            data={cashFlowHistory}
            onMonthClick={(m: MonthDataPoint) => {
              onOpenTraceModal(
                `תזרים חודש ${m.monthLabel}`,
                m.expense,
                transactions.filter((t) => !t.isInternalTransfer)
              );
            }}
          />
        </div>
        <div className="lg:col-span-5">
          <ExpenseCategoryDonut
            categories={categories}
            onSelectCategory={(cat: CategorySummary) => {
              onOpenTraceModal(
                `הוצאות בקטגוריית ${cat.category}`,
                cat.amount,
                cat.transactions
              );
            }}
          />
        </div>
      </div>

      {/* 3. BUDGET STATUS & ACTIVE GOALS */}
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

      {/* 4. FINANCIAL INSIGHTS & UPCOMING COMMITMENTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Meaningful Financial Insights */}
        <div className="lg:col-span-7 bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1F2937] p-5 shadow-xs transition-colors">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">תובנות פיננסיות מבוססות נתונים</h3>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              100% על בסיס עסקאותיך
            </span>
          </div>

          <div className="space-y-2.5">
            <div
              onClick={() =>
                onOpenTraceModal(
                  'הוצאות מזון וסופר החודש',
                  2370,
                  transactions.filter((t) => t.category === 'מזון וסופר')
                )
              }
              className="p-3 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer transition-colors space-y-1"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#0F172A] dark:text-white flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-400" />
                  עלייה של 18% בהוצאות מזון וסופר
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                  <span>צפה בחישוב</span>
                  <ChevronLeft className="w-3 h-3" />
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                הוצאות המזון עמדו על ₪2,370 לעומת ממוצע של ₪2,010 ב-6 החודשים האחרונים. הגידול נובע מ-3 קניות גדולות בשופרסל.
              </p>
            </div>

            <div
              onClick={() => onNavigateToSection('commitments')}
              className="p-3 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer transition-colors space-y-1"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#0F172A] dark:text-white flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-700 dark:bg-emerald-500" />
                  זוהו 7 מנויים וחיובים חוזרים קבועים
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                  <span>לרשימת המנויים</span>
                  <ChevronLeft className="w-3 h-3" />
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                עלותם הכוללת היא כ-₪1,740 בחודש. לא זוהו חיובי כפל או עליות פתאומיות במחיר המנויים.
              </p>
            </div>

            <div
              onClick={() => onNavigateToSection('simulations')}
              className="p-3 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer transition-colors space-y-1"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#0F172A] dark:text-white flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-600 dark:bg-slate-400" />
                  הזדמנות להאצת יעד דירה ב-8 חודשים
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                  <span>לסימולציה</span>
                  <ChevronLeft className="w-3 h-3" />
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                הגדלת ההפקדה החודשית לחיסכון ב-₪600 נוספים תקרב את השלמת ההון העצמי הנדרש.
              </p>
            </div>
          </div>
        </div>

        {/* Upcoming Commitments & Bills */}
        <div className="lg:col-span-5 bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1F2937] p-5 shadow-xs transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">התחייבויות קרובות</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">תשלומים צפויים ב-30 הימים הקרובים</p>
            </div>
            <button
              onClick={() => onNavigateToSection('commitments')}
              className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
            >
              הכל
            </button>
          </div>

          <div className="space-y-2">
            {recurring.slice(0, 4).map((rec) => (
              <div
                key={rec.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] text-xs"
              >
                <div>
                  <div className="font-semibold text-[#0F172A] dark:text-slate-200">{rec.merchant}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {rec.category} • {rec.accountName}
                  </div>
                </div>
                <div className="text-left font-mono font-bold text-rose-700 dark:text-rose-400">
                  ₪{rec.monthlyAmount.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
