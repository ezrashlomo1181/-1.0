import {
  cleanTransactionDescription,
  isGenericTransactionType,
  extractTransactionsFromRawRows,
} from '../services/documentParser.js';

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

console.log('=== TEST SUITE: Description Cleaning & Technical Artifact Removal ===');

// =========================================================================
// Group 1: Synthetic PDF Lines and Technical Description Cleaning
// =========================================================================
console.log('\n--- Group 1: cleanTransactionDescription Unit Tests ---');

// 1.0 Synthetic PDF line: simulate PDF line extraction matching server.ts logic
{
  const line = '10/06/2026 ILS 7.23 ILS עסקה רגילה (כולל דביט) 7.23';
  const dateRegex = /\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](\d{2,4})\b/g;
  const amountRegex = /\b-?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})\b|\b-?\d+\.\d{2}\b/g;

  const dateMatches = Array.from(line.matchAll(dateRegex));
  const amountMatches = Array.from(line.matchAll(amountRegex));

  assert(dateMatches.length === 1, 'PDF line: found 1 date match', `got ${dateMatches.length}`);
  assert(amountMatches.length >= 1, 'PDF line: found amount match', `got ${amountMatches.length}`);

  let strippedLine = line;
  for (const dm of dateMatches) strippedLine = strippedLine.replace(dm[0], ' ');
  for (const am of amountMatches) strippedLine = strippedLine.replace(am[0], ' ');

  const cleanedMerchant = cleanTransactionDescription(strippedLine.replace(/[₪$€,\-]/g, ' '));
  assert(
    cleanedMerchant === 'עסקה רגילה (כולל דביט)',
    'PDF line: extracted and cleaned description is "עסקה רגילה (כולל דביט)" without remaining ILS or 7.23',
    `got "${cleanedMerchant}"`
  );
}

// 1.1 Synthetic Leumi debit transaction with duplicate currency & amount prefix
{
  const input = 'ILS 7.23 ILS עסקה רגילה (כולל דביט)';
  const cleaned = cleanTransactionDescription(input);
  assert(
    cleaned === 'עסקה רגילה (כולל דביט)',
    'Cleans duplicate currency and amount prefix (ILS 7.23 ILS ...)',
    `got "${cleaned}"`
  );
  assert(
    isGenericTransactionType(cleaned) === true,
    'Identifies "עסקה רגילה (כולל דביט)" as generic transaction type',
    `got ${isGenericTransactionType(cleaned)}`
  );
}

// 1.2 Synthetic PDF line with Shekel symbol and trailing amount
{
  const input = 'שופרסל דיל ₪ 250.00';
  const cleaned = cleanTransactionDescription(input);
  assert(
    cleaned === 'שופרסל דיל',
    'Cleans trailing currency and amount (₪ 250.00)',
    `got "${cleaned}"`
  );
  assert(
    isGenericTransactionType(cleaned) === false,
    'Legitimate merchant "שופרסל דיל" is NOT generic',
    `got ${isGenericTransactionType(cleaned)}`
  );
}

// 1.3 Synthetic store name with legitimate numbers (Must NOT be stripped!)
{
  const input1 = 'סופר-פארם סניף 120';
  const cleaned1 = cleanTransactionDescription(input1);
  assert(
    cleaned1 === 'סופר-פארם סניף 120',
    'Preserves store branch number: "סופר-פארם סניף 120"',
    `got "${cleaned1}"`
  );

  const input2 = 'קפה 4';
  const cleaned2 = cleanTransactionDescription(input2);
  assert(
    cleaned2 === 'קפה 4',
    'Preserves legitimate number in merchant: "קפה 4"',
    `got "${cleaned2}"`
  );

  const input3 = '7-Eleven תל אביב';
  const cleaned3 = cleanTransactionDescription(input3);
  assert(
    cleaned3 === '7-Eleven תל אביב',
    'Preserves legitimate number in brand name: "7-Eleven תל אביב"',
    `got "${cleaned3}"`
  );
}

// 1.4 Synthetic input with quotes, brackets, and USD prefix
{
  const input = '"USD 49.99 Zoom Video"';
  const cleaned = cleanTransactionDescription(input);
  assert(
    cleaned === 'Zoom Video',
    'Strips quotes and foreign currency prefix "USD 49.99"',
    `got "${cleaned}"`
  );
}

// =========================================================================
// Group 2: End-to-End Raw Row Extraction & Generic Description Preservation
// =========================================================================
console.log('\n--- Group 2: extractTransactionsFromRawRows with Generic & Messy Descriptions ---');

// 2.1 Statement where description column has technical text (e.g. Bank Leumi debit)
{
  const rawRows = [
    ['תאריך עסקה', 'תיאור הפעולה', 'סכום'],
    ['10/06/2026', 'ILS 7.23 ILS עסקה רגילה (כולל דביט)', '7.23'],
    ['10/06/2026', 'סופר-פארם סניף 120', '54.90'],
  ];

  const result = extractTransactionsFromRawRows(rawRows, 'leumi_sample.xlsx', 'בנק לאומי');
  const txs = result.transactions;

  assert(txs.length === 2, 'Extracted 2 transactions', `got ${txs.length}`);

  // Row 1: Generic description - preserved faithfully, no fake merchant invented
  assert(
    txs[0].description === 'עסקה רגילה (כולל דביט)',
    'Row 1: description is cleaned of "ILS 7.23 ILS" to "עסקה רגילה (כולל דביט)"',
    `got "${txs[0].description}"`
  );
  assert(
    txs[0].merchant === 'עסקה רגילה (כולל דביט)',
    'Row 1: merchant does NOT invent fake merchant, preserves source classification',
    `got "${txs[0].merchant}"`
  );
  assert(txs[0].amount === 7.23, 'Row 1: amount is 7.23', `got ${txs[0].amount}`);

  // Row 2: Legitimate merchant with branch number intact
  assert(
    txs[1].merchant === 'סופר-פארם סניף 120',
    'Row 2: merchant preserves branch number "סופר-פארם סניף 120"',
    `got "${txs[1].merchant}"`
  );
}

console.log(`\n========================================`);
console.log(`Summary: ${passedCount} passed, ${failedCount} failed`);
console.log(`========================================\n`);

if (failedCount > 0) {
  process.exit(1);
}
