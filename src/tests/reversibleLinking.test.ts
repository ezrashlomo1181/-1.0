import {
  evaluateTransactionMatch,
  linkAndEnrichTransactions,
  unlinkTransaction,
} from '../services/reconciliationEngine.js';
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

console.log('=== TEST SUITE: Reversible Mutual Linking & Enrichment (Stage B.2) ===');

function createSyntheticTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: `tx-${Math.random().toString(36).substring(2, 9)}`,
    date: '2026-06-10',
    amount: 100.0,
    currency: 'ILS',
    merchant: 'עסקה כללית',
    description: 'עסקה כללית',
    accountId: 'acc-bank-1',
    accountName: 'חשבון עו"ש לאומי',
    paymentMethod: 'direct_debit',
    category: 'כללי',
    type: 'expense',
    isRecurring: false,
    confidenceScore: 0.8,
    confidenceLevel: 'medium',
    needsReview: true,
    userConfirmed: false,
    sourceDocument: 'leumi_checking.pdf',
    sourceDocumentType: 'bank_statement',
    ...overrides,
  };
}

// =========================================================================
// Test 1: Successful Link and Enrichment for High Confidence Match (Exact Reference)
// =========================================================================
console.log('\n--- Test 1: Successful Link and Enrichment (High Confidence) ---');
{
  const target = createSyntheticTx({
    id: 'bank-tx-1',
    date: '2026-06-12',
    amount: 88.5,
    currency: 'ILS',
    merchant: 'עסקה רגילה (כולל דביט)',
    description: 'עסקה רגילה (כולל דביט) אסמכתא 887766',
    category: 'כללי',
    needsReview: true,
    reviewReason: 'דרוש בירור בית עסק',
  });

  const cardCandidate = createSyntheticTx({
    id: 'card-tx-1',
    date: '2026-06-10',
    amount: 88.5,
    currency: 'ILS',
    merchant: 'סופר פארם סניף דיזנגוף',
    description: 'סופר פארם אסמכתא 887766',
    category: 'פארם ובריאות',
    needsReview: false,
    sourceDocument: 'cal_visa.xlsx',
    sourceDocumentType: 'credit_card_statement',
  });

  const transactions = [target, cardCandidate];
  const originalTransactionsSnapshot = JSON.stringify(transactions);

  const result = linkAndEnrichTransactions(transactions, target.id, cardCandidate.id);

  assert(result.success === true, 'Linking succeeds for high confidence match');
  assert(result.status === 'linked_and_enriched', 'Status is linked_and_enriched');
  assert(result.updatedTransactions.length === 2, 'No transactions deleted or merged into one');

  const updatedTarget = result.updatedTransactions.find((t) => t.id === target.id)!;
  const updatedCandidate = result.updatedTransactions.find((t) => t.id === cardCandidate.id)!;

  // Mutual links
  assert(updatedTarget.linkedTransactionIds?.includes(cardCandidate.id) === true, 'Target contains candidate link ID');
  assert(updatedCandidate.linkedTransactionIds?.includes(target.id) === true, 'Candidate contains target link ID');

  // Enrichment
  assert(updatedTarget.merchant === 'סופר פארם סניף דיזנגוף', 'Target merchant was enriched from candidate');
  assert(updatedTarget.category === 'פארם ובריאות', 'Target default generic category was updated from candidate');
  assert(updatedTarget.needsReview === false, 'Target needsReview set to false after confirmed link');
  assert(updatedTarget.originalDate === '2026-06-10', 'Target originalDate recorded card purchase date');
  assert(updatedTarget.date === '2026-06-12', 'Target bank posting date preserved intact');
  assert(updatedTarget.enrichmentSnapshots?.length === 1, 'Snapshot was created on target');

  // Immutability of inputs
  assert(JSON.stringify(transactions) === originalTransactionsSnapshot, 'Original input array was NOT mutated');
}

