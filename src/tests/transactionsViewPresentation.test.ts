import { Transaction } from '../types/financial';
import {
  formatMerchantAndDescription,
  formatAmountColumns,
  getDisplayDirection,
  getCanonicalCategoryName,
  matchesTransactionFilter,
  buildHierarchicalTransactions,
} from '../views/TransactionsView';
import { getFixedExpenseCategories } from '../services/categoriesService';
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

  // --- Group 6: Clean 11 Approved Categories Dropdown & Canonical Names ---
  console.log('\n--- Group 6: Clean 11 Approved Categories Dropdown ---');
  {
    const approvedNames = [
      'מזון וקניות לבית',
      'פארם',
      'היגיינה וטיפוח',
      'רכב ותחבורה',
      'דיור וחשבונות הבית',
      'מסעדות, קפה ומשלוחים',
      'פנאי ובילויים',
      'ביגוד וקניות אישיות',
      'בריאות ורפואה',
      'חופשות ונסיעות',
      'תקשורת ומנויים',
    ];

    const categories = getFixedExpenseCategories().map((c) => c.name);
    assert(categories.length === 11, 'Test 6.1: Exactly 11 categories in dropdown source');
    for (let i = 0; i < approvedNames.length; i++) {
      assert(categories[i] === approvedNames[i], `Test 6.2.${i}: Category ${i + 1} is "${approvedNames[i]}"`);
    }

    // Verify technical/dirty categories are 100% absent
    assert(!categories.includes('עסקה רגילה (כולל דביט)'), 'Test 6.3: "עסקה רגילה (כולל דביט)" is NOT in categories');
    assert(!categories.includes('סייקל חו"ל'), 'Test 6.4: "סייקל חו״ל" is NOT in categories');
    assert(!categories.includes('כללי'), 'Test 6.5: "כללי" is NOT in categories');
    assert(!categories.includes('משיכת מזומן'), 'Test 6.6: "משיכת מזומן" is NOT in categories');

    // Canonical category name resolver
    assert(getCanonicalCategoryName('מזון וסופר') === 'מזון וקניות לבית', 'Test 6.7: Legacy food maps to "מזון וקניות לבית"');
    assert(getCanonicalCategoryName('תקשורת וטכנולוגיה') === 'תקשורת ומנויים', 'Test 6.8: Legacy comm maps to "תקשורת ומנויים"');
    assert(getCanonicalCategoryName('מזון וקניות לבית') === 'מזון וקניות לבית', 'Test 6.9: Direct canonical name remains unchanged');
    assert(getCanonicalCategoryName('עסקה רגילה (כולל דביט)') === '', 'Test 6.10: Technical transaction type is rejected and returns empty');
    assert(getCanonicalCategoryName('סייקל חו״ל') === '', 'Test 6.11: Foreign cycle is rejected and returns empty');
  }

  // --- Group 7: Hierarchical View, Nesting & Filtering Tests (Stage 2) ---
  console.log('\n--- Group 7: Hierarchical View, Nesting & Filtering Tests ---');
  {
    // Setup test dataset: 1 parent bank settlement, 2 child card transactions, 1 standalone bank transaction
    const bankSettlement: Transaction = createBaseTx({
      id: 'settlement-1',
      date: '2026-10-10',
      merchant: 'חיוב כרטיס אשראי ישראכרט',
      description: 'חיוב מרוכז ספטמבר',
      amount: 450,
      flowDirection: 'outflow',
      type: 'transfer',
      isInternalTransfer: true,
      isAggregateSettlement: true,
      reconciliationStatus: 'settlement_matched',
      cardLastDigits: '4567',
      linkedTransactionIds: ['card-tx-1', 'card-tx-2'],
    });

    const cardTx1: Transaction = createBaseTx({
      id: 'card-tx-1',
      date: '2026-09-15',
      merchant: 'קופי טיים',
      description: 'קפה ומאפה',
      category: 'מסעדות, קפה ומשלוחים',
      amount: 50,
      flowDirection: 'outflow',
      type: 'expense',
      parentTransactionId: 'settlement-1',
      reconciliationStatus: 'reconciled',
      sourceDocumentType: 'credit_card_statement',
    });

    const cardTx2: Transaction = createBaseTx({
      id: 'card-tx-2',
      date: '2026-09-20',
      merchant: 'שופרסל שלי',
      description: 'קניות שבועיות',
      category: 'מזון וקניות לבית',
      amount: 400,
      flowDirection: 'outflow',
      type: 'expense',
      parentTransactionId: 'settlement-1',
      reconciliationStatus: 'reconciled',
      sourceDocumentType: 'credit_card_statement',
    });

    const standaloneTx: Transaction = createBaseTx({
      id: 'standalone-tx-1',
      date: '2026-10-01',
      merchant: 'ארנונה עיריית ירושלים',
      description: 'תשלום ארנונה',
      category: 'דיור וחשבונות הבית',
      amount: 800,
      flowDirection: 'outflow',
      type: 'expense',
      sourceDocumentType: 'bank_statement',
    });

    const allTxs = [bankSettlement, cardTx1, cardTx2, standaloneTx];

    // Test 7.1: Confirmed child transactions are strictly excluded from root level
    const defaultItems = buildHierarchicalTransactions(allTxs, '', 'all', 'all', false, 'desc');
    assert(defaultItems.length === 2, 'Test 7.1: Exactly 2 root items (parent settlement + standalone tx, child txs excluded from root)');
    const rootIds = defaultItems.map((item) => item.parent.id);
    assert(rootIds.includes('settlement-1'), 'Test 7.1: Parent settlement is present at root level');
    assert(rootIds.includes('standalone-tx-1'), 'Test 7.1: Standalone transaction is present at root level');
    assert(!rootIds.includes('card-tx-1'), 'Test 7.1: Child tx 1 is NOT present at root level');
    assert(!rootIds.includes('card-tx-2'), 'Test 7.1: Child tx 2 is NOT present at root level');

    // Test 7.2: Parent item contains both child transactions
    const parentItem = defaultItems.find((item) => item.parent.id === 'settlement-1')!;
    assert(parentItem.hasChildren === true, 'Test 7.2: Parent item hasChildren is true');
    assert(parentItem.isConfirmedSettlement === true, 'Test 7.2: Parent item isConfirmedSettlement is true');
    assert(parentItem.children.length === 2, 'Test 7.2: Parent contains exactly 2 children');
    assert(parentItem.children[0].id === 'card-tx-2', 'Test 7.2: Descending sort puts newer card-tx-2 first');
    assert(parentItem.children[1].id === 'card-tx-1', 'Test 7.2: Descending sort puts older card-tx-1 second');

    // Test 7.3: Category filter on child transaction preserves parent context
    const catFilteredItems = buildHierarchicalTransactions(allTxs, '', 'מסעדות, קפה ומשלוחים', 'all', false, 'desc');
    assert(catFilteredItems.length === 1, 'Test 7.3: Exactly 1 parent returned when child matches category filter');
    const filteredParent = catFilteredItems[0];
    assert(filteredParent.parent.id === 'settlement-1', 'Test 7.3: Parent settlement retained as context container');
    assert(filteredParent.matchingChildren.length === 1, 'Test 7.3: Only matching child is returned in matchingChildren');
    assert(filteredParent.matchingChildren[0].id === 'card-tx-1', 'Test 7.3: Matching child is card-tx-1 (קופי טיים)');
    assert(filteredParent.children.length === 2, 'Test 7.3: Full children array is preserved for reference');

    // Test 7.4: Text search on child merchant preserves parent context
    const searchFilteredItems = buildHierarchicalTransactions(allTxs, 'קופי', 'all', 'all', false, 'desc');
    assert(searchFilteredItems.length === 1, 'Test 7.4: Parent returned when child merchant matches text search');
    assert(searchFilteredItems[0].matchingChildren.length === 1, 'Test 7.4: matchingChildren contains 1 match');
    assert(searchFilteredItems[0].matchingChildren[0].merchant === 'קופי טיים', 'Test 7.4: Matched merchant is "קופי טיים"');

    // Test 7.5: Search that matches neither parent nor children excludes parent
    const nonMatchingItems = buildHierarchicalTransactions(allTxs, 'חופשה באילת', 'all', 'all', false, 'desc');
    assert(nonMatchingItems.length === 0, 'Test 7.5: Parent excluded when neither parent nor any child matches search');

    // Test 7.6: Partial / unreconciled / needsReview bank settlement remains standalone root row
    const ambiguousSettlement: Transaction = createBaseTx({
      id: 'ambiguous-settlement',
      date: '2026-10-15',
      merchant: 'חיוב כרטיס אשראי',
      amount: 999,
      flowDirection: 'outflow',
      type: 'expense',
      isInternalTransfer: false,
      isAggregateSettlement: true,
      reconciliationStatus: 'partial',
      needsReview: true,
      reviewReason: 'זוהו שני כרטיסים בעלי סכום זהה',
    });
    const ambiguousItems = buildHierarchicalTransactions([ambiguousSettlement], '', 'all', 'all', false, 'desc');
    assert(ambiguousItems.length === 1, 'Test 7.6: Ambiguous settlement is returned as root item');
    assert(ambiguousItems[0].hasChildren === false, 'Test 7.6: Ambiguous settlement does not have confirmed children');
    assert(ambiguousItems[0].isConfirmedSettlement === false, 'Test 7.6: isConfirmedSettlement is false');
    assert(ambiguousItems[0].parent.needsReview === true, 'Test 7.6: needsReview remains true on ambiguous settlement');

    // Test 7.7: Orphaned child transaction safely appears as root standalone row
    const orphanChild: Transaction = createBaseTx({
      id: 'orphan-card-tx',
      date: '2026-09-25',
      merchant: 'ספוטיפיי',
      category: 'תקשורת ומנויים',
      amount: 29.9,
      parentTransactionId: 'non-existent-parent-id',
      sourceDocumentType: 'credit_card_statement',
    });
    const orphanItems = buildHierarchicalTransactions([orphanChild], '', 'all', 'all', false, 'desc');
    assert(orphanItems.length === 1, 'Test 7.7: Orphan child whose parent is absent is safely shown at root level');
    assert(orphanItems[0].parent.id === 'orphan-card-tx', 'Test 7.7: Orphan child is root item');

    // Test 7.8: Immutability - original transaction properties are untouched
    assert(bankSettlement.amount === 450, 'Test 7.8: Bank settlement amount immutable');
    assert(cardTx1.amount === 50, 'Test 7.8: Child tx amount immutable');
    assert(cardTx1.category === 'מסעדות, קפה ומשלוחים', 'Test 7.8: Child category immutable');
    assert(cardTx1.type === 'expense', 'Test 7.8: Child type immutable');
  }

  console.log('\nTransactions View Presentation Suite: All tests passed successfully.');
}

runTransactionsViewPresentationTests();



