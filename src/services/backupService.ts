import {
  AppState,
  migrateTransactionToV2,
  saveState,
  saveUserSpecificState,
  loadUserSpecificState,
  loadInitialState,
  getStoredLearnedRules,
  saveStoredLearnedRules,
} from './storage';
import {
  UserProfile,
  Transaction,
  Account,
  BudgetCategory,
  FinancialGoal,
  InvestmentAsset,
  RecurringCommitment,
  AnomalyAlert,
  LearnedRule,
  UploadedDocument,
  DataQualityReport,
} from '../types/financial';

export const BACKUP_APP_IDENTIFIER = 'matzpen_financial_app' as const;
export const BACKUP_FORMAT_VERSION = 1 as const;
export const PRE_RESTORE_SNAPSHOT_PREFIX = 'matzpen_pre_restore_snapshot';

export interface BackupMetadata {
  appIdentifier: typeof BACKUP_APP_IDENTIFIER;
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  exportedAt: string; // ISO 8601
  appVersion?: string;
  userScope?: {
    userId?: string;
    username?: string;
    isDemo: boolean;
  };
  summary: {
    transactionsCount: number;
    accountsCount: number;
    budgetsCount: number;
    goalsCount: number;
    investmentsCount: number;
    recurringCount: number;
    rulesCount: number;
    documentsCount: number;
  };
}

export interface MatzpenBackupPayload {
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  metadata: BackupMetadata;
  state: AppState;
  learnedRules?: LearnedRule[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  parsedPayload?: MatzpenBackupPayload;
  summary?: BackupMetadata['summary'];
  exportedAt?: string;
}

export interface SnapshotRecord {
  timestamp: string;
  userId?: string;
  state: AppState;
  summary: BackupMetadata['summary'];
}

export interface RestoreResult {
  success: boolean;
  restoredState?: AppState;
  snapshotCreated: boolean;
  error?: string;
}

/**
 * Generate a standard JSON backup payload from current state and user profile.
 * Strictly avoids sensitive secrets, hashes or plain passwords.
 */
export function generateBackupPayload(
  state: AppState,
  userProfile?: UserProfile | null
): MatzpenBackupPayload {
  const currentRules = getStoredLearnedRules();
  // Merge rules from state and persistent storage without duplicates
  const ruleMap = new Map<string, LearnedRule>();
  (state.learnedRules || []).forEach((r) => ruleMap.set(r.id, r));
  currentRules.forEach((r) => ruleMap.set(r.id, r));
  const mergedRules = Array.from(ruleMap.values());

  const summary: BackupMetadata['summary'] = {
    transactionsCount: state.transactions?.length || 0,
    accountsCount: state.accounts?.length || 0,
    budgetsCount: state.budgets?.length || 0,
    goalsCount: state.goals?.length || 0,
    investmentsCount: state.investments?.length || 0,
    recurringCount: state.recurring?.length || 0,
    rulesCount: mergedRules.length,
    documentsCount: state.documents?.length || 0,
  };

  const metadata: BackupMetadata = {
    appIdentifier: BACKUP_APP_IDENTIFIER,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: '2.0.0',
    userScope: {
      userId: userProfile?.id,
      username: userProfile?.username || userProfile?.name,
      isDemo: !!state.isDemoMode,
    },
    summary,
  };

  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    metadata,
    state: {
      ...state,
      learnedRules: mergedRules,
    },
    learnedRules: mergedRules,
  };
}

/**
 * Validates a parsed JSON backup object or raw text.
 * Performs deep type and semantic verification.
 */