// =========================================================================
// Test 2: Complete Reversibility (Unlinking Restores 100% of Original State)
// =========================================================================
console.log('\n--- Test 2: Complete Reversibility (Unlinking) ---');
{
  const target = createSyntheticTx({
    id: 'target-undo-1',
    date: '2026-06-12',
    amount: 150.0,
    currency: 'ILS',
    merchant: 'עסקה רגילה (כולל דביט)',
    description: 'עסקה רגילה (כולל דביט) שובר 12345',
    category: 'כללי',
    needsReview: true,
    reviewReason: 'שם בית עסק חסר',
    reconciliationStatus: 'unreconciled',
  });

  const card = createSyntheticTx({
    id: 'card-undo-1',
    date: '2026-06-11',
    amount: 150.0,
    currency: 'ILS',
    merchant: 'שופרסל דיל',
    description: 'שופרסל שובר 12345',
    category: 'סופרמרקט ומזון',
    reconciliationStatus: 'unreconciled',
  });

  const initialList = [target, card];
  const linkResult = linkAndEnrichTransactions(initialList, target.id, card.id);
  assert(linkResult.success === true, 'Pre-condition: Linking succeeded');

  // Now unlink
  const unlinkResult = unlinkTransaction(linkResult.updatedTransactions, target.id, card.id);
  assert(unlinkResult.success === true, 'Unlink succeeds');
  assert(unlinkResult.status === 'unlinked', 'Status is unlinked');

  const restoredTarget = unlinkResult.updatedTransactions.find((t) => t.id === target.id)!;
  const restoredCard = unlinkResult.updatedTransactions.find((t) => t.id === card.id)!;

  // Verify full restoration
  assert(restoredTarget.merchant === target.merchant, 'Target merchant restored to original');
  assert(restoredTarget.description === target.description, 'Target description restored to original');
  assert(restoredTarget.category === target.category, 'Target category restored to original');
  assert(restoredTarget.needsReview === target.needsReview, 'Target needsReview restored to original');
  assert(restoredTarget.reviewReason === target.reviewReason, 'Target reviewReason restored to original');
  assert(restoredTarget.reconciliationStatus === 'unreconciled', 'Target reconciliationStatus restored');
  assert((restoredTarget.linkedTransactionIds?.length || 0) === 0, 'Target link IDs completely cleared');
  assert((restoredCard.linkedTransactionIds?.length || 0) === 0, 'Candidate link IDs completely cleared');
}

// =========================================================================
// Test 3: Protection of User Custom Category (Never Overwritten)
// =========================================================================
console.log('\n--- Test 3: Protection of User Custom Category ---');
{
  const targetWithUserCategory = createSyntheticTx({
    id: 'target-custom-cat',
    date: '2026-06-12',
    amount: 60.0,
    currency: 'ILS',
    merchant: 'עסקה רגילה',
    description: 'עסקה רגילה כרטיס 9988',
    category: 'תקציב אישי מיוחד', // User explicit custom category
    userCustomizedCategory: true,
  });

  const cardCandidate = createSyntheticTx({
    id: 'card-custom-cat',
    date: '2026-06-11',
    amount: 60.0,
    currency: 'ILS',
    merchant: 'קפה לנדוור כרטיס 9988',
    description: 'קפה לנדוור',
    category: 'בתי קפה ומסעדות',
  });

  const list = [targetWithUserCategory, cardCandidate];
  const result = linkAndEnrichTransactions(list, targetWithUserCategory.id, cardCandidate.id);

  assert(result.success === true, 'Linking succeeds');
  const updatedTarget = result.updatedTransactions.find((t) => t.id === targetWithUserCategory.id)!;
  assert(updatedTarget.category === 'תקציב אישי מיוחד', 'User-assigned category was NOT overwritten');
  assert(result.enrichedFields.categoryProposed === 'בתי קפה ומסעדות', 'Candidate category was suggested only');
}

