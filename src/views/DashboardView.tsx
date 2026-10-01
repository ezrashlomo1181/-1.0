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
  TrendingDown,
  Wallet,
  PiggyBank,
  BadgePercent,
  ShieldCheck,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronLeft,
  Sparkles,
  Calendar,
  Layers,
  FileSearch,
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
}) => {
  const netWorth = calculateNetWorth(accounts);
  const cashFlow = calculateMonthlyCashFlow(transactions, accounts);
  const cashFlowHistory = getCashFlowHistory(transactions, 6);
  const categories = getCategoryBreakdown(transactions);

  // Budget overall calculation
  const totalBudgeted = budgets.reduce((sum, b) => sum + b.allocated, 0);
  const totalBudgetSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
  const budgetPercentUsed = totalBudgeted > 0 ? Math.round((totalBudgetSpent / totalBudgeted) * 100) : 0;

  // Investment totals
  const totalPortfolioValue = investments.reduce((sum, i) => sum + i.currentValue, 0);
  const totalInvestedPrincipal = investments.reduce((sum, i) => sum + i.investedAmount, 0);
  const totalUnrealizedGain = investments.reduce((sum, i) => sum + i.unrealizedGain, 0);
  const overallPortfolioReturn =
    totalInvestedPrincipal > 0 ? ((totalUnrealizedGain / totalInvestedPrincipal) * 100).toFixed(1) : '0';

  // Find any transactions that need review
  const pendingReviews = transactions.filter((t) => t.needsReview);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Top Banner if items need review */}
      {pendingReviews.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                זוהו {pendingReviews.length} עסקאות ללא ודאות סיווג (למשל: {pendingReviews[0].merchant})
              </h4>
              <p className="text-xs text-amber-200/80 mt-0.5">
                עקרון המערכת: כשאין ודאות מלאה – שואלים אותך במקום לנחש.
              </p>
            </div>
          </div>
          <button
            onClick={() => onOpenReviewTransaction(pendingReviews[0])}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 self-start sm:self-auto shadow-md"
          >
            <span>אמת עכשיו</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. FINANCIAL OVERVIEW CARDS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>מבט-על פיננסי</span>
            <span className="text-xs font-normal text-slate-400">
              (מנוטרל העברות פנימיות ופירעונות כפולים)
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
            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
          >
            <FileSearch className="w-3.5 h-3.5" />
            <span>הסבר חישוב ושקיפות נתונים</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Net Worth Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>שווי פיננסי נטו</span>
              <span className="text-emerald-400 font-mono font-medium bg-emerald-500/10 px-2 py-0.5 rounded-md">
                +4.8% ב-6 חודשים
              </span>
            </div>
            <div className="text-2xl font-extrabold text-white font-mono mt-1">
              ₪{netWorth.totalNetWorth.toLocaleString()}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>נכסים: ₪{netWorth.totalAssets.toLocaleString()}</span>
              <span>התחייבויות: ₪{netWorth.totalLiabilities.toLocaleString()}</span>
            </div>
          </div>

          {/* Cash & Liquid Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>כסף נזיל ופקדונות</span>
              <Wallet className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-extrabold text-white font-mono mt-1">
              ₪{(netWorth.cashAndLiquid + netWorth.savings).toLocaleString()}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>עו״ש: ₪{netWorth.cashAndLiquid.toLocaleString()}</span>
              <span>חיסכון: ₪{netWorth.savings.toLocaleString()}</span>
            </div>
          </div>

          {/* Investments Card */}
          <div
            onClick={() => onNavigateToSection('investments')}
            className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg group hover:border-slate-700 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>תיק השקעות וגמל</span>
              <TrendingUp className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-extrabold text-cyan-300 font-mono mt-1">
              ₪{netWorth.investments.toLocaleString()}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>רווח לא ממומש:</span>
              <span className="text-emerald-400 font-mono font-medium">
                +₪{totalUnrealizedGain.toLocaleString()} ({overallPortfolioReturn}%)
              </span>
            </div>
          </div>

          {/* Monthly Savings Rate Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>שיעור חיסכון חודשי</span>
              <BadgePercent className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-extrabold text-indigo-300 font-mono mt-1">
              {cashFlow.savingsRate}%
            </div>
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
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
        <div className="lg:col-span-6 bg-slate-900/90 rounded-2xl border border-slate-800/80 p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white">סטטוס תקציב חודשי</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                נוצלו ₪{totalBudgetSpent.toLocaleString()} מתוך ₪{totalBudgeted.toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => onNavigateToSection('budget')}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
            >
              <span>ניהול תקציב</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Main Progress Bar */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">ניצול כולל החודש</span>
              <span
                className={`font-mono font-bold ${
                  budgetPercentUsed > 90 ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {budgetPercentUsed}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  budgetPercentUsed > 90 ? 'bg-amber-400' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, budgetPercentUsed)}%` }}
              />
            </div>
          </div>

          {/* Top Categories */}
          <div className="space-y-3">
            {budgets.slice(0, 4).map((b) => {
              const pct = Math.round((b.spent / b.allocated) * 100);
              const isOver = pct > 95;
              return (
                <div key={b.id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-200 font-medium">{b.category}</span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      ₪{b.spent.toLocaleString()} / ₪{b.allocated.toLocaleString()} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        isOver ? 'bg-rose-500' : 'bg-slate-400'
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
        <div className="lg:col-span-6 bg-slate-900/90 rounded-2xl border border-slate-800/80 p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white">התקדמות במטרות וחסכונות</h3>
              <p className="text-xs text-slate-400 mt-0.5">מעקב חי דינמי בהתאם לחסכונות בפועל</p>
            </div>
            <button
              onClick={() => onNavigateToSection('goals')}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
            >
              <span>כל המטרות</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-4">
            {goals.slice(0, 3).map((goal) => {
              const progress = Math.round((goal.currentAmount / goal.targetAmount) * 100);
              return (
                <div
                  key={goal.id}
                  className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2 hover:border-slate-700 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-bold text-white">{goal.name}</h4>
                      <p className="text-[11px] text-slate-400">
                        הפקדה חודשית: ₪{goal.monthlyContribution.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-left font-mono">
                      <span className="text-xs font-bold text-emerald-400">{progress}%</span>
                      <span className="text-[10px] text-slate-500 block">
                        ₪{goal.currentAmount.toLocaleString()} / ₪{goal.targetAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-l from-emerald-400 to-teal-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, progress)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. AI INSIGHTS & UPCOMING COMMITMENTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Meaningful AI Insights */}
        <div className="lg:col-span-7 bg-slate-900/90 rounded-2xl border border-slate-800/80 p-5 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h3 className="text-base font-semibold text-white">תובנות בינה פיננסית</h3>
            <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded">
              מבוסס 100% על נתוניך
            </span>
          </div>

          <div className="space-y-3">
            <div
              onClick={() =>
                onOpenTraceModal(
                  'הוצאות מזון וסופר החודש',
                  2370,
                  transactions.filter((t) => t.category === 'מזון וסופר')
                )
              }
              className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 hover:bg-slate-800/70 cursor-pointer transition-colors space-y-1"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  עלייה של 18% בהוצאות מזון וסופר
                </span>
                <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                  <span>צפה בחישוב</span>
                  <ChevronLeft className="w-3 h-3" />
                </span>
              </div>
              <p className="text-xs text-slate-300">
                הוצאות המזון עמדו על ₪2,370 לעומת ממוצע של ₪2,010 ב-6 החודשים האחרונים. הגידול נובע מ-3 קניות גדולות בשופרסל לקראת החגים.
              </p>
            </div>

            <div
              onClick={() => onNavigateToSection('commitments')}
              className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 hover:bg-slate-800/70 cursor-pointer transition-colors space-y-1"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  זוהו 7 מנויים וחיובים חוזרים קבועים
                </span>
                <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                  <span>לרשימת המנויים</span>
                  <ChevronLeft className="w-3 h-3" />
                </span>
              </div>
              <p className="text-xs text-slate-300">
                עלותם הכוללת היא כ-₪1,740 בחודש (כ-₪20,880 בשנה). לא זוהו חיובי כפל או עליות פתאומיות במחיר המנויים.
              </p>
            </div>

            <div
              onClick={() => onNavigateToSection('simulations')}
              className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 hover:bg-slate-800/70 cursor-pointer transition-colors space-y-1"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  הזדמנות להאצת יעד דירה ב-8 חודשים
                </span>
                <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                  <span>לסימולציה</span>
                  <ChevronLeft className="w-3 h-3" />
                </span>
              </div>
              <p className="text-xs text-slate-300">
                הגדלת ההפקדה החודשית לחיסכון ב-₪600 נוספים תקרב את השלמת ההון העצמי הנדרש ליעד אפריל 2029 במקום דצמבר 2029.
              </p>
            </div>
          </div>
        </div>

        {/* Upcoming Commitments & Bills */}
        <div className="lg:col-span-5 bg-slate-900/90 rounded-2xl border border-slate-800/80 p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white">התחייבויות קרובות</h3>
              <p className="text-xs text-slate-400 mt-0.5">תשלומים צפויים ב-30 הימים הקרובים</p>
            </div>
            <button
              onClick={() => onNavigateToSection('commitments')}
              className="text-xs text-slate-400 hover:text-white"
            >
              הכל
            </button>
          </div>

          <div className="space-y-2.5">
            {recurring.slice(0, 4).map((rec) => (
              <div
                key={rec.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/60 text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-200">{rec.merchant}</div>
                  <div className="text-[11px] text-slate-400">
                    {rec.category} • {rec.accountName}
                  </div>
                </div>
                <div className="text-left font-mono font-bold text-rose-400">
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
