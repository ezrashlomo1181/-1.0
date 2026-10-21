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


runTest('Explicit unknown flow direction is quarantined and counted as an anomaly', () => {
  const unknownTx = createTx({ amount: 900, type: 'expense', flowDirection: 'unknown' });
  const period = calculateCashFlowForPeriod([unknownTx], '2026-09');
  assert.strictEqual(period.grossExpenses, 0);
  assert.strictEqual(period.anomaliesCount, 1);
});

runTest('Independent refund increases cash flow but does not offset expenses', () => {
  const expenseTx = createTx({ amount: 500, type: 'expense', flowDirection: 'outflow' });
  const refundTx = createTx({
    amount: 200, type: 'refund', flowDirection: 'inflow',
    deductsFromExpense: false, isIndependentRefund: true,
  });
  const period = calculateCashFlowForPeriod([expenseTx, refundTx], '2026-09');
  assert.strictEqual(period.expenses, 500, 'Independent refund must not reduce reported expenses');
  assert.strictEqual(period.netCashFlow, -300, 'Independent refund still counts as cash received');
  assert.strictEqual(period.refunds, 0, 'Independent refund is not an expense-offsetting refund');
});

runTest('Refund linked to a non-expense does not inherit its category', () => {
  const linkedIncome = createTx({
    id: 'linked-income', amount: 1000, type: 'income',
    category: 'משכורת והכנסות', flowDirection: 'inflow',
  });
  const refundTx = createTx({
    amount: 100, type: 'refund', category: 'החזר לא מסווג',
    flowDirection: 'inflow', linkedExpenseId: 'linked-income',
  });
  const period = calculateCashFlowForPeriod([linkedIncome, refundTx], '2026-09');
  assert.ok(period.categoryBreakdown.some((c) => c.category === 'החזר לא מסווג'));
  assert.ok(!period.categoryBreakdown.some((c) => c.category === 'משכורת והכנסות'));
});

runTest('Loan and independent refund receipts do not inflate operating savings rate', () => {
  const salaryTx = createTx({ amount: 1000, type: 'income', flowDirection: 'inflow' });
  const expenseTx = createTx({ amount: 400, type: 'expense', flowDirection: 'outflow' });
  const loanTx = createTx({ amount: 5000, type: 'loan_received', flowDirection: 'inflow' });
  const independentRefund = createTx({
    amount: 3000, type: 'refund', flowDirection: 'inflow', deductsFromExpense: false,
  });
  const period = calculateCashFlowForPeriod([salaryTx, expenseTx, loanTx, independentRefund], '2026-09');
  assert.strictEqual(period.operatingSavings, 600);
  assert.strictEqual(period.savingsRate, 60);
  assert.strictEqual(period.netCashFlow, 8600);
});

console.log(`\nStage 1 Base Calculations Summary: ${passedCount} passed, ${failedCount} failed.`);
if (failedCount > 0) {
  process.exit(1);
}
