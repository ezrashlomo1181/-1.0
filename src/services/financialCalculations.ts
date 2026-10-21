import { Account, Transaction, FinancialGoal } from '../types/financial';

export interface NetWorthSummary {
  totalNetWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  cashAndLiquid: number;
  savings: number;
  investments: number;
  debts: number;
}

export interface MonthlyCashFlowSummary {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySavings: number;
  savingsRate: number; // percentage, e.g. 28.5%
  liquidRunwayMonths: number;
}

export interface MonthDataPoint {
  monthKey: string;
  monthLabel: string;
  income: number;
  expense: number;
  savings: number;
}

export interface CategorySummary {
  category: string;
  amount: number;
  percentage: number;
  count: number;
  transactions: Transaction[];
  color: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  'דיור': '#2563eb', // solid banking navy/blue
  'מזון וסופר': '#059669', // forest emerald
  'מסעדות ומשלוחים': '#d97706', // muted amber
  'תחבורה': '#6366f1', // indigo
  'קניות': '#9333ea', // muted purple
  'בילויים ופנאי': '#0284c7', // classic sky/blue (no cyan glow)
  'בריאות': '#0f766e', // deep teal
  'ביטוחים': '#475569', // slate
  'חשבונות': '#64748b', // classic slate
  'מנויים': '#7c3aed', // muted purple
  'הלוואות והתחייבויות': '#be123c', // professional bordeaux rose
  'אחר': '#94a3b8', // light slate
  'הכנסות': '#059669', // forest emerald
};

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || '#94a3b8';
}

export function calculateNetWorth(accounts: Account[]): NetWorthSummary {
  let cashAndLiquid = 0;
  let savings = 0;
  let investments = 0;
  let debts = 0;

  for (const acc of accounts) {
    if (acc.type === 'bank') {
      cashAndLiquid += acc.balance;
    } else if (acc.type === 'savings') {
      savings += acc.balance;
    } else if (acc.type === 'investment') {
      investments += acc.balance;
    } else if (acc.type === 'credit_card' || acc.type === 'loan') {
      // Debts are liabilities
      debts += Math.abs(acc.balance);
    }
  }

  const totalAssets = cashAndLiquid + savings + investments;
  const totalLiabilities = debts;
  const totalNetWorth = totalAssets - totalLiabilities;

  return {
    totalNetWorth,
    totalAssets,
    totalLiabilities,
    cashAndLiquid,
    savings,
    investments,
    debts,
  };
}

const CURRENT_APP_DATE = '2026-10-08';
export const CURRENT_APP_MONTH = '2026-10';

export function getCurrentAppMonthKey(): string {
  return CURRENT_APP_MONTH;
}

export interface DetailedCashFlowPeriod {
  monthKey: string;
  monthLabel: string;
  income: number;
  grossExpenses: number;
  refunds: number;
  expenses: number; // grossExpenses - refunds
  netCashFlow: number; // income - expenses
  savingsRate: number;
  transfers: number;
  transactionCount: number;
  categoryBreakdown: CategorySummary[];
  incomeBreakdown: { source: string; amount: number; percentage: number }[];
  transactions: Transaction[];
  isCurrentMonth: boolean;
  isFuture: boolean;
}

export interface PersonalHistoricalAverages {
  averageMonthlyExpenses: number;
  averageMonthlyIncome: number;
  averageMonthlySavings: number;
  averageCategorySpending: Record<string, number>;
  completedMonthsCount: number;
  hasSufficientHistory: boolean;
  explanationLabel: string;
}

export interface FinancialMetricComparison {
  currentValue: number;
  previousMonthValue?: number;
  personalAverageValue?: number;
  diffVsPreviousMonth?: number;
  percentVsPreviousMonth?: number;
  diffVsPersonalAverage?: number;
  percentVsPersonalAverage?: number;
  hasPreviousMonthData: boolean;
  hasPersonalAverageData: boolean;
}

export interface WhatChangedInsight {
  id: string;
  type: 'increase' | 'decrease' | 'anomaly' | 'positive' | 'warning' | 'neutral';
  title: string;
  description: string;
  category?: string;
  amountDiff?: number;
  percentDiff?: number;
}

/**
 * CENTRAL PERIOD CASH FLOW ENGINE
 * 
 * Computes strictly bounded financial metrics for a specific month or cycle.
 * Never leaks multi-month aggregates into single-month reports.
 * Correctly offsets refunds from relevant category expenses.
 */
