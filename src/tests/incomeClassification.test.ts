import assert from 'assert';
import {
  classifyTransactionSemantics,
  validateAndFixTransactionCombination,
  matchLearnedRule,
} from '../services/classificationEngine';
import {
  calculateCashFlowForPeriod,
} from '../services/financialCalculations';
import { Transaction, LearnedRule } from '../types/financial';
import { INITIAL_TRANSACTIONS } from '../data/demoData';
import { parseCsvContent } from '../services/documentParser';

console.log('\n=== TEST SUITE: Income, Salary & Inflow Classification (Phase B.2.4) ===');

let passedTests = 0;
let failedTests = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    failedTests++;
  }
}

// -----------------------------------------------------------------------------
// Group A: הפקדת משכורת עם המילה "משכורת"
// -----------------------------------------------------------------------------
console.log('\n--- Group A: Salary deposit with explicit "משכורת" ---');

runTest('A.1: Salary in checking is classified as income with high confidence', () => {
  const res = classifyTransactionSemantics({
    merchant: 'חברת הייטק בע״מ - שכר עבודה',
    description: 'הפקדת משכורת חודש אוגוסט',
    isCreditRow: true,
    isCreditCardSource: false,
  });

  assert.strictEqual(res.type, 'income');
  assert.strictEqual(res.category, 'משכורת והכנסות');
  assert.strictEqual(res.needsReview, false);
  assert.strictEqual(res.confidenceLevel, 'high');
});

runTest('A.2: "הפקדת שכר" in checking is classified as income', () => {
  const res = classifyTransactionSemantics({
    merchant: 'אלפא פתרונות בע"מ',
    description: 'הפקדת שכר עבודה נטו',
    isCreditRow: true,
    isCreditCardSource: false,
  });

  assert.strictEqual(res.type, 'income');
  assert.strictEqual(res.category, 'משכורת והכנסות');
  assert.strictEqual(res.needsReview, false);
});

// -----------------------------------------------------------------------------
// Group B: הפקדה המתוארת כ"מופ"ת חובה-י"
// -----------------------------------------------------------------------------
console.log('\n--- Group B: Deposit described as "מופ"ת חובה-י" ---');

runTest('B.1: "מופ"ת חובה-י" in bank checking is recognized as income, NOT refund', () => {
  const res = classifyTransactionSemantics({
    merchant: 'מופ"ת חובה-י',
    description: 'זיכוי מופת',
    isCreditRow: true,
    isCreditCardSource: false,
  });

  assert.strictEqual(res.type, 'income', 'מופ"ת חייב להיות מסווג כ-income ולא כ-refund');
  assert.strictEqual(res.category, 'משכורת והכנסות');
  assert.strictEqual(res.needsReview, false);
});

runTest('B.2: Alternative spelling "מופת" or "מת"ש" in checking is recognized as income', () => {
  const resMofet = classifyTransactionSemantics({
    merchant: 'מופת שכר צהל',
    description: 'זיכוי קבע',
    isCreditRow: true,
    isCreditCardSource: false,
  });
  assert.strictEqual(resMofet.type, 'income');

  const resMatash = classifyTransactionSemantics({
    merchant: 'מת"ש מילואים',
    description: 'תגמול מילואים',
    isCreditRow: true,
    isCreditCardSource: false,
  });
  assert.strictEqual(resMatash.type, 'income');
});

// -----------------------------------------------------------------------------
// Group C: זיכוי בנקאי המכיל "זיכוי מס"ב"
// -----------------------------------------------------------------------------
console.log('\n--- Group C: Bank credit containing "זיכוי מס"ב" ---');

