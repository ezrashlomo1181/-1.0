import assert from 'node:assert';
import { parseCsvContent, buildTransactionObject } from '../services/documentParser.js';
import { getDisplayDirection } from '../views/TransactionsView.js';
import { INITIAL_TRANSACTIONS } from '../data/demoData.js';
import { Transaction } from '../types/financial.js';

let passed = 0;
let failed = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    failed++;
  }
}

console.log('=== TEST SUITE: Flow Direction & Safe Presentation (Stage 1) ===');

// -------------------------------------------------------------
// Part 1: Decision Table Invariants (buildTransactionObject)
// -------------------------------------------------------------
console.log('\n--- Part 1: Deterministic Decision Table Invariants ---');

const bankInstitution = {
  name: 'בנק לאומי',
  accountId: 'acc-bank-1',
  accountName: 'עו"ש ראשי - לאומי',
  defaultPayment: 'bank_transfer' as const,
  currency: 'ILS' as const,
  isCreditCardOnly: false,
};

const cardInstitution = {
  name: 'כרטיס ויזה כאל',
  accountId: 'acc-card-1',
  accountName: 'ויזה כאל זהב',
  defaultPayment: 'credit_card' as const,
  currency: 'ILS' as const,
  isCreditCardOnly: true,
};

const unidentifiedInstitution = {
  name: 'קובץ ללא זיהוי',
  accountId: 'acc-general',
  accountName: 'חשבון כללי',
  defaultPayment: 'direct_debit' as const,
  currency: 'ILS' as const,
  isCreditCardOnly: false,
};

runTest('Rule 1: Contradictory flags (isCreditRow & isDebitRow) -> unknown', () => {
  const tx = buildTransactionObject({
    date: '2026-10-01',
    amount: 1500,
    merchant: 'עסקה בסתירה',
    description: 'עמודת חובה וזכות שתיהן פעילות',
    isCreditRow: true,
    isDebitRow: true,
    amountIsNegative: false,
    institutionInfo: bankInstitution,
    sourceFileName: 'bank.csv',
  });
  assert.strictEqual(tx.flowDirection, 'unknown', 'Contradictory debit & credit rows must yield unknown');
});

runTest('Rule 2: Explicit Credit column with negative amount (contradictory) -> unknown', () => {
  const tx = buildTransactionObject({
    date: '2026-10-01',
    amount: 500,
    merchant: 'עסק זיכוי',
    description: 'מינוס בתוך טור זכות',
    isCreditRow: true,
    isDebitRow: false,
    amountIsNegative: true,
    institutionInfo: bankInstitution,
    sourceFileName: 'bank.csv',
  });
  assert.strictEqual(tx.flowDirection, 'unknown', 'Negative amount inside explicit credit column is contradictory');
});

runTest('Rule 3: Explicit Credit column with positive amount -> inflow', () => {
  const tx = buildTransactionObject({
    date: '2026-10-01',
    amount: 8500,
    merchant: 'הפקדת כספים',
    description: 'זיכוי רגיל בעמודת זכות',
    isCreditRow: true,
    isDebitRow: false,
    amountIsNegative: false,
    institutionInfo: bankInstitution,
    sourceFileName: 'bank.csv',
  });
  assert.strictEqual(tx.flowDirection, 'inflow', 'Positive amount in explicit credit column must yield inflow');
});

runTest('Rule 4: Bank explicit Debit column with positive amount -> outflow', () => {
  const tx = buildTransactionObject({
    date: '2026-10-01',
    amount: 320,
    merchant: 'סופר פארם',
    description: 'חיוב בעמודת חובה',
    isCreditRow: false,
    isDebitRow: true,
    amountIsNegative: false,
    institutionInfo: bankInstitution,
    sourceFileName: 'bank.csv',
  });
  assert.strictEqual(tx.flowDirection, 'outflow', 'Positive amount in explicit bank debit column must yield outflow');
});

runTest('Rule 5: Credit card explicit Debit column with negative amount (refund) -> inflow', () => {
  const tx = buildTransactionObject({
    date: '2026-10-01',
    amount: 199,
    merchant: 'זארה ישראל',
    description: 'זיכוי בכרטיס אשראי בעמודת חיוב',
    isCreditRow: false,
    isDebitRow: true,
    amountIsNegative: true,
    institutionInfo: cardInstitution,
    sourceFileName: 'card.csv',
  });
  assert.strictEqual(tx.flowDirection, 'inflow', 'Negative amount in card debit column is a refund (inflow)');
});

