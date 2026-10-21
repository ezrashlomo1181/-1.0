import assert from 'node:assert/strict';
import { calculateCashFlowForPeriod } from '../services/financialCalculations.js';
import { buildTransactionObject } from '../services/documentParser.js';
import type { Transaction } from '../types/financial.js';

let passed = 0;
let failed = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (error) {
    failed++;
    console.error(`  FAIL: ${name}`);
    console.error(error);
  }
}

function tx(overrides: Partial<Transaction> & Pick<Transaction, 'id' | 'amount' | 'type'>): Transaction {
  return {
    id: overrides.id,
    date: '2026-09-15',
    amount: overrides.amount,
    currency: 'ILS',
    merchant: overrides.merchant || overrides.id,
    description: overrides.description || overrides.id,
    accountId: 'account-test',
    accountName: 'חשבון בדיקה',
    paymentMethod: 'bank_transfer',
    category: overrides.category || 'אחר',
    type: overrides.type,
    isRecurring: false,
    confidenceScore: 0.9,
    confidenceLevel: 'high',
    needsReview: false,
    userConfirmed: true,
    ...overrides,
  };
}

console.log('\n=== TEST SUITE: Accounting Consistency & Flow Direction (Stage 2) ===');

runTest('Verified inflows and outflows drive totals, not a contradictory semantic type', () => {
  const transactions = [
    tx({ id: 'salary', amount: 5000, type: 'income', flowDirection: 'inflow' }),
    tx({ id: 'groceries', amount: 1000, type: 'expense', flowDirection: 'outflow', category: 'מזון וסופר' }),
    tx({ id: 'refund', amount: 100, type: 'refund', flowDirection: 'inflow', category: 'מזון וסופר' }),
    tx({ id: 'wrong-income-direction', amount: 800, type: 'income', flowDirection: 'outflow' }),
    tx({ id: 'wrong-expense-direction', amount: 600, type: 'expense', flowDirection: 'inflow' }),
    tx({ id: 'uncertain', amount: 300, type: 'other', flowDirection: 'unknown', needsReview: true }),
  ];

  const result = calculateCashFlowForPeriod(transactions, '2026-09');
  assert.equal(result.income, 5000);
  assert.equal(result.grossExpenses, 1800);
  assert.equal(result.refunds, 100);
  assert.equal(result.expenses, 1700);
  assert.equal(result.netCashFlow, 3300);
  assert.equal(result.transactions.some((t) => t.id === 'uncertain'), false);
});

runTest('Ignored transactions do not affect cash-flow totals', () => {
  const result = calculateCashFlowForPeriod([
    tx({ id: 'salary', amount: 2000, type: 'income', flowDirection: 'inflow' }),
    tx({ id: 'ignored-expense', amount: 900, type: 'expense', flowDirection: 'outflow', ignored: true }),
  ], '2026-09');
  assert.equal(result.income, 2000);
  assert.equal(result.expenses, 0);
});

runTest('Legacy transactions without flowDirection retain type-based calculation', () => {
  const result = calculateCashFlowForPeriod([
    tx({ id: 'legacy-income', amount: 4000, type: 'income' }),
    tx({ id: 'legacy-expense', amount: 1200, type: 'expense' }),
  ], '2026-09');
  assert.equal(result.income, 4000);
  assert.equal(result.expenses, 1200);
});

runTest('Unknown source direction is quarantined and requires review', () => {
  const unknownInstitution = {
    name: 'מקור לא מזוהה',
    accountId: 'acc-general',
    accountName: 'חשבון כללי',
    defaultPayment: 'direct_debit' as const,
    currency: 'ILS' as const,
    isCreditCardOnly: false,
  };

  const built = buildTransactionObject({
    date: '2026-09-15',
    amount: 125,
    merchant: 'עסקה לא ברורה',
    description: 'תנועה ללא טור חובה או זכות',
    isCreditRow: false,
    isDebitRow: false,
    amountIsNegative: false,
    institutionInfo: unknownInstitution,
    sourceFileName: 'unknown-source.csv',
  });

  assert.equal(built.flowDirection, 'unknown');
  assert.equal(built.type, 'other');
  assert.equal(built.needsReview, true);
  assert.equal(built.userConfirmed, false);
});

runTest('Inflow marked expense is not counted as spending; outflow marked income is spending', () => {
  const result = calculateCashFlowForPeriod([
    tx({ id: 'inflow-marked-expense', amount: 250, type: 'expense', flowDirection: 'inflow', needsReview: true }),
    tx({ id: 'outflow-marked-income', amount: 400, type: 'income', flowDirection: 'outflow', needsReview: true }),
  ], '2026-09');
  assert.equal(result.income, 0);
  assert.equal(result.expenses, 400);
  assert.equal(result.grossExpenses, 400);
});

console.log(`Stage 2 accounting consistency: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  throw new Error(`Stage 2 accounting consistency failed: ${failed} test(s).`);
}
