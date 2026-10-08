import { Transaction } from '../types/financial';

export interface ReconciliationReport {
  reconciledTransactions: Transaction[];
  reconciledSettlementsCount: number;
  matchedDetailedTransactionsCount: number;
  unmatchedSettlementsCount: number;
  reconciliationNotes: string[];
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
  const combined = `${tx.merchant} ${tx.description}`.toLowerCase();
  return (
    combined.includes('חיוב כרטיס') ||
    combined.includes('פירעון כרטיס') ||
    combined.includes('חיוב ויזה') ||
    combined.includes('חיוב ישראכרט') ||
    combined.includes('חיוב כאל') ||
    combined.includes('חיוב מקס') ||
    combined.includes('חיוב מאסטרקארד') ||
    combined.includes('חיוב לאומי קארד') ||
    combined.includes('הוראת קבע כרטיס אשראי') ||
    combined.includes('חיוב ח-ן כרטיס') ||
    combined.includes('חיוב חודשי כרטיס') ||
    (combined.includes('ישראכרט') && combined.includes('חיוב')) ||
    (combined.includes('מקס') && combined.includes('חיוב')) ||
    (combined.includes('כאל') && combined.includes('חיוב'))
  );
}

/**
 * CENTRAL CROSS-DOCUMENT RECONCILIATION ENGINE
 *
 * Links bank-side consolidated settlements with detailed credit card statements.
 * Prevents double-counting in cash flow while preserving full provenance and original records.
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
    if (t.sourceDocumentType === 'bank_statement' && isConsolidatedCardSettlement(t)) {
      bankSettlements.push(t);
    } else if (t.sourceDocumentType === 'credit_card_statement' && !isConsolidatedCardSettlement(t)) {
      detailedCardTxs.push(t);
    }
  }

  // Map detailed card transactions by billing cycle / month
  // E.g., billingDate "2026-10-02" or month key "2026-10"
  const cycleMap = new Map<string, Transaction[]>();
  for (const cardTx of detailedCardTxs) {
    // Primary key: billingDate if available, else transaction month
    const key = cardTx.billingDate || cardTx.date.substring(0, 7);
    if (!cycleMap.has(key)) cycleMap.set(key, []);
    cycleMap.get(key)!.push(cardTx);
  }

  // Reconcile each bank settlement
  for (const settlement of bankSettlements) {
    const settlementDate = settlement.date;
    const settlementMonth = settlementDate.substring(0, 7);
    const settlementAmt = settlement.amount;

    let matchedTxs: Transaction[] = [];
    let matchEvidence = '';

    // Strategy 1: Check cycle by exact billing date (e.g. bank settlement date matches billingDate)
    const exactBillingMatches = cycleMap.get(settlementDate);
    if (exactBillingMatches && exactBillingMatches.length > 0) {
      const netSum = exactBillingMatches.reduce(
        (sum, t) => sum + (t.type === 'refund' ? -t.amount : t.amount),
        0
      );
      if (Math.abs(netSum - settlementAmt) <= 2.0) {
        matchedTxs = exactBillingMatches;
        matchEvidence = `התאמה מלאה: תאריך חיוב מדויק (${settlementDate}) וסכום זהה ₪${settlementAmt.toLocaleString()}`;
      }
    }

    // Strategy 2: Check all cycle buckets in the same month or nearby month (within +/- 1 month)
    let hasUncertainCandidates = false;
    let uncertainDiff = 0;

    if (matchedTxs.length === 0) {
      for (const [cycleKey, candidateTxs] of cycleMap.entries()) {
        const netSum = candidateTxs.reduce(
          (sum, t) => sum + (t.type === 'refund' ? -t.amount : t.amount),
          0
        );

        // Check date proximity (within 45 days)
        const sTime = new Date(settlementDate).getTime();
        const cTime = new Date(candidateTxs[0].date).getTime();
        const diffDays = Math.abs(sTime - cTime) / (1000 * 3600 * 24);

        if (diffDays <= 45) {
          // Check if sum equals settlement amount (within 2.5 ILS tolerance for foreign rounding/fees)
          if (Math.abs(netSum - settlementAmt) <= 2.5) {
            matchedTxs = candidateTxs;
            matchEvidence = `התאמת סכום כולל (₪${settlementAmt.toLocaleString()}) מול ${candidateTxs.length} עסקאות במחזור ${cycleKey}`;
            break;
          } else if (candidateTxs.length > 0 && Math.abs(netSum - settlementAmt) < settlementAmt * 0.5) {
            // Potential cycle candidate exists but sum does not match closely
            hasUncertainCandidates = true;
            uncertainDiff = Math.abs(netSum - settlementAmt);
          }
        }
      }
    }

    // Apply reconciliation outcome
    if (matchedTxs.length > 0) {
      reconciledSettlementsCount++;
      matchedDetailedTransactionsCount += matchedTxs.length;

      // Mark the bank settlement as reconciled internal transfer
      // Detailed transactions are kept as the actual expenses!
      settlement.type = 'transfer';
      settlement.isInternalTransfer = true;
      settlement.isAggregateSettlement = true;
      settlement.reconciliationStatus = 'settlement_matched';
      settlement.linkedTransactionIds = matchedTxs.map((t) => t.id);
      settlement.reconciliationEvidence = matchEvidence;
      settlement.needsReview = false;

      // Mark detailed transactions as reconciled expenses
      for (const dTx of matchedTxs) {
        dTx.reconciliationStatus = 'reconciled';
        if (!dTx.linkedTransactionIds) dTx.linkedTransactionIds = [];
        if (!dTx.linkedTransactionIds.includes(settlement.id)) {
          dTx.linkedTransactionIds.push(settlement.id);
        }
      }

      reconciliationNotes.push(
        `הותאם חיוב כרטיס בעו"ש (₪${settlementAmt.toLocaleString()}) מול ${matchedTxs.length} עסקאות פירוט בכרטיס האשראי.`
      );
    } else if (hasUncertainCandidates) {
      // Uncertain reconciliation: detailed transactions exist but sum does not match!
      // Do NOT silently merge or classify as internal transfer. Preserve both and flag NeedsReview.
      unmatchedSettlementsCount++;
      settlement.type = 'expense';
      settlement.isInternalTransfer = false;
      settlement.isAggregateSettlement = true;
      settlement.reconciliationStatus = 'partial';
      settlement.needsReview = true;
      settlement.reviewReason = `זוהו עסקאות כרטיס אשראי אך הסכום אינו תואם במדויק (פער של ₪${Math.round(uncertainDiff).toLocaleString()}) מול החיוב בבנק – דרוש אימות משתמש.`;

      reconciliationNotes.push(
        `התאמה לא ודאית: חיוב כרטיס בעו"ש (₪${settlementAmt.toLocaleString()}) עם פער מסכום הפירוט. הועבר לבקרת משתמש.`
      );
    } else {
      // Unmatched bank settlement: No detailed card statement imported yet for this cycle!
      // CRITICAL: Do NOT silently assume internal transfer! The spending must NOT disappear!
      unmatchedSettlementsCount++;
      settlement.type = 'expense';
      settlement.isInternalTransfer = false; // Kept as expense so the spending is NOT lost!
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
      (t.merchant === 'עסקה ללא פירוט' || t.merchant === 'עסקה ללא שם' || t.merchant.includes('חיוב כרטיס')) &&
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