runTest('C.1: "זיכוי מס"ב" in bank checking is recognized as income, NOT refund', () => {
  const res = classifyTransactionSemantics({
    merchant: 'זיכוי מס"ב',
    description: 'זיכוי מס"ב 12345678',
    isCreditRow: true,
    isCreditCardSource: false,
  });

  assert.strictEqual(res.type, 'income', 'זיכוי מס"ב בעו"ש חייב להיות מסווג כ-income ולא כ-refund');
  assert.strictEqual(res.category, 'משכורת והכנסות');
  assert.strictEqual(res.needsReview, false);
});

runTest('C.2: Variations "מסב", "חילן", "מלם שכר" in bank checking are recognized as income', () => {
  const resHilan = classifyTransactionSemantics({
    merchant: 'חילן שכר בע"מ',
    description: 'זיכוי חילן חודשי',
    isCreditRow: true,
    isCreditCardSource: false,
  });
  assert.strictEqual(resHilan.type, 'income');

  const resMalam = classifyTransactionSemantics({
    merchant: 'מלם שכר',
    description: 'העברת מלם',
    isCreditRow: true,
    isCreditCardSource: false,
  });
  assert.strictEqual(resMalam.type, 'income');
});

// -----------------------------------------------------------------------------
// Group D: זיכוי רכישה בכרטיס אשראי
// -----------------------------------------------------------------------------
console.log('\n--- Group D: Purchase credit in credit card statement ---');

runTest('D.1: Supermarket credit in credit card statement is classified as refund', () => {
  const res = classifyTransactionSemantics({
    merchant: 'שופרסל דיל',
    description: 'זיכוי בגין פריט חסר',
    isCreditRow: true,
    isCreditCardSource: true,
  });

  assert.strictEqual(res.type, 'refund');
  assert.strictEqual(res.category, 'מזון וקניות לבית');
  assert.strictEqual(res.needsReview, false);
});

runTest('D.2: Negative amount on credit card with consumer merchant is classified as refund', () => {
  const res = classifyTransactionSemantics({
    merchant: 'סופר פארם',
    description: 'זיכוי כרטיס',
    amountIsNegative: true,
    isCreditCardSource: true,
  });

  assert.strictEqual(res.type, 'refund');
  assert.strictEqual(res.category, 'פארם');
  assert.strictEqual(res.needsReview, false);
});

// -----------------------------------------------------------------------------
// Group E: החזר מחנות אופנה
// -----------------------------------------------------------------------------
console.log('\n--- Group E: Refund from a fashion store ---');

runTest('E.1: Zara credit card refund is classified as refund reducing clothing expenses', () => {
  const res = classifyTransactionSemantics({
    merchant: 'זארה קניון רמת אביב',
    description: 'זיכוי כרטיס אשראי',
    isCreditRow: true,
    isCreditCardSource: true,
  });

  assert.strictEqual(res.type, 'refund');
  assert.strictEqual(res.category, 'ביגוד וקניות אישיות');
  assert.strictEqual(res.needsReview, false);
});

// -----------------------------------------------------------------------------
// Group F: הפקדה מגוף ששמו כולל "גולף", ללא הנחה מוקדמת שמדובר בשכר או בהחזר
// -----------------------------------------------------------------------------
console.log('\n--- Group F: Bank checking inflow from "קבוצת גולף" ---');

runTest('F.1: "קבוצת גולף-י" in bank checking goes to review as "other", NOT refund or income', () => {
  const res = classifyTransactionSemantics({
    merchant: 'קבוצת גולף-י',
    description: 'זיכוי העברה',
    isCreditRow: true,
    isCreditCardSource: false, // Bank checking account!
  });

  assert.strictEqual(res.type, 'other', 'בעו"ש אין להניח שגוף צרכני הוא בהכרח החזר קנייה');
  assert.strictEqual(res.needsReview, true);
  assert.strictEqual(res.category, 'אחר / לבירור');
  assert(res.reviewReason && res.reviewReason.includes('קבוצת גולף-י'));
});

