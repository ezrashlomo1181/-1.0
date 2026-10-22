import assert from 'node:assert';
import { calculateCashFlowForPeriod } from '../services/financialCalculations.js';
import { Transaction } from '../types/financial.js';

let passedCount = 0;
let failedCount = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    failedCount++;
  }
}

console.log('\n=== TEST SUITE: Stage 1 Base Calculations & Cash Flow (v2.5) ===');

function createTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: `tx-${Math.random().toString(36).substring(2, 9)}`,
    date: '2026-09-15',
    amount: 100,
    currency: 'ILS',
    merchant: 'עסקה כללית',
    description: 'עסקה כללית',
    accountId: 'acc-test',
    accountName: 'חשבון בדיקה',
    paymentMethod: 'bank_transfer',
    category: 'כללי',
    type: 'expense',
    isRecurring: false,
    confidenceScore: 0.9,
    confidenceLevel: 'high',
    needsReview: false,
    userConfirmed: true,
    flowDirection: 'outflow',
    ...overrides,
  };
}

// -----------------------------------------------------------------------------
// Test 1: Mandatory Scenario 1 - Salary 10,000 ILS, Refund 4,000 ILS, 0 other expenses
// -----------------------------------------------------------------------------
runTest('Scenario 1: Salary 10,000 ILS, Refund 4,000 ILS, 0 other expenses', () => {
  const salaryTx = createTx({
    date: '2026-09-01',
    merchant: 'חברת הייטק בע"מ',
    description: 'משכורת חודשית',
    amount: 10000,
    category: 'משכורת והכנסות',
    type: 'income',
    flowDirection: 'inflow',
  });

  const refundTx = createTx({
    date: '2026-09-10',
    merchant: 'חנות מחשבים',
    description: 'החזר רכישת מחשב מחודש קודם',
    amount: 4000,
    category: 'מחשבים וטכנולוגיה',
    type: 'refund',
    flowDirection: 'inflow',
  });

  const period = calculateCashFlowForPeriod([salaryTx, refundTx], '2026-09');

  // 1. תזרים נטו: 14,000 ₪ (כניסה של 10,000 ₪ משכר + כניסה של 4,000 ₪ מהחזר, 0 יציאות)
  assert.strictEqual(period.netCashFlow, 14000, 'תזרים נטו חייב להיות 14,000 ₪ בדיוק (ולא 18,000 ₪ או 10,000 ₪)');

  // 2. הכנסה תפעולית: 10,000 ₪ (ההחזר אינו נספר בטעות כהכנסת שכר)
  assert.strictEqual(period.income, 10000, 'הכנסה תפעולית היא 10,000 ₪ בלבד');

  // 3. סך החזרים: 4,000 ₪
  assert.strictEqual(period.refunds, 4000, 'החזרים נספרים ב-refunds');

  // 4. סך הוצאות נטו: 4,000- ₪ (ההחזרים עולים על הוצאות החודש)
  assert.strictEqual(period.expenses, -4000, 'סך הוצאות נטו הוא 4,000- ₪');

  // 5. יתרת זכות שלילית בקטגוריה המקורית: 4,000- ₪
  const techCategory = period.categoryBreakdown.find((c) => c.category === 'מחשבים וטכנולוגיה');
  assert.ok(techCategory, 'קטגוריית מחשבים וטכנולוגיה קיימת בפילוח');
  assert.strictEqual(techCategory!.amount, -4000, 'יתרת זכות של 4,000- ₪ בקטגוריית מחשבים וטכנולוגיה');
});

