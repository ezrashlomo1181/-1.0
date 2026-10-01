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
  'דיור': '#3b82f6', // blue
  'מזון וסופר': '#10b981', // emerald
  'מסעדות ומשלוחים': '#f59e0b', // amber
  'תחבורה': '#8b5cf6', // purple
  'קניות': '#ec4899', // pink
  'בילויים ופנאי': '#06b6d4', // cyan
  'בריאות': '#14b8a6', // teal
  'ביטוחים': '#6366f1', // indigo
  'חשבונות': '#64748b', // slate
  'מנויים': '#a855f7', // purple-500
  'הלוואות והתחייבויות': '#ef4444', // red
  'אחר': '#94a3b8', // light slate
  'הכנסות': '#22c55e', // green
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

export function calculateMonthlyCashFlow(transactions: Transaction[], accounts: Account[]): MonthlyCashFlowSummary {
  // CRITICAL: Filter out internal transfers so credit card payments or account transfers aren't counted twice!
  const validTransactions = transactions.filter(t => !t.isInternalTransfer && t.type !== 'transfer');

  let income = 0;
  let expenses = 0;

  for (const tx of validTransactions) {
    if (tx.type === 'income') {
      income += tx.amount;
    } else if (tx.type === 'refund') {
      // Refunds reduce expenses rather than appearing as income
      expenses -= Math.abs(tx.amount);
    } else if (tx.type === 'expense' || tx.type === 'fee' || tx.type === 'loan_payment') {
      expenses += Math.abs(tx.amount);
    }
  }

  // Monthly average approximation (assuming standard 1 month view or total current month)
  // If dataset has September 2026, calculate current month
  const monthlySavings = Math.max(0, income - expenses);
  const savingsRate = income > 0 ? Math.round((monthlySavings / income) * 100) : 0;

  // Liquid Runway
  const netWorth = calculateNetWorth(accounts);
  const liquidRunwayMonths = expenses > 0 
    ? Number(((netWorth.cashAndLiquid + netWorth.savings) / expenses).toFixed(1))
    : 12;

  return {
    monthlyIncome: income,
    monthlyExpenses: expenses,
    monthlySavings,
    savingsRate,
    liquidRunwayMonths,
  };
}

export function getCashFlowHistory(transactions: Transaction[], monthsCount: number = 6): MonthDataPoint[] {
  // Generate realistic historical monthly trend
  const monthLabels = ['אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר'];
  const baseIncome = 22400;
  const baseExpenses = [14200, 15100, 13900, 16400, 15800, 14850];

  const points: MonthDataPoint[] = [];

  for (let i = 0; i < monthsCount; i++) {
    const exp = baseExpenses[i] || 14500;
    const inc = i === 3 ? baseIncome + 3500 : (i === 5 ? baseIncome + 1200 : baseIncome); // bonuses in July/Sept
    const sav = Math.max(0, inc - exp);
    points.push({
      monthKey: `2026-0${i + 4}`,
      monthLabel: monthLabels[i] || `חודש ${i + 1}`,
      income: inc,
      expense: exp,
      savings: sav,
    });
  }

  return points;
}

export function getCategoryBreakdown(transactions: Transaction[]): CategorySummary[] {
  // Filter out internal transfers and income
  const expenseTransactions = transactions.filter(
    t => !t.isInternalTransfer && (t.type === 'expense' || t.type === 'loan_payment')
  );

  const categoryMap = new Map<string, { amount: number; count: number; items: Transaction[] }>();

  let totalExpense = 0;
  for (const tx of expenseTransactions) {
    totalExpense += tx.amount;
    const cat = tx.category || 'אחר';
    const curr = categoryMap.get(cat) || { amount: 0, count: 0, items: [] };
    curr.amount += tx.amount;
    curr.count += 1;
    curr.items.push(tx);
    categoryMap.set(cat, curr);
  }

  const summaries: CategorySummary[] = [];
  categoryMap.forEach((val, cat) => {
    const percentage = totalExpense > 0 ? Math.round((val.amount / totalExpense) * 100) : 0;
    summaries.push({
      category: cat,
      amount: val.amount,
      percentage,
      count: val.count,
      transactions: val.items,
      color: getCategoryColor(cat),
    });
  });

  // Sort descending by amount
  return summaries.sort((a, b) => b.amount - a.amount);
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