runTest('F.2: "קבוצת גולף-י" in cash flow calculation does NOT increase income and does NOT reduce expenses before review', () => {
  const dummyTx: Transaction = {
    id: 'tx-golf-test',
    date: '2026-09-09',
    amount: 1472.8,
    currency: 'ILS',
    merchant: 'קבוצת גולף-י',
    description: 'זיכוי העברה',
    accountId: 'acc-hapoalim',
    accountName: 'עו"ש פועלים',
    paymentMethod: 'bank_transfer',
    category: 'אחר / לבירור',
    type: 'other',
    isRecurring: false,
    confidenceScore: 0.5,
    confidenceLevel: 'medium',
    needsReview: true,
    userConfirmed: false,
  };

  const cashFlow = calculateCashFlowForPeriod([dummyTx], '2026-09');
  assert.strictEqual(cashFlow.income, 0, 'תנועה לא ודאית (other) לא נספרת כהכנסה');
  assert.strictEqual(cashFlow.refunds, 0, 'תנועה לא ודאית (other) לא מפחיתה הוצאות כ-refund');
});

// -----------------------------------------------------------------------------
// Group G: העברה בין חשבונות שאינה הכנסה
// -----------------------------------------------------------------------------
console.log('\n--- Group G: Inter-account transfer that is not income ---');

runTest('G.1: Incoming transfer mentioning "בנק מזרחי" in checking requires verification and is NOT income', () => {
  const res = classifyTransactionSemantics({
    merchant: 'בנק מזרחי',
    description: 'זיכוי העברה בנק מזרחי',
    isCreditRow: true,
    isCreditCardSource: false,
  });

  assert.strictEqual(res.type, 'other', 'העברה מבנק אחר אינה הכנסה ודאית');
  assert.strictEqual(res.category, 'העברות ומזומן');
  assert.strictEqual(res.needsReview, true);
});

runTest('G.2: Explicit self-transfer is transfer, not income', () => {
  const res = classifyTransactionSemantics({
    merchant: 'העברה בין חשבונות',
    description: 'העברה עצמית מחיסכון',
    isCreditRow: true,
    isCreditCardSource: false,
  });

  assert.strictEqual(res.type, 'transfer');
  assert.strictEqual(res.isInternalTransfer, true);
  assert.strictEqual(res.needsReview, false);
});

// -----------------------------------------------------------------------------
// Group H: תיקון ידני של תנועה מ-refund/other ל-income, כולל השפעה על הדוחות ושמירת כלל
// -----------------------------------------------------------------------------
console.log('\n--- Group H: Manual resolution from refund/other to income ---');

runTest('H.1: Resolving a transaction to salary updates type to income and reflects in reports', () => {
  // Initial state: unverified transaction with type 'other'
  const initialTx: Transaction = {
    id: 'tx-resolve-1',
    date: '2026-09-01',
    amount: 2872.65,
    currency: 'ILS',
    merchant: 'מופ"ת חובה-י',
    description: 'זיכוי',
    accountId: 'acc-hapoalim',
    accountName: 'בנק הפועלים',
    paymentMethod: 'bank_transfer',
    category: 'אחר / לבירור',
    type: 'other',
    isRecurring: false,
    confidenceScore: 0.5,
    confidenceLevel: 'low',
    needsReview: true,
    userConfirmed: false,
  };

  const beforeFlow = calculateCashFlowForPeriod([initialTx], '2026-09');
  assert.strictEqual(beforeFlow.income, 0);

  // User resolves via VerificationModal logic
  const resolvedTx: Transaction = {
    ...initialTx,
    category: 'משכורת והכנסות',
    type: 'income',
    isInternalTransfer: false,
    needsReview: false,
    userConfirmed: true,
    confidenceScore: 1.0,
    confidenceLevel: 'high',
  };

  const afterFlow = calculateCashFlowForPeriod([resolvedTx], '2026-09');
  assert.strictEqual(afterFlow.income, 2873, 'הכנסה מעודכנת בדוחות לאחר אישור משתמש');
  assert.strictEqual(afterFlow.refunds, 0);
});

