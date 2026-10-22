export type TransactionType =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'refund'
  | 'investment_contribution'
  | 'investment_withdrawal'
  | 'loan_payment'
  | 'loan_received'
  | 'debt'
  | 'fee'
  | 'other';

export type ReconciliationStatus =
  | 'unreconciled'
  | 'reconciled'
  | 'partial'
  | 'settlement_matched'
  | 'unverified_pending_review'
  | 'independent_charge'
  | 'pending_verification';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type IgnoredReason =
  | 'duplicate_copy'       // התעלמות מעותק כפול (עסקה זהה שנמצאת כבר במערכת)
  | 'user_excluded_real'  // החלטת משתמש להחריג עסקה אמיתית מהחישובים הפיננסיים
  | 'settlement_covered'  // חיוב מרוכז שכוסה ע"י עסקאות מפורטות
  | 'other';

export interface SourceRecord {
  id: string; // unique ID or hash of source appearance
  documentId?: string;
  sourceDocument: string;
  sourceDocumentType?: 'bank_statement' | 'credit_card_statement' | 'detailed_report' | 'other';
  rawText?: string;
  amount: number;
  date: string;
  originalDate?: string;
  description: string;
  merchant?: string;
  accountId?: string;
  accountName?: string;
  paymentMethod?: 'credit_card' | 'bank_transfer' | 'direct_debit' | 'cash' | 'bit' | 'paybox';
  importedAt: string;
  idempotencyKey?: string; // hash/fingerprint of source row to detect re-import of identical source row
}

export interface MergeHistorySnapshot {
  mergedAt: string;
  reason: string;
  confidenceScore: number;
  // Snapshot of pre-merge transactions with original IDs, classifications and decision history
  originalTransactions: Transaction[];
}

export interface EnrichmentSnapshot {
  linkedAt: string;
  linkedTransactionId: string;
  reason: string;
  confidenceScore: number;
  // Previous field values before enrichment
  originalMerchant: string;
  originalDescription: string;
  originalCategory: string;
  originalDate: string;
  originalTargetOriginalDate?: string;
  originalReconciliationStatus?: ReconciliationStatus;
  originalNeedsReview: boolean;
  originalReviewReason?: string;
  // Applied enriched values to detect post-enrichment manual modifications
  appliedEnrichedMerchant?: string;
  appliedEnrichedDescription?: string;
  appliedEnrichedCategory?: string;
  appliedEnrichedOriginalDate?: string;
}

export interface DuplicateCandidate {
  existingTransactionId: string;
  incomingRecord: SourceRecord;
  confidenceScore: number;
  matchType: 'exact_duplicate' | 'cross_document_merge' | 'competing_candidate' | 'uncertain';
  reasons: string[];
  suggestedAction: 'merge_auto' | 'review_required' | 'keep_both';
}

export interface VerificationDecision {
  transactionId: string;
  action: 'approve' | 'merge' | 'keep_separate' | 'ignore' | 'unmerge';
  reason?: string;
  timestamp: string;
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  currency: 'ILS' | 'USD' | 'EUR';
  merchant: string;
  description: string;
  accountId: string;
  accountName: string;
  paymentMethod: 'credit_card' | 'bank_transfer' | 'direct_debit' | 'cash' | 'bit' | 'paybox';
  category: string;
  subcategory?: string;
  type: TransactionType;
  isRecurring: boolean;
  recurringFrequency?: 'monthly' | 'weekly' | 'yearly';
  confidenceScore: number; // 0 to 1
  confidenceLevel: ConfidenceLevel;
  needsReview: boolean;
  reviewReason?: string;
  reviewOptions?: string[];
  userConfirmed: boolean;
  userNotes?: string;
  aiReasoning?: string;
  sourceDocument?: string;
  additionalSources?: string[];
  sourceDocumentType?: 'bank_statement' | 'credit_card_statement' | 'detailed_report' | 'other';
  originalDate?: string; // original transaction date if normalized
  billingDate?: string; // YYYY-MM-DD
  cyclePeriod?: string; // e.g. "2026-09-10_to_2026-10-09"
  rawText?: string;
  isInternalTransfer?: boolean; // if true, exclude from income/expense calculations
  reconciliationStatus?: ReconciliationStatus;
  linkedTransactionIds?: string[];
  reconciliationEvidence?: string;
  isAggregateSettlement?: boolean; // true if bank consolidated card debit matched to detailed transactions
  isFuture?: boolean; // true if transaction date is in the future relative to current date
  flowDirection?: 'inflow' | 'outflow' | 'unknown'; // Verified financial flow direction from source row

  // Multi-source and deduplication model (Stage 1)
  sourceRecords?: SourceRecord[];
  mergeHistory?: MergeHistorySnapshot[];
  enrichmentSnapshots?: EnrichmentSnapshot[];
  userCustomizedCategory?: boolean; // Protects user-assigned categories from overwrite
  originalTransactionId?: string;
  idempotencyKey?: string;

  // Ignore / Exclusion tracking (Refinement #2)
  ignored?: boolean;
  ignoredReason?: IgnoredReason;
  ignoredAt?: string;
  ignoredByUser?: boolean;
  ignoredNotes?: string;

  // Refund tracking (Refinement #1)
  linkedExpenseId?: string; // links to original expense transaction if identified
  isIndependentRefund?: boolean; // true if standalone refund not linked to specific original expense
  deductsFromExpense?: boolean; // indicates accounting behavior
}