// -----------------------------------------------------------------------------
// Test 2: Mandatory Scenario 2 - Expenses 5,000 ILS and Refunds 1,000 ILS
// -----------------------------------------------------------------------------
runTest('Scenario 2: Expenses 5,000 ILS and Refunds 1,000 ILS yields net expenses of 4,000 ILS', () => {
  const expenseTx = createTx({
    date: '2026-09-05',
    merchant: 'חנות ביגוד',
    amount: 5000,
    category: 'קניות וביגוד',
    type: 'expense',
    flowDirection: 'outflow',
  });

  const refundTx = createTx({
    date: '2026-09-12',
    merchant: 'חנות ביגוד',
    amount: 1000,
    category: 'קניות וביגוד',
    type: 'refund',
    flowDirection: 'inflow',
  });

  const period = calculateCashFlowForPeriod([expenseTx, refundTx], '2026-09');

  assert.strictEqual(period.grossExpenses, 5000, 'הוצאות ברוטו 5,000 ₪');
  assert.strictEqual(period.refunds, 1000, 'החזרים 1,000 ₪');
  assert.strictEqual(period.expenses, 4000, 'הוצאות נטו 4,000 ₪ (5,000 פחות 1,000)');
  assert.strictEqual(period.netCashFlow, -4000, 'תזרים נטו שלילי של 4,000- ₪');

  const clothingCategory = period.categoryBreakdown.find((c) => c.category === 'קניות וביגוד');
  assert.ok(clothingCategory);
  assert.strictEqual(clothingCategory!.amount, 4000, 'הוצאת נטו בקטגוריה היא 4,000 ₪');
});

// -----------------------------------------------------------------------------
// Test 3: Mandatory Scenario 3 - Regular transactions continue to be counted as before
// -----------------------------------------------------------------------------
runTest('Scenario 3: Regular non-refund transactions preserve existing calculation behavior', () => {
  const regularIncome = createTx({
    date: '2026-09-01',
    amount: 8500,
    category: 'משכורת והכנסות',
    type: 'income',
    flowDirection: 'inflow',
  });

  const regularExpense = createTx({
    date: '2026-09-15',
    amount: 1200,
    category: 'מזון וסופר',
    type: 'expense',
    flowDirection: 'outflow',
  });

  const feeTx = createTx({
    date: '2026-09-20',
    amount: 25,
    category: 'עמלות ודמי ניהול',
    type: 'fee',
    flowDirection: 'outflow',
  });

  const period = calculateCashFlowForPeriod([regularIncome, regularExpense, feeTx], '2026-09');

  assert.strictEqual(period.income, 8500, 'הכנסה רגילה נספרת');
  assert.strictEqual(period.grossExpenses, 1225, 'הוצאות ועמלות נספרות בברוטו');
  assert.strictEqual(period.refunds, 0, 'אפס החזרים');
  assert.strictEqual(period.expenses, 1225, 'הוצאות נטו שוות להוצאות ברוטו');
  assert.strictEqual(period.netCashFlow, 8500 - 1225, 'תזרים נטו מדויק');
});

// -----------------------------------------------------------------------------
// Test 4: Mandatory Scenario 4 - Internal transfers are excluded and have zero impact on income/expenses
// -----------------------------------------------------------------------------
runTest('Scenario 4: Internal transfers and transfer types have zero impact on income and expenses', () => {
  const transferTx = createTx({
    date: '2026-09-08',
    amount: 5000,
    category: 'העברות ומזומן',
    type: 'transfer',
    isInternalTransfer: true,
  });

  const normalExpense = createTx({
    date: '2026-09-10',
    amount: 300,
    category: 'חשבונות',
    type: 'expense',
  });

  const period = calculateCashFlowForPeriod([transferTx, normalExpense], '2026-09');

  assert.strictEqual(period.income, 0, 'העברה אינה הכנסה');
  assert.strictEqual(period.expenses, 300, 'רק ההוצאה הרגילה נספרת, ההעברה סוננה');
  assert.strictEqual(period.netCashFlow, -300, 'העברה לא השפיעה על התזרים השוטף');
});

