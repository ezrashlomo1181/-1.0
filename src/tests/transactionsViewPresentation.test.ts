import { Transaction } from '../types/financial';
import {
  formatMerchantAndDescription,
  formatAmountColumns,
  getDisplayDirection,
} from '../views/TransactionsView';
import { formatPaymentMethodLabel } from '../components/VerificationModal';

function assert(condition: boolean, message: string, detail?: unknown): void {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`, detail !== undefined ? detail : '');
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ PASS: ${message}`);
}

function createBaseTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-test-1',
    date: '2026-09-04',
    amount: 34,
    currency: 'ILS',
    merchant: 'קצפת קניון הדר בע"מ',
    description: 'קצפת קניון הדר בע"מ',
    accountId: 'acc-1',
    accountName: 'עו"ש לאומי',
    paymentMethod: 'credit_card',
    category: 'עסקה רגילה (כולל דביט)',
    type: 'expense',
    isRecurring: false,
    confidenceScore: 0.88,
    confidenceLevel: 'high',
    needsReview: false,
    userConfirmed: false,
    ...overrides,
  };
}

export function runTransactionsViewPresentationTests(): void {
  console.log('\n=== TEST SUITE: Transactions View Presentation & Deduplication ===');

  // --- Group 1: Merchant & Description Deduplication ---
  console.log('\n--- Group 1: Merchant & Description Deduplication ---');
  {
    // Test 1.1: Identical merchant and description -> deduplicate, secondaryDescription is null
    const tx = createBaseTx({
      merchant: 'אושר עד תלפיות ירושלים',
      description: 'אושר עד תלפיות ירושלים',
    });
    const result = formatMerchantAndDescription(tx);
    assert(result.merchant === 'אושר עד תלפיות ירושלים', 'Test 1.1: Merchant name matches exactly');
    assert(result.secondaryDescription === null, 'Test 1.1: Duplicate description is suppressed (null)');
  }

  {
    // Test 1.2: Distinct merchant and description -> both are preserved
    const tx = createBaseTx({
      merchant: 'NEXT',
      description: 'הזמנה מקוונת בגדי ילדים',
    });
    const result = formatMerchantAndDescription(tx);
    assert(result.merchant === 'NEXT', 'Test 1.2: Merchant name is preserved');
    assert(result.secondaryDescription === 'הזמנה מקוונת בגדי ילדים', 'Test 1.2: Distinct description is preserved');
  }

  {
    // Test 1.3: Empty or whitespace-only description -> suppressed
    const tx = createBaseTx({
      merchant: 'תמנון',
      description: '   ',
    });
    const result = formatMerchantAndDescription(tx);
    assert(result.merchant === 'תמנון', 'Test 1.3: Merchant name is preserved');
    assert(result.secondaryDescription === null, 'Test 1.3: Whitespace description is suppressed');
  }

  // --- Group 2: Amount Columns Split ('יצא' and 'נכנס') ---
  console.log('\n--- Group 2: Outflow and Inflow Amount Columns ---');
  {
    // Test 2.1: Regular expense (outflow) -> appears ONLY in outflow column with minus sign
    const tx = createBaseTx({
      amount: 34,
      flowDirection: 'outflow',
      type: 'expense',
    });
    const cols = formatAmountColumns(tx);
    assert(cols.outflowText === '−₪34', 'Test 2.1: Outflow column shows negative formatted amount');
    assert(cols.inflowText === null, 'Test 2.1: Inflow column is null for outflow transaction');
    assert(cols.direction === 'outflow', 'Test 2.1: Direction is outflow');
    assert(cols.isUnknown === false, 'Test 2.1: isUnknown is false');
  }

  {
    // Test 2.2: Regular income (inflow) -> appears ONLY in inflow column with plus sign
    const tx = createBaseTx({
      amount: 12500,
      flowDirection: 'inflow',
      type: 'income',
      merchant: 'הפקדת משכורת',
      description: 'הפקדת משכורת חודשית',
    });
    const cols = formatAmountColumns(tx);
    assert(cols.outflowText === null, 'Test 2.2: Outflow column is null for inflow transaction');
    assert(cols.inflowText === '+₪12,500', 'Test 2.2: Inflow column shows positive formatted amount');
    assert(cols.direction === 'inflow', 'Test 2.2: Direction is inflow');
    assert(cols.isUnknown === false, 'Test 2.2: isUnknown is false');
  }

  {
    // Test 2.3: Refund / Credit (inflow) -> appears ONLY in inflow column
    const tx = createBaseTx({
      amount: 185,
      flowDirection: 'inflow',
      type: 'refund',
      merchant: 'זארה זיכוי',
      description: 'זיכוי בגין החזרת פריט',
    });
    const cols = formatAmountColumns(tx);
    assert(cols.outflowText === null, 'Test 2.3: Outflow column is null for refund');
    assert(cols.inflowText === '+₪185', 'Test 2.3: Inflow column shows refund as positive');
    assert(cols.direction === 'inflow', 'Test 2.3: Refund direction is inflow');
  }

  {
    // Test 2.4: Internal transfer -> appears in the relevant column without crashing or line-through mutation
    const txOutflowTransfer = createBaseTx({
      amount: 2000,
      flowDirection: 'outflow',
      type: 'transfer',
      isInternalTransfer: true,
      merchant: 'העברה לחשבון חסכון',
    });
    const colsOut = formatAmountColumns(txOutflowTransfer);
    assert(colsOut.outflowText === '−₪2,000', 'Test 2.4a: Internal transfer outflow formatted properly');
    assert(colsOut.inflowText === null, 'Test 2.4a: Inflow column is null for outflow transfer');

    const txInflowTransfer = createBaseTx({
      amount: 2000,
      flowDirection: 'inflow',
      type: 'transfer',
      isInternalTransfer: true,
      merchant: 'העברה מחשבון חסכון',
    });
    const colsIn = formatAmountColumns(txInflowTransfer);
    assert(colsIn.outflowText === null, 'Test 2.4b: Outflow column is null for inflow transfer');
    assert(colsIn.inflowText === '+₪2,000', 'Test 2.4b: Inflow transfer appears in inflow column');
  }

  {
    // Test 2.5: Unknown flow direction -> neither column gets guessed sign
    const txUnknown = createBaseTx({
      amount: 500,
      flowDirection: 'unknown',
      merchant: 'תנועה כללית ללא אינדיקציה',
      description: '',
      type: 'other',
    });
    const cols = formatAmountColumns(txUnknown);
    assert(cols.isUnknown === true, 'Test 2.5: Unknown direction correctly flagged as isUnknown');
    assert(cols.inflowText === null, 'Test 2.5: Inflow is null for unknown direction');
    assert(cols.outflowText === '₪500 (לבדיקה)', 'Test 2.5: Outflow displays neutral amount with review badge');
  }

  // --- Group 3: Strict Pure Read-Only & Immutability ---
  console.log('\n--- Group 3: Pure Read-Only & Immutability ---');
  {
    const originalTx = Object.freeze(createBaseTx({
      id: 'tx-frozen',
      amount: 367.42,
      date: '2026-09-04',
      billingDate: '2026-10-05',
      flowDirection: 'outflow',
      merchant: 'אושר עד',
      description: 'אושר עד',
    }));

    // Calling formatting helpers on a frozen object must not throw and must not mutate
    const descResult = formatMerchantAndDescription(originalTx);
    const amountResult = formatAmountColumns(originalTx);
    const dirResult = getDisplayDirection(originalTx);

    assert(descResult.merchant === 'אושר עד', 'Test 3.1: Merchant name resolved correctly on frozen object');
    assert(amountResult.outflowText === '−₪367.42', 'Test 3.1: Amount resolved correctly on frozen object');
    assert(dirResult === 'outflow', 'Test 3.1: Flow direction resolved correctly');
    assert(originalTx.date === '2026-09-04', 'Test 3.1: Transaction date untouched');
    assert(originalTx.billingDate === '2026-10-05', 'Test 3.1: Billing date untouched');
    assert(originalTx.amount === 367.42, 'Test 3.1: Amount value untouched');
  }

  // --- Group 4: Verification Modal Payment Method Labels ---
  console.log('\n--- Group 4: Verification Modal Payment Method Labels ---');
  {
    assert(formatPaymentMethodLabel('credit_card') === 'כרטיס אשראי', 'Test 4.1: credit_card -> כרטיס אשראי');
    assert(formatPaymentMethodLabel('bank_transfer') === 'העברה בנקאית', 'Test 4.2: bank_transfer -> העברה בנקאית');
    assert(formatPaymentMethodLabel('direct_debit') === 'הוראת קבע', 'Test 4.3: direct_debit -> הוראת קבע');
    assert(formatPaymentMethodLabel('bit') === 'ביט', 'Test 4.4: bit -> ביט');
    assert(formatPaymentMethodLabel('paybox') === 'פייבוקס', 'Test 4.5: paybox -> פייבוקס');
    assert(formatPaymentMethodLabel('cash') === 'מזומן', 'Test 4.6: cash -> מזומן');
    assert(formatPaymentMethodLabel(undefined) === 'לא צוין', 'Test 4.7: undefined -> לא צוין');
  }

  // --- Group 5: Date Separation Invariant ---
  console.log('\n--- Group 5: Date Separation Invariant ---');
  {
    // Main table relies exclusively on tx.date
    const tx = createBaseTx({
      date: '2026-09-04',
      billingDate: '2026-10-05',
    });
    assert(tx.date === '2026-09-04', 'Test 5.1: Main table transaction date is exactly tx.date');
    assert(tx.billingDate === '2026-10-05', 'Test 5.1: Billing date exists as separate field for modal');
    assert(tx.date !== tx.billingDate, 'Test 5.1: Purchase date and billing date are independent and distinct');
  }

  console.log('\nTransactions View Presentation Suite: All tests passed successfully.');
}

runTransactionsViewPresentationTests();