export function validateBackupData(rawData: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!rawData || typeof rawData !== 'object') {
    return {
      isValid: false,
      errors: ['תוכן הקובץ אינו אובייקט JSON תקין.'],
      warnings: [],
    };
  }

  const obj = rawData as Record<string, any>;

  // Check if it's a standard wrapped backup or a legacy direct AppState
  let candidateState: any = null;
  let metadata: BackupMetadata | undefined = undefined;
  let exportedAt = new Date().toISOString();

  if (obj.metadata && typeof obj.metadata === 'object' && obj.state && typeof obj.state === 'object') {
    // Standard MatzpenBackupPayload
    if (obj.metadata.appIdentifier !== BACKUP_APP_IDENTIFIER) {
      warnings.push(`מזהה אפליקציה אינו סטנדרטי (${obj.metadata.appIdentifier}), אך הקובץ ינותח לפי המבנה.`);
    }
    metadata = obj.metadata as BackupMetadata;
    candidateState = obj.state;
    if (obj.metadata.exportedAt) {
      exportedAt = obj.metadata.exportedAt;
    }
  } else if (Array.isArray(obj.transactions) && Array.isArray(obj.accounts)) {
    // Direct AppState structure
    warnings.push('קובץ הגיבוי הוא במבנה מצב ישיר (Direct AppState). הנתונים יומרו למבנה סטנדרטי.');
    candidateState = obj;
  } else {
    return {
      isValid: false,
      errors: ['קובץ הגיבוי אינו מכיל נתוני מצב פיננסי תקינים (חסרים transactions או accounts).'],
      warnings,
    };
  }

  // Validate transactions array
  if (!Array.isArray(candidateState.transactions)) {
    errors.push('רשימת העסקאות (transactions) אינה מערך תקין.');
  } else {
    // Deep validate transaction items
    let invalidTxCount = 0;
    const migratedTxs: Transaction[] = [];

    for (let i = 0; i < candidateState.transactions.length; i++) {
      const tx = candidateState.transactions[i];
      if (!tx || typeof tx !== 'object') {
        invalidTxCount++;
        continue;
      }

      if (!tx.id || typeof tx.id !== 'string') {
        invalidTxCount++;
        continue;
      }

      if (typeof tx.amount !== 'number' || !isFinite(tx.amount)) {
        invalidTxCount++;
        continue;
      }

      if (!tx.date || typeof tx.date !== 'string') {
        invalidTxCount++;
        continue;
      }

      // Safe migration to v2 (ensuring sourceRecords and flags)
      migratedTxs.push(migrateTransactionToV2(tx as Transaction));
    }

    if (invalidTxCount > 0) {
      warnings.push(`זוהו ${invalidTxCount} עסקאות לא תקינות אשר סוננו בעת הוולידציה.`);
    }

    candidateState.transactions = migratedTxs;
  }

  // Validate accounts array
  if (!Array.isArray(candidateState.accounts)) {
    errors.push('רשימת החשבונות (accounts) אינה מערך תקין.');
  } else {
    candidateState.accounts = candidateState.accounts.filter(
      (a: any) => a && typeof a === 'object' && a.id && a.name
    );
  }

  // Validate arrays for optional sections with safe fallbacks
  candidateState.budgets = Array.isArray(candidateState.budgets) ? candidateState.budgets : [];
  candidateState.goals = Array.isArray(candidateState.goals) ? candidateState.goals : [];
  candidateState.investments = Array.isArray(candidateState.investments) ? candidateState.investments : [];
  candidateState.recurring = Array.isArray(candidateState.recurring) ? candidateState.recurring : [];
  candidateState.anomalies = Array.isArray(candidateState.anomalies) ? candidateState.anomalies : [];
  candidateState.documents = Array.isArray(candidateState.documents) ? candidateState.documents : [];
  candidateState.learnedRules = Array.isArray(candidateState.learnedRules)
    ? candidateState.learnedRules
    : Array.isArray(obj.learnedRules)
    ? obj.learnedRules
    : [];

  // Validate dataQuality
  if (!candidateState.dataQuality || typeof candidateState.dataQuality !== 'object') {
    candidateState.dataQuality = {
      overallScore: candidateState.transactions?.length > 0 ? 80 : 0,
      institutions: [],
      recommendations: [],
    };
  }

  candidateState.isDemoMode = !!candidateState.isDemoMode;

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      warnings,
    };
  }

  const calculatedSummary: BackupMetadata['summary'] = {
    transactionsCount: candidateState.transactions.length,
    accountsCount: candidateState.accounts.length,
    budgetsCount: candidateState.budgets.length,
    goalsCount: candidateState.goals.length,
    investmentsCount: candidateState.investments.length,
    recurringCount: candidateState.recurring.length,
    rulesCount: candidateState.learnedRules.length,
    documentsCount: candidateState.documents.length,
  };

  const finalMetadata: BackupMetadata = metadata || {
    appIdentifier: BACKUP_APP_IDENTIFIER,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt,
    summary: calculatedSummary,
  };

  finalMetadata.summary = calculatedSummary;

  const validPayload: MatzpenBackupPayload = {
    formatVersion: BACKUP_FORMAT_VERSION,
    metadata: finalMetadata,
    state: candidateState as AppState,
    learnedRules: candidateState.learnedRules,
  };

  return {
    isValid: true,
    errors: [],
    warnings,
    parsedPayload: validPayload,
    summary: calculatedSummary,
    exportedAt,
  };
}

/**
 * Trigger client-side JSON file download in browser.
 */
