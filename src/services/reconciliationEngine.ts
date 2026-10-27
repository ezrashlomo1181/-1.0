import { Transaction, SourceRecord, DuplicateCandidate, TransactionType, EnrichmentSnapshot } from '../types/financial';

export interface ReconciliationReport {
  reconciledTransactions: Transaction[];
  reconciledSettlementsCount: number;
  matchedDetailedTransactionsCount: number;
  unmatchedSettlementsCount: number;
  reconciliationNotes: string[];
}

/**
 * Restore original transactions from a merged transaction (full Unmerge).
 * Returns the separated transactions in their pristine accounting state.
 */
export function unmergeTransaction(mergedTx: Transaction): Transaction[] {
  // If no mergeHistory snapshot exists, return the transaction as is
  if (!mergedTx.mergeHistory || mergedTx.mergeHistory.length === 0) {
    return [mergedTx];
  }

  // The earliest or most complete snapshot contains the pristine original transactions
  const latestSnapshot = mergedTx.mergeHistory[mergedTx.mergeHistory.length - 1];
  if (latestSnapshot.originalTransactions && latestSnapshot.originalTransactions.length > 0) {
    return latestSnapshot.originalTransactions.map((orig) => {
      const restored: Transaction = {
        ...orig,
        // Ensure not marked as merged or needing verification from old state
        idempotencyKey: orig.idempotencyKey || (orig.sourceRecords?.[0]?.idempotencyKey),
      };
      return restored;
    });
  }

  // Fallback: reconstruct from sourceRecords if snapshot was empty
  if (mergedTx.sourceRecords && mergedTx.sourceRecords.length > 1) {
    return mergedTx.sourceRecords.map((sr) => {
      const restoredTx: Transaction = {
        id: sr.id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        date: sr.date,
        originalDate: sr.originalDate || sr.date,
        amount: sr.amount,
        currency: 'ILS',
        merchant: sr.merchant || mergedTx.merchant,
        description: sr.description || mergedTx.description,
        accountId: sr.accountId || mergedTx.accountId,
        accountName: sr.accountName || mergedTx.accountName,
        paymentMethod: sr.paymentMethod || mergedTx.paymentMethod,
        category: mergedTx.category,
        type: mergedTx.type,
        isRecurring: mergedTx.isRecurring,
        confidenceScore: 1,
        confidenceLevel: 'high',
        needsReview: false,
        userConfirmed: true,
        sourceDocument: sr.sourceDocument,
        sourceDocumentType: sr.sourceDocumentType,
        sourceRecords: [sr],
        idempotencyKey: sr.idempotencyKey,
      };
      return restoredTx;
    });
  }

  return [mergedTx];
}

/**
 * Identify source document role for a transaction
 */
export function identifyDocumentRole(tx: Transaction): 'bank_statement' | 'credit_card_statement' | 'detailed_report' | 'other' {
  if (tx.sourceDocumentType) return tx.sourceDocumentType;

  const doc = (tx.sourceDocument || '').toLowerCase();
  const acc = (tx.accountName || '').toLowerCase();
  const desc = (tx.description || '').toLowerCase();
  const inst = `${doc} ${acc} ${desc}`;

  if (
    inst.includes('עוש') ||
    inst.includes('עו"ש') ||
    inst.includes('פועלים') ||
    inst.includes('לאומי') ||
    inst.includes('דיסקונט') ||
    inst.includes('מזרחי') ||
    inst.includes('יהב') ||
    inst.includes('בינלאומי') ||
    inst.includes('תדפיס') ||
    inst.includes('bank')
  ) {
    return 'bank_statement';
  }

  if (
    inst.includes('ישראכרט') ||
    inst.includes('isracard') ||
    inst.includes('מקס') ||
    inst.includes('max') ||
    inst.includes('כאל') ||
    inst.includes('cal') ||
    inst.includes('ויזה') ||
    inst.includes('visa') ||
    inst.includes('מאסטרקארד') ||
    inst.includes('mastercard') ||
    inst.includes('אשראי') ||
    tx.paymentMethod === 'credit_card'
  ) {
    return 'credit_card_statement';
  }

  return 'other';
}

/**
 * Check if a bank-side row represents a consolidated credit card debit/settlement
 */
export function isConsolidatedCardSettlement(tx: Transaction): boolean {
  const combined = `${tx.merchant || ''} ${tx.description || ''} ${tx.rawText || ''}`.toLowerCase();

  // Exclude explicit point-of-sale debit or regular retail purchases
  if (
    combined.includes('עסקה רגילה (כולל דביט)') ||
    combined.includes('רכישת דביט') ||
    combined.includes('משיכת דביט') ||
    combined.includes('דביט מיידי')
  ) {
    return false;
  }

  // Check for consolidated settlement keywords
  const hasSettlementKeyword =
    combined.includes('חיוב כרטיס') ||
    combined.includes('חיוב כרטיסי אשראי') ||
    combined.includes('פירעון כרטיס') ||
    combined.includes('פירעון כרטיסי אשראי') ||
    combined.includes('חיוב מרוכז') ||
    combined.includes('חיוב ויזה') ||
    combined.includes('חיוב ישראכרט') ||
    combined.includes('חיוב כאל') ||
    combined.includes('חיוב מקס') ||
    combined.includes('חיוב מאסטרקארד') ||
    combined.includes('חיוב לאומי קארד') ||
    combined.includes('חיוב אמריקן אקספרס') ||
    combined.includes('חיוב דיינרס') ||
    combined.includes('חיוב icc') ||
    combined.includes('חיוב amex') ||
    combined.includes('חיוב mastercard') ||
    combined.includes('חיוב visa') ||
    combined.includes('חיוב cal') ||
    combined.includes('חיוב max') ||
    combined.includes('חיוב isracard') ||
    combined.includes('חיוב diners') ||
    combined.includes('הוראת קבע כרטיס') ||
    combined.includes('הוראת קבע כרטיסי אשראי') ||
    combined.includes('חיוב ח-ן כרטיס') ||
    combined.includes('חיוב חודשי כרטיס') ||
    combined.includes('חיוב חודשי - כרטיס') ||
    combined.includes('credit card settlement') ||
    combined.includes('credit card payment') ||
    combined.includes('card settlement');

  if (hasSettlementKeyword) return true;

  // Combination check: Card issuer name + settlement action
  const hasIssuer =
    combined.includes('ישראכרט') ||
    combined.includes('isracard') ||
    combined.includes('מקס') ||
    combined.includes('max') ||
    combined.includes('כאל') ||
    combined.includes('cal') ||
    combined.includes('ויזה') ||
    combined.includes('visa') ||
    combined.includes('מאסטרקארד') ||
    combined.includes('mastercard') ||
    combined.includes('דיינרס') ||
    combined.includes('diners') ||
    combined.includes('אמריקן אקספרס') ||
    combined.includes('amex') ||
    combined.includes('icc');

  const hasAction =
    combined.includes('חיוב') ||
    combined.includes('פירעון') ||
    combined.includes('סילוקין') ||
    combined.includes('הוראת קבע');

  if (hasIssuer && hasAction) {
    const isRetailMerchant =
      combined.includes('שופרסל') ||
      combined.includes('סופר-פארם') ||
      combined.includes('פארם') ||
      combined.includes('קפה') ||
      combined.includes('דלק') ||
      combined.includes('מסעד') ||
      combined.includes('רשת');
    return !isRetailMerchant;
  }

  return false;
}

export interface CandidateStatementGroup {
  groupKey: string;
  cardDigits?: string;
  billingDate?: string;
  cycleKey: string;
  accountName: string;
  transactions: Transaction[];
  netSum: number;
  earliestDate: string;
  latestDate: string;
}