// -----------------------------------------------------------------------------
// Test 5: Loan Received Type Support (loan_received)
// -----------------------------------------------------------------------------
runTest('Scenario 5: loan_received enters cash flow without inflating operating salary income', () => {
  const loanTx = createTx({
    date: '2026-09-02',
    merchant: 'בנק לאומי',
    description: 'העמדת הלוואה לרכב',
    amount: 45000,
    category: 'הלוואות ומימון',
    type: 'loan_received',
    flowDirection: 'inflow',
  });

  const salaryTx = createTx({
    date: '2026-09-01',
    amount: 12000,
    category: 'משכורת והכנסות',
    type: 'income',
    flowDirection: 'inflow',
  });

  const period = calculateCashFlowForPeriod([loanTx, salaryTx], '2026-09');

  assert.strictEqual(period.income, 12000, 'הכנסה תפעולית היא 12,000 ₪ בלבד (הלוואה אינה שכר!)');
  assert.strictEqual(period.netCashFlow, 12000 + 45000, 'תזרים מזומנים בפועל כולל את תקבול ההלוואה');
});

// -----------------------------------------------------------------------------
// Test 6: Dynamic Period Selection & Historical Dataset Labeling
// -----------------------------------------------------------------------------
runTest('Scenario 6: Dynamic period selection, graceful empty fallback and historical labeling', () => {
  // 6.1 Explicit targetMonthKey with zero transactions returns clean empty period object
  const emptyExplicitPeriod = calculateCashFlowForPeriod([], '2026-01');
  assert.strictEqual(emptyExplicitPeriod.monthKey, '2026-01', 'Explicit monthKey is honored');
  assert.strictEqual(emptyExplicitPeriod.income, 0, 'Empty period income is 0');
  assert.strictEqual(emptyExplicitPeriod.expenses, 0, 'Empty period expenses is 0');
  assert.strictEqual(emptyExplicitPeriod.transactionCount, 0, 'Empty period transaction count is 0');
  assert.strictEqual(emptyExplicitPeriod.categoryBreakdown.length, 0, 'Empty period category breakdown is empty');
  assert.strictEqual(emptyExplicitPeriod.isHistorical, true, '2026-01 is historical (< CURRENT_APP_MONTH)');

  // 6.2 Completely empty dataset without targetMonthKey falls back cleanly without crashing
  const defaultEmptyPeriod = calculateCashFlowForPeriod([]);
  assert.ok(defaultEmptyPeriod.monthKey, 'Default empty period has a valid monthKey');
  assert.strictEqual(defaultEmptyPeriod.transactionCount, 0, 'Default empty period transaction count is 0');

  // 6.3 Historical dataset where latest month is May 2026 (prior to CURRENT_APP_MONTH October 2026)
  const historicalTx1 = createTx({
    date: '2026-05-10',
    amount: 1500,
    type: 'expense',
    flowDirection: 'outflow',
  });
  const historicalTx2 = createTx({
    date: '2026-04-12',
    amount: 800,
    type: 'expense',
    flowDirection: 'outflow',
  });
  const internalTransferMay = createTx({
    date: '2026-05-28',
    amount: 10000,
    type: 'transfer',
    isInternalTransfer: true,
  });

  const resolvedHistoricalPeriod = calculateCashFlowForPeriod([historicalTx1, historicalTx2, internalTransferMay]);
  assert.strictEqual(resolvedHistoricalPeriod.monthKey, '2026-05', 'Selects latest month with non-transfer data');
  assert.strictEqual(resolvedHistoricalPeriod.isHistorical, true, 'Identified as historical period (< 2026-10)');
  assert.strictEqual(resolvedHistoricalPeriod.expenses, 1500, 'Calculates May expenses correctly');
});