runTest('H.2: Learned rule is created with assignedType: income and correctly classifies next occurrence', () => {
  const learnedRule: LearnedRule = {
    id: 'rule-test-mofet',
    pattern: 'מופ"ת חובה-י',
    applyTo: 'all_similar',
    assignedCategory: 'משכורת והכנסות',
    assignedType: 'income',
    createdAt: '2026-09-01',
    userPromptBasis: 'אישור משתמש עבור מופ"ת חובה-י',
    timesApplied: 1,
  };

  // Next month transaction arrives
  const nextMonthTxResult = classifyTransactionSemantics({
    merchant: 'מופ"ת חובה-י',
    description: 'תשלום שכר',
    isCreditRow: true,
    isCreditCardSource: false,
    customRules: [learnedRule],
  });

  assert.strictEqual(nextMonthTxResult.isUserRule, true);
  assert.strictEqual(nextMonthTxResult.type, 'income');
  assert.strictEqual(nextMonthTxResult.category, 'משכורת והכנסות');
  assert.strictEqual(nextMonthTxResult.needsReview, false);
});

// -----------------------------------------------------------------------------
// Group I: טעינה מחדש של האפליקציה לאחר התיקון, כדי לוודא שהסיווג נשמר
// -----------------------------------------------------------------------------
console.log('\n--- Group I: Reload simulation & serialization persistence ---');

runTest('I.1: Transaction state serializes to JSON and retains income type upon restore', () => {
  const resolvedTx: Transaction = {
    id: 'tx-persisted-1',
    date: '2026-09-01',
    amount: 1474,
    currency: 'ILS',
    merchant: 'נווה דניאל-כ-י',
    description: 'זיכוי',
    accountId: 'acc-hapoalim',
    accountName: 'בנק הפועלים',
    paymentMethod: 'bank_transfer',
    category: 'משכורת והכנסות',
    type: 'income',
    isRecurring: false,
    confidenceScore: 1.0,
    confidenceLevel: 'high',
    needsReview: false,
    userConfirmed: true,
  };

  const serialized = JSON.stringify([resolvedTx]);
  const restored: Transaction[] = JSON.parse(serialized);

  assert.strictEqual(restored.length, 1);
  assert.strictEqual(restored[0].type, 'income');
  assert.strictEqual(restored[0].category, 'משכורת והכנסות');
  assert.strictEqual(restored[0].userConfirmed, true);
  assert.strictEqual(restored[0].needsReview, false);

  const flow = calculateCashFlowForPeriod(restored, '2026-09');
  assert.strictEqual(flow.income, 1474);
});

// -----------------------------------------------------------------------------
// Group J: בדיקת עסקאות קיימות לוודא שלא חל בהן שינוי לא מכוון
// -----------------------------------------------------------------------------
console.log('\n--- Group J: Existing demo transactions integrity ---');

runTest('J.1: Initial demo data transactions preserve their types and classifications', () => {
  const incomeTxs = INITIAL_TRANSACTIONS.filter((t) => t.type === 'income');
  const transferTxs = INITIAL_TRANSACTIONS.filter((t) => t.type === 'transfer');
  const expenseTxs = INITIAL_TRANSACTIONS.filter((t) => t.type === 'expense');

  assert(incomeTxs.length > 0, 'קיימות עסקאות הכנסה בנתוני הדמו המקוריים');
  assert(transferTxs.length > 0, 'קיימות העברות פנימיות בנתוני הדמו המקוריים');
  assert(expenseTxs.length > 0, 'קיימות עסקאות הוצאה בנתוני הדמו המקוריים');

  // Verify specific high-tech salary
  const highTechSalary = INITIAL_TRANSACTIONS.find((t) => t.id === 'tx-income-1');
  assert(highTechSalary);
  assert.strictEqual(highTechSalary.type, 'income');
  assert.strictEqual(highTechSalary.amount, 22400);

  // Verify internal transfer
  const cardSettlementTransfer = INITIAL_TRANSACTIONS.find((t) => t.id === 'tx-transfer-1');
  assert(cardSettlementTransfer);
  assert.strictEqual(cardSettlementTransfer.type, 'transfer');
  assert.strictEqual(cardSettlementTransfer.isInternalTransfer, true);
});