/**
 * CENTRAL CROSS-DOCUMENT RECONCILIATION ENGINE
 *
 * Tiered multi-level reconciliation linking bank-side consolidated settlements with detailed credit card statements.
 * Enforces hierarchy: card last digits -> amount match -> billing cycle compatibility.
 * Safeguards accounting integrity: unresolved debits remain expenses; never auto-matches ambiguous candidates.
 */
export function reconcileCrossDocumentTransactions(transactions: Transaction[]): ReconciliationReport {
  if (!transactions || transactions.length === 0) {
    return {
      reconciledTransactions: [],
      reconciledSettlementsCount: 0,
      matchedDetailedTransactionsCount: 0,
      unmatchedSettlementsCount: 0,
      reconciliationNotes: [],
    };
  }

  // Clone transactions to ensure immutability
  const cloned: Transaction[] = transactions.map((t) => ({
    ...t,
    sourceDocumentType: identifyDocumentRole(t),
  }));

  const reconciliationNotes: string[] = [];
  let reconciledSettlementsCount = 0;
  let matchedDetailedTransactionsCount = 0;
  let unmatchedSettlementsCount = 0;

  // Separate potential bank settlements from detailed card transactions
  const bankSettlements: Transaction[] = [];
  const detailedCardTxs: Transaction[] = [];

  for (const t of cloned) {
    const role = identifyDocumentRole(t);
    if (role === 'bank_statement' && isConsolidatedCardSettlement(t)) {
      bankSettlements.push(t);
    } else if ((role === 'credit_card_statement' || role === 'detailed_report') && !isConsolidatedCardSettlement(t)) {
      detailedCardTxs.push(t);
    }
  }

  // Group detailed card transactions by card digits (or account) + billing cycle
  const groupsMap = new Map<string, CandidateStatementGroup>();

  for (const cardTx of detailedCardTxs) {
    const cardDigits = extractCardLastDigits(cardTx);
    const cardIdentifier = cardDigits ? `card_${cardDigits}` : (cardTx.accountId || cardTx.accountName || 'unknown_card');
    const cycleKey = cardTx.billingDate || (cardTx.date ? cardTx.date.substring(0, 7) : 'unknown_cycle');
    const groupKey = `${cardIdentifier}:::${cycleKey}`;

    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, {
        groupKey,
        cardDigits,
        billingDate: cardTx.billingDate,
        cycleKey,
        accountName: cardTx.accountName || 'כרטיס אשראי',
        transactions: [],
        netSum: 0,
        earliestDate: cardTx.date,
        latestDate: cardTx.date,
      });
    }

    const group = groupsMap.get(groupKey)!;
    group.transactions.push(cardTx);
    if (!group.billingDate && cardTx.billingDate) {
      group.billingDate = cardTx.billingDate;
    }
    if (!group.cardDigits && cardDigits) {
      group.cardDigits = cardDigits;
    }
    if (cardTx.date < group.earliestDate) group.earliestDate = cardTx.date;
    if (cardTx.date > group.latestDate) group.latestDate = cardTx.date;
  }

  // Calculate netSum for each group (purchases minus refunds)
  for (const group of groupsMap.values()) {
    group.netSum = group.transactions.reduce((sum, t) => {
      const amt = Math.abs(t.amount);
      return sum + (t.type === 'refund' ? -amt : amt);
    }, 0);
  }

  const matchedGroupKeys = new Set<string>();

  // Reconcile each bank settlement using tiered matching hierarchy
  for (const settlement of bankSettlements) {
    const settlementDate = settlement.date;
    const settlementAmt = Math.abs(settlement.amount);
    const settlementDigits = extractCardLastDigits(settlement);

    // Evaluate against all available candidate statement groups
    interface GroupEval {
      group: CandidateStatementGroup;
      digitsMatch: boolean;
      digitsMismatch: boolean;
      isSumMatch: boolean;
      diff: number;
      isDateCompatible: boolean;
      exactBillingMatch: boolean;
    }

    const groupEvals: GroupEval[] = [];

    for (const [key, group] of groupsMap.entries()) {
      if (matchedGroupKeys.has(key)) continue;

      let digitsMatch = false;
      let digitsMismatch = false;

      if (settlementDigits && group.cardDigits) {
        if (settlementDigits === group.cardDigits) {
          digitsMatch = true;
        } else {
          digitsMismatch = true;
        }
      }

      const diff = Math.abs(group.netSum - settlementAmt);
      const isSumMatch = diff <= 2.5;

      // Date check
      let isDateCompatible = false;
      let exactBillingMatch = false;

      if (group.billingDate) {
        if (settlementDate === group.billingDate) {
          isDateCompatible = true;
          exactBillingMatch = true;
        } else {
          const sTime = new Date(settlementDate).getTime();
          const bTime = new Date(group.billingDate).getTime();
          const deltaDays = Math.round((sTime - bTime) / (1000 * 3600 * 24));
          // Bank debit is usually on or within -3 to 14 days of card statement billing date
          if (deltaDays >= -3 && deltaDays <= 14) {
            isDateCompatible = true;
          }
        }
      } else {
        // Fallback to transaction date proximity (within 45 days)
        const sTime = new Date(settlementDate).getTime();
        const lTime = new Date(group.latestDate).getTime();
        const deltaDays = Math.round((sTime - lTime) / (1000 * 3600 * 24));
        if (deltaDays >= -3 && deltaDays <= 45) {
          isDateCompatible = true;
        }
      }

      groupEvals.push({
        group,
        digitsMatch,
        digitsMismatch,
        isSumMatch,
        diff,
        isDateCompatible,
        exactBillingMatch,
      });
    }

    // Tier 1: Strong Candidates (matching digits + matching sum + compatible date)
    const strongCandidates = groupEvals.filter(
      (e) => e.digitsMatch && e.isSumMatch && e.isDateCompatible
    );

    // Tier 2: Same card digits and cycle date, but sum discrepancy
    const discrepancyCandidates = groupEvals.filter(
      (e) => e.digitsMatch && !e.isSumMatch && e.isDateCompatible && e.diff < settlementAmt * 0.5
    );

    // Tier 3: Candidates without card digits (or unknown on one side) that match sum and date, with NO digits mismatch
    const noDigitsSumMatches = groupEvals.filter(
      (e) => !e.digitsMatch && !e.digitsMismatch && e.isSumMatch && e.isDateCompatible
    );

    if (strongCandidates.length === 1) {
      // Unambiguous verified match by 4 digits and sum
      const match = strongCandidates[0];
      const matchedGroup = match.group;
      matchedGroupKeys.add(matchedGroup.groupKey);

      reconciledSettlementsCount++;
      matchedDetailedTransactionsCount += matchedGroup.transactions.length;

      settlement.type = 'transfer';
      settlement.isInternalTransfer = true;
      settlement.isAggregateSettlement = true;
      settlement.reconciliationStatus = 'settlement_matched';
      settlement.cardLastDigits = settlementDigits || matchedGroup.cardDigits;
      settlement.linkedTransactionIds = matchedGroup.transactions.map((t) => t.id);
      settlement.reconciliationEvidence = `התאמה מלאה: 4 ספרות כרטיס (${settlement.cardLastDigits}), תאריך חיוב וסכום זהה ₪${settlementAmt.toLocaleString()}`;
      settlement.needsReview = false;
      settlement.reviewReason = undefined;

      for (const dTx of matchedGroup.transactions) {
        dTx.reconciliationStatus = 'reconciled';
        dTx.parentTransactionId = settlement.id;
        if (!dTx.cardLastDigits && settlement.cardLastDigits) {
          dTx.cardLastDigits = settlement.cardLastDigits;
        }
        if (!dTx.linkedTransactionIds) dTx.linkedTransactionIds = [];
        if (!dTx.linkedTransactionIds.includes(settlement.id)) {
          dTx.linkedTransactionIds.push(settlement.id);
        }
      }

      reconciliationNotes.push(
        `הותאם חיוב כרטיס בעו"ש (₪${settlementAmt.toLocaleString()}, כרטיס ${settlement.cardLastDigits}) מול ${matchedGroup.transactions.length} עסקאות פירוט.`
      );
    } else if (strongCandidates.length > 1) {
      // Multiple cycles for the same card matching the exact amount - ambiguous!
      unmatchedSettlementsCount++;
      settlement.type = 'expense';
      settlement.isInternalTransfer = false;
      settlement.isAggregateSettlement = true;
      settlement.reconciliationStatus = 'partial';
      settlement.needsReview = true;
      settlement.reviewReason = `זוהו מספר מחזורים שונים של כרטיס ${settlementDigits} בעלי סכום זהה (₪${settlementAmt.toLocaleString()}) – דרוש אימות משתמש להכרעה.`;

      reconciliationNotes.push(
        `עמימות: מספר מחזורים של כרטיס ${settlementDigits} בעלי סכום זהה (₪${settlementAmt.toLocaleString()}). הועבר לבקרת משתמש.`
      );
    } else if (discrepancyCandidates.length > 0) {
      // Found the card statement for this card, but sum does not match!
      const disc = discrepancyCandidates[0];
      unmatchedSettlementsCount++;
      settlement.type = 'expense';
      settlement.isInternalTransfer = false;
      settlement.isAggregateSettlement = true;
      settlement.reconciliationStatus = 'partial';
      settlement.needsReview = true;
      settlement.cardLastDigits = settlementDigits;
      settlement.reviewReason = `זוהה פירוט עסקאות לכרטיס (${settlementDigits}) אך קיים פער סכום של ₪${Math.round(disc.diff).toLocaleString()} (חיוב בנק: ₪${settlementAmt.toLocaleString()} מול סכום עסקאות: ₪${disc.group.netSum.toLocaleString()}) – דרוש אימות משתמש.`;

      reconciliationNotes.push(
        `פער סכום: חיוב כרטיס ${settlementDigits} בעו"ש (₪${settlementAmt.toLocaleString()}) שונה מסכום הפירוט (₪${disc.group.netSum.toLocaleString()}). נשמר כהוצאה בבקרת משתמש.`
      );
    } else if (noDigitsSumMatches.length === 1) {
      // Single match without 4 digits.
      // Auto-confirm ONLY if exact billing date matches OR only 1 card group exists in system,
      // and no other groups have confusing similar amounts.
      const totalAvailableGroups = Array.from(groupsMap.values()).filter((g) => !matchedGroupKeys.has(g.groupKey));
      const match = noDigitsSumMatches[0];

      const otherConfusingGroups = totalAvailableGroups.filter(
        (g) => g.groupKey !== match.group.groupKey && Math.abs(g.netSum - settlementAmt) < 50
      );

      if ((match.exactBillingMatch || totalAvailableGroups.length === 1) && otherConfusingGroups.length === 0) {
        // Unambiguous match!
        const matchedGroup = match.group;
        matchedGroupKeys.add(matchedGroup.groupKey);

        reconciledSettlementsCount++;
        matchedDetailedTransactionsCount += matchedGroup.transactions.length;

        settlement.type = 'transfer';
        settlement.isInternalTransfer = true;
        settlement.isAggregateSettlement = true;
        settlement.reconciliationStatus = 'settlement_matched';
        settlement.cardLastDigits = matchedGroup.cardDigits;
        settlement.linkedTransactionIds = matchedGroup.transactions.map((t) => t.id);
        settlement.reconciliationEvidence = `התאמה מלאה: תאריך חיוב חד-משמעי (${settlementDate}) וסכום זהה ₪${settlementAmt.toLocaleString()}`;
        settlement.needsReview = false;
        settlement.reviewReason = undefined;

        for (const dTx of matchedGroup.transactions) {
          dTx.reconciliationStatus = 'reconciled';
          dTx.parentTransactionId = settlement.id;
          if (!dTx.linkedTransactionIds) dTx.linkedTransactionIds = [];
          if (!dTx.linkedTransactionIds.includes(settlement.id)) {
            dTx.linkedTransactionIds.push(settlement.id);
          }
        }

        reconciliationNotes.push(
          `הותאם חיוב כרטיס בעו"ש (₪${settlementAmt.toLocaleString()}) מול ${matchedGroup.transactions.length} עסקאות פירוט ללא ספרות כרטיס (ראיות חד-משמעיות).`
        );
      } else {
        // Ambiguous without digits
        unmatchedSettlementsCount++;
        settlement.type = 'expense';
        settlement.isInternalTransfer = false;
        settlement.isAggregateSettlement = true;
        settlement.reconciliationStatus = 'partial';
        settlement.needsReview = true;
        settlement.reviewReason = `נמצאה התאמת סכום (₪${settlementAmt.toLocaleString()}) אך ללא 4 ספרות כרטיס מאמתות וללא תאריך חיוב חד-משמעי – נדרש אימות משתמש.`;

        reconciliationNotes.push(
          `עמימות: התאמת סכום ללא ספרות כרטיס מאמתות (₪${settlementAmt.toLocaleString()}). הועבר לבקרת משתמש.`
        );
      }
    } else if (noDigitsSumMatches.length > 1) {
      // Multiple cards with identical sum without digits (competing candidates!)
      unmatchedSettlementsCount++;
      settlement.type = 'expense';
      settlement.isInternalTransfer = false;
      settlement.isAggregateSettlement = true;
      settlement.reconciliationStatus = 'partial';
      settlement.needsReview = true;
      settlement.reviewReason = `זוהו ${noDigitsSumMatches.length} כרטיסים שונים בעלי סכום זהה (₪${settlementAmt.toLocaleString()}) – נדרש אימות משתמש להכרעה בין הכרטיסים.`;

      reconciliationNotes.push(
        `עמימות: ${noDigitsSumMatches.length} כרטיסים שונים בעלי סכום זהה (₪${settlementAmt.toLocaleString()}). הועבר לבקרת משתמש.`
      );
    } else {
      // No matching statement at all (missing statement file)
      unmatchedSettlementsCount++;
      settlement.type = 'expense';
      settlement.isInternalTransfer = false;
      settlement.isAggregateSettlement = true;
      settlement.reconciliationStatus = 'unreconciled';
      settlement.category = settlement.category || 'חיוב כרטיס אשראי (ללא פירוט)';
      settlement.needsReview = true;
      settlement.reviewReason =
        'חיוב כרטיס אשראי מרוכז בחשבון העו"ש ללא קובץ פירוט עסקאות מקביל – נספר כהוצאה כוללת כדי שהתזרים לא ייפגע, עד לייבוא פירוט הכרטיס.';

      reconciliationNotes.push(
        `נמצא חיוב כרטיס בעו"ש (₪${settlementAmt.toLocaleString()}) ללא פירוט מקביל. נכלל כהוצאה בבקרת משתמש.`
      );
    }
  }

  // 1-to-1 match check for generic bank transactions with detailed descriptions
  for (const t of cloned) {
    if (
      t.sourceDocumentType === 'bank_statement' &&
      !isConsolidatedCardSettlement(t) &&
      (t.merchant === 'עסקה ללא פירוט' || t.merchant === 'עסקה ללא שם' || t.merchant.includes('חיוב כרטיס') || t.description.includes('עסקה רגילה')) &&
      !t.linkedTransactionIds?.length
    ) {
      // Look for a single card transaction with identical date and amount
      const singleMatch = detailedCardTxs.find(
        (c) => c.date === t.date && Math.abs(c.amount - t.amount) < 0.01 && !c.linkedTransactionIds?.length
      );

      if (singleMatch) {
        t.linkedTransactionIds = [singleMatch.id];
        singleMatch.linkedTransactionIds = [t.id];
        t.reconciliationStatus = 'reconciled';
        singleMatch.reconciliationStatus = 'reconciled';
        t.description = `${t.description} -> הותאם ל-${singleMatch.merchant}`;
      }
    }
  }

  return {
    reconciledTransactions: cloned,
    reconciledSettlementsCount,
    matchedDetailedTransactionsCount,
    unmatchedSettlementsCount,
    reconciliationNotes,
  };
}