export function downloadBackupFile(
  payload: MatzpenBackupPayload,
  customFilename?: string
): void {
  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().slice(0, 10);
  const defaultFilename = `matzpen-backup-${dateStr}.json`;
  const filename = customFilename || defaultFilename;

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Pure client-side file reading with asynchronous parsing.
 */
export async function readBackupFile(file: File): Promise<{ content: string; result: ValidationResult }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          resolve({
            content: '',
            result: {
              isValid: false,
              errors: ['הקובץ שנבחר ריק.'],
              warnings: [],
            },
          });
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch (jsonErr: any) {
          resolve({
            content: text,
            result: {
              isValid: false,
              errors: [`שגיאה בפענוח JSON: ${jsonErr.message || 'פורמט לא תקין'}`],
              warnings: [],
            },
          });
          return;
        }

        const validation = validateBackupData(parsed);
        resolve({ content: text, result: validation });
      } catch (err: any) {
        reject(err);
      }
    };
    reader.onerror = () => {
      reject(new Error('שגיאה בקריאת הקובץ מהמכשיר.'));
    };
    reader.readAsText(file);
  });
}

/**
 * Snapshot storage key for a user (or default demo state).
 */
export function getSnapshotStorageKey(userId?: string): string {
  return userId ? `${PRE_RESTORE_SNAPSHOT_PREFIX}_${userId}` : PRE_RESTORE_SNAPSHOT_PREFIX;
}

/**
 * Creates an automatic safety rollback snapshot of the current state before applying restore.
 */
export function createPreRestoreSnapshot(
  currentState: AppState,
  userId?: string
): SnapshotRecord {
  const summary: BackupMetadata['summary'] = {
    transactionsCount: currentState.transactions?.length || 0,
    accountsCount: currentState.accounts?.length || 0,
    budgetsCount: currentState.budgets?.length || 0,
    goalsCount: currentState.goals?.length || 0,
    investmentsCount: currentState.investments?.length || 0,
    recurringCount: currentState.recurring?.length || 0,
    rulesCount: currentState.learnedRules?.length || 0,
    documentsCount: currentState.documents?.length || 0,
  };

  const record: SnapshotRecord = {
    timestamp: new Date().toISOString(),
    userId,
    state: currentState,
    summary,
  };

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(getSnapshotStorageKey(userId), JSON.stringify(record));
    } catch (e) {
      console.warn('Failed to save pre-restore snapshot to localStorage:', e);
    }
  }

  return record;
}

/**
 * Retrieves the stored pre-restore safety snapshot if available.
 */
export function getPreRestoreSnapshot(userId?: string): SnapshotRecord | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getSnapshotStorageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.state && parsed.timestamp) {
        return parsed as SnapshotRecord;
      }
    }
  } catch (e) {
    console.warn('Failed to get pre-restore snapshot:', e);
  }
  return null;
}

/**
 * Clears the pre-restore snapshot after a rollback or user confirmation.
 */
export function clearPreRestoreSnapshot(userId?: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(getSnapshotStorageKey(userId));
  } catch (e) {
    console.warn('Failed to clear pre-restore snapshot:', e);
  }
}

/**
 * Applies rollback to previous pre-restore snapshot state.
 */
export function rollbackPreRestoreSnapshot(userId?: string): {
  success: boolean;
  rolledBackState?: AppState;
  error?: string;
} {
  const snapshot = getPreRestoreSnapshot(userId);
  if (!snapshot) {
    return {
      success: false,
      error: 'לא נמצא עותק בטיחות קודם לשחזור לאחור.',
    };
  }

  try {
    if (userId) {
      saveUserSpecificState(userId, snapshot.state);
    } else {
      saveState(snapshot.state);
    }

    if (snapshot.state.learnedRules) {
      saveStoredLearnedRules(snapshot.state.learnedRules);
    }

    // Keep the snapshot until cleared or replaced
    return {
      success: true,
      rolledBackState: snapshot.state,
    };
  } catch (e: any) {
    return {
      success: false,
      error: `שגיאה בשחזור לאחור: ${e.message}`,
    };
  }
}

/**
 * Restores a validated backup payload into persistent storage and creates a safety rollback snapshot.
 */
export function applyRestore(
  payload: MatzpenBackupPayload,
  currentState: AppState,
  userId?: string
): RestoreResult {
  try {
    // 1. Create safety snapshot of current state prior to overwriting
    createPreRestoreSnapshot(currentState, userId);

    const targetState = payload.state;

    // 2. Persist to isolated user storage or default state
    if (userId) {
      saveUserSpecificState(userId, targetState);
    } else {
      saveState(targetState);
    }

    // 3. Update learned rules store if present in backup
    if (payload.learnedRules && Array.isArray(payload.learnedRules)) {
      saveStoredLearnedRules(payload.learnedRules);
    }

    return {
      success: true,
      restoredState: targetState,
      snapshotCreated: true,
    };
  } catch (err: any) {
    return {
      success: false,
      snapshotCreated: false,
      error: `שגיאה בהחלת השחזור: ${err.message || 'שגיאה לא ידועה'}`,
    };
  }
}