// -----------------------------------------------------------------------------
// Group K: שלב ב׳.2.5 — תיקון ממוקד לבאג סיווג משכורות כהוצאות (תרחישים 1–9)
// -----------------------------------------------------------------------------
console.log('\n--- Group K: Stage B.2.5 Comprehensive Regression Scenarios ---');

runTest('K.1 (Scenario 1): Salary in bank checking with isCreditRow=false is classified as income', () => {
  const res = classifyTransactionSemantics({
    merchant: 'מופ"ת חובה-י',
    description: 'הפקדת קצבה / שכר',
    isCreditRow: false, // In single-amount columns or raw calls, isCreditRow starts as false
    isCreditCardSource: false,
  });

  assert.strictEqual(res.type, 'income', 'משכורת מזוהה בעו"ש חייבת להיות income גם אם isCreditRow=false');
  assert.strictEqual(res.category, 'משכורת והכנסות');
  assert.strictEqual(res.needsReview, false);
});

runTest('K.2 (Scenario 2): Salary with generic raw category "כללי" gets overridden to "משכורת והכנסות"', () => {
  const res = classifyTransactionSemantics({
    merchant: 'מופ"ת חובה-י',
    description: 'זיכוי',
    rawCategory: 'כללי',
    isCreditRow: false,
    isCreditCardSource: false,
  });

  assert.strictEqual(res.type, 'income');
  assert.strictEqual(res.category, 'משכורת והכנסות', 'קטגוריית "כללי" נדרסת לקטגוריית "משכורת והכנסות"');
  assert.strictEqual(res.needsReview, false);
});

runTest('K.3 (Scenario 3): End-to-end CSV import with single amount column (positive salary & negative expense)', () => {
  const csvContent = [
    'תאריך,תיאור פעולה,אסמכתא,סכום,קטגוריה',
    '2026-09-01,מופת חובה-י,1001,2872.65,כללי',
    '2026-09-02,שופרסל דיל סניף 4,1002,-450.00,כללי',
    '2026-09-03,חילן שכר עבודה,1003,15000.00,',
  ].join('\n');

  const parsed = parseCsvContent(csvContent, 'leumi_bank_statement.csv');
  assert.strictEqual(parsed.success, true);
  assert.strictEqual(parsed.transactions.length, 3);

  const salaryTx = parsed.transactions.find((t) => t.merchant.includes('מופת'));
  assert(salaryTx, 'נמצאה עסקת מופת');
  assert.strictEqual(salaryTx.type, 'income', 'עסקת מופת מסווגת כ-income');
  assert.strictEqual(salaryTx.category, 'משכורת והכנסות', 'עסקת מופת מסווגת כמשכורת והכנסות ולא כללי');
  assert.strictEqual(salaryTx.amount, 2872.65);

  const hilanTx = parsed.transactions.find((t) => t.merchant.includes('חילן'));
  assert(hilanTx, 'נמצאה עסקת חילן');
  assert.strictEqual(hilanTx.type, 'income');
  assert.strictEqual(hilanTx.category, 'משכורת והכנסות');
  assert.strictEqual(hilanTx.amount, 15000);

  const groceryTx = parsed.transactions.find((t) => t.merchant.includes('שופרסל'));
  assert(groceryTx, 'נמצאה עסקת שופרסל');
  assert.strictEqual(groceryTx.type, 'expense');
  assert.strictEqual(groceryTx.category, 'מזון וקניות לבית');
  assert.strictEqual(groceryTx.amount, 450);

  // Overall parser totals
  assert.strictEqual(parsed.totalIncome, 17872.65, 'סה"כ הכנסות כולל את שתי המשכורות');
  assert.strictEqual(parsed.totalExpense, 450, 'סה"כ הוצאות כולל רק את שופרסל');
});