// =========================================================================
// Test 4: Rejection of Incompatible Matches (Different Currency or Flow)
// =========================================================================
console.log('\n--- Test 4: Rejection of Incompatible Matches ---');
{
  const target = createSyntheticTx({
    id: 'target-incomp-curr',
    amount: 100.0,
    currency: 'ILS',
  });

  const candidateUsd = createSyntheticTx({
    id: 'candidate-usd',
    amount: 100.0,
    currency: 'USD',
  });

  const list = [target, candidateUsd];
  const result = linkAndEnrichTransactions(list, target.id, candidateUsd.id);

  assert(result.success === false, 'Cannot link incompatible currencies');
  assert(result.status === 'incompatible', 'Status is incompatible');
  assert(result.updatedTransactions === list, 'List unchanged on failure');
}

// =========================================================================
// Test 5: Rejection of Conflicting References or Card Digits
// =========================================================================
console.log('\n--- Test 5: Rejection of Conflicting References or Card Digits ---');
{
  const target = createSyntheticTx({
    id: 'target-card-1111',
    amount: 75.0,
    description: 'עסקה רגילה כרטיס 1111',
  });

  const candidate = createSyntheticTx({
    id: 'candidate-card-2222',
    amount: 75.0,
    description: 'פיצה האט כרטיס 2222',
  });

  const list = [target, candidate];
  const result = linkAndEnrichTransactions(list, target.id, candidate.id);

  assert(result.success === false, 'Cannot link conflicting card digits');
  assert(result.status === 'incompatible', 'Status is incompatible');
}

// =========================================================================
// Test 6: Indeterminate Candidates Require Explicit User Confirmation
// =========================================================================
console.log('\n--- Test 6: Indeterminate Candidates Require Explicit Confirmation ---');
{
  // Same amount and date, but NO reference and NO card digits
  const target = createSyntheticTx({
    id: 'target-indet',
    date: '2026-06-10',
    amount: 45.0,
    merchant: 'עסקה ללא פירוט',
  });

  const candidate = createSyntheticTx({
    id: 'candidate-indet',
    date: '2026-06-10',
    amount: 45.0,
    merchant: 'מאפיית אריאל',
  });

  const list = [target, candidate];

  // Attempt without explicit confirmation
  const resultWithoutConfirm = linkAndEnrichTransactions(list, target.id, candidate.id);
  assert(resultWithoutConfirm.success === false, 'Indeterminate candidate is NOT auto-linked without explicit confirmation');

  // Attempt with explicit user confirmation
  const resultWithConfirm = linkAndEnrichTransactions(list, target.id, candidate.id, {
    forceLinkIndeterminate: true,
  });
  assert(resultWithConfirm.success === true, 'Indeterminate candidate CAN be linked with explicit confirmation');
  assert(resultWithConfirm.updatedTransactions.find((t) => t.id === target.id)!.merchant === 'מאפיית אריאל', 'Merchant enriched after explicit approval');
}

// =========================================================================
// Test 7: Prevent Double Linking
// =========================================================================
console.log('\n--- Test 7: Prevent Double Linking ---');
{
  const target = createSyntheticTx({
    id: 'target-double',
    amount: 30.0,
    description: 'אסמכתא 5544',
  });

  const candidate = createSyntheticTx({
    id: 'candidate-double',
    amount: 30.0,
    description: 'אסמכתא 5544',
  });

  const list = [target, candidate];
  const firstResult = linkAndEnrichTransactions(list, target.id, candidate.id);
  assert(firstResult.success === true, 'First link succeeds');

  const secondResult = linkAndEnrichTransactions(firstResult.updatedTransactions, target.id, candidate.id);
  assert(secondResult.success === false, 'Second attempt recognized as already linked');
  assert(secondResult.status === 'already_linked', 'Status is already_linked');
}

