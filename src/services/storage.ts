import {
  Transaction,
  Account,
  BudgetCategory,
  FinancialGoal,
  InvestmentAsset,
  RecurringCommitment,
  AnomalyAlert,
  LearnedRule,
  DataQualityReport,
  UploadedDocument,
} from '../types/financial';
import {
  INITIAL_ACCOUNTS,
  INITIAL_TRANSACTIONS,
  INITIAL_BUDGETS,
  INITIAL_GOALS,
  INITIAL_INVESTMENTS,
  INITIAL_RECURRING,
  INITIAL_ANOMALIES,
  INITIAL_RULES,
  INITIAL_DATA_QUALITY,
  INITIAL_DOCUMENTS,
} from '../data/demoData';

export interface AppState {
  isDemoMode: boolean;
  accounts: Account[];
  transactions: Transaction[];
  budgets: BudgetCategory[];
  goals: FinancialGoal[];
  investments: InvestmentAsset[];
  recurring: RecurringCommitment[];
  anomalies: AnomalyAlert[];
  learnedRules: LearnedRule[];
  dataQuality: DataQualityReport;
  documents: UploadedDocument[];
}

const STORAGE_KEY = 'matzpen_financial_app_state_v1';

export function loadInitialState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.transactions)) {
        if (!Array.isArray(parsed.documents)) {
          parsed.documents = INITIAL_DOCUMENTS;
        }
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load saved state from localStorage, loading default demo data', e);
  }

  return {
    isDemoMode: true,
    accounts: INITIAL_ACCOUNTS,
    transactions: INITIAL_TRANSACTIONS,
    budgets: INITIAL_BUDGETS,
    goals: INITIAL_GOALS,
    investments: INITIAL_INVESTMENTS,
    recurring: INITIAL_RECURRING,
    anomalies: INITIAL_ANOMALIES,
    learnedRules: INITIAL_RULES,
    dataQuality: INITIAL_DATA_QUALITY,
    documents: INITIAL_DOCUMENTS,
  };
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state to localStorage', e);
  }
}

export function resetToDemoData(): AppState {
  const defaultState: AppState = {
    isDemoMode: true,
    accounts: INITIAL_ACCOUNTS,
    transactions: INITIAL_TRANSACTIONS,
    budgets: INITIAL_BUDGETS,
    goals: INITIAL_GOALS,
    investments: INITIAL_INVESTMENTS,
    recurring: INITIAL_RECURRING,
    anomalies: INITIAL_ANOMALIES,
    learnedRules: INITIAL_RULES,
    dataQuality: INITIAL_DATA_QUALITY,
    documents: INITIAL_DOCUMENTS,
  };
  saveState(defaultState);
  return defaultState;
}

export function switchToMyDataEmpty(): AppState {
  const emptyState: AppState = {
    isDemoMode: false,
    accounts: [],
    transactions: [],
    budgets: [],
    goals: [],
    investments: [],
    recurring: [],
    anomalies: [],
    learnedRules: [],
    documents: [],
    dataQuality: {
      overallScore: 0,
      institutions: [],
      recommendations: [
        'העלה קובץ תדפיס ראשון ממרכז הנתונים (PDF, CSV או Excel)',
        'המערכת תנתח אוטומטית עסקאות, חשבונות והוראות קבע.',
      ],
    },
  };
  saveState(emptyState);
  return emptyState;
}