runTest('K.4 (Scenario 4): Normal expense with negative amount remains expense with proper category', () => {
  const res = classifyTransactionSemantics({
    merchant: 'חברת חשמל לישראל',
    description: 'תשלום חשבון תקופתי',
    amountIsNegative: true,
    isCreditCardSource: false,
  });

  assert.strictEqual(res.type, 'expense');
  assert.strictEqual(res.category, 'דיור וחשבונות הבית');
  assert.strictEqual(res.needsReview, false);
});

runTest('K.5 (Scenario 5): Credit card consumer refund reduces expenses, not income', () => {
  const res = classifyTransactionSemantics({
    merchant: 'קסטרו קניון השרון',
    description: 'זיכוי רכישה קסטרו',
    isCreditRow: true,
    isCreditCardSource: true,
  });

  assert.strictEqual(res.type, 'refund');
  assert.strictEqual(res.category, 'ביגוד וקניות אישיות');
  assert.strictEqual(res.needsReview, false);
});

runTest('K.6 (Scenario 6): Positive bank inflow with ambiguous inter-bank transfer is NOT auto-classified as income', () => {
  const res = classifyTransactionSemantics({
    merchant: 'בנק דיסקונט לישראל',
    description: 'העברה נכנסת',
    isCreditRow: false,
    isCreditCardSource: false,
  });

  assert.notStrictEqual(res.type, 'income', 'העברה מבנק אחר אינה הכנסה אוטומטית');
  assert.strictEqual(res.type, 'other');
  assert.strictEqual(res.category, 'העברות ומזומן');
  assert.strictEqual(res.needsReview, true);
});

runTest('K.7 (Scenario 7): Learned rule protection & user customization consistency', () => {
  // 1. Verify an expense rule for a store doesn't turn a salary into an expense
  const sampleRules: LearnedRule[] = [
    {
      id: 'rule-generic-exp',
      pattern: 'קניות',
      applyTo: 'all_similar',
      assignedCategory: 'ביגוד וקניות אישיות',
      assignedType: 'expense',
      createdAt: '2026-05-10',
      userPromptBasis: 'אישור משתמש',
      timesApplied: 1,
    },
  ];

  const salaryRes = classifyTransactionSemantics({
    merchant: 'מת"ש צה"ל - שכר',
    description: 'משכורת חודשית',
    isCreditRow: false,
    isCreditCardSource: false,
    customRules: sampleRules,
  });

  assert.strictEqual(salaryRes.type, 'income');
  assert.strictEqual(salaryRes.category, 'משכורת והכנסות');

  // 2. An explicit user income rule is honored
  const customIncomeRules: LearnedRule[] = [
    {
      id: 'rule-freelance',
      pattern: 'לקוח פרטי',
      applyTo: 'all_similar',
      assignedCategory: 'משכורת והכנסות',
      assignedType: 'income',
      createdAt: '2026-05-10',
      userPromptBasis: 'אישור משתמש עבור הכנסת פרילנס',
      timesApplied: 1,
    },
  ];

  const freelanceRes = classifyTransactionSemantics({
    merchant: 'לקוח פרטי ישראל',
    description: 'תשלום פרויקט',
    isCreditRow: false,
    isCreditCardSource: false,
    customRules: customIncomeRules,
  });

  assert.strictEqual(freelanceRes.type, 'income');
  assert.strictEqual(freelanceRes.category, 'משכורת והכנסות');
});