// =========================================================================
// Test 8: Protection of Post-Link User Manual Edits Upon Unlinking
// =========================================================================
console.log('\n--- Test 8: Protection of Post-Link User Manual Edits Upon Unlinking ---');
{
  const target = createSyntheticTx({
    id: 'target-post-edit-1',
    date: '2026-06-15',
    amount: 120.0,
    merchant: 'עסקה כללית',
    description: 'עסקה כללית אסמכתא 9911',
    category: 'כללי',
  });

  const candidate = createSyntheticTx({
    id: 'card-post-edit-1',
    date: '2026-06-14',
    amount: 120.0,
    merchant: 'רמי לוי שיווק השקמה',
    description: 'רמי לוי אסמכתא 9911',
    category: 'סופרמרקט ומזון',
  });

  const list = [target, candidate];
  const linkResult = linkAndEnrichTransactions(list, target.id, candidate.id);
  assert(linkResult.success === true, 'Pre-condition: Link succeeds');

  // Simulate user making manual edits AFTER the link occurred
  const linkedTarget = linkResult.updatedTransactions.find((t) => t.id === target.id)!;
  const manuallyEditedTarget: Transaction = {
    ...linkedTarget,
    category: 'אירוח וכיבוד משרדי', // User manual edit to category
    userCustomizedCategory: true,
    description: 'הוצאת כיבוד משרדי (עריכת משתמש ידנית)', // User manual edit to description
  };

  const listWithManualEdits = linkResult.updatedTransactions.map((t) =>
    t.id === target.id ? manuallyEditedTarget : t
  );

  // Now user decides to unlink
  const unlinkResult = unlinkTransaction(listWithManualEdits, target.id, candidate.id);
  assert(unlinkResult.success === true, 'Unlink succeeds');

  const unlinkedTarget = unlinkResult.updatedTransactions.find((t) => t.id === target.id)!;

  // Verify: User manual edits were PRESERVED, not stomped by snapshot
  assert(unlinkedTarget.category === 'אירוח וכיבוד משרדי', 'User post-link category edit was PRESERVED');
  assert(unlinkedTarget.description === 'הוצאת כיבוד משרדי (עריכת משתמש ידנית)', 'User post-link description edit was PRESERVED');
  // Merchant was NOT manually edited by user, so it should cleanly revert to original
  assert(unlinkedTarget.merchant === 'עסקה כללית', 'Merchant safely reverted to pre-enrichment original');
  assert(unlinkedTarget.linkedTransactionIds?.length === 0, 'Link was removed');
}

// =========================================================================
// Test 9: Pre-existing originalDate Preservation Upon Unlinking
// =========================================================================
console.log('\n--- Test 9: Pre-existing originalDate Preservation Upon Unlinking ---');
{
  const targetWithPreExistingOriginalDate = createSyntheticTx({
    id: 'target-predate-1',
    date: '2026-06-20',
    originalDate: '2026-06-05', // Pre-existing original date before this link
    amount: 250.0,
    merchant: 'עסקה רגילה',
    description: 'עסקה רגילה אסמכתא 443322',
  });

  const candidate = createSyntheticTx({
    id: 'card-predate-1',
    date: '2026-06-18', // Card purchase date
    amount: 250.0,
    merchant: 'זארה גברים',
    description: 'זארה אסמכתא 443322',
    category: 'ביגוד והנעלה',
  });

  const list = [targetWithPreExistingOriginalDate, candidate];
  const linkResult = linkAndEnrichTransactions(list, targetWithPreExistingOriginalDate.id, candidate.id);
  assert(linkResult.success === true, 'Link succeeds');

  const linkedTarget = linkResult.updatedTransactions.find((t) => t.id === targetWithPreExistingOriginalDate.id)!;
  assert(linkedTarget.originalDate === '2026-06-18', 'Enriched with card purchase date');

  // Unlink
  const unlinkResult = unlinkTransaction(linkResult.updatedTransactions, targetWithPreExistingOriginalDate.id, candidate.id);
  assert(unlinkResult.success === true, 'Unlink succeeds');

  const unlinkedTarget = unlinkResult.updatedTransactions.find((t) => t.id === targetWithPreExistingOriginalDate.id)!;
  assert(unlinkedTarget.originalDate === '2026-06-05', 'Pre-existing originalDate was restored, NOT wiped to undefined');
}