export function calculateCashFlowForPeriod(
  transactions: Transaction[],
  targetMonthKey?: string
): DetailedCashFlowPeriod {
  // Exclude explicitly ignored transactions, internal transfers and directionally ambiguous rows.
  // Legacy transactions without flowDirection keep their previous type-based behavior.
  const validTransactions = transactions.filter((t) =>
    !t.ignored &&
    !t.isInternalTransfer &&
    t.type !== 'transfer' &&
    t.flowDirection !== 'unknown'
  );

  // Determine which month to calculate
  let monthKey = targetMonthKey;
  if (!monthKey) {
    // Pick the most recent historical month that is <= CURRENT_APP_MONTH
    const availableMonths = Array.from(
      new Set(
        validTransactions
          .map((t) => t.date?.substring(0, 7))
          .filter((k) => k && k <= CURRENT_APP_MONTH)
      )
    ).sort((a, b) => b.localeCompare(a));

    monthKey = availableMonths[0] || CURRENT_APP_MONTH;
  }

  // Filter transactions belonging to this exact month
  const periodTxs = validTransactions.filter((t) => t.date && t.date.startsWith(monthKey!));

  let income = 0;
  let grossExpenses = 0;
  let refunds = 0;
  let transfers = 0;

  // Category tracking with refund deduction
  const categoryMap = new Map<string, { gross: number; refunds: number; items: Transaction[] }>();
  // Income sources tracking
  const incomeSourcesMap = new Map<string, number>();

  for (const tx of periodTxs) {
    const cat = tx.category || 'אחר / ללא סיווג';

    // The verified direction is authoritative. A transaction with unknown direction
    // was filtered above, rather than silently counted as either income or expense.
    const direction = tx.flowDirection;
    const amount = Math.abs(tx.amount);

    if (direction === 'inflow') {
      if (tx.type === 'refund') {
        refunds += amount;
        const curr = categoryMap.get(cat) || { gross: 0, refunds: 0, items: [] };
        curr.refunds += amount;
        curr.items.push(tx);
        categoryMap.set(cat, curr);
      } else if (tx.type === 'income') {
        income += amount;
        const src = tx.merchant || 'הכנסה';
        incomeSourcesMap.set(src, (incomeSourcesMap.get(src) || 0) + amount);
      } else if (tx.type === 'transfer' || tx.type === 'investment_withdrawal') {
        transfers += amount;
      }
      // Any other inflow is deliberately held out of totals until classified.
    } else if (direction === 'outflow') {
      if (tx.type === 'transfer' || tx.type === 'investment_withdrawal') {
        transfers += amount;
      } else {
        // Direction is the accounting source of truth: an outflow cannot be income or a refund.
        // Count it as spending even if its semantic type is contradictory, so cash leaving the
        // account is not silently lost from reports. The parser flags such contradictions for review.
        grossExpenses += amount;
        const curr = categoryMap.get(cat) || { gross: 0, refunds: 0, items: [] };
        curr.gross += amount;
        curr.items.push(tx);
        categoryMap.set(cat, curr);
      }
    } else if (!direction) {
      // Compatibility for historical transactions created before flowDirection existed.
      if (tx.type === 'income') {
        income += amount;
        const src = tx.merchant || 'הכנסה';
        incomeSourcesMap.set(src, (incomeSourcesMap.get(src) || 0) + amount);
      } else if (tx.type === 'refund') {
        refunds += amount;
        const curr = categoryMap.get(cat) || { gross: 0, refunds: 0, items: [] };
        curr.refunds += amount;
        curr.items.push(tx);
        categoryMap.set(cat, curr);
      } else if (tx.type === 'expense' || tx.type === 'fee' || tx.type === 'loan_payment' || tx.type === 'debt' || tx.type === 'investment_contribution') {
        grossExpenses += amount;
        const curr = categoryMap.get(cat) || { gross: 0, refunds: 0, items: [] };
        curr.gross += amount;
        curr.items.push(tx);
        categoryMap.set(cat, curr);
      } else if (tx.type === 'transfer' || tx.type === 'investment_withdrawal') {
        transfers += amount;
      }
    }
  }

  // Net expenses: gross expenses minus refunds
  const netExpenses = Math.max(0, grossExpenses - refunds);
  const netCashFlow = income - netExpenses;
  const savingsRate = income > 0 ? Math.round((Math.max(0, netCashFlow) / income) * 100) : 0;

  // Build category summaries with net expenses
  const categoryBreakdown: CategorySummary[] = [];
  categoryMap.forEach((val, cat) => {
    const netCatAmount = Math.max(0, val.gross - val.refunds);
    if (netCatAmount > 0 || val.items.length > 0) {
      const pct = netExpenses > 0 ? Math.round((netCatAmount / netExpenses) * 100) : 0;
      categoryBreakdown.push({
        category: cat,
        amount: Math.round(netCatAmount),
        percentage: pct,
        count: val.items.length,
        transactions: val.items,
        color: getCategoryColor(cat),
      });
    }
  });

  categoryBreakdown.sort((a, b) => b.amount - a.amount);

  // Income sources breakdown
  const incomeBreakdown = Array.from(incomeSourcesMap.entries())
    .map(([source, amount]) => ({
      source,
      amount: Math.round(amount),
      percentage: income > 0 ? Math.round((amount / income) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    monthKey: monthKey!,
    monthLabel: formatMonthKeyLabel(monthKey!),
    income: Math.round(income),
    grossExpenses: Math.round(grossExpenses),
    refunds: Math.round(refunds),
    expenses: Math.round(netExpenses),
    netCashFlow: Math.round(netCashFlow),
    savingsRate,
    transfers: Math.round(transfers),
    transactionCount: periodTxs.length,
    categoryBreakdown,
    incomeBreakdown,
    transactions: periodTxs,
    isCurrentMonth: monthKey === CURRENT_APP_MONTH,
    isFuture: monthKey! > CURRENT_APP_MONTH,
  };
}

/**
 * Standard Monthly Cash Flow Summary used across Dashboard and KPI Cards
 */
export function calculateMonthlyCashFlow(
  transactions: Transaction[],
  accounts: Account[],
  targetMonthKey?: string
): MonthlyCashFlowSummary {
  const period = calculateCashFlowForPeriod(transactions, targetMonthKey);
  const netWorth = calculateNetWorth(accounts);
  const liquidRunwayMonths = period.expenses > 0
    ? Number(((netWorth.cashAndLiquid + netWorth.savings) / period.expenses).toFixed(1))
    : 12;

  return {
    monthlyIncome: period.income,
    monthlyExpenses: period.expenses,
    monthlySavings: Math.max(0, period.netCashFlow),
    savingsRate: period.savingsRate,
    liquidRunwayMonths,
  };
}

/**
 * Calculate user's personal historical average from actual complete historical months.
 * Excludes the current incomplete month to prevent skewing comparisons.
 */
export function calculatePersonalHistoricalAverages(
  transactions: Transaction[],
  currentMonthKey: string = CURRENT_APP_MONTH
): PersonalHistoricalAverages {
  const valid = transactions.filter((t) => !t.isInternalTransfer && t.type !== 'transfer');

  // Find all distinct months strictly before the current month
  const completedMonthKeys = Array.from(
    new Set(
      valid
        .map((t) => t.date?.substring(0, 7))
        .filter((k) => k && k < currentMonthKey)
    )
  ).sort((a, b) => a.localeCompare(b));

  if (completedMonthKeys.length === 0) {
    return {
      averageMonthlyExpenses: 0,
      averageMonthlyIncome: 0,
      averageMonthlySavings: 0,
      averageCategorySpending: {},
      completedMonthsCount: 0,
      hasSufficientHistory: false,
      explanationLabel: 'אין עדיין חודשים מלאים קודמים לחישוב ממוצע אישי',
    };
  }

  let totalHistoricalExpenses = 0;
  let totalHistoricalIncome = 0;
  let totalHistoricalSavings = 0;
  const categoryTotals = new Map<string, number>();

  for (const mKey of completedMonthKeys) {
    const mData = calculateCashFlowForPeriod(transactions, mKey);
    totalHistoricalExpenses += mData.expenses;
    totalHistoricalIncome += mData.income;
    totalHistoricalSavings += Math.max(0, mData.netCashFlow);

    for (const cat of mData.categoryBreakdown) {
      categoryTotals.set(cat.category, (categoryTotals.get(cat.category) || 0) + cat.amount);
    }
  }

  const count = completedMonthKeys.length;
  const avgExpenses = Math.round(totalHistoricalExpenses / count);
  const avgIncome = Math.round(totalHistoricalIncome / count);
  const avgSavings = Math.round(totalHistoricalSavings / count);

  const avgCategorySpending: Record<string, number> = {};
  categoryTotals.forEach((val, cat) => {
    avgCategorySpending[cat] = Math.round(val / count);
  });

  return {
    averageMonthlyExpenses: avgExpenses,
    averageMonthlyIncome: avgIncome,
    averageMonthlySavings: avgSavings,
    averageCategorySpending: avgCategorySpending,
    completedMonthsCount: count,
    hasSufficientHistory: count >= 2,
    explanationLabel: `ממוצע אישי מבוסס על ${count} חודשים היסטוריים מלאים`,
  };
}

const HEBREW_MONTH_NAMES = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

export function formatMonthKeyLabel(monthKey: string): string {
  const parts = monthKey.split('-');
  if (parts.length < 2) return monthKey;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const monthName = HEBREW_MONTH_NAMES[monthIdx] || parts[1];
  return `${monthName} ${year}`;
}

/**
 * Historical Cash Flow Trend (Multi-Month Graph)
 * 
 * CRITICAL: Strictly bounded to real historical months <= CURRENT_APP_MONTH.
 * Never includes future months (like December 2026) in historical charts.
 */
export function getCashFlowHistory(
  transactions: Transaction[],
  maxMonths: number = 8
): MonthDataPoint[] {
  const valid = transactions.filter((t) => !t.isInternalTransfer && t.type !== 'transfer');
  if (valid.length === 0) return [];

  // Find all distinct historical months <= CURRENT_APP_MONTH
  const monthKeys = Array.from(
    new Set(
      valid
        .map((t) => t.date?.substring(0, 7))
        .filter((k) => k && k <= CURRENT_APP_MONTH)
    )
  ).sort((a, b) => a.localeCompare(b));

  const recentKeys = monthKeys.slice(-maxMonths);

  const points: MonthDataPoint[] = [];
  for (const key of recentKeys) {
    const period = calculateCashFlowForPeriod(transactions, key);
    points.push({
      monthKey: key,
      monthLabel: period.monthLabel,
      income: period.income,
      expense: period.expenses,
      savings: Math.max(0, period.netCashFlow),
    });
  }

  return points;
}

function txIsIncome(t: Transaction): boolean {
  return t.type === 'income';
}

// -------------------------------------------------------------
// FINANCIAL CYCLE DETECTION & PERIOD MAPPING
// -------------------------------------------------------------
import { FinancialCycleSuggestion, FinancialCycleConfig } from '../types/financial';

/**
 * Detect repeated patterns in salary / credit card settlement dates across multiple months.
 * Looks for recurring large income or high activity on days 10, 1, 15, etc.
 */
export function detectFinancialCyclePattern(transactions: Transaction[]): FinancialCycleSuggestion | null {
  const valid = transactions.filter((t) => !t.isInternalTransfer && t.type !== 'transfer');
  if (valid.length < 10) return null;

  // Track occurrences of recurring income / salary or large charges by day-of-month
  const dayIncomeCounts = new Map<number, { count: number; totalAmount: number; months: Set<string> }>();
  const dayExpenseSpikes = new Map<number, { count: number; months: Set<string> }>();

  for (const t of valid) {
    if (!t.date || t.date.length < 10) continue;
    const parts = t.date.split('-');
    const day = parseInt(parts[2], 10);
    const monthKey = `${parts[0]}-${parts[1]}`;

    if (t.type === 'income' && t.amount >= 3000) {
      // Significant income or salary
      const entry = dayIncomeCounts.get(day) || { count: 0, totalAmount: 0, months: new Set() };
      entry.count += 1;
      entry.totalAmount += t.amount;
      entry.months.add(monthKey);
      dayIncomeCounts.set(day, entry);
    } else if (t.paymentMethod === 'credit_card' || t.type === 'expense') {
      const entry = dayExpenseSpikes.get(day) || { count: 0, months: new Set() };
      entry.count += 1;
      entry.months.add(monthKey);
      dayExpenseSpikes.set(day, entry);
    }
  }

  // Count distinct months in transactions
  const allMonths = new Set(valid.map((t) => t.date.substring(0, 7)));
  if (allMonths.size < 2) {
    // Need at least 2 distinct months of real data to detect a true cycle pattern
    return null;
  }

  // Standard Israeli financial cycles: 10th (very common), 1st, 15th, 2nd
  const candidateDays = [10, 1, 15, 2, 20];
  let bestDay: number | null = null;
  let bestScore = 0;
  let bestReason = '';
  let bestMonthsCovered = 0;

  for (const day of candidateDays) {
    // Check window of day ± 1 (e.g. 9-11)
    let incomeOccurrences = 0;
    const matchedMonths = new Set<string>();

    for (let d = Math.max(1, day - 1); d <= Math.min(31, day + 1); d++) {
      const inc = dayIncomeCounts.get(d);
      if (inc) {
        incomeOccurrences += inc.count;
        inc.months.forEach((m) => matchedMonths.add(m));
      }
    }

    if (matchedMonths.size >= 2 && incomeOccurrences >= 2) {
      const score = Math.min(1.0, (matchedMonths.size / allMonths.size) * 0.9 + 0.1);
      if (score > bestScore) {
        bestScore = score;
        bestDay = day;
        bestMonthsCovered = matchedMonths.size;
        bestReason = `זוהתה כניסת משכורת/הכנסה קבועה סביב ה-${day} לחודש ב-${matchedMonths.size} חודשים שונים.`;
      }
    }
  }

  // If no income pattern found, check credit card bill spike on day 10 or 15 or 2
  if (!bestDay) {
    for (const day of [10, 15, 2]) {
      const sp = dayExpenseSpikes.get(day);
      if (sp && sp.months.size >= 2) {
        bestDay = day;
        bestScore = 0.75;
        bestMonthsCovered = sp.months.size;
        bestReason = `זוהה ריכוז חיובים חוזר סביב ה-${day} לחודש ב-${sp.months.size} חודשים.`;
        break;
      }
    }
  }

  if (bestDay && bestScore >= 0.7 && bestDay !== 1) {
    return {
      suggestedStartDay: bestDay,
      confidenceScore: bestScore,
      reasoning: bestReason,
      occurrencesCount: bestMonthsCovered,
      monthsAnalyzed: allMonths.size,
    };
  }

  return null;
}

/**
 * Calculates which Financial Cycle period a transaction date belongs to.
 * E.g., if startDay = 10:
 * 2026-09-08 belongs to cycle "2026-08-10_to_2026-09-09" (August-September cycle)
 * 2026-09-12 belongs to cycle "2026-09-10_to_2026-10-09" (September-October cycle)
 */
export function getTransactionCyclePeriod(dateStr: string, startDay: number): {
  periodKey: string;
  periodLabel: string;
} {
  const parts = dateStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);

  let cycleStartYear = y;
  let cycleStartMonth = m;

  if (d < startDay) {
    // Falls into the cycle that started in the previous calendar month
    cycleStartMonth = m - 1;
    if (cycleStartMonth === 0) {
      cycleStartMonth = 12;
      cycleStartYear = y - 1;
    }
  }

  let cycleEndYear = cycleStartYear;
  let cycleEndMonth = cycleStartMonth + 1;
  if (cycleEndMonth === 13) {
    cycleEndMonth = 1;
    cycleEndYear = cycleStartYear + 1;
  }

  const endDay = startDay - 1;
  const startMonthStr = String(cycleStartMonth).padStart(2, '0');
  const endMonthStr = String(cycleEndMonth).padStart(2, '0');
  const startDayStr = String(startDay).padStart(2, '0');
  const endDayStr = String(endDay).padStart(2, '0');

  const periodKey = `${cycleStartYear}-${startMonthStr}-${startDayStr}_to_${cycleEndYear}-${endMonthStr}-${endDayStr}`;
  const startMonthName = HEBREW_MONTH_NAMES[cycleStartMonth - 1];
  const endMonthName = HEBREW_MONTH_NAMES[cycleEndMonth - 1];

  const periodLabel = `${startDay} ב${startMonthName} – ${endDay} ב${endMonthName} ${cycleEndYear}`;

  return { periodKey, periodLabel };
}


export function getCategoryBreakdown(transactions: Transaction[], targetMonthKey?: string): CategorySummary[] {
  // Uses central period cash flow calculation to ensure exact consistency and refund deductions
  const period = calculateCashFlowForPeriod(transactions, targetMonthKey);
  return period.categoryBreakdown;
}

// SIMULATION: Compound Interest & Growth
export interface CompoundGrowthPoint {
  year: number;
  totalValue: number;
  totalContributions: number;
  totalGains: number;
  realValueAdjustedForInflation: number;
}

export function simulateCompoundGrowth(params: {
  initialAmount: number;
  monthlyContribution: number;
  annualReturnRate: number; // e.g. 7 for 7%
  years: number;
  inflationRate?: number; // e.g. 2.5 for 2.5%
}): CompoundGrowthPoint[] {
  const points: CompoundGrowthPoint[] = [];
  const monthlyRate = params.annualReturnRate / 100 / 12;
  const inflationMonthlyRate = (params.inflationRate || 2.5) / 100 / 12;

  let totalValue = params.initialAmount;
  let totalContributions = params.initialAmount;

  points.push({
    year: 0,
    totalValue: Math.round(totalValue),
    totalContributions: Math.round(totalContributions),
    totalGains: 0,
    realValueAdjustedForInflation: Math.round(totalValue),
  });

  for (let year = 1; year <= params.years; year++) {
    for (let month = 1; month <= 12; month++) {
      totalValue = totalValue * (1 + monthlyRate) + params.monthlyContribution;
      totalContributions += params.monthlyContribution;
    }

    const totalGains = Math.max(0, totalValue - totalContributions);
    const inflationFactor = Math.pow(1 + (params.inflationRate || 2.5) / 100, year);
    const realValue = totalValue / inflationFactor;

    points.push({
      year,
      totalValue: Math.round(totalValue),
      totalContributions: Math.round(totalContributions),
      totalGains: Math.round(totalGains),
      realValueAdjustedForInflation: Math.round(realValue),
    });
  }

  return points;
}

// SIMULATION: Housing Buy vs Rent
export interface HousingSimulationResult {
  monthlyMortgagePayment: number;
  totalMortgageInterestPaid: number;
  equityAfterYears: number;
  rentAlternativePortfolioValue: number;
  betterChoice: 'buy' | 'rent' | 'similar';
  differenceExplanation: string;
}

export function simulateHousingRentVsBuy(params: {
  homePrice: number;
  downPayment: number;
  mortgageYears: number;
  mortgageRateAnnual: number; // e.g. 4.5%
  monthlyRent: number;
  expectedAnnualAppreciation: number; // e.g. 3.0%
  expectedInvestmentReturn: number; // e.g. 7.0%
}): HousingSimulationResult {
  const loanAmount = Math.max(0, params.homePrice - params.downPayment);
  const monthlyMortgageRate = params.mortgageRateAnnual / 100 / 12;
  const totalMonths = params.mortgageYears * 12;

  // Standard Spitzer formula for fixed payment
  const monthlyMortgagePayment =
    loanAmount *
    ((monthlyMortgageRate * Math.pow(1 + monthlyMortgageRate, totalMonths)) /
      (Math.pow(1 + monthlyMortgageRate, totalMonths) - 1));

  const totalPayments = monthlyMortgagePayment * totalMonths;
  const totalMortgageInterestPaid = Math.round(totalPayments - loanAmount);

  // Property value after N years
  const futurePropertyValue =
    params.homePrice * Math.pow(1 + params.expectedAnnualAppreciation / 100, params.mortgageYears);

  // Rent alternative: Start with downPayment invested in S&P500, plus monthly diff between mortgage & rent
  let investedRentPortfolio = params.downPayment;
  const investMonthlyRate = params.expectedInvestmentReturn / 100 / 12;

  for (let m = 1; m <= totalMonths; m++) {
    // If mortgage payment is higher than rent, renter invests the difference!
    const monthlyDifference = Math.max(0, monthlyMortgagePayment - params.monthlyRent);
    investedRentPortfolio = investedRentPortfolio * (1 + investMonthlyRate) + monthlyDifference;
  }

  const equityAfterYears = Math.round(futurePropertyValue);
  const rentAlternativePortfolioValue = Math.round(investedRentPortfolio);

  let betterChoice: 'buy' | 'rent' | 'similar' = 'similar';
  let differenceExplanation = '';

  if (equityAfterYears > rentAlternativePortfolioValue * 1.1) {
    betterChoice = 'buy';
    differenceExplanation = `רכישה עדיפה מתמטית בהנחות אלו בכ-₪${(equityAfterYears - rentAlternativePortfolioValue).toLocaleString()} הודות לעליית ערך הנדל״ן ומינוף המשכנתא.`;
  } else if (rentAlternativePortfolioValue > equityAfterYears * 1.1) {
    betterChoice = 'rent';
    differenceExplanation = `שכירות והשקעת ההון העצמי בשוק ההון עדיפה מתמטית בכ-₪${(rentAlternativePortfolioValue - equityAfterYears).toLocaleString()} בזכות תשואת ריבית דריבית עודפת.`;
  } else {
    differenceExplanation = `התוצאה צמודה מאוד (הפרש של פחות מ-10%). ההחלטה תלויה בגמישות אישית, יציבות מגורים והעדפת סיכון.`;
  }

  return {
    monthlyMortgagePayment: Math.round(monthlyMortgagePayment),
    totalMortgageInterestPaid,
    equityAfterYears,
    rentAlternativePortfolioValue,
    betterChoice,
    differenceExplanation,
  };
}

// SIMULATION: "Can I Afford This?" (האם אני יכול להרשות לעצמי את זה?)
export interface AffordabilityAnalysis {
  plannedExpense: number;
  expenseName: string;
  isAffordable: boolean;
  liquidCashRemaining: number;
  emergencyRunwayRemainingMonths: number;
  recoveryMonths: number;
  impactOnGoals: { goalName: string; delayedMonths: number }[];
  verdict: 'comfortable' | 'tight' | 'caution' | 'not_recommended';
  verdictHebrew: string;
  reasoningHebrew: string;
}

export function checkAffordability(
  plannedExpense: number,
  expenseName: string,
  accounts: Account[],
  monthlySavings: number,
  goals: FinancialGoal[],
  monthlyExpenses: number
): AffordabilityAnalysis {
  const netWorth = calculateNetWorth(accounts);
  const liquidCash = netWorth.cashAndLiquid + netWorth.savings;
  const liquidCashRemaining = Math.max(0, liquidCash - plannedExpense);

  const emergencyRunwayRemainingMonths =
    monthlyExpenses > 0 ? Number((liquidCashRemaining / monthlyExpenses).toFixed(1)) : 6;

  const recoveryMonths = monthlySavings > 0 ? Math.ceil(plannedExpense / monthlySavings) : 999;

  let verdict: 'comfortable' | 'tight' | 'caution' | 'not_recommended' = 'comfortable';
  let verdictHebrew = 'בר השגה בנוחות מלאה';
  let reasoningHebrew = '';

  if (plannedExpense > liquidCash) {
    verdict = 'not_recommended';
    verdictHebrew = 'לא מומלץ כעת (חריגה מנזילות)';
    reasoningHebrew = `ההוצאה (₪${plannedExpense.toLocaleString()}) עולה על סך המזומנים הנזילים שלך (₪${liquidCash.toLocaleString()}). מחייב לקיחת חוב או מימוש השקעות.`;
  } else if (emergencyRunwayRemainingMonths < 3) {
    verdict = 'caution';
    verdictHebrew = 'זהירות: פגיעה בכרית הביטחון';
    reasoningHebrew = `רכישה זו תוריד את כרית הביטחון הנזילה שלך ל-${emergencyRunwayRemainingMonths} חודשי קיום (הסף המומלץ הוא לפחות 3-6 חודשים).`;
  } else if (recoveryMonths > 6) {
    verdict = 'tight';
    verdictHebrew = 'אפשרי אך ידרוש הידוק חגורה';
    reasoningHebrew = `יידרשו לך כ-${recoveryMonths} חודשי חיסכון מלאים כדי להחזיר את הנזילות לרמתה הנוכחית.`;
  } else {
    verdict = 'comfortable';
    verdictHebrew = 'בר השגה בנוחות מלאה';
    reasoningHebrew = `יש לך די נזילות. תישאר עם ${emergencyRunwayRemainingMonths} חודשי ביטחון, וזמן ההתאוששות המוערך הוא ${recoveryMonths} חודשים בלבד.`;
  }

  const impactOnGoals = goals.map(g => ({
    goalName: g.name,
    delayedMonths: recoveryMonths > 2 ? Math.min(recoveryMonths, 4) : 0,
  }));

  return {
    plannedExpense,
    expenseName,
    isAffordable: verdict !== 'not_recommended',
    liquidCashRemaining,
    emergencyRunwayRemainingMonths,
    recoveryMonths,
    impactOnGoals,
    verdict,
    verdictHebrew,
    reasoningHebrew,
  };
}
