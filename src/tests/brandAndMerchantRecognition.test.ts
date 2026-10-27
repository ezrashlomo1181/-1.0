import assert from 'assert';
import {
  classifyTransactionSemantics,
  cleanMerchantAndPaymentPrefixes,
  findBrandMatch,
  BRAND_CATALOG,
} from '../services/classificationEngine';
import { getFixedExpenseCategories } from '../services/categoriesService';

let passedTests = 0;
let failedTests = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ PASS: ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`✗ FAIL: ${name}`);
    console.error(`  Error: ${err.message}`);
    failedTests++;
  }
}

console.log('--- RUNNING SUITE 12: BRAND & MERCHANT RECOGNITION AND EXPENSE CLASSIFICATION ---');

// -------------------------------------------------------------
// Test 1: cleanMerchantAndPaymentPrefixes
// -------------------------------------------------------------
runTest('Strips payment processor prefixes cleanly', () => {
  assert.strictEqual(cleanMerchantAndPaymentPrefixes('PAYPAL *SPOTIFY'), 'SPOTIFY');
  assert.strictEqual(cleanMerchantAndPaymentPrefixes('PAYPAL* SPOTIFY'), 'SPOTIFY');
  assert.strictEqual(cleanMerchantAndPaymentPrefixes('BIT - פיצה האט'), 'פיצה האט');
  assert.strictEqual(cleanMerchantAndPaymentPrefixes('ביט - ארומה'), 'ארומה');
  assert.strictEqual(cleanMerchantAndPaymentPrefixes('פייבוקס* שופרסל'), 'שופרסל');
  assert.strictEqual(cleanMerchantAndPaymentPrefixes('PAYBOX שופרסל'), 'שופרסל');
  assert.strictEqual(cleanMerchantAndPaymentPrefixes('הוראת קבע - חברת חשמל'), 'חברת חשמל');
  assert.strictEqual(cleanMerchantAndPaymentPrefixes('MAX - זארה'), 'זארה');
  assert.strictEqual(cleanMerchantAndPaymentPrefixes('CAL - גולדה'), 'גולדה');
  assert.strictEqual(cleanMerchantAndPaymentPrefixes('ISR - רמי לוי'), 'רמי לוי');
});

runTest('Strips corporate suffixes while preserving branch identifiers', () => {
  assert.strictEqual(cleanMerchantAndPaymentPrefixes('קבוצת גולף בע"מ'), 'קבוצת גולף');
  assert.strictEqual(cleanMerchantAndPaymentPrefixes('סופר פארם בע״מ'), 'סופר פארם');
  assert.strictEqual(cleanMerchantAndPaymentPrefixes('שופרסל LTD'), 'שופרסל');
  assert.strictEqual(cleanMerchantAndPaymentPrefixes('קופי טיים סניף 4'), 'קופי טיים סניף 4');
});

runTest('Preserves pure payment processor string when no merchant is attached', () => {
  assert.strictEqual(cleanMerchantAndPaymentPrefixes('ביט'), 'ביט');
  assert.strictEqual(cleanMerchantAndPaymentPrefixes('פייבוקס'), 'פייבוקס');
});

// -------------------------------------------------------------
// Test 2: BRAND_CATALOG & findBrandMatch
// -------------------------------------------------------------
runTest('findBrandMatch correctly identifies Spotify across aliases', () => {
  const match1 = findBrandMatch('Spotify', 'Spotify AB');
  assert(match1 !== null, 'Expected match for Spotify');
  assert.strictEqual(match1?.canonicalName, 'Spotify');
  assert.strictEqual(match1?.category, 'תקשורת ומנויים');

  const match2 = findBrandMatch('ספוטיפיי', 'חיוב חודשי ספוטיפיי');
  assert(match2 !== null, 'Expected match for ספוטיפיי');
  assert.strictEqual(match2?.canonicalName, 'Spotify');
  assert.strictEqual(match2?.category, 'תקשורת ומנויים');
});

runTest('findBrandMatch correctly identifies Coffee Time across aliases', () => {
  const match1 = findBrandMatch('קופי טיים', 'קופי טיים');
  assert(match1 !== null, 'Expected match for קופי טיים');
  assert.strictEqual(match1?.canonicalName, 'קופי טיים');
  assert.strictEqual(match1?.category, 'מסעדות, קפה ומשלוחים');

  const match2 = findBrandMatch('Coffee Time', 'COFFEE TIME TLV');
  assert(match2 !== null, 'Expected match for Coffee Time');
  assert.strictEqual(match2?.canonicalName, 'קופי טיים');
  assert.strictEqual(match2?.category, 'מסעדות, קפה ומשלוחים');
});

