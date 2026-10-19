import {
  evaluateTransactionMatch,
  findCandidatesForTransaction,
  identifyCrossDocumentCandidates,
  extractTransactionReference,
  extractCardLastDigits,
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

console.log('=== TEST SUITE: Cross-Document Candidate Identification (Stage B.1) ===');

// Helper to create synthetic transactions with default values
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
// Group 1: Match with Explicit Reference / Voucher (אסמכתא)
// =========================================================================
console.log('\n--- Group 1: Match with Explicit Reference / Voucher ---');
{
  const target = createSyntheticTx({
    id: 'target-ref-1',
    date: '2026-06-10',
    amount: 142.5,
    currency: 'ILS',
    type: 'expense',
    merchant: 'עסקה רגילה (כולל דביט)',
    description: 'עסקה רגילה (כולל דביט) (אסמכתא: 884712)',
    sourceDocumentType: 'bank_statement',
  });

  const candidateWithMatchingRef = createSyntheticTx({
    id: 'cand-ref-match',
    date: '2026-06-09',
    billingDate: '2026-06-10',
    amount: 142.5,
    currency: 'ILS',
    type: 'expense',
    merchant: 'סופר פארם דיזנגוף',
    description: 'סופר פארם (אסמכתא: 884712)',
    sourceDocumentType: 'credit_card_statement',
  });

  const evaluation = evaluateTransactionMatch(target, candidateWithMatchingRef);

  assert(evaluation.isViableCandidate === true, 'Viable candidate when reference matches');
  assert(evaluation.certainty === 'high_confidence', 'Certainty is high_confidence with matching reference');
  assert(evaluation.evidence.referenceMatch === 'exact', 'Reference match is exact');
  assert(evaluation.evidence.referenceDetails.targetRef === '884712', 'Extracted target ref is 884712');
  assert(evaluation.evidence.referenceDetails.candidateRef === '884712', 'Extracted candidate ref is 884712');
  assert(evaluation.confidenceScore >= 0.9, 'Confidence score >= 0.9 for matching reference');

  // Verify findCandidatesForTransaction
  const searchResult = findCandidatesForTransaction(target, [candidateWithMatchingRef]);
  assert(searchResult.isAmbiguous === false, 'Search result is NOT ambiguous when high-confidence reference matches');
  assert(searchResult.primaryCandidate?.candidateTransactionId === 'cand-ref-match', 'Primary candidate is identified');

  // Test contradictory references
  const candidateWithMismatchedRef = createSyntheticTx({
    id: 'cand-ref-mismatch',
    date: '2026-06-09',
    amount: 142.5,
    currency: 'ILS',
    type: 'expense',
    merchant: 'סופר פארם דיזנגוף',
    description: 'סופר פארם (אסמכתא: 991122)',
    sourceDocumentType: 'credit_card_statement',
  });

  const mismatchEval = evaluateTransactionMatch(target, candidateWithMismatchedRef);
  assert(mismatchEval.isViableCandidate === false, 'Candidate rejected when references contradict');
  assert(mismatchEval.certainty === 'incompatible', 'Certainty is incompatible on reference mismatch');
  assert(mismatchEval.evidence.referenceMatch === 'mismatch', 'Reference match is mismatch');
}

// =========================================================================
// Group 2: Single Candidate Without Reference (Do NOT assume match from absence of info!)
// =========================================================================
console.log('\n--- Group 2: Single Candidate Without Reference / Voucher ---');
{
  const target = createSyntheticTx({
    id: 'target-no-ref',
    date: '2026-06-10',
    amount: 7.23,
    currency: 'ILS',
    type: 'expense',
    merchant: 'עסקה רגילה (כולל דביט)',
    description: 'עסקה רגילה (כולל דביט)',
    sourceDocumentType: 'bank_statement',
  });

  const candidateNoRef = createSyntheticTx({
    id: 'cand-no-ref',
    date: '2026-06-08',
    amount: 7.23,
    currency: 'ILS',
    type: 'expense',
    merchant: 'מאפיית הכפר',
    description: 'מאפיית הכפר',
    sourceDocumentType: 'credit_card_statement',
  });

  const evaluation = evaluateTransactionMatch(target, candidateNoRef);

  assert(evaluation.isViableCandidate === true, 'Candidate is viable based on amount and date proximity');
  assert(
    evaluation.certainty === 'indeterminate',
    'Certainty is INDETERMINATE (amount alone is never treated as conclusive proof)',
    `got ${evaluation.certainty}`
  );
  assert(evaluation.evidence.referenceMatch === 'none', 'Reference match is none');
  assert(evaluation.ambiguityReasons.length > 0, 'Ambiguity reasons are documented');

  const searchResult = findCandidatesForTransaction(target, [candidateNoRef]);
  assert(
    searchResult.isAmbiguous === true,
    'Search result is marked AMBIGUOUS despite being sole candidate (requires user verification)'
  );
  assert(searchResult.primaryCandidate === undefined, 'No primaryCandidate auto-assigned without solid proof');
  assert(
    searchResult.summaryReason.includes('נדרש אימות משתמש'),
    'Summary reason indicates user verification is required'
  );
}

// =========================================================================
// Group 3: Multiple Candidates With Identical Amount (Disambiguation)
// =========================================================================
console.log('\n--- Group 3: Multiple Candidates With Identical Amount ---');
{
  const target = createSyntheticTx({
    id: 'target-multi',
    date: '2026-06-10',
    amount: 50.0,
    currency: 'ILS',
    type: 'expense',
    merchant: 'עסקה רגילה (כולל דביט)',
    description: 'עסקה רגילה (כולל דביט)',
    sourceDocumentType: 'bank_statement',
  });

  const cand1 = createSyntheticTx({
    id: 'cand-multi-1',
    date: '2026-06-09',
    amount: 50.0,
    currency: 'ILS',
    type: 'expense',
    merchant: 'קפה לנדוור',
    description: 'קפה לנדוור',
    sourceDocumentType: 'credit_card_statement',
  });

  const cand2 = createSyntheticTx({
    id: 'cand-multi-2',
    date: '2026-06-08',
    amount: 50.0,
    currency: 'ILS',
    type: 'expense',
    merchant: 'ארומה אספרסו בר',
    description: 'ארומה אספרסו בר',
    sourceDocumentType: 'credit_card_statement',
  });

  const searchResult = findCandidatesForTransaction(target, [cand1, cand2]);
  assert(searchResult.viableCandidates.length === 2, 'Found 2 viable candidates');
  assert(searchResult.isAmbiguous === true, 'Flagged as ambiguous due to multi-candidates');
  assert(searchResult.primaryCandidate === undefined, 'No primary candidate selected blindly');
  assert(searchResult.summaryReason.includes('2 מועמדים'), 'Summary notes multiple candidates');
}

// =========================================================================
// Group 4: Same Amount With Different Currency
// =========================================================================
console.log('\n--- Group 4: Same Amount With Different Currency ---');
{
  const target = createSyntheticTx({
    id: 'target-ils',
    amount: 100.0,
    currency: 'ILS',
  });

  const candidateUsd = createSyntheticTx({
    id: 'cand-usd',
    amount: 100.0,
    currency: 'USD',
  });

  const evaluation = evaluateTransactionMatch(target, candidateUsd);
  assert(evaluation.isViableCandidate === false, 'Currency mismatch rejected as viable candidate');
  assert(evaluation.certainty === 'incompatible', 'Certainty is incompatible');
  assert(evaluation.evidence.currencyMatch === false, 'evidence.currencyMatch is false');
  assert(
    evaluation.evidence.riskOrAmbiguityFactors.some((f) => f.includes('סתירת מטבע')),
    'Risk factors mention currency conflict'
  );
}

// =========================================================================
// Group 5: Different Transaction Flow Directions (Expense vs Income/Refund)
// =========================================================================
console.log('\n--- Group 5: Different Transaction Directions ---');
{
  const targetExpense = createSyntheticTx({
    id: 'target-exp',
    amount: 200.0,
    type: 'expense',
  });

  const candidateIncome = createSyntheticTx({
    id: 'cand-inc',
    amount: 200.0,
    type: 'income',
  });

  const candidateRefund = createSyntheticTx({
    id: 'cand-ref',
    amount: 200.0,
    type: 'refund',
  });

  const evalIncome = evaluateTransactionMatch(targetExpense, candidateIncome);
  assert(evalIncome.isViableCandidate === false, 'Expense vs Income rejected');
  assert(evalIncome.evidence.flowDirectionMatch === false, 'flowDirectionMatch is false for expense vs income');

  const evalRefund = evaluateTransactionMatch(targetExpense, candidateRefund);
  assert(evalRefund.isViableCandidate === false, 'Expense vs Refund rejected');
  assert(evalRefund.evidence.flowDirectionMatch === false, 'flowDirectionMatch is false for expense vs refund');
}

// =========================================================================
// Group 6: Missing or Contradictory Dates
// =========================================================================
console.log('\n--- Group 6: Missing or Contradictory Dates ---');
{
  // 6a: Contradictory chronology: Candidate purchase is AFTER bank debit date
  const targetBankDebit = createSyntheticTx({
    id: 'target-bank-date',
    date: '2026-06-10',
    amount: 85.0,
  });

  const candidateFuturePurchase = createSyntheticTx({
    id: 'cand-future-date',
    date: '2026-06-15', // 5 days AFTER the bank debit!
    amount: 85.0,
  });

  const evalFuture = evaluateTransactionMatch(targetBankDebit, candidateFuturePurchase);
  assert(evalFuture.isViableCandidate === false, 'Rejected candidate with purchase date after bank debit date');
  assert(evalFuture.certainty === 'incompatible', 'Incompatible due to chronological contradiction');
  assert(evalFuture.evidence.dateRelationship === 'candidate_after_target', 'dateRelationship is candidate_after_target');
  assert(evalFuture.evidence.dateDeltaDays! < 0, 'dateDeltaDays is negative');

  // 6b: Missing or invalid date
  const candidateMissingDate = createSyntheticTx({
    id: 'cand-missing-date',
    date: '',
    amount: 85.0,
  });

  const evalMissing = evaluateTransactionMatch(targetBankDebit, candidateMissingDate);
  assert(evalMissing.isViableCandidate === false, 'Rejected candidate with missing date');
  assert(evalMissing.evidence.dateRelationship === 'date_missing', 'dateRelationship is date_missing');

  // 6c: Excessive date delta (> 35 days)
  const candidateOldPurchase = createSyntheticTx({
    id: 'cand-old-date',
    date: '2026-04-10', // 61 days earlier
    amount: 85.0,
  });

  const evalOld = evaluateTransactionMatch(targetBankDebit, candidateOldPurchase);
  assert(evalOld.isViableCandidate === false, 'Rejected candidate with delta > 35 days');
}

// =========================================================================
// Group 7: Already Linked Transactions (Prevent Double Matching)
// =========================================================================
console.log('\n--- Group 7: Already Linked Transactions ---');
{
  const target = createSyntheticTx({
    id: 'target-clean',
    amount: 120.0,
    date: '2026-06-10',
  });

  const candidateAlreadyLinked = createSyntheticTx({
    id: 'cand-already-linked',
    amount: 120.0,
    date: '2026-06-10',
    linkedTransactionIds: ['tx-prior-reconciled-999'],
  });

  const evaluation = evaluateTransactionMatch(target, candidateAlreadyLinked);
  assert(evaluation.isViableCandidate === false, 'Already-linked candidate rejected from auto-matching');
  assert(evaluation.certainty === 'incompatible', 'Certainty is incompatible');
  assert(evaluation.evidence.alreadyLinkedStatus.candidateLinked === true, 'candidateLinked is flagged true');
  assert(
    evaluation.ambiguityReasons.some((r) => r.includes('מניעת קישור כפול')),
    'Ambiguity reason notes prevention of double-linking'
  );
}

// =========================================================================
// Group 8: Card 4 Digits Verification & Mismatch
// =========================================================================
console.log('\n--- Group 8: Card 4 Digits Verification & Mismatch ---');
{
  const targetWithCard = createSyntheticTx({
    id: 'target-card-1234',
    amount: 33.0,
    date: '2026-06-10',
    description: 'עסקה רגילה (כרטיס 1234)',
  });

  const candWithSameCard = createSyntheticTx({
    id: 'cand-card-1234',
    amount: 33.0,
    date: '2026-06-10',
    description: 'סנדוויץ בר (דביט 1234)',
  });

  const candWithDifferentCard = createSyntheticTx({
    id: 'cand-card-5678',
    amount: 33.0,
    date: '2026-06-10',
    description: 'סנדוויץ בר (כרטיס 5678)',
  });

  const evalSameCard = evaluateTransactionMatch(targetWithCard, candWithSameCard);
  assert(evalSameCard.evidence.cardDigitsMatch === 'match', 'Card digits match');
  assert(evalSameCard.evidence.cardDigitsDetails.targetCard === '1234', 'Target card extracted as 1234');
  assert(evalSameCard.evidence.cardDigitsDetails.candidateCard === '1234', 'Candidate card extracted as 1234');
  assert(evalSameCard.certainty === 'high_confidence', 'Certainty is high_confidence with matching card digits');

  const evalDiffCard = evaluateTransactionMatch(targetWithCard, candWithDifferentCard);
  assert(evalDiffCard.isViableCandidate === false, 'Rejected candidate with mismatched card digits');
  assert(evalDiffCard.certainty === 'incompatible', 'Certainty incompatible when cards differ');
  assert(evalDiffCard.evidence.cardDigitsMatch === 'mismatch', 'cardDigitsMatch is mismatch');
}

// =========================================================================
// Group 9: Read-Only Purity (Immutability Verification)
// =========================================================================
console.log('\n--- Group 9: Read-Only Purity Verification ---');
{
  const originalTx = createSyntheticTx({
    id: 'purity-test-tx',
    amount: 55.5,
    date: '2026-06-10',
    category: 'מזון ומשקאות',
    needsReview: true,
    userConfirmed: true,
  });

  const cloneBefore = JSON.stringify(originalTx);

  const candidateTx = createSyntheticTx({
    id: 'purity-candidate-tx',
    amount: 55.5,
    date: '2026-06-10',
    category: 'ביגוד והנעלה',
  });

  const cloneCandidateBefore = JSON.stringify(candidateTx);

  // Run all functions
  evaluateTransactionMatch(originalTx, candidateTx);
  findCandidatesForTransaction(originalTx, [candidateTx]);
  identifyCrossDocumentCandidates([originalTx, candidateTx]);

  const cloneAfter = JSON.stringify(originalTx);
  const cloneCandidateAfter = JSON.stringify(candidateTx);

  assert(cloneBefore === cloneAfter, 'Target transaction was NOT mutated in any way (100% pure)');
  assert(cloneCandidateBefore === cloneCandidateAfter, 'Candidate transaction was NOT mutated in any way (100% pure)');
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
