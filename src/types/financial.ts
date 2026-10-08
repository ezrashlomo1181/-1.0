export type TransactionType =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'refund'
  | 'investment_contribution'
  | 'investment_withdrawal'
  | 'loan_payment'
  | 'debt'
  | 'fee'
  | 'other';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

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
  rawText?: string;
  isInternalTransfer?: boolean; // if true, exclude from income/expense calculations
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

export interface UploadedDocument {
  id: string;
  fileName: string;
  fileType: 'pdf' | 'csv' | 'xlsx' | 'xls';
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
  fileType: 'pdf' | 'csv' | 'xlsx' | 'xls' | 'unknown';
  folderPath?: string;
  fileHash: string;
  uploadStatus: 'waiting' | 'uploading' | 'uploaded' | 'failed';
  processingStatus: 'waiting' | 'processing' | 'processed' | 'needs_review';
  duplicateStatus: 'none' | 'potential_duplicate' | 'confirmed_duplicate';
  extractedTransactionsCount: number;
  institutionDetected?: string;
  createdAt: string;
  errorDetails?: string;
  isTestFile?: boolean;
}