export interface Account {
  id: string;
  name: string;
  institution: string; // e.g., 'בנק הפועלים', 'ישראכרט', 'מיטב טרייד'
  type: 'bank' | 'credit_card' | 'investment' | 'loan' | 'savings';
  balance: number;
  currency: 'ILS' | 'USD';
  accountNumberMasked: string;
  lastUpdated: string;
  importedMonthsCount: number;
}

export interface CategoryDefinition {
  id: string;
  name: string;
  isCustom: boolean;
  color: string;
  iconName?: string;
  userId?: string;
  description?: string;
}

export interface BudgetCategory {
  id: string;
  category: string;
  allocated: number;
  spent: number;
  previousMonthSpent?: number;
  suggestedAmount?: number;
  iconName?: string;
}

export interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string; // YYYY-MM-DD
  monthlyContribution: number;
  category: 'emergency_fund' | 'vacation' | 'car' | 'home' | 'education' | 'investment' | 'custom';
  linkedAccountId?: string;
  notes?: string;
}

export interface InvestmentAsset {
  id: string;
  name: string;
  symbol?: string;
  type: 'etf' | 'stocks' | 'bonds' | 'pension' | 'provident_fund' | 'crypto' | 'cash';
  accountName: string;
  currentValue: number;
  investedAmount: number;
  unrealizedGain: number;
  gainPercentage: number;
  allocationPercentage: number;
}

export interface RecurringCommitment {
  id: string;
  merchant: string;
  category: string;
  monthlyAmount: number;
  frequency: 'monthly' | 'bimonthly' | 'annual';
  firstDetectedDate: string;
  lastDetectedDate: string;
  status: 'active' | 'review' | 'cancelled';
  accountName: string;
  estimatedAnnualCost: number;
  serviceDetails?: string;
  billingDayInMonth?: number;
}

export interface AnomalyAlert {
  id: string;
  title: string;
  description: string;
  amount?: number;
  merchant?: string;
  date: string;
  severity: 'info' | 'warning' | 'critical';
  type: 'spending_spike' | 'large_purchase' | 'duplicate' | 'new_recurring' | 'unexpected_fee';
  transactionId?: string;
  isDismissed?: boolean;
}

export interface LearnedRule {
  id: string;
  pattern: string; // e.g. "BUYME"
  applyTo: 'exact' | 'similar' | 'all_similar' | 'exact_only';
  assignedCategory: string;
  assignedType: TransactionType;
  createdAt: string;
  userPromptBasis: string;
  timesApplied: number;
}

export interface DataQualityReport {
  overallScore: number; // e.g. 87%
  institutions: {
    name: string;
    type: string;
    status: 'good' | 'warning' | 'partial';
    monthsCovered: number;
    recommendedMonths: number;
    notes: string;
  }[];
  recommendations: string[];
}

export interface FinancialCycleConfig {
  startDay: number; // e.g. 10 (meaning 10th of the month to 9th of next month)
  label: string; // e.g. "מחזור 10 בחודש עד 9 בחודש הבא"
  basis: string; // e.g. "זוהה על בסיס מועד שכר וחיוב כרטיסי אשראי"
  isApprovedByUser: boolean;
  detectedAt: string;
}

export interface FinancialCycleSuggestion {
  suggestedStartDay: number;
  confidenceScore: number; // 0 to 1
  reasoning: string;
  occurrencesCount: number;
  monthsAnalyzed: number;
}

export interface UploadedDocument {
  id: string;
  fileName: string;
  fileType: 'pdf' | 'csv' | 'xlsx' | 'xls' | 'html' | 'json' | 'ofx' | 'zip' | 'image' | string;
  fileSize: number;
  uploadDate: string;
  status: 'completed' | 'processing' | 'error';
  transactionsCount: number;
  institution?: string;
}

export interface UserProfile {
  id: string; // Local user ID
  username?: string;
  name: string;
  email?: string;
  authProvider: 'google.com' | 'apple.com' | 'password' | 'local';
  createdAt: string;
  lastLogin: string;
  role: 'user' | 'admin';
  accountStatus: 'active' | 'deactivated';
  deletionStatus: 'none' | 'pending_deletion';
  deletionRequestedAt: string | null;
  scheduledDeletionDate: string | null;
  financialProfileCompletion: number; // 0 - 100
  onboardingCompleted: boolean;
  isDemoUser?: boolean;
}

export interface ManagedFileItem {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: 'pdf' | 'csv' | 'xlsx' | 'xls' | 'html' | 'json' | 'ofx' | 'zip' | 'image' | 'unknown' | string;
  folderPath?: string;
  fileHash: string;
  uploadStatus: 'waiting' | 'uploading' | 'uploaded' | 'failed';
  processingStatus: 'waiting' | 'processing' | 'processed' | 'needs_review';
  duplicateStatus: 'none' | 'potential_duplicate' | 'confirmed_duplicate';
  extractedTransactionsCount: number;
  addedCount?: number;
  duplicatesMergedCount?: number;
  needsReviewCount?: number;
  processingMethod?: string;
  institutionDetected?: string;
  createdAt: string;
  errorDetails?: string;
  isTestFile?: boolean;
}

export interface ImportBatchSummary {
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  totalFoundTransactions: number;
  newTransactionsAdded: number;
  duplicatesMerged: number;
  needsReviewTransactions: number;
}