runTest('K.8 (Scenario 8): Cash flow calculations, UI amount sign & serialization fidelity', () => {
  const mofetTx: Transaction = {
    id: 'tx-mofet-k8',
    date: '2026-09-01',
    amount: 2872.65,
    currency: 'ILS',
    merchant: 'מופ"ת חובה-י',
    description: 'זיכוי שכר',
    accountId: 'acc-poalim',
    accountName: 'פועלים עו"ש',
    paymentMethod: 'bank_transfer',
    category: 'משכורת והכנסות',
    type: 'income',
    isRecurring: false,
    confidenceScore: 0.95,
    confidenceLevel: 'high',
    needsReview: false,
    userConfirmed: true,
  };

  const expenseTx: Transaction = {
    id: 'tx-exp-k8',
    date: '2026-09-02',
    amount: 450.0,
    currency: 'ILS',
    merchant: 'שופרסל דיל',
    description: 'קניות מזון',
    accountId: 'acc-poalim',
    accountName: 'פועלים עו"ש',
    paymentMethod: 'credit_card',
    category: 'מזון וקניות לבית',
    type: 'expense',
    isRecurring: false,
    confidenceScore: 0.95,
    confidenceLevel: 'high',
    needsReview: false,
    userConfirmed: true,
  };

  // 1. Cash flow computation
  const flow = calculateCashFlowForPeriod([mofetTx, expenseTx], '2026-09');
  assert.strictEqual(flow.income, Math.round(2872.65), 'המשכורת נכללת ב-totalIncome');
  assert.strictEqual(flow.expenses, 450.0, 'המשכורת אינה מתווספת להוצאות');
  assert.strictEqual(flow.netCashFlow, Math.round(2872.65 - 450.0), 'תזרים נקי חיובי');

  // 2. UI Display format simulation (as in TransactionsView.tsx line 279)
  const formatTxDisplay = (t: Transaction) => {
    const sign = t.type === 'income' ? '+' : t.type === 'refund' ? 'זיכוי +' : '-';
    return `${sign}₪${Math.abs(t.amount).toLocaleString()}`;
  };

  assert.strictEqual(formatTxDisplay(mofetTx), '+₪2,872.65', 'מוצג עם סימן פלוס');
  assert.strictEqual(formatTxDisplay(expenseTx), '-₪450', 'הוצאה מוצגת עם סימן מינוס');

  // 3. Serialization and reload fidelity
  const savedState = JSON.stringify([mofetTx]);
  const restoredState: Transaction[] = JSON.parse(savedState);
  assert.strictEqual(restoredState[0].type, 'income');
  assert.strictEqual(restoredState[0].category, 'משכורת והכנסות');
  assert.strictEqual(restoredState[0].amount, 2872.65);
});

runTest('K.9 (Scenario 9): PDF text layer line recognition of Mofet / Matash / Masav', () => {
  // Simulates digital text line extracted from Israeli bank PDF
  const pdfLine = '01/09/2026 מופ"ת חובה-י 2,872.65 זכות';
  const hasIncomeWord =
    pdfLine.includes('מופת') ||
    pdfLine.includes('מופ"ת') ||
    pdfLine.includes('מתש') ||
    pdfLine.includes('מת"ש') ||
    pdfLine.includes('מסב') ||
    pdfLine.includes('מס"ב') ||
    pdfLine.includes('משכורת') ||
    pdfLine.includes('שכר');

  assert.strictEqual(hasIncomeWord, true, 'שורת טקסט מ-PDF מזוהה כמועמדת להכנסה');

  const res = classifyTransactionSemantics({
    merchant: 'מופ"ת חובה-י',
    description: '01/09/2026 מופ"ת חובה-י 2,872.65',
    isCreditRow: false, // Text layer might not split columns
    isCreditCardSource: false,
    rawCategory: 'כללי',
  });

  assert.strictEqual(res.type, 'income');
  assert.strictEqual(res.category, 'משכורת והכנסות');
});

console.log('\n======================================================================');
console.log(`TEST SUITE SUMMARY: ${passedTests} passed, ${failedTests} failed`);
console.log('======================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