runTest('Rule 6: Bank explicit Debit column with negative amount (contradictory) -> unknown', () => {
  const tx = buildTransactionObject({
    date: '2026-10-01',
    amount: 450,
    merchant: 'בנק פעולה',
    description: 'סכום שלילי בתוך טור חובה בבנק',
    isCreditRow: false,
    isDebitRow: true,
    amountIsNegative: true,
    institutionInfo: bankInstitution,
    sourceFileName: 'bank.csv',
  });
  assert.strictEqual(tx.flowDirection, 'unknown', 'Negative amount inside bank debit column is contradictory');
});

runTest('Rule 7: Verified bank single amount column with negative amount -> outflow', () => {
  const tx = buildTransactionObject({
    date: '2026-10-01',
    amount: 250,
    merchant: 'שופרסל',
    description: 'קניות',
    isCreditRow: false,
    isDebitRow: false,
    amountIsNegative: true,
    institutionInfo: bankInstitution,
    sourceFileName: 'bank.csv',
  });
  assert.strictEqual(tx.flowDirection, 'outflow', 'Negative amount in bank single column is outflow');
});

runTest('Rule 8: Verified bank single amount column with positive amount -> inflow', () => {
  const tx = buildTransactionObject({
    date: '2026-10-01',
    amount: 14000,
    merchant: 'מופ"ת חובה-י',
    description: 'הפקדת משכורת',
    isCreditRow: false,
    isDebitRow: false,
    amountIsNegative: false,
    institutionInfo: bankInstitution,
    sourceFileName: 'bank.csv',
  });
  assert.strictEqual(tx.flowDirection, 'inflow', 'Positive amount in bank single column is inflow');
});

runTest('Rule 9: Credit card single amount column with positive amount -> outflow', () => {
  const tx = buildTransactionObject({
    date: '2026-10-01',
    amount: 120,
    merchant: 'קפה ארומה',
    description: 'רכישה רגילה בכרטיס',
    isCreditRow: false,
    isDebitRow: false,
    amountIsNegative: false,
    institutionInfo: cardInstitution,
    sourceFileName: 'visa_card.csv',
  });
  assert.strictEqual(tx.flowDirection, 'outflow', 'Positive amount on credit card is outflow');
});

runTest('Rule 10: Credit card single amount column with negative amount -> inflow', () => {
  const tx = buildTransactionObject({
    date: '2026-10-01',
    amount: 80,
    merchant: 'החזר קפה ארומה',
    description: 'ביטול עסקה בכרטיס',
    isCreditRow: false,
    isDebitRow: false,
    amountIsNegative: true,
    institutionInfo: cardInstitution,
    sourceFileName: 'visa_card.csv',
  });
  assert.strictEqual(tx.flowDirection, 'inflow', 'Negative amount on credit card is inflow (refund)');
});

runTest('Rule 11: Unidentified source with single amount column -> unknown', () => {
  const tx = buildTransactionObject({
    date: '2026-10-01',
    amount: 500,
    merchant: 'עסק לא מזוהה',
    description: 'קובץ ללא שיוך מוסדי ברור',
    isCreditRow: false,
    isDebitRow: false,
    amountIsNegative: false,
    institutionInfo: unidentifiedInstitution,
    sourceFileName: 'unknown_raw_data.csv',
  });
  assert.strictEqual(tx.flowDirection, 'unknown', 'Unidentified single column source cannot assume direction');
});

// -------------------------------------------------------------
// Part 2: File Parser Integration (parseCsvContent)
// -------------------------------------------------------------
console.log('\n--- Part 2: File Parser End-to-End Integration ---');

runTest('CSV bank statement with single amount column preserves inflow and outflow', () => {
  const csv = [
    'תאריך,תיאור,אסמכתא,סכום',
    '2026-09-01,מופת חובה-י,101,4500.00',
    '2026-09-02,סופרסל דיל,102,-350.50',
    '2026-09-03,חילן שכר עבודה,103,16200.00',
    '2026-09-04,תדלוק סונול,104,-220.00',
  ].join('\n');

  const res = parseCsvContent(csv, 'leumi_bank.csv');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.transactions.length, 4);

  const mofet = res.transactions.find((t) => t.merchant.includes('מופת'))!;
  assert.strictEqual(mofet.flowDirection, 'inflow', 'מופת חובה-י gets flowDirection: inflow');
  assert.strictEqual(mofet.amount, 4500);

  const hilan = res.transactions.find((t) => t.merchant.includes('חילן'))!;
  assert.strictEqual(hilan.flowDirection, 'inflow', 'חילן שכר gets flowDirection: inflow');

  const grocery = res.transactions.find((t) => t.merchant.includes('סופרסל'))!;
  assert.strictEqual(grocery.flowDirection, 'outflow', 'סופרסל gets flowDirection: outflow');
  assert.strictEqual(grocery.amount, 350.5);

  const gas = res.transactions.find((t) => t.merchant.includes('סונול'))!;
  assert.strictEqual(gas.flowDirection, 'outflow', 'סונול gets flowDirection: outflow');
});

