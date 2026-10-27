import {
  reconcileCrossDocumentTransactions,
  isConsolidatedCardSettlement,
  extractCardLastDigits,
} from '../services/reconciliationEngine.js';
import { calculateCashFlowForPeriod } from '../services/financialCalculations.js';
import { Transaction } from '../types/financial.js';

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${testName} - ${detail || ''}`);
    failedCount++;
  }
}

console.log('=== TEST SUITE: Tiered Credit Card Statement Reconciliation & Accounting Protection ===');

// Helper to create synthetic transactions with clean defaults
function createTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: `tx-${Math.random().toString(36).substring(2, 9)}`,
    date: '2026-10-02',
    amount: 100.0,
    currency: 'ILS',
    merchant: 'עסקה לדוגמה',
    description: 'עסקה לדוגמה',
    accountId: 'acc-1',
    accountName: 'חשבון ברירת מחדל',
    paymentMethod: 'credit_card',
    category: 'מזון וקניות לבית',
    type: 'expense',
    isRecurring: false,
    confidenceScore: 0.9,
    confidenceLevel: 'high',
    needsReview: false,
    userConfirmed: true,
    sourceDocument: 'statement.xlsx',
    sourceDocumentType: 'credit_card_statement',
    flowDirection: 'outflow',
    ...overrides,
  };
}

// -------------------------------------------------------------------------
// SCENARIO 1: Match by Card 4 Digits + Total Sum + Billing Date (Tier 1)
// -------------------------------------------------------------------------
console.log('\n--- Scenario 1: Exact Match by Card 4 Digits and Total Sum ---');
{
  const bankSettlement = createTx({
    id: 'bank-settle-1',
    date: '2026-10-02',
    amount: 1000.0,
    merchant: 'חיוב כרטיס לאומי קארד סיומת 1234',
    description: 'חיוב כרטיס לאומי קארד סיומת 1234',
    accountName: 'חשבון עו"ש בנק לאומי',
    accountId: 'acc-bank',
    sourceDocumentType: 'bank_statement',
    paymentMethod: 'direct_debit',
  });

  const cardTx1 = createTx({
    id: 'card-tx-1',
    date: '2026-09-15',
    billingDate: '2026-10-02',
    amount: 400.0,
    merchant: 'שופרסל',
    description: 'שופרסל שלי',
    accountName: 'כרטיס ויזה 1234',
    cardLastDigits: '1234',
    category: 'מזון וקניות לבית',
  });

  const cardTx2 = createTx({
    id: 'card-tx-2',
    date: '2026-09-22',
    billingDate: '2026-10-02',
    amount: 600.0,
    merchant: 'סופר-פארם',
    description: 'סופר פארם סניף דיזנגוף',
    accountName: 'כרטיס ויזה 1234',
    cardLastDigits: '1234',
    category: 'פארם',
  });

  const report = reconcileCrossDocumentTransactions([bankSettlement, cardTx1, cardTx2]);
  const reconciledBank = report.reconciledTransactions.find((t) => t.id === 'bank-settle-1')!;
  const reconciledCard1 = report.reconciledTransactions.find((t) => t.id === 'card-tx-1')!;
  const reconciledCard2 = report.reconciledTransactions.find((t) => t.id === 'card-tx-2')!;

  assert(report.reconciledSettlementsCount === 1, 'Scenario 1: Exactly 1 settlement reconciled');
  assert(report.matchedDetailedTransactionsCount === 2, 'Scenario 1: 2 detailed transactions matched');
  assert(reconciledBank.reconciliationStatus === 'settlement_matched', 'Scenario 1: Bank status is settlement_matched');
  assert(reconciledBank.isInternalTransfer === true, 'Scenario 1: Bank settlement converted to internal transfer');
  assert(reconciledBank.type === 'transfer', 'Scenario 1: Bank settlement type is transfer');
  assert(reconciledBank.isAggregateSettlement === true, 'Scenario 1: Bank settlement is marked as aggregate settlement');
  assert(reconciledBank.cardLastDigits === '1234', 'Scenario 1: Card last digits stored on bank settlement');
  assert(
    Boolean(
      reconciledBank.linkedTransactionIds?.includes('card-tx-1') &&
        reconciledBank.linkedTransactionIds?.includes('card-tx-2')
    ),
    'Scenario 1: Bank settlement links to both child transactions'
  );
  assert(reconciledCard1.reconciliationStatus === 'reconciled', 'Scenario 1: Card tx 1 status is reconciled');
  assert(reconciledCard1.parentTransactionId === 'bank-settle-1', 'Scenario 1: Card tx 1 points to parent settlement');
  assert(reconciledCard1.type === 'expense', 'Scenario 1: Card tx 1 remains an expense');
  assert(reconciledCard2.parentTransactionId === 'bank-settle-1', 'Scenario 1: Card tx 2 points to parent settlement');
}

// -------------------------------------------------------------------------
// SCENARIO 2: Match without Card 4 Digits when Evidence is Unambiguous (Tier 2)
// -------------------------------------------------------------------------
console.log('\n--- Scenario 2: Unambiguous Match Without 4 Card Digits ---');
{
  const bankSettlement = createTx({
    id: 'bank-settle-no-digits',
    date: '2026-10-02',
    amount: 1500.0,
    merchant: 'חיוב כרטיסי אשראי',
    description: 'חיוב כרטיסי אשראי - הוראת קבע',
    accountName: 'חשבון עו"ש בנק הפועלים',
    sourceDocumentType: 'bank_statement',
  });

  const cardTx1 = createTx({
    id: 'card-nodigits-1',
    date: '2026-09-10',
    billingDate: '2026-10-02',
    amount: 1000.0,
    merchant: 'איקאה',
    accountName: 'כרטיס אשראי ללא סיומת',
  });

  const cardTx2 = createTx({
    id: 'card-nodigits-2',
    date: '2026-09-18',
    billingDate: '2026-10-02',
    amount: 500.0,
    merchant: 'רמי לוי',
    accountName: 'כרטיס אשראי ללא סיומת',
  });

  const report = reconcileCrossDocumentTransactions([bankSettlement, cardTx1, cardTx2]);
  const reconciledBank = report.reconciledTransactions.find((t) => t.id === 'bank-settle-no-digits')!;

  assert(report.reconciledSettlementsCount === 1, 'Scenario 2: Single unambiguous statement matched');
  assert(reconciledBank.reconciliationStatus === 'settlement_matched', 'Scenario 2: Status is settlement_matched');
  assert(reconciledBank.isInternalTransfer === true, 'Scenario 2: Converted to internal transfer');
}

// -------------------------------------------------------------------------
// SCENARIO 3: Two Cards with Identical Sum and Date WITHOUT Bank Card Digits (Ambiguity)
// -------------------------------------------------------------------------
console.log('\n--- Scenario 3: Two Cards With Identical Sum - Ambiguity Guard ---');
{
  const bankSettlement = createTx({
    id: 'bank-settle-ambiguous',
    date: '2026-10-02',
    amount: 500.0,
    merchant: 'חיוב כרטיס אשראי',
    description: 'חיוב כרטיס אשראי מרוכז',
    accountName: 'חשבון עו"ש',
    sourceDocumentType: 'bank_statement',
  });

  // Card A ending in 1111 totaling ₪500
  const cardA1 = createTx({
    id: 'card-a-1',
    date: '2026-09-15',
    billingDate: '2026-10-02',
    amount: 500.0,
    merchant: 'חנות א',
    accountName: 'כרטיס א 1111',
    cardLastDigits: '1111',
  });

  // Card B ending in 2222 totaling ₪500
  const cardB1 = createTx({
    id: 'card-b-1',
    date: '2026-09-16',
    billingDate: '2026-10-02',
    amount: 500.0,
    merchant: 'חנות ב',
    accountName: 'כרטיס ב 2222',
    cardLastDigits: '2222',
  });

  const report = reconcileCrossDocumentTransactions([bankSettlement, cardA1, cardB1]);
  const reconciledBank = report.reconciledTransactions.find((t) => t.id === 'bank-settle-ambiguous')!;

  assert(report.reconciledSettlementsCount === 0, 'Scenario 3: Must NOT automatically reconcile ambiguous cards');
  assert(reconciledBank.reconciliationStatus === 'partial', 'Scenario 3: Status is partial (needs review)');
  assert(reconciledBank.needsReview === true, 'Scenario 3: Flagged for user review');
  assert(reconciledBank.isInternalTransfer === false, 'Scenario 3: Accounting guard: remains isInternalTransfer=false');
  assert(reconciledBank.type === 'expense', 'Scenario 3: Accounting guard: remains expense');
  assert(Boolean(reconciledBank.reviewReason?.includes('כרטיסים שונים')), 'Scenario 3: Review reason explains ambiguity');
}

// -------------------------------------------------------------------------
// SCENARIO 4: Two Cards with Identical Sum Disambiguated by Card 4 Digits
// -------------------------------------------------------------------------
console.log('\n--- Scenario 4: Two Cards With Identical Sum Disambiguated by 4 Digits ---');
{
  const bankSettlement = createTx({
    id: 'bank-settle-with-digits',
    date: '2026-10-02',
    amount: 500.0,
    merchant: 'חיוב כרטיס ויזה *1111',
    description: 'חיוב כרטיס ויזה סיומת 1111',
    accountName: 'חשבון עו"ש',
    sourceDocumentType: 'bank_statement',
  });

  const cardA = createTx({
    id: 'card-target-1111',
    date: '2026-09-15',
    billingDate: '2026-10-02',
    amount: 500.0,
    merchant: 'חנות א',
    accountName: 'כרטיס 1111',
    cardLastDigits: '1111',
  });

  const cardB = createTx({
    id: 'card-other-2222',
    date: '2026-09-16',
    billingDate: '2026-10-02',
    amount: 500.0,
    merchant: 'חנות ב',
    accountName: 'כרטיס 2222',
    cardLastDigits: '2222',
  });

  const report = reconcileCrossDocumentTransactions([bankSettlement, cardA, cardB]);
  const reconciledBank = report.reconciledTransactions.find((t) => t.id === 'bank-settle-with-digits')!;
  const reconciledCardA = report.reconciledTransactions.find((t) => t.id === 'card-target-1111')!;
  const reconciledCardB = report.reconciledTransactions.find((t) => t.id === 'card-other-2222')!;

  assert(report.reconciledSettlementsCount === 1, 'Scenario 4: Exactly 1 settlement matched');
  assert(reconciledBank.reconciliationStatus === 'settlement_matched', 'Scenario 4: Bank matched to 1111');
  assert(reconciledBank.isInternalTransfer === true, 'Scenario 4: Bank settlement converted to transfer');
  assert(reconciledCardA.reconciliationStatus === 'reconciled', 'Scenario 4: Card 1111 reconciled');
  assert(reconciledCardA.parentTransactionId === 'bank-settle-with-digits', 'Scenario 4: Card 1111 linked to parent');
  assert(reconciledCardB.reconciliationStatus !== 'reconciled', 'Scenario 4: Card 2222 remains unlinked');
  assert(reconciledCardB.parentTransactionId === undefined, 'Scenario 4: Card 2222 has no parent');
}

// -------------------------------------------------------------------------
// SCENARIO 5: Sum Discrepancy Between Bank Settlement and Card Statement
// -------------------------------------------------------------------------
console.log('\n--- Scenario 5: Sum Discrepancy (e.g. Bank Fee or Installment Adjustment) ---');
{
  const bankSettlement = createTx({
    id: 'bank-settle-disc',
    date: '2026-10-02',
    amount: 1050.0, // 50 ILS discrepancy
    merchant: 'חיוב כרטיס מקס סיומת 3333',
    description: 'חיוב כרטיס מקס סיומת 3333',
    accountName: 'חשבון עו"ש',
    sourceDocumentType: 'bank_statement',
  });

  const cardTx = createTx({
    id: 'card-tx-disc',
    date: '2026-09-20',
    billingDate: '2026-10-02',
    amount: 1000.0,
    merchant: 'קסטרו',
    accountName: 'כרטיס מקס 3333',
    cardLastDigits: '3333',
  });

  const report = reconcileCrossDocumentTransactions([bankSettlement, cardTx]);
  const reconciledBank = report.reconciledTransactions.find((t) => t.id === 'bank-settle-disc')!;

  assert(report.reconciledSettlementsCount === 0, 'Scenario 5: Settlement not reconciled due to sum mismatch');
  assert(reconciledBank.reconciliationStatus === 'partial', 'Scenario 5: Bank marked partial');
  assert(reconciledBank.needsReview === true, 'Scenario 5: Bank flagged needsReview=true');
  assert(reconciledBank.isInternalTransfer === false, 'Scenario 5: Not converted to internal transfer');
  assert(reconciledBank.type === 'expense', 'Scenario 5: Remains an expense');
  assert(Boolean(reconciledBank.reviewReason?.includes('פער סכום')), 'Scenario 5: Review reason specifies sum gap');
}

// -------------------------------------------------------------------------
// SCENARIO 6: Different Billing Cycle (Excessive Date Difference)
// -------------------------------------------------------------------------
console.log('\n--- Scenario 6: Different Billing Cycle (Dates do not match) ---');
{
  const bankSettlement = createTx({
    id: 'bank-settle-nov',
    date: '2026-11-15', // November settlement
    amount: 800.0,
    merchant: 'חיוב כרטיס ישראכרט סיומת 4444',
    description: 'חיוב כרטיס ישראכרט סיומת 4444',
    accountName: 'חשבון עו"ש',
    sourceDocumentType: 'bank_statement',
  });

  const cardTxSept = createTx({
    id: 'card-tx-sept',
    date: '2026-09-02', // September transaction (74 days earlier)
    billingDate: '2026-09-10',
    amount: 800.0,
    merchant: 'דלק מנטה',
    accountName: 'כרטיס ישראכרט 4444',
    cardLastDigits: '4444',
  });

  const report = reconcileCrossDocumentTransactions([bankSettlement, cardTxSept]);
  const reconciledBank = report.reconciledTransactions.find((t) => t.id === 'bank-settle-nov')!;

  assert(report.reconciledSettlementsCount === 0, 'Scenario 6: Different cycle not matched');
  assert(reconciledBank.reconciliationStatus === 'unreconciled', 'Scenario 6: Status is unreconciled');
  assert(reconciledBank.isInternalTransfer === false, 'Scenario 6: Remains isInternalTransfer=false');
  assert(reconciledBank.type === 'expense', 'Scenario 6: Remains expense');
}

// -------------------------------------------------------------------------
// SCENARIO 7: Missing Credit Card Statement File (Accounting Protection)
// -------------------------------------------------------------------------
console.log('\n--- Scenario 7: Missing Credit Card Statement File ---');
{
  const bankSettlement = createTx({
    id: 'bank-settle-orphan',
    date: '2026-10-02',
    amount: 3500.0,
    merchant: 'חיוב כרטיס ויזה כאל',
    description: 'חיוב כרטיס ויזה כאל סיומת 9999',
    accountName: 'חשבון עו"ש',
    sourceDocumentType: 'bank_statement',
    category: '',
  });

  const report = reconcileCrossDocumentTransactions([bankSettlement]);
  const reconciledBank = report.reconciledTransactions.find((t) => t.id === 'bank-settle-orphan')!;

  assert(report.unmatchedSettlementsCount === 1, 'Scenario 7: Exactly 1 unmatched settlement');
  assert(reconciledBank.reconciliationStatus === 'unreconciled', 'Scenario 7: Status is unreconciled');
  assert(reconciledBank.type === 'expense', 'Scenario 7: Remains expense so spending is not lost');
  assert(reconciledBank.isInternalTransfer === false, 'Scenario 7: isInternalTransfer=false');
  assert(
    reconciledBank.category === 'חיוב כרטיס אשראי (ללא פירוט)',
    'Scenario 7: Default fallback category assigned'
  );
  assert(reconciledBank.needsReview === true, 'Scenario 7: needsReview=true');
}

// -------------------------------------------------------------------------
// SCENARIO 8: Refunds Inside Credit Card Statement (Offset Expenses, Not Income)
// -------------------------------------------------------------------------
console.log('\n--- Scenario 8: Refunds Inside Credit Card Statement ---');
{
  // Purchases = 1200, Refund = 200, Net debit = 1000
  const bankSettlement = createTx({
    id: 'bank-settle-refund-test',
    date: '2026-10-02',
    amount: 1000.0,
    merchant: 'חיוב כרטיס מאסטרקארד סיומת 5555',
    description: 'חיוב כרטיס מאסטרקארד סיומת 5555',
    accountName: 'חשבון עו"ש',
    sourceDocumentType: 'bank_statement',
  });

  const cardPurchase1 = createTx({
    id: 'card-purch-1',
    date: '2026-09-12',
    billingDate: '2026-10-02',
    amount: 700.0,
    merchant: 'זארה',
    type: 'expense',
    accountName: 'כרטיס 5555',
    cardLastDigits: '5555',
    category: 'ביגוד וקניות אישיות',
  });

  const cardPurchase2 = createTx({
    id: 'card-purch-2',
    date: '2026-09-18',
    billingDate: '2026-10-02',
    amount: 500.0,
    merchant: 'שילב',
    type: 'expense',
    accountName: 'כרטיס 5555',
    cardLastDigits: '5555',
    category: 'ביגוד וקניות אישיות',
  });

  const cardRefund = createTx({
    id: 'card-refund-1',
    date: '2026-09-25',
    billingDate: '2026-10-02',
    amount: 200.0,
    merchant: 'זארה - זיכוי',
    type: 'refund',
    flowDirection: 'inflow',
    accountName: 'כרטיס 5555',
    cardLastDigits: '5555',
    category: 'ביגוד וקניות אישיות',
    deductsFromExpense: true,
  });

  const report = reconcileCrossDocumentTransactions([bankSettlement, cardPurchase1, cardPurchase2, cardRefund]);
  const reconciledBank = report.reconciledTransactions.find((t) => t.id === 'bank-settle-refund-test')!;
  const reconciledRefund = report.reconciledTransactions.find((t) => t.id === 'card-refund-1')!;

  assert(report.reconciledSettlementsCount === 1, 'Scenario 8: Reconciled with net sum (1200 - 200 = 1000)');
  assert(reconciledBank.reconciliationStatus === 'settlement_matched', 'Scenario 8: Bank settlement matched');
  assert(reconciledBank.isInternalTransfer === true, 'Scenario 8: Bank settlement converted to transfer');
  assert(reconciledRefund.type === 'refund', 'Scenario 8: Child refund remains type=refund');
  assert(reconciledRefund.parentTransactionId === 'bank-settle-refund-test', 'Scenario 8: Refund links to parent');

  // Verify financial calculation behavior
  const cashFlow = calculateCashFlowForPeriod(report.reconciledTransactions, '2026-09');
  assert(cashFlow.income === 0, 'Scenario 8: Refund did NOT inflate income (income is 0)');
  assert(cashFlow.refunds === 200, 'Scenario 8: Refunds total is 200');
  assert(cashFlow.grossExpenses === 1200, 'Scenario 8: Gross expenses are 1200');
  assert(cashFlow.expenses === 1000, 'Scenario 8: Net expenses exactly equal 1000 (matches bank debit)');
}

// -------------------------------------------------------------------------
// SCENARIO 9: Single POS Debit Card Transaction in Bank (Not Consolidated Settlement)
// -------------------------------------------------------------------------
console.log('\n--- Scenario 9: Single POS Debit Transaction in Bank ---');
{
  const debitTx = createTx({
    id: 'bank-pos-debit',
    date: '2026-10-05',
    amount: 85.0,
    merchant: 'סופר פארם',
    description: 'עסקה רגילה (כולל דביט) סופר פארם',
    accountName: 'חשבון עו"ש',
    sourceDocumentType: 'bank_statement',
    paymentMethod: 'direct_debit',
  });

  assert(isConsolidatedCardSettlement(debitTx) === false, 'Scenario 9: POS debit is NOT a consolidated settlement');

  const report = reconcileCrossDocumentTransactions([debitTx]);
  const resultTx = report.reconciledTransactions.find((t) => t.id === 'bank-pos-debit')!;

  assert(resultTx.isInternalTransfer !== true, 'Scenario 9: POS debit is NOT an internal transfer');
  assert(resultTx.type === 'expense', 'Scenario 9: POS debit remains expense');
  assert(resultTx.isAggregateSettlement !== true, 'Scenario 9: POS debit is NOT aggregate settlement');
}

// -------------------------------------------------------------------------
// SCENARIO 10: Idempotency on Repeated Execution
// -------------------------------------------------------------------------
console.log('\n--- Scenario 10: Idempotency on Repeated Execution ---');
{
  const bankSettlement = createTx({
    id: 'bank-idem-1',
    date: '2026-10-02',
    amount: 500.0,
    merchant: 'חיוב כרטיס ויזה 6666',
    description: 'חיוב כרטיס ויזה 6666',
    accountName: 'חשבון עו"ש',
    sourceDocumentType: 'bank_statement',
  });

  const cardTx = createTx({
    id: 'card-idem-1',
    date: '2026-09-20',
    billingDate: '2026-10-02',
    amount: 500.0,
    merchant: 'ארומה',
    accountName: 'כרטיס 6666',
    cardLastDigits: '6666',
  });

  const run1 = reconcileCrossDocumentTransactions([bankSettlement, cardTx]);
  const run2 = reconcileCrossDocumentTransactions(run1.reconciledTransactions);

  const b1 = run1.reconciledTransactions.find((t) => t.id === 'bank-idem-1')!;
  const b2 = run2.reconciledTransactions.find((t) => t.id === 'bank-idem-1')!;

  assert(b1.reconciliationStatus === b2.reconciliationStatus, 'Scenario 10: Status identical across runs');
  assert(b1.isInternalTransfer === b2.isInternalTransfer, 'Scenario 10: isInternalTransfer identical across runs');
  assert(
    b2.linkedTransactionIds?.length === 1 && b2.linkedTransactionIds[0] === 'card-idem-1',
    'Scenario 10: No duplicated linkedTransactionIds on second run'
  );
}

// -------------------------------------------------------------------------
// SCENARIO 11: Double Counting Invariant in Financial Calculations
// -------------------------------------------------------------------------
console.log('\n--- Scenario 11: Double Counting Invariant ---');
{
  // User spent 2500 on card. Bank billed 2500.
  // Total expenses across application must be 2500, NOT 5000!
  const bankSettlement = createTx({
    id: 'bank-double-check',
    date: '2026-10-02',
    amount: 2500.0,
    merchant: 'חיוב כרטיס לאומי קארד סיומת 7777',
    description: 'חיוב כרטיס לאומי קארד סיומת 7777',
    accountName: 'חשבון עו"ש',
    sourceDocumentType: 'bank_statement',
  });

  const cardTx1 = createTx({
    id: 'card-dc-1',
    date: '2026-10-01',
    billingDate: '2026-10-02',
    amount: 1500.0,
    merchant: 'טיסה אל על',
    category: 'חופשות ונסיעות',
    accountName: 'כרטיס 7777',
    cardLastDigits: '7777',
  });

  const cardTx2 = createTx({
    id: 'card-dc-2',
    date: '2026-10-01',
    billingDate: '2026-10-02',
    amount: 1000.0,
    merchant: 'מלון דן',
    category: 'חופשות ונסיעות',
    accountName: 'כרטיס 7777',
    cardLastDigits: '7777',
  });

  const report = reconcileCrossDocumentTransactions([bankSettlement, cardTx1, cardTx2]);
  const cashFlow = calculateCashFlowForPeriod(report.reconciledTransactions, '2026-10');

  assert(
    cashFlow.expenses === 2500.0,
    'Scenario 11: Total net expenses are exactly 2500 (bank settlement excluded, card details included)'
  );
}

// -------------------------------------------------------------------------
// SCENARIO 12: Data Immutability and Provenance Preservation
// -------------------------------------------------------------------------
console.log('\n--- Scenario 12: Data Immutability and Provenance Preservation ---');
{
  const bankSettlement = Object.freeze(
    createTx({
      id: 'bank-frozen',
      date: '2026-10-02',
      amount: 450.0,
      merchant: 'חיוב כרטיס מקס סיומת 8888',
      description: 'חיוב כרטיס מקס סיומת 8888',
      accountName: 'חשבון עו"ש',
      sourceDocumentType: 'bank_statement',
    })
  );

  const cardTx = Object.freeze(
    createTx({
      id: 'card-frozen',
      date: '2026-09-25',
      billingDate: '2026-10-02',
      amount: 450.0,
      merchant: 'בוקסטור',
      accountName: 'כרטיס מקס 8888',
      cardLastDigits: '8888',
    })
  );

  // Must not throw even when input objects are Object.freeze'd
  let report: any;
  let didThrow = false;
  try {
    report = reconcileCrossDocumentTransactions([bankSettlement as any, cardTx as any]);
  } catch (e) {
    didThrow = true;
  }

  assert(!didThrow, 'Scenario 12: Engine does not mutate frozen inputs');
  const reconciledCard = report.reconciledTransactions.find((t: Transaction) => t.id === 'card-frozen')!;
  assert(reconciledCard.date === '2026-09-25', 'Scenario 12: Card transaction purchase date preserved');
  assert(reconciledCard.amount === 450.0, 'Scenario 12: Card transaction amount preserved');
  assert(reconciledCard.merchant === 'בוקסטור', 'Scenario 12: Card merchant preserved');
}

console.log('\n========================================================================');
console.log(`Credit Card Reconciliation Suite Finished: ${passedCount} passed, ${failedCount} failed.`);
console.log('========================================================================\n');

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