// =========================================================================
// STAGE B.1: ISOLATED READ-ONLY CROSS-DOCUMENT CANDIDATE IDENTIFICATION
// =========================================================================

export type MatchCertainty = 'high_confidence' | 'indeterminate' | 'incompatible';

export interface MatchEvidence {
  amountMatch: boolean;
  currencyMatch: boolean;
  currencyDetails: { targetCurrency: string; candidateCurrency: string };
  flowDirectionMatch: boolean;
  flowDirectionDetails: { targetType: TransactionType; candidateType: TransactionType };
  referenceMatch: 'exact' | 'none' | 'mismatch';
  referenceDetails: { targetRef?: string; candidateRef?: string };
  cardDigitsMatch: 'match' | 'mismatch' | 'not_available';
  cardDigitsDetails: { targetCard?: string; candidateCard?: string };
  dateRelationship:
    | 'exact_date'
    | 'billing_date_match'
    | 'date_delta_acceptable'
    | 'candidate_precedes_target'
    | 'candidate_after_target'
    | 'date_missing'
    | 'unknown_semantics';
  dateDeltaDays?: number;
  dateExplanation: string;
  accountCompatibility: 'cross_account' | 'same_account' | 'indeterminate';
  alreadyLinkedStatus: { targetLinked: boolean; candidateLinked: boolean };
  positiveIndicators: string[];
  riskOrAmbiguityFactors: string[];
}