runTest('CSV bank statement with separate Debit and Credit columns', () => {
  const csv = [
    'תאריך,תיאור,חובה,זכות',
    '2026-09-10,משכורת חברה,,18000.00',
    '2026-09-11,ארנונה עירייה,850.00,',
    '2026-09-12,זיכוי החזר מס,,1200.00',
  ].join('\n');

  const res = parseCsvContent(csv, 'hapoalim_bank.csv');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.transactions.length, 3);

  const salary = res.transactions.find((t) => t.merchant.includes('משכורת'))!;
  assert.strictEqual(salary.flowDirection, 'inflow');

  const tax = res.transactions.find((t) => t.merchant.includes('ארנונה'))!;
  assert.strictEqual(tax.flowDirection, 'outflow');

  const refund = res.transactions.find((t) => t.merchant.includes('החזר מס'))!;
  assert.strictEqual(refund.flowDirection, 'inflow');
});

runTest('CSV with contradictory row where both debit and credit contain amounts -> unknown', () => {
  const csv = [
    'תאריך,תיאור,חובה,זכות',
    '2026-09-10,עסקה שגויה במסמך,500.00,500.00',
  ].join('\n');

  const res = parseCsvContent(csv, 'hapoalim_bank.csv');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.transactions.length, 1);
  assert.strictEqual(res.transactions[0].flowDirection, 'unknown', 'Row with both debit and credit is unknown');
});

runTest('CSV credit card statement: purchase is outflow, refund is inflow', () => {
  const csv = [
    'תאריך,שם בית עסק,סכום חיוב',
    '2026-09-15,קסטרו ביגוד,299.90',
    '2026-09-16,זיכוי קסטרו,-100.00',
  ].join('\n');

  const res = parseCsvContent(csv, 'isracard_statement.csv');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.transactions.length, 2);

  const purchase = res.transactions.find((t) => t.amount === 299.9)!;
  assert.strictEqual(purchase.flowDirection, 'outflow');

  const refund = res.transactions.find((t) => t.amount === 100)!;
  assert.strictEqual(refund.flowDirection, 'inflow');
});

runTest('CSV from unidentified generic file with single amount column -> unknown', () => {
  const csv = [
    'תאריך,פעולה,סכום',
    '2026-09-01,משהו לא מזוהה,300.00',
  ].join('\n');

  const res = parseCsvContent(csv, 'random_data_export.csv');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.transactions.length, 1);
  assert.strictEqual(res.transactions[0].flowDirection, 'unknown');
});

// -------------------------------------------------------------
// Part 3: UI Presentation Helper (getDisplayDirection)
// -------------------------------------------------------------
console.log('\n--- Part 3: Presentation Helper (getDisplayDirection) ---');

runTest('Saved flowDirection takes immediate precedence', () => {
  const txInflow: Transaction = {
    id: 'tx-1',
    date: '2026-10-01',
    amount: 1000,
    currency: 'ILS',
    merchant: 'חנות כללית',
    description: 'קנייה',
    accountId: 'acc-1',
    accountName: 'חשבון',
    paymentMethod: 'bank_transfer',
    category: 'כללי',
    type: 'expense',
    flowDirection: 'inflow', // Explicitly marked as inflow from source
    isRecurring: false,
    confidenceScore: 0.9,
    confidenceLevel: 'high',
    needsReview: false,
    userConfirmed: true,
  };
  assert.strictEqual(getDisplayDirection(txInflow), 'inflow');

  const txOutflow: Transaction = {
    ...txInflow,
    flowDirection: 'outflow',
  };
  assert.strictEqual(getDisplayDirection(txOutflow), 'outflow');

  const txUnknown: Transaction = {
    ...txInflow,
    flowDirection: 'unknown',
  };
  assert.strictEqual(getDisplayDirection(txUnknown), 'unknown');
});