// =========================================================================
// Test 10: Reject Linking When Either Transaction is Already Linked to Another
// =========================================================================
console.log('\n--- Test 10: Reject Linking to Already Linked Transactions ---');
{
  const tx1 = createSyntheticTx({ id: 'tx-alpha', amount: 50.0, description: 'אסמכתא 1122' });
  const tx2 = createSyntheticTx({ id: 'tx-beta', amount: 50.0, description: 'אסמכתא 1122' });
  const tx3 = createSyntheticTx({ id: 'tx-gamma', amount: 50.0, description: 'אסמכתא 1122' });

  const list = [tx1, tx2, tx3];
  const firstLink = linkAndEnrichTransactions(list, tx1.id, tx2.id);
  assert(firstLink.success === true, 'First link between tx1 and tx2 succeeds');

  // Attempt to link tx2 (already linked) with tx3
  const secondLink = linkAndEnrichTransactions(firstLink.updatedTransactions, tx3.id, tx2.id);
  assert(secondLink.success === false, 'Cannot link to candidate that is already linked');
  assert(secondLink.status === 'already_linked', 'Status is already_linked');

  // Attempt to link tx1 (already linked) with tx3
  const thirdLink = linkAndEnrichTransactions(firstLink.updatedTransactions, tx1.id, tx3.id);
  assert(thirdLink.success === false, 'Cannot link target that is already linked');
  assert(thirdLink.status === 'already_linked', 'Status is already_linked');
}

// =========================================================================
// Test 11: Unlink With Missing/Unmatched Snapshot Fails Safely with Conflict (No Mutations)
// =========================================================================
console.log('\n--- Test 11: Unlink With Unmatched Snapshot Fails Safely (No Mutations) ---');
{
  const targetWithOrphanLink = createSyntheticTx({
    id: 'target-orphan-1',
    merchant: 'חנות ספרים',
    description: 'חנות ספרים מרכז',
    category: 'ספרים ופנאי',
    linkedTransactionIds: ['orphan-id-99'],
    enrichmentSnapshots: [], // No snapshot exists for orphan-id-99
  });

  const candidateWithOrphanLink = createSyntheticTx({
    id: 'orphan-id-99',
    merchant: 'סטימצקי',
    description: 'סטימצקי קניון',
    category: 'ספרים',
    linkedTransactionIds: ['target-orphan-1'],
    enrichmentSnapshots: [],
  });

  const list = [targetWithOrphanLink, candidateWithOrphanLink];
  const listSnapshotBefore = JSON.stringify(list);

  const unlinkResult = unlinkTransaction(list, targetWithOrphanLink.id, 'orphan-id-99');

  // Must fail explicitly with conflict
  assert(unlinkResult.success === false, 'Unlink fails explicitly when snapshot is missing');
  assert(unlinkResult.status === 'conflict', 'Status is conflict when snapshot is missing');

  // Must NOT mutate input list or any objects
  assert(JSON.stringify(list) === listSnapshotBefore, 'Original input array and transactions remain strictly untouched');

  // Returned updatedTransactions must be identical to input transactions without changes
  assert(unlinkResult.updatedTransactions === list, 'Returned updatedTransactions array is the unmodified original array');
  assert(unlinkResult.unlinkedTarget?.linkedTransactionIds?.includes('orphan-id-99') === true, 'Target link ID was NOT removed');
  assert(unlinkResult.unlinkedTarget?.merchant === 'חנות ספרים', 'Target merchant unchanged');
  assert(unlinkResult.unlinkedTarget?.category === 'ספרים ופנאי', 'Target category unchanged');
  assert(unlinkResult.unlinkedCandidate?.linkedTransactionIds?.includes('target-orphan-1') === true, 'Candidate link ID was NOT removed');
}

// =========================================================================
// Summary
// =========================================================================
console.log('\n========================================');
console.log(`Summary: ${passedCount} passed, ${failedCount} failed`);
console.log('========================================');

if (failedCount > 0) {
  process.exit(1);
}
