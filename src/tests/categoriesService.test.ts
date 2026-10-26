import assert from 'node:assert';
import {
  FIXED_EXPENSE_CATEGORIES,
  SPECIAL_SYSTEM_CATEGORIES,
  getFixedExpenseCategories,
  getSpecialSystemCategories,
  getAllStandardCategories,
  isFixedExpenseCategory,
  isSpecialSystemCategory,
  findCategoryById,
  findCategoryByName,
  getCategoryColor,
  validateCustomCategoryName,
  createCustomCategoryDefinition,
  isTechnicalTransactionType,
  resolveToCanonicalExpenseCategory,
} from '../services/categoriesService.js';

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

console.log('\n=== TEST SUITE: Central Categories Service & Fixed/Custom Categories (Stage 1) ===');

// -----------------------------------------------------------------------------
// Test 1: Exactly 11 Clean Fixed Expense Categories Defined
// -----------------------------------------------------------------------------
runTest('Exactly 11 Fixed Expense Categories with Required Hebrew Names', () => {
  const fixed = getFixedExpenseCategories();
  assert.strictEqual(fixed.length, 11, 'Must have exactly 11 fixed expense categories');

  const expectedNames = [
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

  for (const name of expectedNames) {
    const found = fixed.find((c) => c.name === name);
    assert.ok(found, `Expected fixed category "${name}" must exist`);
    assert.strictEqual(found.isCustom, false, `Category "${name}" must have isCustom: false`);
    assert.ok(found.id.startsWith('cat_'), `Category "${name}" ID must be stable and start with cat_`);
    assert.ok(found.color && found.color.startsWith('#'), `Category "${name}" must have a valid hex color`);
  }
});

// -----------------------------------------------------------------------------
// Test 2: Unified "דיור וחשבונות הבית" Category
// -----------------------------------------------------------------------------
runTest('Unified "דיור וחשבונות הבית" exists with stable ID', () => {
  const housing = findCategoryByName('דיור וחשבונות הבית');
  assert.ok(housing, 'Unified housing category must be retrievable by name');
  assert.strictEqual(housing?.id, 'cat_housing', 'Housing category must have ID cat_housing');
  assert.strictEqual(housing?.isCustom, false);
});

// -----------------------------------------------------------------------------
// Test 3: Special System Categories Segregation
// -----------------------------------------------------------------------------
runTest('Special System Categories are strictly segregated from Fixed Expense Categories', () => {
  const system = getSpecialSystemCategories();
  assert.strictEqual(system.length, 6, 'Must have exactly 6 special system categories');

  const expectedSystem = [
    'משכורת והכנסות',
    'העברות ומזומן',
    'החזרים וזיכויים',
    'השקעות',
    'הלוואות והתחייבויות',
    'אחר / לבירור',
  ];

  for (const name of expectedSystem) {
    const found = system.find((c) => c.name === name);
    assert.ok(found, `Special system category "${name}" must exist`);
    assert.strictEqual(isSpecialSystemCategory(name), true, `"${name}" must be recognized as system category`);
    assert.strictEqual(isFixedExpenseCategory(name), false, `"${name}" must NOT be recognized as expense category`);
  }
});

// -----------------------------------------------------------------------------
// Test 4: Custom Category Validation Rejections (Empty, Collisions)
// -----------------------------------------------------------------------------
runTest('Validation rejects empty, whitespace, and name collisions', () => {
  // Empty & short
  assert.strictEqual(validateCustomCategoryName('').valid, false);
  assert.strictEqual(validateCustomCategoryName('   ').valid, false);
  assert.strictEqual(validateCustomCategoryName('א').valid, false);

  // Collision with fixed expense category
  const fixedCollision = validateCustomCategoryName('מזון וקניות לבית');
  assert.strictEqual(fixedCollision.valid, false);
  assert.ok(fixedCollision.error?.includes('קבועות'));

  // Collision with special system category
  const systemCollision = validateCustomCategoryName('משכורת והכנסות');
  assert.strictEqual(systemCollision.valid, false);
  assert.ok(systemCollision.error?.includes('שמור על ידי המערכת'));

  // Collision with existing custom category
  const existingCustom = [
    {
      id: 'cust_1',
      name: 'קורסים והעשרה',
      isCustom: true,
      color: '#0284c7',
    },
  ];
  const customCollision = validateCustomCategoryName('קורסים והעשרה', existingCustom);
  assert.strictEqual(customCollision.valid, false);
  assert.ok(customCollision.error?.includes('כבר קיימת'));

  // Valid custom category
  const valid = validateCustomCategoryName('ספורט וכושר', existingCustom);
  assert.strictEqual(valid.valid, true);
});

// -----------------------------------------------------------------------------
// Test 5: Custom Category Creation
// -----------------------------------------------------------------------------
runTest('Create custom category generates unique ID and assigns color/user', () => {
  const created = createCustomCategoryDefinition({
    name: 'גינון ומרפסת',
    userId: 'user_ezra_123',
    description: 'הוצאות טיפוח הגינה',
  });

  assert.ok(created.id.startsWith('cust_'), 'Custom category ID must start with cust_');
  assert.strictEqual(created.name, 'גינון ומרפסת');
  assert.strictEqual(created.isCustom, true);
  assert.strictEqual(created.userId, 'user_ezra_123');
  assert.strictEqual(created.description, 'הוצאות טיפוח הגינה');
  assert.ok(created.color && created.color.startsWith('#'));
});

// -----------------------------------------------------------------------------
// Test 6: Category Resolution (findCategoryById, findCategoryByName, getCategoryColor)
// -----------------------------------------------------------------------------
runTest('Category Resolution by ID, Name, and Color Fallback', () => {
  const custom = [
    {
      id: 'cust_abc_999',
      name: 'בעלי חיים וחיות מחמד',
      isCustom: true,
      color: '#ea580c',
    },
  ];

  // Resolve by ID
  const byId = findCategoryById('cust_abc_999', custom);
  assert.strictEqual(byId?.name, 'בעלי חיים וחיות מחמד');

  // Resolve by Name
  const byName = findCategoryByName('בעלי חיים וחיות מחמד', custom);
  assert.strictEqual(byName?.id, 'cust_abc_999');

  // Color lookup
  const colorFixed = getCategoryColor('מזון וקניות לבית');
  assert.strictEqual(colorFixed, '#059669');

  const colorCustom = getCategoryColor('cust_abc_999', custom);
  assert.strictEqual(colorCustom, '#ea580c');

  const colorFallback = getCategoryColor('קטגוריה שלא קיימת');
  assert.strictEqual(colorFallback, '#94a3b8');
});

// -----------------------------------------------------------------------------
// Test 7: Canonical Resolution & Technical Type Filtering
// -----------------------------------------------------------------------------
runTest('Technical transaction strings are identified and blocked from becoming categories', () => {
  // Technical strings must return true for isTechnicalTransactionType
  assert.strictEqual(isTechnicalTransactionType('עסקה רגילה (כולל דביט)'), true);
  assert.strictEqual(isTechnicalTransactionType('עסקה רגילה'), true);
  assert.strictEqual(isTechnicalTransactionType('דביט'), true);
  assert.strictEqual(isTechnicalTransactionType('סייקל חו"ל'), true);
  assert.strictEqual(isTechnicalTransactionType('סייקל חו״ל'), true);
  assert.strictEqual(isTechnicalTransactionType('כללי'), true);
  assert.strictEqual(isTechnicalTransactionType('אחר / ללא סיווג'), true);
  assert.strictEqual(isTechnicalTransactionType('הוראת קבע'), true);

  // Legitimate category names return false
  assert.strictEqual(isTechnicalTransactionType('מזון וקניות לבית'), false);
  assert.strictEqual(isTechnicalTransactionType('פארם'), false);

  // resolveToCanonicalExpenseCategory returns null for technical strings
  assert.strictEqual(resolveToCanonicalExpenseCategory('עסקה רגילה (כולל דביט)'), null);
  assert.strictEqual(resolveToCanonicalExpenseCategory('סייקל חו״ל'), null);

  // resolveToCanonicalExpenseCategory resolves legacy names to official clean names
  assert.strictEqual(resolveToCanonicalExpenseCategory('מזון וסופר'), 'מזון וקניות לבית');
  assert.strictEqual(resolveToCanonicalExpenseCategory('פארם ומזון לתינוקות'), 'פארם');
  assert.strictEqual(resolveToCanonicalExpenseCategory('טואלטיקה וטיפוח'), 'היגיינה וטיפוח');
  assert.strictEqual(resolveToCanonicalExpenseCategory('תחבורה ורכב'), 'רכב ותחבורה');
  assert.strictEqual(resolveToCanonicalExpenseCategory('מסעדות ובילויים'), 'מסעדות, קפה ומשלוחים');
  assert.strictEqual(resolveToCanonicalExpenseCategory('פנאי וספורט'), 'פנאי ובילויים');
  assert.strictEqual(resolveToCanonicalExpenseCategory('קניות וביגוד'), 'ביגוד וקניות אישיות');
  assert.strictEqual(resolveToCanonicalExpenseCategory('חופשות וטיסות'), 'חופשות ונסיעות');
  assert.strictEqual(resolveToCanonicalExpenseCategory('מנויים ותקשורת'), 'תקשורת ומנויים');
  assert.strictEqual(resolveToCanonicalExpenseCategory('תקשורת וטכנולוגיה'), 'תקשורת ומנויים');
});

// Summary
console.log(`\nCategories Service Test Results: ${passedCount} passed, ${failedCount} failed.`);
if (failedCount > 0) {
  process.exit(1);
}
