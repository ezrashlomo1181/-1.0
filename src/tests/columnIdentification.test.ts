import { identifyHeaderColumns, extractTransactionsFromRawRows } from '../services/documentParser';

// Simple lightweight test runner
let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${testName}${detail ? ` (${detail})` : ''}`);
    failedCount++;
  }
}

console.log('=== TEST SUITE: Column Identification & Date/Description Prioritization ===\n');

// ----------------------------------------------------------------------
// GROUP 1: Unit Tests for identifyHeaderColumns
// ----------------------------------------------------------------------
console.log('--- Group 1: Header Recognition & Priority Tests ---');

// 1.1 "תאריך ערך" and "תאריך עסקה" together
{
  const headers = ['תאריך ערך', 'תאריך עסקה', 'תיאור', 'חובה'];
  const res = identifyHeaderColumns(headers);
  assert(res.dateCol === 1, 'Prefers תאריך עסקה (col 1) over תאריך ערך (col 0)', `got dateCol=${res.dateCol}`);
  assert(res.billingDateCol === 0, 'Correctly maps תאריך ערך to billingDateCol (col 0)', `got billingDateCol=${res.billingDateCol}`);
  assert(res.descCol === 2, 'Correctly maps תיאור to descCol (col 2)', `got descCol=${res.descCol}`);
  assert(res.debitCol === 3, 'Correctly maps חובה to debitCol (col 3)', `got debitCol=${res.debitCol}`);
}

// 1.2 "תאריך עסקה" before "תאריך ערך"
{
  const headers = ['תאריך עסקה', 'תאריך ערך', 'שם בית עסק', 'סכום חיוב'];
  const res = identifyHeaderColumns(headers);
  assert(res.dateCol === 0, 'Prefers תאריך עסקה (col 0) when it appears first', `got dateCol=${res.dateCol}`);
  assert(res.billingDateCol === 1, 'Maps תאריך ערך (col 1) to billingDateCol', `got billingDateCol=${res.billingDateCol}`);
  assert(res.descCol === 2, 'Maps שם בית עסק to descCol', `got descCol=${res.descCol}`);
  assert(res.billingAmountCol === 3, 'Maps סכום חיוב to billingAmountCol', `got billingAmountCol=${res.billingAmountCol}`);
}

// 1.3 General date "תאריך" vs "תאריך ערך"
{
  const headers = ['תאריך', 'תאריך ערך', 'תיאור', 'חובה'];
  const res = identifyHeaderColumns(headers);
  assert(res.dateCol === 0, 'Prefers general תאריך (col 0) over תאריך ערך (col 1)', `got dateCol=${res.dateCol}`);
  assert(res.billingDateCol === 1, 'Assigns תאריך ערך to billingDateCol', `got billingDateCol=${res.billingDateCol}`);
}

// 1.4 General date "תאריך" when "תאריך ערך" appears first
{
  const headers = ['תאריך ערך', 'תאריך', 'תיאור', 'חובה'];
  const res = identifyHeaderColumns(headers);
  assert(res.dateCol === 1, 'Prefers general תאריך (col 1) even when תאריך ערך is col 0', `got dateCol=${res.dateCol}`);
  assert(res.billingDateCol === 0, 'Assigns תאריך ערך to billingDateCol (col 0)', `got billingDateCol=${res.billingDateCol}`);
}

// 1.5 General date "תאריך" vs explicit "תאריך עסקה"
{
  const headers = ['תאריך', 'תאריך עסקה', 'תיאור', 'סכום'];
  const res = identifyHeaderColumns(headers);
  assert(res.dateCol === 1, 'Explicit תאריך עסקה (col 1) takes priority over general תאריך (col 0)', `got dateCol=${res.dateCol}`);
}

// 1.6 Single value date column fallback (no transaction date present)
{
  const headers = ['תאריך ערך', 'תיאור', 'חובה'];
  const res = identifyHeaderColumns(headers);
  assert(res.dateCol === 0, 'Safely falls back to תאריך ערך when no other date exists', `got dateCol=${res.dateCol}`);
  assert(res.billingDateCol === 0, 'Records billingDateCol as col 0', `got billingDateCol=${res.billingDateCol}`);
}

// 1.7 "סוג פעולה" vs "תיאור בית עסק"
{
  const headers = ['תאריך', 'סוג פעולה', 'תיאור בית עסק', 'חובה'];
  const res = identifyHeaderColumns(headers);
  assert(res.descCol === 2, 'Does not pick סוג פעולה (col 1) as description; chooses תיאור בית עסק (col 2)', `got descCol=${res.descCol}`);
  assert(res.categoryCol === 1, 'Assigns סוג פעולה to categoryCol (col 1)', `got categoryCol=${res.categoryCol}`);
}

// 1.8 "סוג פעולה" after "תיאור הפעולה"
{
  const headers = ['תאריך', 'תיאור הפעולה', 'סוג פעולה', 'חובה'];
  const res = identifyHeaderColumns(headers);
  assert(res.descCol === 1, 'Does not overwrite תיאור הפעולה (col 1) with subsequent סוג פעולה (col 2)', `got descCol=${res.descCol}`);
  assert(res.categoryCol === 2, 'Assigns סוג פעולה to categoryCol (col 2)', `got categoryCol=${res.categoryCol}`);
}

// 1.9 "סוג פעולה" without any description column
{
  const headers = ['תאריך', 'סוג פעולה', 'חובה'];
  const res = identifyHeaderColumns(headers);
  assert(res.descCol === -1, 'Leaves descCol as -1 when only סוג פעולה exists (safe, no false merchant)', `got descCol=${res.descCol}`);
  assert(res.categoryCol === 1, 'Captures סוג פעולה as categoryCol (col 1)', `got categoryCol=${res.categoryCol}`);
}

// 1.10 Ambiguous or completely unknown headers
{
  const headers = ['עמודה א', 'עמודה ב', 'מידע כללי'];
  const res = identifyHeaderColumns(headers);
  assert(!res.isHeaderRow, 'Does not guess on ambiguous headers: isHeaderRow is false', `got isHeaderRow=${res.isHeaderRow}`);
  assert(res.dateCol === -1, 'dateCol remains -1', `got dateCol=${res.dateCol}`);
  assert(res.descCol === -1, 'descCol remains -1', `got descCol=${res.descCol}`);
}

// 1.11 Backward compatibility: Israeli Credit Cards (Isracard / Max / Cal)
{
  const headers = ['תאריך רכישה', 'שם בית עסק', 'סכום עסקה', 'סכום חיוב', 'תאריך חיוב', 'ענף'];
  const res = identifyHeaderColumns(headers);
  assert(res.dateCol === 0, 'Credit card: maps תאריך רכישה to dateCol (0)', `got dateCol=${res.dateCol}`);
  assert(res.descCol === 1, 'Credit card: maps שם בית עסק to descCol (1)', `got descCol=${res.descCol}`);
  assert(res.amountCol === 2, 'Credit card: maps סכום עסקה to amountCol (2)', `got amountCol=${res.amountCol}`);
  assert(res.billingAmountCol === 3, 'Credit card: maps סכום חיוב to billingAmountCol (3)', `got billingAmountCol=${res.billingAmountCol}`);
  assert(res.billingDateCol === 4, 'Credit card: maps תאריך חיוב to billingDateCol (4)', `got billingDateCol=${res.billingDateCol}`);
  assert(res.categoryCol === 5, 'Credit card: maps ענף to categoryCol (5)', `got categoryCol=${res.categoryCol}`);
}

// 1.12 Backward compatibility: Bank Hapoalim / Discount check account
{
  const headers = ['תאריך', 'תיאור הפעולה', 'אסמכתא', 'חובה', 'זכות', 'יתרה'];
  const res = identifyHeaderColumns(headers);
  assert(res.dateCol === 0, 'Bank checking: maps תאריך to dateCol (0)', `got dateCol=${res.dateCol}`);
  assert(res.descCol === 1, 'Bank checking: maps תיאור הפעולה to descCol (1)', `got descCol=${res.descCol}`);
  assert(res.refCol === 2, 'Bank checking: maps אסמכתא to refCol (2)', `got refCol=${res.refCol}`);
  assert(res.debitCol === 3, 'Bank checking: maps חובה to debitCol (3)', `got debitCol=${res.debitCol}`);
  assert(res.creditCol === 4, 'Bank checking: maps זכות to creditCol (4)', `got creditCol=${res.creditCol}`);
}

console.log('\n--- Group 2: End-to-End Raw Row Extraction Tests ---');

// 2.1 Bank Leumi structure: separate value date and transaction date with distinct dates
{
  const rawRows = [
    ['תאריך ערך', 'תאריך עסקה', 'סוג פעולה', 'תיאור הפעולה', 'אסמכתא', 'חובה', 'זכות'],
    ['10/06/2026', '01/06/2026', 'עסקה רגילה (כולל דביט)', 'שופרסל דיל תל אביב', '11001', '250.00', ''],
    ['10/06/2026', '04/06/2026', 'עסקה רגילה (כולל דביט)', 'סופר-פארם דיזנגוף', '11002', '75.50', ''],
    ['10/06/2026', '08/06/2026', 'העברה בנקאית', 'משכורת חודשית', '11003', '', '12000.00'],
  ];

  const result = extractTransactionsFromRawRows(rawRows, 'leumi_sample.xlsx', 'בנק לאומי');
  const txs = result.transactions;

  assert(txs.length === 3, 'Extracted all 3 transactions', `got ${txs.length}`);
  
  // Row 1 assertions
  assert(txs[0].date === '2026-06-01', 'Row 1 date is transaction date 2026-06-01, NOT 2026-06-10', `got ${txs[0]?.date}`);
  assert(txs[0].billingDate === '2026-06-10', 'Row 1 billingDate is preserved as 2026-06-10', `got ${txs[0]?.billingDate}`);
  assert(txs[0].merchant === 'שופרסל דיל תל אביב', 'Row 1 merchant is שופרסל דיל, NOT עסקה רגילה (כולל דביט)', `got ${txs[0]?.merchant}`);
  assert(txs[0].amount === 250, 'Row 1 amount is 250.00', `got ${txs[0]?.amount}`);
  assert(txs[0].type === 'expense', 'Row 1 type is expense', `got ${txs[0]?.type}`);

  // Row 2 assertions
  assert(txs[1].date === '2026-06-04', 'Row 2 date is transaction date 2026-06-04', `got ${txs[1]?.date}`);
  assert(txs[1].billingDate === '2026-06-10', 'Row 2 billingDate is 2026-06-10', `got ${txs[1]?.billingDate}`);
  assert(txs[1].merchant === 'סופר-פארם דיזנגוף', 'Row 2 merchant is סופר-פארם דיזנגוף', `got ${txs[1]?.merchant}`);
  assert(txs[1].amount === 75.5, 'Row 2 amount is 75.50', `got ${txs[1]?.amount}`);

  // Row 3 assertions (Income / Salary)
  assert(txs[2].date === '2026-06-08', 'Row 3 date is 2026-06-08', `got ${txs[2]?.date}`);
  assert(txs[2].merchant === 'משכורת חודשית', 'Row 3 merchant is משכורת חודשית', `got ${txs[2]?.merchant}`);
  assert(txs[2].amount === 12000, 'Row 3 amount is 12000.00', `got ${txs[2]?.amount}`);
  assert(txs[2].type === 'income', 'Row 3 type is income', `got ${txs[2]?.type}`);

  // Distinct dates check
  const distinctDates = new Set(txs.map((t) => t.date));
  assert(distinctDates.size === 3, 'All 3 rows maintained distinct dates (not duplicated to 2026-06-10)', `got ${distinctDates.size}`);
}

// 2.2 Preserving Bank Discount / Hapoalim with value date
{
  const rawRows = [
    ['תאריך', 'תאריך ערך', 'תיאור', 'חובה', 'זכות'],
    ['15/05/2026', '16/05/2026', 'קפה ארומה', '18.00', ''],
  ];

  const result = extractTransactionsFromRawRows(rawRows, 'discount.xlsx', 'בנק דיסקונט');
  const tx = result.transactions[0];
  assert(tx && tx.date === '2026-05-15', 'Bank Discount: transaction date is 2026-05-15', `got ${tx?.date}`);
  assert(tx && tx.billingDate === '2026-05-16', 'Bank Discount: value date is 2026-05-16', `got ${tx?.billingDate}`);
  assert(tx && tx.merchant === 'קפה ארומה', 'Bank Discount: merchant is קפה ארומה', `got ${tx?.merchant}`);
}

// 2.3 Ambiguous table doesn't generate fake transactions
{
  const rawRows = [
    ['כותרת א', 'כותרת ב'],
    ['ערך 1', 'ערך 2'],
  ];
  const result = extractTransactionsFromRawRows(rawRows, 'unknown.xlsx');
  assert(result.transactions.length === 0, 'Ambiguous file safely produces 0 transactions without guessing', `got ${result.transactions.length}`);
}

console.log(`\n========================================`);
console.log(`Summary: ${passedCount} passed, ${failedCount} failed`);
console.log(`========================================\n`);

if (failedCount > 0) {
  process.exit(1);
}