export interface CandidateEvaluation {
  candidateTransactionId: string;
  candidateTransaction: Transaction;
  certainty: MatchCertainty;
  confidenceScore: number;
  evidence: MatchEvidence;
  ambiguityReasons: string[];
  isViableCandidate: boolean;
}

export interface CrossDocumentMatchResult {
  targetTransactionId: string;
  targetTransaction: Transaction;
  totalCandidatesEvaluated: number;
  viableCandidates: CandidateEvaluation[];
  isAmbiguous: boolean;
  primaryCandidate?: CandidateEvaluation;
  summaryReason: string;
}

/**
 * Extracts reference / voucher / אסמכתא from transaction description or metadata.
 * Pure and read-only.
 */
export function extractTransactionReference(tx: Transaction): string | undefined {
  if (tx.description) {
    const m = tx.description.match(/(?:אסמכתא|שובר|ref(?:erence)?)\s*[:#\-]?\s*(\d{4,12})/i);
    if (m) return m[1].trim();
  }
  if (tx.merchant) {
    const m = tx.merchant.match(/(?:אסמכתא|שובר|ref(?:erence)?)\s*[:#\-]?\s*(\d{4,12})/i);
    if (m) return m[1].trim();
  }
  if (tx.idempotencyKey && tx.idempotencyKey.startsWith('idem:ref:')) {
    const parts = tx.idempotencyKey.replace('idem:ref:', '').split('_');
    if (parts[0]) return parts[0];
  }
  if (tx.sourceRecords && tx.sourceRecords.length > 0) {
    for (const sr of tx.sourceRecords) {
      if (sr.idempotencyKey && sr.idempotencyKey.startsWith('idem:ref:')) {
        const parts = sr.idempotencyKey.replace('idem:ref:', '').split('_');
        if (parts[0]) return parts[0];
      }
      if (sr.description) {
        const m = sr.description.match(/(?:אסמכתא|שובר|ref(?:erence)?)\s*[:#\-]?\s*(\d{4,12})/i);
        if (m) return m[1].trim();
      }
    }
  }
  return undefined;
}

/**
 * Extracts masked or explicitly referenced card last 4 digits from descriptions and account info.
 * Pure and read-only.
 */
export function extractCardLastDigits(tx: Transaction): string | undefined {
  if (tx.cardLastDigits && /^\d{4}$/.test(tx.cardLastDigits.trim())) {
    return tx.cardLastDigits.trim();
  }

  const textPool = [
    tx.merchant,
    tx.description,
    tx.rawText,
    tx.accountName,
    tx.sourceRecords?.[0]?.description,
  ]
    .filter(Boolean)
    .join(' ');

  const patterns = [
    /(?:כרטיס|דביט|visa|cal|max|mastercard|ישראכרט|amex|diners|אמריקן\s*אקספרס|דיינרס|לאומי\s*קארד|icc)\D{0,10}(\d{4})\b/i,
    /(?:\*|x{2,4}|X{2,4})\s*(\d{4})\b/,
    /\b(\d{4})\s*(?:כרטיס|דביט)/i,
    /סיומת\s*(\d{4})\b/i,
    /(?:חשבון\s*כרטיס|כרטיס\s*מספר|מס['׳]?\s*כרטיס)\s*[:#\-]?\s*(\d{4})\b/i,
  ];

  for (const p of patterns) {
    const match = textPool.match(p);
    if (match) return match[1];
  }
  return undefined;
}

/**
 * Evaluates match compatibility and evidence between a target transaction (e.g. generic bank checking debit)
 * and a potential candidate transaction (e.g. detailed credit/debit card purchase).
 *
 * PURE & READ-ONLY: Never modifies transactions or records state.
 */
export function evaluateTransactionMatch(
  target: Transaction,
  candidate: Transaction
): CandidateEvaluation {
  const positiveIndicators: string[] = [];
  const riskOrAmbiguityFactors: string[] = [];
  const ambiguityReasons: string[] = [];

  // 1. Identity Check
  if (target.id === candidate.id) {
    return {
      candidateTransactionId: candidate.id,
      candidateTransaction: candidate,
      certainty: 'incompatible',
      confidenceScore: 0,
      evidence: {
        amountMatch: true,
        currencyMatch: true,
        currencyDetails: { targetCurrency: target.currency, candidateCurrency: candidate.currency },
        flowDirectionMatch: true,
        flowDirectionDetails: { targetType: target.type, candidateType: candidate.type },
        referenceMatch: 'none',
        referenceDetails: {},
        cardDigitsMatch: 'not_available',
        cardDigitsDetails: {},
        dateRelationship: 'unknown_semantics',
        dateExplanation: 'אותה עסקה בדיוק',
        accountCompatibility: 'same_account',
        alreadyLinkedStatus: { targetLinked: false, candidateLinked: false },
        positiveIndicators: [],
        riskOrAmbiguityFactors: ['אותה עסקה בדיוק אינה יכולה לשמש כמועמד לעצמה'],
      },
      ambiguityReasons: ['זהות מזהים (אותה עסקה)'],
      isViableCandidate: false,
    };
  }

  // 2. Existing Link Check
  const targetLinked = Boolean(target.linkedTransactionIds && target.linkedTransactionIds.length > 0);
  const candidateLinked = Boolean(candidate.linkedTransactionIds && candidate.linkedTransactionIds.length > 0);
  if (targetLinked) {
    riskOrAmbiguityFactors.push(`עסקת המטרה כבר מקושרת (${target.linkedTransactionIds!.join(', ')})`);
  }
  if (candidateLinked) {
    riskOrAmbiguityFactors.push(`המועמד כבר מקושר לעסקה אחרת (${candidate.linkedTransactionIds!.join(', ')})`);
    ambiguityReasons.push('המועמד כבר משויך לעסקה קיימת – מניעת קישור כפול');
  }

  // 3. Amount Comparison
  const amountMatch = Math.abs(target.amount - candidate.amount) < 0.005;
  if (amountMatch) {
    positiveIndicators.push(`סכום זהה: ₪${target.amount.toFixed(2)}`);
  } else {
    riskOrAmbiguityFactors.push(`סכומים אינם תואמים: ₪${target.amount.toFixed(2)} מול ₪${candidate.amount.toFixed(2)}`);
  }

  // 4. Currency Comparison
  const targetCurr = target.currency || 'ILS';
  const candidateCurr = candidate.currency || 'ILS';
  const currencyMatch = targetCurr === candidateCurr;
  if (!currencyMatch) {
    riskOrAmbiguityFactors.push(`סתירת מטבע: ${targetCurr} מול ${candidateCurr}`);
  }

  // 5. Flow Direction Comparison
  const targetType = target.type || 'expense';
  const candidateType = candidate.type || 'expense';
  const flowDirectionMatch =
    targetType === candidateType ||
    (targetType === 'transfer' && candidateType === 'expense');

  if (flowDirectionMatch) {
    positiveIndicators.push(`כיוון תנועה תואם (${targetType} מול ${candidateType})`);
  } else {
    riskOrAmbiguityFactors.push(`סתירת כיוון תנועה: ${targetType} מול ${candidateType}`);
  }

  // 6. Explicit Reference / Voucher Comparison
  const targetRef = extractTransactionReference(target);
  const candidateRef = extractTransactionReference(candidate);
  let referenceMatch: 'exact' | 'none' | 'mismatch' = 'none';

  if (targetRef && candidateRef) {
    if (targetRef === candidateRef) {
      referenceMatch = 'exact';
      positiveIndicators.push(`אסמכתא זהה ומאמתת: ${targetRef}`);
    } else {
      referenceMatch = 'mismatch';
      riskOrAmbiguityFactors.push(`סתירת אסמכתאות: ${targetRef} מול ${candidateRef}`);
    }
  } else {
    referenceMatch = 'none';
  }

  // 7. Card 4 Digits Comparison
  const targetCard = extractCardLastDigits(target);
  const candidateCard = extractCardLastDigits(candidate);
  let cardDigitsMatch: 'match' | 'mismatch' | 'not_available' = 'not_available';

  if (targetCard && candidateCard) {
    if (targetCard === candidateCard) {
      cardDigitsMatch = 'match';
      positiveIndicators.push(`4 ספרות כרטיס תואמות: ${targetCard}`);
    } else {
      cardDigitsMatch = 'mismatch';
      riskOrAmbiguityFactors.push(`סתירת 4 ספרות כרטיס: ${targetCard} מול ${candidateCard}`);
    }
  } else {
    cardDigitsMatch = 'not_available';
  }

  // 8. Date Analysis with Semantic Awareness
  // NOTE ON DATE SEMANTICS:
  // In bank checking statements, the date column may reflect posting date (תאריך פעולה),
  // value date (תאריך ערך), or transaction date. In credit card statements, date reflects
  // purchase date (תאריך רכישה) and billingDate reflects statement debit date (תאריך חיוב).
  // A purchase can happen on or before the bank debit date, but NOT after.
  let dateRelationship: MatchEvidence['dateRelationship'] = 'unknown_semantics';
  let dateDeltaDays: number | undefined = undefined;
  let dateExplanation = '';

  const tDate = target.date?.trim();
  const cDate = candidate.date?.trim();
  const cBillingDate = candidate.billingDate?.trim();

  if (!tDate || !cDate || isNaN(new Date(tDate).getTime()) || isNaN(new Date(cDate).getTime())) {
    dateRelationship = 'date_missing';
    dateExplanation = 'תאריך חסר או לא תקין באחת העסקאות';
    riskOrAmbiguityFactors.push('תאריך חסר או לא תקין באחת העסקאות');
  } else {
    const tTime = new Date(tDate).getTime();
    const cTime = new Date(cDate).getTime();
    const rawDelta = Math.round((tTime - cTime) / (1000 * 3600 * 24));

    if (tDate === cDate) {
      dateRelationship = 'exact_date';
      dateDeltaDays = 0;
      dateExplanation = `תאריכים זהים בדיוק (${tDate})`;
      positiveIndicators.push('תאריך זהה בדיוק');
    } else if (cBillingDate && cBillingDate === tDate) {
      dateRelationship = 'billing_date_match';
      dateDeltaDays = rawDelta;
      dateExplanation = `תאריך החיוב בכרטיס (${cBillingDate}) תואם בדיוק לתאריך העו"ש (${tDate})`;
      positiveIndicators.push(`תאריך חיוב בכרטיס (${cBillingDate}) תואם לתאריך החיוב בעו"ש`);
    } else if (rawDelta < 0) {
      // Candidate purchase date is AFTER bank debit date
      const futureDays = Math.abs(rawDelta);
      dateRelationship = 'candidate_after_target';
      dateDeltaDays = rawDelta;
      dateExplanation = `סתירה כרונולוגית: תאריך רכישת המועמד (${cDate}) מאוחר מתאריך החיוב בעו"ש (${tDate}) ב-${futureDays} ימים`;
      riskOrAmbiguityFactors.push(`סתירה כרונולוגית: רכישה לאחר מועד החיוב בבנק (${futureDays} ימים)`);
    } else if (rawDelta >= 0 && rawDelta <= 5) {
      // Standard debit window (0-5 days between POS authorization and bank posting)
      dateRelationship = 'date_delta_acceptable';
      dateDeltaDays = rawDelta;
      dateExplanation = `תאריך הרכישה (${cDate}) קדם לתאריך החיוב בעו"ש (${tDate}) ב-${rawDelta} ימים (טווח סביר לדביט)`;
      positiveIndicators.push(`הפרש של ${rawDelta} ימים בין רכישה לחיוב בעו"ש (בתוך טווח דביט)`);
    } else if (rawDelta > 5 && rawDelta <= 35) {
      // Monthly credit card cycle or delayed clearance
      dateRelationship = 'candidate_precedes_target';
      dateDeltaDays = rawDelta;
      dateExplanation = `הפרש של ${rawDelta} ימים בין תאריך הרכישה (${cDate}) לתאריך העו"ש (${tDate}) (מתאים למחזור כרטיס חודשי, אך חורג מדביט מיידי)`;
      riskOrAmbiguityFactors.push(`הפרש של ${rawDelta} ימים בין רכישה לחיוב בעו"ש – משמעות השדות עמומה ודורשת אימות`);
    } else {
      // Excessive delta (> 35 days)
      dateRelationship = 'candidate_precedes_target';
      dateDeltaDays = rawDelta;
      dateExplanation = `הפרש תאריכים חריג של ${rawDelta} ימים בין הרכישה לחיוב`;
      riskOrAmbiguityFactors.push(`הפרש תאריכים חריג (${rawDelta} ימים)`);
    }
  }

  // 9. Account Compatibility
  let accountCompatibility: MatchEvidence['accountCompatibility'] = 'cross_account';
  if (target.accountId && candidate.accountId && target.accountId === candidate.accountId) {
    accountCompatibility = 'same_account';
    riskOrAmbiguityFactors.push('שתי העסקאות משויכות לאותו חשבון (אינו דוח כרטיס חיצוני)');
  }

  // 10. Certainty Classification
  let certainty: MatchCertainty = 'indeterminate';
  let isViableCandidate = false;
  let confidenceScore = 0;

  // Strict Incompatibility checks
  if (
    !amountMatch ||
    !currencyMatch ||
    !flowDirectionMatch ||
    referenceMatch === 'mismatch' ||
    cardDigitsMatch === 'mismatch' ||
    dateRelationship === 'candidate_after_target' ||
    dateRelationship === 'date_missing' ||
    (dateDeltaDays !== undefined && dateDeltaDays > 35) ||
    candidateLinked ||
    targetLinked
  ) {
    certainty = 'incompatible';
    isViableCandidate = false;
    confidenceScore = 0;
  } else {
    // Basic criteria passed (amount, currency, flow direction, compatible dates)
    isViableCandidate = true;

    // High confidence requires unambiguous corroborating anchor (exact reference OR matching card digits)
    if (referenceMatch === 'exact') {
      certainty = 'high_confidence';
      confidenceScore = 0.95;
    } else if (
      cardDigitsMatch === 'match' &&
      (dateRelationship === 'exact_date' ||
        dateRelationship === 'billing_date_match' ||
        dateRelationship === 'date_delta_acceptable')
    ) {
      certainty = 'high_confidence';
      confidenceScore = 0.85;
    } else {
      // Amount and date alone are NOT conclusive proof: must flag as indeterminate!
      certainty = 'indeterminate';
      confidenceScore = 0.5;
      ambiguityReasons.push('התאמת סכום וחלון תאריכים בלבד ללא אסמכתא או 4 ספרות כרטיס מאמתות');
      riskOrAmbiguityFactors.push('היעדר אסמכתא או נתוני כרטיס מאמתים – המידע אינו מספיק להכרעה אוטומטית');
    }
  }

  const evidence: MatchEvidence = {
    amountMatch,
    currencyMatch,
    currencyDetails: { targetCurrency: targetCurr, candidateCurrency: candidateCurr },
    flowDirectionMatch,
    flowDirectionDetails: { targetType, candidateType },
    referenceMatch,
    referenceDetails: { targetRef, candidateRef },
    cardDigitsMatch,
    cardDigitsDetails: { targetCard, candidateCard },
    dateRelationship,
    dateDeltaDays,
    dateExplanation,
    accountCompatibility,
    alreadyLinkedStatus: { targetLinked, candidateLinked },
    positiveIndicators,
    riskOrAmbiguityFactors,
  };

  return {
    candidateTransactionId: candidate.id,
    candidateTransaction: candidate,
    certainty,
    confidenceScore,
    evidence,
    ambiguityReasons,
    isViableCandidate,
  };
}

/**
 * Finds and evaluates candidate matches for a single target transaction from a pool of transactions.
 * PURE & READ-ONLY: Never modifies any transaction.
 */
export function findCandidatesForTransaction(
  target: Transaction,
  pool: Transaction[]
): CrossDocumentMatchResult {
  const evaluations: CandidateEvaluation[] = [];

  for (const candidate of pool) {
    if (candidate.id === target.id) continue;
    const evaluation = evaluateTransactionMatch(target, candidate);
    evaluations.push(evaluation);
  }

  const viableCandidates = evaluations.filter((e) => e.isViableCandidate);

  let isAmbiguous = false;
  let primaryCandidate: CandidateEvaluation | undefined = undefined;
  let summaryReason = '';

  if (viableCandidates.length === 0) {
    isAmbiguous = false;
    primaryCandidate = undefined;
    summaryReason = 'לא נמצאו מועמדים תואמים בסכום, במטבע ובטווח התאריכים';
  } else if (viableCandidates.length === 1) {
    const single = viableCandidates[0];
    if (single.certainty === 'high_confidence') {
      isAmbiguous = false;
      primaryCandidate = single;
      summaryReason = `נמצא מועמד יחיד בוודאות גבוהה: מאומת ע"י ${single.evidence.positiveIndicators.join(', ')}`;
    } else {
      isAmbiguous = true;
      primaryCandidate = undefined; // Never select as conclusive primary without strong proof!
      summaryReason =
        'נמצא מועמד יחיד בסכום זהה, אך ללא אסמכתא או כרטיס מאמת. המידע אינו מספיק להכרעה אוטומטית (נדרש אימות משתמש)';
    }
  } else {
    // Multiple viable candidates
    isAmbiguous = true;
    primaryCandidate = undefined;
    summaryReason = `זוהו ${viableCandidates.length} מועמדים שונים בסכום זהה (₪${target.amount.toFixed(
      2
    )}) ללא אסמכתא ייחודית מכריעה. נדרש אימות משתמש.`;
  }

  return {
    targetTransactionId: target.id,
    targetTransaction: target,
    totalCandidatesEvaluated: evaluations.length,
    viableCandidates,
    isAmbiguous,
    primaryCandidate,
    summaryReason,
  };
}

/**
 * Scans a transactions array and identifies potential cross-document candidate matches
 * for transactions requiring reconciliation or detail enrichment (e.g. generic bank checking debits).
 *
 * PURE & READ-ONLY: Never mutates transactions, never links, never modifies categories or statuses.
 */
export function identifyCrossDocumentCandidates(
  transactions: Transaction[],
  options?: {
    targetIds?: string[];
    onlyGenericBankDebits?: boolean;
  }
): CrossDocumentMatchResult[] {
  if (!transactions || transactions.length === 0) return [];

  const targetIdsSet = options?.targetIds ? new Set(options.targetIds) : null;
  const onlyGeneric = options?.onlyGenericBankDebits !== false;

  const targets: Transaction[] = [];

  for (const t of transactions) {
    if (targetIdsSet) {
      if (targetIdsSet.has(t.id)) targets.push(t);
      continue;
    }

    if (onlyGeneric) {
      const docRole = identifyDocumentRole(t);
      const isBank = docRole === 'bank_statement';
      const isGeneric =
        t.merchant === 'עסקה ללא פירוט' ||
        t.merchant === 'עסקה ללא שם' ||
        t.merchant.includes('עסקה רגילה') ||
        t.merchant.includes('דביט') ||
        t.merchant.includes('חיוב כרטיס') ||
        t.description.includes('עסקה רגילה') ||
        t.description.includes('דביט');

      if (isBank && isGeneric) {
        targets.push(t);
      }
    } else {
      targets.push(t);
    }
  }

  return targets.map((target) => findCandidatesForTransaction(target, transactions));
}

// =========================================================================
// STAGE B.2: REVERSIBLE MUTUAL LINKING, ENRICHMENT & UNLINKING
// =========================================================================

export interface LinkAndEnrichResult {
  updatedTransactions: Transaction[];
  targetTransaction: Transaction;
  candidateTransaction: Transaction;
  success: boolean;
  status: 'linked_and_enriched' | 'already_linked' | 'incompatible' | 'not_found';
  message: string;
  enrichedFields: {
    merchantEnriched: boolean;
    purchaseDateEnriched: boolean;
    categoryProposed?: string;
  };
}

export interface UnlinkResult {
  updatedTransactions: Transaction[];
  unlinkedTarget: Transaction;
  unlinkedCandidate?: Transaction;
  success: boolean;
  status: 'unlinked' | 'not_linked' | 'not_found' | 'conflict';
  message: string;
}

/**
 * Checks if a merchant string is a placeholder or generic technical label.
 */
function isGenericMerchant(merchant?: string): boolean {
  if (!merchant || !merchant.trim()) return true;
  const m = merchant.trim();
  return (
    m === 'עסקה ללא פירוט' ||
    m === 'עסקה ללא שם' ||
    m === 'עסקה כללית' ||
    m === 'כללי' ||
    m === 'עסקה רגילה' ||
    m === 'עסקה רגילה (כולל דביט)' ||
    m === 'דביט' ||
    m === 'חיוב כרטיס' ||
    m === 'כרטיס אשראי' ||
    m === 'הוראת קבע'
  );
}

/**
 * Reversibly links two transactions and enriches generic target details from a detailed candidate.
 *
 * PURE & IMMUTABLE:
 * - Does NOT mutate transactions array or any input transaction object.
 * - Does NOT merge or delete transactions; both remain distinct with mutual link IDs.
 * - Preserves original amounts, flow direction, currency, and accounts.
 * - Preserves user-assigned categories (never overwrites if category was manually set).
 * - Saves a complete snapshot to `enrichmentSnapshots` so unlinking is 100% reversible.
 * - Only applies if the candidate meets match criteria (non-incompatible).
 */
export function linkAndEnrichTransactions(
  transactions: Transaction[],
  targetId: string,
  candidateId: string,
  options?: {
    forceLinkIndeterminate?: boolean; // User explicit confirmation for indeterminate candidates
    enrichPurchaseDate?: boolean;      // Whether to enrich originalDate/date with card purchase date
    customReason?: string;
  }
): LinkAndEnrichResult {
  if (!transactions || transactions.length === 0) {
    throw new Error('Transaction array cannot be empty');
  }

  // Find target and candidate
  const targetIndex = transactions.findIndex((t) => t.id === targetId);
  const candidateIndex = transactions.findIndex((t) => t.id === candidateId);

  if (targetIndex === -1 || candidateIndex === -1) {
    return {
      updatedTransactions: transactions,
      targetTransaction: transactions[targetIndex] || ({} as Transaction),
      candidateTransaction: transactions[candidateIndex] || ({} as Transaction),
      success: false,
      status: 'not_found',
      message: `אחת העסקאות לא נמצאה ברשימה (target: ${targetId}, candidate: ${candidateId})`,
      enrichedFields: { merchantEnriched: false, purchaseDateEnriched: false },
    };
  }

  const origTarget = transactions[targetIndex];
  const origCandidate = transactions[candidateIndex];

  // Check if already linked together or if either is already linked to other transactions
  if (
    origTarget.linkedTransactionIds?.includes(candidateId) ||
    origCandidate.linkedTransactionIds?.includes(targetId)
  ) {
    return {
      updatedTransactions: transactions,
      targetTransaction: origTarget,
      candidateTransaction: origCandidate,
      success: false,
      status: 'already_linked',
      message: 'העסקאות כבר מקושרות זו לזו (או קישור קיים חלקי)',
      enrichedFields: { merchantEnriched: false, purchaseDateEnriched: false },
    };
  }

  if (origTarget.linkedTransactionIds && origTarget.linkedTransactionIds.length > 0) {
    return {
      updatedTransactions: transactions,
      targetTransaction: origTarget,
      candidateTransaction: origCandidate,
      success: false,
      status: 'already_linked',
      message: `עסקת היעד כבר מקושרת לעסקה אחרת (${origTarget.linkedTransactionIds.join(', ')}). יש לבטל את הקישור הקיים תחילה.`,
      enrichedFields: { merchantEnriched: false, purchaseDateEnriched: false },
    };
  }

  if (origCandidate.linkedTransactionIds && origCandidate.linkedTransactionIds.length > 0) {
    return {
      updatedTransactions: transactions,
      targetTransaction: origTarget,
      candidateTransaction: origCandidate,
      success: false,
      status: 'already_linked',
      message: `עסקת המועמד כבר מקושרת לעסקה אחרת (${origCandidate.linkedTransactionIds.join(', ')}). יש לבטל את הקישור הקיים תחילה.`,
      enrichedFields: { merchantEnriched: false, purchaseDateEnriched: false },
    };
  }

  // Evaluate candidate match
  const evaluation = evaluateTransactionMatch(origTarget, origCandidate);

  if (evaluation.certainty === 'incompatible') {
    return {
      updatedTransactions: transactions,
      targetTransaction: origTarget,
      candidateTransaction: origCandidate,
      success: false,
      status: 'incompatible',
      message: `לא ניתן לקשר: העסקאות אינן תואמות (${evaluation.ambiguityReasons.join(', ') || 'סתירה בפרטים'})`,
      enrichedFields: { merchantEnriched: false, purchaseDateEnriched: false },
    };
  }

  if (evaluation.certainty === 'indeterminate' && !options?.forceLinkIndeterminate) {
    return {
      updatedTransactions: transactions,
      targetTransaction: origTarget,
      candidateTransaction: origCandidate,
      success: false,
      status: 'incompatible',
      message: `ההתאמה היא ברמת ודאות בינונית (indeterminate) ודורשת אישור משתמש מפורש לקשירה (${evaluation.ambiguityReasons.join(', ')})`,
      enrichedFields: { merchantEnriched: false, purchaseDateEnriched: false },
    };
  }

  // Determine enriched fields
  const shouldEnrichMerchant =
    isGenericMerchant(origTarget.merchant) &&
    !isGenericMerchant(origCandidate.merchant);

  const shouldEnrichPurchaseDate = Boolean(
    options?.enrichPurchaseDate !== false &&
    origCandidate.date &&
    origTarget.date !== origCandidate.date
  );

  // New merchant & description
  const newMerchant = shouldEnrichMerchant ? origCandidate.merchant : origTarget.merchant;
  const newDescription = shouldEnrichMerchant
    ? (origTarget.description.includes(origCandidate.merchant)
        ? origTarget.description
        : `${origTarget.description} [הועשר מ-${origCandidate.merchant}]`)
    : origTarget.description;

  // Category handling: NEVER overwrite user customized or specific categories
  // Only suggest/propose category without silently forcing if target has user custom category
  let newCategory = origTarget.category;
  let proposedCategory: string | undefined = undefined;

  if (origTarget.userCustomizedCategory) {
    // Keep user's explicit category intact!
    proposedCategory = origCandidate.category;
  } else if (
    origTarget.category === 'כללי' ||
    origTarget.category === 'עסקה ללא פירוט' ||
    origTarget.category === 'שונות' ||
    !origTarget.category
  ) {
    if (origCandidate.category && origCandidate.category !== 'כללי') {
      newCategory = origCandidate.category;
    }
  } else {
    // Target already had a distinct category - preserve it and only propose
    proposedCategory = origCandidate.category;
  }

  // Create full snapshot of original target before any modification, including pre-existing originalDate
  // and applied enriched values to detect post-enrichment manual modifications upon unlinking
  const timestamp = new Date().toISOString();
  const targetSnapshot: EnrichmentSnapshot = {
    linkedAt: timestamp,
    linkedTransactionId: origCandidate.id,
    reason: options?.customReason || evaluation.evidence.positiveIndicators.join('; ') || 'קישור צולב מבוקר',
    confidenceScore: evaluation.confidenceScore,
    originalMerchant: origTarget.merchant,
    originalDescription: origTarget.description,
    originalCategory: origTarget.category,
    originalDate: origTarget.date,
    originalTargetOriginalDate: origTarget.originalDate,
    originalReconciliationStatus: origTarget.reconciliationStatus,
    originalNeedsReview: origTarget.needsReview,
    originalReviewReason: origTarget.reviewReason,
    appliedEnrichedMerchant: shouldEnrichMerchant ? newMerchant : undefined,
    appliedEnrichedDescription: shouldEnrichMerchant ? newDescription : undefined,
    appliedEnrichedCategory: newCategory !== origTarget.category ? newCategory : undefined,
    appliedEnrichedOriginalDate: shouldEnrichPurchaseDate ? origCandidate.date : undefined,
  };

  // Prepare updated target
  const updatedTarget: Transaction = {
    ...origTarget,
    merchant: newMerchant,
    description: newDescription,
    category: newCategory,
    originalDate: shouldEnrichPurchaseDate ? origCandidate.date : (origTarget.originalDate || origTarget.date),
    linkedTransactionIds: Array.from(new Set([...(origTarget.linkedTransactionIds || []), origCandidate.id])),
    reconciliationStatus: 'reconciled',
    needsReview: false, // Matched with verified card record
    reviewReason: undefined,
    reconciliationEvidence: `הותאם לדוח כרטיס: ${origCandidate.merchant} (₪${origCandidate.amount})`,
    enrichmentSnapshots: [...(origTarget.enrichmentSnapshots || []), targetSnapshot],
  };

  // Prepare updated candidate (mutual reciprocal link, no field alteration)
  const updatedCandidate: Transaction = {
    ...origCandidate,
    linkedTransactionIds: Array.from(new Set([...(origCandidate.linkedTransactionIds || []), origTarget.id])),
    reconciliationStatus: 'reconciled',
  };

  // Construct new transactions array immutably
  const updatedTransactions = transactions.map((t, idx) => {
    if (idx === targetIndex) return updatedTarget;
    if (idx === candidateIndex) return updatedCandidate;
    return t;
  });

  return {
    updatedTransactions,
    targetTransaction: updatedTarget,
    candidateTransaction: updatedCandidate,
    success: true,
    status: 'linked_and_enriched',
    message: `העסקאות קושרו בהצלחה והפרטים הועשרו מ-${origCandidate.merchant}`,
    enrichedFields: {
      merchantEnriched: shouldEnrichMerchant,
      purchaseDateEnriched: shouldEnrichPurchaseDate,
      categoryProposed: proposedCategory,
    },
  };
}

/**
 * Reversibly breaks the link between two transactions and restores all original values from snapshots.
 *
 * PURE & IMMUTABLE:
 * - Does NOT mutate transactions array or any input transaction object.
 * - Restores target's original merchant, description, category, dates, review status and reconciliationStatus.
 * - Removes mutual linkedTransactionIds from both transactions.
 * - Completely reversible without data loss.
 */
export function unlinkTransaction(
  transactions: Transaction[],
  targetId: string,
  candidateId?: string
): UnlinkResult {
  if (!transactions || transactions.length === 0) {
    throw new Error('Transaction array cannot be empty');
  }

  const targetIndex = transactions.findIndex((t) => t.id === targetId);
  if (targetIndex === -1) {
    return {
      updatedTransactions: transactions,
      unlinkedTarget: {} as Transaction,
      success: false,
      status: 'not_found',
      message: `עסקת היעד ${targetId} לא נמצאה ברשימה`,
    };
  }

  const target = transactions[targetIndex];
  const linkedIds = target.linkedTransactionIds || [];

  if (linkedIds.length === 0) {
    return {
      updatedTransactions: transactions,
      unlinkedTarget: target,
      success: false,
      status: 'not_linked',
      message: 'העסקה אינה מקושרת לאף עסקה אחרת',
    };
  }

  // Determine candidate to unlink
  const targetCandidateId = candidateId || linkedIds[0];
  const candidateIndex = transactions.findIndex((t) => t.id === targetCandidateId);
  const candidate = candidateIndex !== -1 ? transactions[candidateIndex] : undefined;

  // Retrieve relevant snapshot for target
  const snapshots = target.enrichmentSnapshots || [];
  const snapshotIndex = snapshots.findIndex((s) => s.linkedTransactionId === targetCandidateId);
  const snapshot = snapshotIndex !== -1 ? snapshots[snapshotIndex] : undefined;

  // If no matching snapshot exists for this link ID, reject the unlink operation without mutating any transaction
  if (!snapshot) {
    return {
      updatedTransactions: transactions,
      unlinkedTarget: target,
      unlinkedCandidate: candidate,
      success: false,
      status: 'conflict',
      message: `לא נמצא Snapshot תואם עבור מזהה הקישור ${targetCandidateId}. ביטול הקישור נדחה ללא כל שינוי כדי למנוע השחתת נתונים.`,
    };
  }

  const remainingSnapshots = snapshots.filter((_, idx) => idx !== snapshotIndex);
  const remainingLinks = linkedIds.filter((id) => id !== targetCandidateId);

  // 1. Category restoration: Protect user custom categories and post-link manual edits
  let restoredCategory = target.category;
  if (target.userCustomizedCategory) {
    // User explicitly customized category - keep it intact
    restoredCategory = target.category;
  } else if (snapshot.appliedEnrichedCategory) {
    // If category matches what was enriched, revert to pre-enrichment value
    if (target.category === snapshot.appliedEnrichedCategory) {
      restoredCategory = snapshot.originalCategory;
    } else {
      // User changed category manually after enrichment - keep user's manual change
      restoredCategory = target.category;
    }
  } else {
    restoredCategory = target.category;
  }

  // 2. Description restoration: Protect post-link manual edits
  let restoredDescription = target.description;
  if (snapshot.appliedEnrichedDescription) {
    if (target.description === snapshot.appliedEnrichedDescription) {
      restoredDescription = snapshot.originalDescription;
    } else {
      // User changed description manually after enrichment - keep user's manual change
      restoredDescription = target.description;
    }
  } else {
    restoredDescription = target.description;
  }

  // 3. Merchant restoration: Protect post-link manual edits
  let restoredMerchant = target.merchant;
  if (snapshot.appliedEnrichedMerchant) {
    if (target.merchant === snapshot.appliedEnrichedMerchant) {
      restoredMerchant = snapshot.originalMerchant;
    } else {
      // User changed merchant manually after enrichment - keep user's manual change
      restoredMerchant = target.merchant;
    }
  } else {
    restoredMerchant = target.merchant;
  }

  // 4. OriginalDate restoration: Protect post-link manual edits and restore pre-existing originalDate
  let restoredOriginalDate: string | undefined = target.originalDate;
  if (snapshot.appliedEnrichedOriginalDate) {
    if (target.originalDate === snapshot.appliedEnrichedOriginalDate) {
      // Revert to target's originalDate before this enrichment (or undefined if it didn't have one)
      restoredOriginalDate = snapshot.originalTargetOriginalDate;
    } else {
      // User changed originalDate manually after enrichment - keep user's manual change
      restoredOriginalDate = target.originalDate;
    }
  } else {
    restoredOriginalDate = target.originalDate;
  }

  // 5. Review & reconciliation status
  const restoredStatus = remainingLinks.length > 0
    ? target.reconciliationStatus
    : (snapshot.originalReconciliationStatus || 'unreconciled');

  const restoredNeedsReview = remainingLinks.length > 0
    ? false
    : snapshot.originalNeedsReview;

  const restoredReviewReason = remainingLinks.length > 0
    ? target.reviewReason
    : snapshot.originalReviewReason;

  const restoredTarget: Transaction = {
    ...target,
    merchant: restoredMerchant,
    description: restoredDescription,
    category: restoredCategory,
    originalDate: restoredOriginalDate,
    reconciliationStatus: restoredStatus,
    needsReview: restoredNeedsReview,
    reviewReason: restoredReviewReason,
    linkedTransactionIds: remainingLinks,
    enrichmentSnapshots: remainingSnapshots.length > 0 ? remainingSnapshots : undefined,
    reconciliationEvidence: remainingLinks.length > 0 ? target.reconciliationEvidence : undefined,
  };

  let restoredCandidate: Transaction | undefined = undefined;
  if (candidate) {
    const candidateRemainingLinks = (candidate.linkedTransactionIds || []).filter((id) => id !== targetId);
    restoredCandidate = {
      ...candidate,
      linkedTransactionIds: candidateRemainingLinks,
      reconciliationStatus: candidateRemainingLinks.length > 0 ? candidate.reconciliationStatus : 'unreconciled',
    };
  }

  const updatedTransactions = transactions.map((t, idx) => {
    if (idx === targetIndex) return restoredTarget;
    if (candidateIndex !== -1 && idx === candidateIndex && restoredCandidate) return restoredCandidate;
    return t;
  });

  return {
    updatedTransactions,
    unlinkedTarget: restoredTarget,
    unlinkedCandidate: restoredCandidate,
    success: true,
    status: 'unlinked',
    message: `הקישור בוטל בהצלחה ופרטי עסקת היעד שוחזרו לקדמותם`,
  };
}