// -------------------------------------------------------------
// Test 3: Coffee Time Classification
// -------------------------------------------------------------
runTest('Classifies "קופי טיים" as "מסעדות, קפה ומשלוחים" with high confidence', () => {
  const res = classifyTransactionSemantics({
    merchant: 'קופי טיים',
    description: 'קופי טיים סניף 4',
    isCreditCardSource: true,
  });

  assert.strictEqual(res.category, 'מסעדות, קפה ומשלוחים');
  assert.strictEqual(res.type, 'expense');
  assert.strictEqual(res.confidenceLevel, 'high');
  assert.strictEqual(res.needsReview, false);
});

runTest('Classifies "Coffee Time" (English) as "מסעדות, קפה ומשלוחים"', () => {
  const res = classifyTransactionSemantics({
    merchant: 'Coffee Time',
    description: 'COFFEE TIME TLV',
    isCreditCardSource: true,
  });

  assert.strictEqual(res.category, 'מסעדות, קפה ומשלוחים');
  assert.strictEqual(res.type, 'expense');
  assert.strictEqual(res.confidenceLevel, 'high');
  assert.strictEqual(res.needsReview, false);
});

runTest('Classifies standalone coffee shop "קפה 4" or "קפה לנדוור" as "מסעדות, קפה ומשלוחים"', () => {
  const res1 = classifyTransactionSemantics({
    merchant: 'קפה לנדוור',
    description: 'קפה לנדוור',
    isCreditCardSource: true,
  });
  assert.strictEqual(res1.category, 'מסעדות, קפה ומשלוחים');

  const res2 = classifyTransactionSemantics({
    merchant: 'קפה 4',
    description: 'קפה 4',
    isCreditCardSource: true,
  });
  assert.strictEqual(res2.category, 'מסעדות, קפה ומשלוחים');
});

// -------------------------------------------------------------
// Test 4: Spotify Classification on Bank Checking & Credit Card
// -------------------------------------------------------------
runTest('Spotify on credit card is classified as "תקשורת ומנויים"', () => {
  const res = classifyTransactionSemantics({
    merchant: 'Spotify',
    description: 'SPOTIFY P12345678',
    isCreditCardSource: true,
  });

  assert.strictEqual(res.category, 'תקשורת ומנויים');
  assert.strictEqual(res.type, 'expense');
  assert.strictEqual(res.confidenceLevel, 'high');
  assert.strictEqual(res.needsReview, false);
});

runTest('Spotify on bank checking is NOT falsely treated as an inflow deposit', () => {
  // On bank checking without explicit isCreditRow, Spotify is an expense, NOT an inflow!
  const res = classifyTransactionSemantics({
    merchant: 'Spotify',
    description: 'Spotify AB',
    isCreditCardSource: false,
  });

  assert.strictEqual(res.category, 'תקשורת ומנויים');
  assert.strictEqual(res.type, 'expense');
  assert.strictEqual(res.confidenceLevel, 'high');
  assert.strictEqual(res.needsReview, false);
});

runTest('PAYPAL *SPOTIFY is cleanly resolved to Spotify and "תקשורת ומנויים"', () => {
  const res = classifyTransactionSemantics({
    merchant: 'PAYPAL *SPOTIFY',
    description: 'PAYPAL *SPOTIFY 35314369001',
    isCreditCardSource: true,
  });

  assert.strictEqual(res.category, 'תקשורת ומנויים');
  assert.strictEqual(res.type, 'expense');
  assert.strictEqual(res.confidenceLevel, 'high');
  assert.strictEqual(res.needsReview, false);
});

runTest('Refund from Spotify on card statement is typed as "refund" with category "תקשורת ומנויים"', () => {
  const res = classifyTransactionSemantics({
    merchant: 'Spotify',
    description: 'Spotify reversal',
    amountIsNegative: true,
    isCreditCardSource: true,
  });

  assert.strictEqual(res.category, 'תקשורת ומנויים');
  assert.strictEqual(res.type, 'refund');
  assert.strictEqual(res.confidenceLevel, 'high');
  assert.strictEqual(res.needsReview, false);
});

// -------------------------------------------------------------
// Test 5: Invariant Protection & 11 Official Categories
// -------------------------------------------------------------
runTest('All brand catalog categories strictly belong to the 11 official categories', () => {
  const officialCategoryNames = new Set(getFixedExpenseCategories().map((c) => c.name));

  for (const brand of BRAND_CATALOG) {
    assert(
      officialCategoryNames.has(brand.category),
      `Brand ${brand.canonicalName} has unapproved category: ${brand.category}`
    );
  }
});

runTest('Genuine Salary is never overridden by brand classification', () => {
  const res = classifyTransactionSemantics({
    merchant: 'משכורת חודשית',
    description: 'העברת שכר מלם',
    isCreditCardSource: false,
    isCreditRow: true,
  });

  assert.strictEqual(res.category, 'משכורת והכנסות');
  assert.strictEqual(res.type, 'income');
  assert.strictEqual(res.confidenceLevel, 'high');
  assert.strictEqual(res.needsReview, false);
});

console.log(`\nSuite 12 Finished: ${passedTests} passed, ${failedTests} failed.`);
if (failedTests > 0) {
  process.exit(1);
}