// -----------------------------------------------------------------------------
// Test 7: Quarantine Isolation & Multi-Currency Segregation
// -----------------------------------------------------------------------------
runTest('Scenario 7: Quarantine isolation for contradictions & unconfirmed unknowns, preserving legacy & multi-currency', () => {
  // 7.1 Contradiction: type === 'expense' but flowDirection === 'inflow' (quarantined)
  const contradictionTx1 = createTx({
    id: 'tx-contra-1',
    date: '2026-09-05',
    amount: 1000,
    currency: 'ILS',
    type: 'expense',
    flowDirection: 'inflow',
  });

  // 7.2 Contradiction: type === 'income' but flowDirection === 'outflow' (quarantined)
  const contradictionTx2 = createTx({
    id: 'tx-contra-2',
    date: '2026-09-08',
    amount: 300,
    currency: 'USD',
    type: 'income',
    flowDirection: 'outflow',
  });

  // 7.3 Unconfirmed unknown: flowDirection === 'unknown' and userConfirmed === false (quarantined)
  const unconfirmedUnknownTx = createTx({
    id: 'tx-unknown-unconfirmed',
    date: '2026-09-12',
    amount: 50,
    currency: 'EUR',
    type: 'expense',
    flowDirection: 'unknown',
    userConfirmed: false,
  });

  // 7.4 Confirmed unknown: flowDirection === 'unknown' but userConfirmed === true (NOT quarantined)
  const confirmedUnknownTx = createTx({
    id: 'tx-unknown-confirmed',
    date: '2026-09-15',
    amount: 250,
    currency: 'ILS',
    type: 'expense',
    flowDirection: 'unknown',
    userConfirmed: true,
  });

  // 7.5 Legacy transaction: flowDirection === undefined (NOT quarantined, backward compatibility)
  const legacyTx = createTx({
    id: 'tx-legacy',
    date: '2026-09-20',
    amount: 400,
    currency: 'ILS',
    type: 'expense',
    flowDirection: undefined,
  });

  // 7.6 Legitimate income
  const validIncomeTx = createTx({
    id: 'tx-valid-income',
    date: '2026-09-01',
    amount: 8000,
    currency: 'ILS',
    type: 'income',
    flowDirection: 'inflow',
  });

  const period = calculateCashFlowForPeriod(
    [
      contradictionTx1,
      contradictionTx2,
      unconfirmedUnknownTx,
      confirmedUnknownTx,
      legacyTx,
      validIncomeTx,
    ],
    '2026-09'
  );

  // Quarantine checks:
  // Exactly 3 transactions quarantined: contradictionTx1, contradictionTx2, unconfirmedUnknownTx
  assert.strictEqual(period.quarantinedTransactions.length, 3, 'Exactly 3 transactions are quarantined');
  const quarantinedIds = period.quarantinedTransactions.map((t) => t.id);
  assert.ok(quarantinedIds.includes('tx-contra-1'), 'Contradiction 1 in quarantine');
  assert.ok(quarantinedIds.includes('tx-contra-2'), 'Contradiction 2 in quarantine');
  assert.ok(quarantinedIds.includes('tx-unknown-unconfirmed'), 'Unconfirmed unknown in quarantine');
  assert.ok(!quarantinedIds.includes('tx-unknown-confirmed'), 'Confirmed unknown released from quarantine');
  assert.ok(!quarantinedIds.includes('tx-legacy'), 'Legacy undefined flowDirection released from quarantine');

  // Multi-currency segregation check:
  // Quarantined amounts must be segregated by currency, NEVER summed into a single number
  assert.strictEqual(period.quarantinedAmounts.ILS, 1000, 'Quarantined ILS is 1,000');
  assert.strictEqual(period.quarantinedAmounts.USD, 300, 'Quarantined USD is 300');
  assert.strictEqual(period.quarantinedAmounts.EUR, 50, 'Quarantined EUR is 50');

  // Calculation isolation check:
  // Income should be 8,000 only (tx-contra-2 was isolated)
  assert.strictEqual(period.income, 8000, 'Quarantined income outflow does not corrupt income');
  // Expenses should be 250 (confirmed unknown) + 400 (legacy) = 650 (tx-contra-1 and unconfirmed unknown were isolated)
  assert.strictEqual(period.expenses, 650, 'Quarantined expense inflow and unconfirmed unknown do not corrupt expenses');
});

console.log(`\nStage 1 Base Calculations Summary: ${passedCount} passed, ${failedCount} failed.`);
if (failedCount > 0) {
  process.exit(1);
}