runTest('Fallback for historical transaction with explicit credit text resolves to inflow', () => {
  const legacySalary: Transaction = {
    id: 'tx-legacy-1',
    date: '2026-08-01',
    amount: 3200,
    currency: 'ILS',
    merchant: 'מופ"ת חובה-י',
    description: 'משכורת צבאית',
    accountId: 'acc-1',
    accountName: 'בנק',
    paymentMethod: 'bank_transfer',
    category: 'כללי',
    type: 'expense', // Legacy erroneous classification!
    // No flowDirection field on legacy transaction
    isRecurring: false,
    confidenceScore: 0.5,
    confidenceLevel: 'low',
    needsReview: true,
    userConfirmed: false,
  };

  assert.strictEqual(getDisplayDirection(legacySalary), 'inflow', 'Explicit payroll text safely resolves to inflow');
});

runTest('Fallback for historical transaction with explicit debit text resolves to outflow', () => {
  const legacyAtm: Transaction = {
    id: 'tx-legacy-2',
    date: '2026-08-01',
    amount: 400,
    currency: 'ILS',
    merchant: 'בנק דיסקונט',
    description: 'משיכת מזומן במכשיר',
    accountId: 'acc-1',
    accountName: 'בנק',
    paymentMethod: 'cash',
    category: 'משיכת מזומן',
    type: 'transfer',
    isRecurring: false,
    confidenceScore: 0.8,
    confidenceLevel: 'medium',
    needsReview: false,
    userConfirmed: true,
  };

  assert.strictEqual(getDisplayDirection(legacyAtm), 'outflow', 'Explicit cash withdrawal resolves to outflow');
});

runTest('Fallback for ambiguous historical transaction does NOT guess from type and yields unknown', () => {
  const ambiguousLegacy: Transaction = {
    id: 'tx-legacy-3',
    date: '2026-08-01',
    amount: 150,
    currency: 'ILS',
    merchant: 'חנות כלבו',
    description: 'פעולה מסחרית',
    accountId: 'acc-1',
    accountName: 'בנק',
    paymentMethod: 'credit_card',
    category: 'כללי',
    type: 'expense', // Could be wrong, must not assume '-' sign
    isRecurring: false,
    confidenceScore: 0.4,
    confidenceLevel: 'low',
    needsReview: true,
    userConfirmed: false,
  };

  assert.strictEqual(
    getDisplayDirection(ambiguousLegacy),
    'unknown',
    'Ambiguous legacy transaction yields neutral unknown display'
  );
});

// -------------------------------------------------------------
// Part 4: Safety Invariants & Immutability
// -------------------------------------------------------------
console.log('\n--- Part 4: Safety & Immutability Invariants ---');

runTest('getDisplayDirection is strictly read-only and never mutates transaction', () => {
  const originalTx: Transaction = {
    id: 'tx-freeze-1',
    date: '2026-09-01',
    amount: 99.9,
    currency: 'ILS',
    merchant: 'בדיקת קפיאה',
    description: 'עסקה למניעת שינוי',
    accountId: 'acc-1',
    accountName: 'בנק',
    paymentMethod: 'bank_transfer',
    category: 'כללי',
    type: 'expense',
    isRecurring: false,
    confidenceScore: 0.5,
    confidenceLevel: 'low',
    needsReview: true,
    userConfirmed: false,
  };

  Object.freeze(originalTx);
  const dir = getDisplayDirection(originalTx);
  assert.strictEqual(dir, 'unknown');
  assert.strictEqual(originalTx.type, 'expense', 'Transaction type was untouched');
  assert.strictEqual(originalTx.amount, 99.9, 'Transaction amount was untouched');
});

runTest('Initial demo data transactions are untouched and fully preserved', () => {
  assert(INITIAL_TRANSACTIONS.length > 0, 'Demo transactions exist');
  for (const tx of INITIAL_TRANSACTIONS) {
    assert(tx.amount !== 0, 'Every demo transaction amount is non-zero');
    assert(Math.abs(tx.amount) > 0, 'Absolute amount is positive');
    assert(tx.type, 'Every demo transaction has a valid type');
  }

  // Ensure existing demo refund transaction resolves to inflow display
  const demoRefund = INITIAL_TRANSACTIONS.find((t) => t.id === 'tx-refund-1');
  assert(demoRefund, 'Demo refund tx exists');
  assert.strictEqual(getDisplayDirection(demoRefund), 'inflow');
});

console.log('\n======================================================================');
console.log(`TEST SUITE SUMMARY: ${passed} passed, ${failed} failed`);
console.log('======================================================================');

if (failed > 0) {
  process.exit(1);
}
