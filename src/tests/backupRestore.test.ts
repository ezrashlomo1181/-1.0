import {
  generateBackupPayload,
  validateBackupData,
  applyRestore,
  createPreRestoreSnapshot,
  getPreRestoreSnapshot,
  rollbackPreRestoreSnapshot,
  BACKUP_APP_IDENTIFIER,
  BACKUP_FORMAT_VERSION,
  MatzpenBackupPayload,
} from '../services/backupService.js';
import { AppState } from '../services/storage.js';
import { Transaction, Account, LearnedRule, UserProfile } from '../types/financial.js';

// Setup isolated synthetic in-memory storage for test run
const memoryStore = new Map<string, string>();
if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (k: string) => memoryStore.get(k) ?? null,
    setItem: (k: string, v: string) => memoryStore.set(k, String(v)),
    removeItem: (k: string) => memoryStore.delete(k),
    clear: () => memoryStore.clear(),
    key: (idx: number) => Array.from(memoryStore.keys())[idx] ?? null,
    get length() {
      return memoryStore.size;
    },
  };
}

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

console.log('=== TEST SUITE: Local Backup & Restore Mechanism (Stage C.2) ===');

function createSampleAppState(): AppState {
  const transactions: Transaction[] = [
    {
      id: 'tx-syn-1',
      date: '2026-05-10',
      amount: 450.0,
      currency: 'ILS',
      merchant: 'שופרסל דיל',
      description: 'קניות שבועיות בסופר',
      accountId: 'acc-1',
      accountName: 'לאומי עו"ש',
      paymentMethod: 'credit_card',
      category: 'מזון וסופר',
      type: 'expense',
      isRecurring: false,
      confidenceScore: 0.95,
      confidenceLevel: 'high',
      needsReview: false,
      userConfirmed: true,
      sourceDocument: 'leumi_statement.pdf',
      sourceRecords: [],
    },
    {
      id: 'tx-syn-2',
      date: '2026-05-12',
      amount: 12000.0,
      currency: 'ILS',
      merchant: 'מעסיק טכנולוגיות',
      description: 'משכורת חודשית',
      accountId: 'acc-1',
      accountName: 'לאומי עו"ש',
      paymentMethod: 'bank_transfer',
      category: 'שכר עבודה',
      type: 'income',
      isRecurring: false,
      confidenceScore: 1.0,
      confidenceLevel: 'high',
      needsReview: false,
      userConfirmed: true,
      sourceDocument: 'salary_stub.pdf',
      sourceRecords: [],
    },
  ];

  const accounts: Account[] = [
    {
      id: 'acc-1',
      name: 'לאומי עו"ש',
      type: 'bank',
      balance: 15400,
      currency: 'ILS',
      institution: 'בנק לאומי',
      accountNumberMasked: '****1234',
      lastUpdated: '2026-05-12',
      importedMonthsCount: 6,
    },
  ];

  const rules: LearnedRule[] = [
    {
      id: 'rule-syn-1',
      pattern: 'שופרסל',
      applyTo: 'all_similar',
      assignedCategory: 'מזון וסופר',
      assignedType: 'expense',
      createdAt: '2026-05-10',
      userPromptBasis: 'אישור משתמש',
      timesApplied: 3,
    },
  ];

  return {
    isDemoMode: false,
    accounts,
    transactions,
    budgets: [
      { id: 'b-1', category: 'מזון וסופר', allocated: 2500, spent: 450, iconName: 'ShoppingBag' },
    ],
    goals: [
      {
        id: 'g-1',
        name: 'קרן חירום',
        targetAmount: 50000,
        currentAmount: 15000,
        targetDate: '2027-01-01',
        monthlyContribution: 2000,
        category: 'emergency_fund',
      },
    ],
    investments: [],
    recurring: [],
    anomalies: [],
    learnedRules: rules,
    dataQuality: {
      overallScore: 90,
      institutions: [
        {
          name: 'בנק לאומי',
          type: 'בנק',
          status: 'good',
          monthsCovered: 6,
          recommendedMonths: 12,
          notes: 'כיסוי תקין',
        },
      ],
      recommendations: [],
    },
    documents: [],
  };
}

// =========================================================================
// Test 1: Generate Standard Backup Payload Structure & Statistics
// =========================================================================
console.log('\n--- Test 1: Payload Generation ---');
{
  const state = createSampleAppState();
  const mockUser: UserProfile = {
    id: 'user_syn_99',
    username: 'ezra_s',
    name: 'עזרא',
    authProvider: 'password',
    createdAt: '2026-01-01',
    lastLogin: '2026-05-12',
    role: 'user',
    accountStatus: 'active',
    deletionStatus: 'none',
    deletionRequestedAt: null,
    scheduledDeletionDate: null,
    financialProfileCompletion: 80,
    onboardingCompleted: true,
  };

  const payload = generateBackupPayload(state, mockUser);

  assert(payload.formatVersion === BACKUP_FORMAT_VERSION, 'formatVersion is 1');
  assert(payload.metadata.appIdentifier === BACKUP_APP_IDENTIFIER, 'appIdentifier is correct');
  assert(payload.metadata.userScope?.userId === 'user_syn_99', 'userScope preserves userId');
  assert(payload.metadata.userScope?.username === 'ezra_s', 'userScope preserves username');
  assert(payload.metadata.summary.transactionsCount === 2, 'summary reflects exact transactions count (2)');
  assert(payload.metadata.summary.accountsCount === 1, 'summary reflects accounts count (1)');
  assert(payload.metadata.summary.rulesCount === 1, 'summary reflects learned rules count (1)');
  assert(payload.state.transactions.length === 2, 'state contains transactions');
}

// =========================================================================
// Test 2: Validation of Valid Backup
// =========================================================================
console.log('\n--- Test 2: Validation of Valid Backup ---');
{
  const state = createSampleAppState();
  const payload = generateBackupPayload(state);
  const result = validateBackupData(payload);

  assert(result.isValid === true, 'Valid backup passes validation');
  assert(result.errors.length === 0, 'No validation errors');
  assert(result.summary?.transactionsCount === 2, 'Validation summary matches transactions count');
  assert(result.summary?.accountsCount === 1, 'Validation summary matches accounts count');
}

// =========================================================================
// Test 3: Validation Rejects Non-Object or Corrupted Payload
// =========================================================================
console.log('\n--- Test 3: Rejection of Invalid / Corrupted Payloads ---');
{
  const nullResult = validateBackupData(null);
  assert(nullResult.isValid === false, 'null is rejected');
  assert(nullResult.errors.length > 0, 'null produces errors');

  const emptyResult = validateBackupData({});
  assert(emptyResult.isValid === false, 'Empty object is rejected');
  assert(emptyResult.errors.length > 0, 'Empty object produces errors');

  const invalidTxsResult = validateBackupData({
    accounts: [{ id: 'a1', name: 'acc' }],
    transactions: 'not_an_array',
  });
  assert(invalidTxsResult.isValid === false, 'Non-array transactions is rejected');
}

// =========================================================================
// Test 4: Handling Corrupted Transaction Rows Safely
// =========================================================================
console.log('\n--- Test 4: Filtering Corrupted Transaction Items with Warnings ---');
{
  const corruptedPayload: any = {
    metadata: {
      appIdentifier: BACKUP_APP_IDENTIFIER,
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      summary: { transactionsCount: 3 },
    },
    state: {
      accounts: [{ id: 'acc1', name: 'ראשי' }],
      transactions: [
        { id: 'tx-ok-1', amount: 100, date: '2026-05-01', description: 'תקינה' },
        { id: null, amount: 200, date: '2026-05-02', description: 'ללא ID' },
        { id: 'tx-bad-2', amount: 'NaN_string', date: '2026-05-03', description: 'סכום לא מספר' },
        { id: 'tx-ok-2', amount: 350, date: '2026-05-04', description: 'תקינה נוספת' },
      ],
    },
  };

  const result = validateBackupData(corruptedPayload);
  assert(result.isValid === true, 'Payload is accepted after filtering invalid rows');
  assert(result.summary?.transactionsCount === 2, 'Only the 2 valid transactions remain');
  assert(result.warnings.length > 0, 'Warning logged about filtered corrupted rows');
}

// =========================================================================
// Test 5: Backward Compatibility with Legacy Direct AppState
// =========================================================================
console.log('\n--- Test 5: Legacy Direct AppState Support ---');
{
  const legacyAppState = {
    accounts: [{ id: 'acc-leg-1', name: 'עו"ש ישן' }],
    transactions: [
      { id: 'tx-leg-1', amount: 80, date: '2026-01-01', description: 'עסקה ישנה', category: 'כללי' },
    ],
    budgets: [],
  };

  const result = validateBackupData(legacyAppState);
  assert(result.isValid === true, 'Legacy direct AppState accepted');
  assert(result.warnings.some((w) => w.includes('Direct AppState')), 'Warning explains direct conversion');
  assert(result.parsedPayload?.metadata.appIdentifier === BACKUP_APP_IDENTIFIER, 'Wrapped in standard metadata');
  assert(
    (result.parsedPayload?.state.transactions[0]?.sourceRecords?.length ?? 0) > 0,
    'sourceRecords initialized via migrateTransactionToV2'
  );
}

// =========================================================================
// Test 6: Automatic Pre-Restore Safety Snapshot & Rollback
// =========================================================================
console.log('\n--- Test 6: Pre-Restore Safety Snapshot & Rollback ---');
{
  memoryStore.clear();
  const originalState = createSampleAppState();
  const userId = 'usr_test_safety_1';

  // 1. Create snapshot
  const snapshot = createPreRestoreSnapshot(originalState, userId);
  assert(snapshot.summary.transactionsCount === 2, 'Snapshot captures original 2 transactions');

  // 2. Retrieve snapshot
  const retrieved = getPreRestoreSnapshot(userId);
  assert(retrieved !== null, 'Snapshot retrieved successfully from storage');
  assert(retrieved?.summary.transactionsCount === 2, 'Retrieved snapshot has correct transactions count');

  // 3. Rollback snapshot
  const rollbackRes = rollbackPreRestoreSnapshot(userId);
  assert(rollbackRes.success === true, 'Rollback succeeds');
  assert(rollbackRes.rolledBackState?.transactions.length === 2, 'Rolled back state contains original transactions');
}

// =========================================================================
// Test 7: applyRestore Persists to User-Specific Key & Creates Snapshot
// =========================================================================
console.log('\n--- Test 7: Apply Restore with User Isolation ---');
{
  memoryStore.clear();
  const currentState = createSampleAppState();
  const userId = 'user_isolated_alpha';

  // New incoming state with 1 new transaction
  const incomingState = createSampleAppState();
  incomingState.transactions = [
    {
      id: 'tx-restored-1',
      date: '2026-06-01',
      amount: 999.0,
      currency: 'ILS',
      merchant: 'שחזור מוצלח',
      description: 'בדיקת שחזור',
      accountId: 'acc-1',
      accountName: 'לאומי עו"ש',
      paymentMethod: 'credit_card',
      category: 'שונות',
      type: 'expense',
      isRecurring: false,
      confidenceScore: 1.0,
      confidenceLevel: 'high',
      needsReview: false,
      userConfirmed: true,
      sourceDocument: 'restored.pdf',
      sourceRecords: [],
    },
  ];

  const payload: MatzpenBackupPayload = {
    formatVersion: 1,
    metadata: {
      appIdentifier: BACKUP_APP_IDENTIFIER,
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      summary: {
        transactionsCount: 1,
        accountsCount: 1,
        budgetsCount: 1,
        goalsCount: 1,
        investmentsCount: 0,
        recurringCount: 0,
        rulesCount: 1,
        documentsCount: 0,
      },
    },
    state: incomingState,
    learnedRules: incomingState.learnedRules,
  };

  const restoreResult = applyRestore(payload, currentState, userId);

  assert(restoreResult.success === true, 'applyRestore succeeds');
  assert(restoreResult.snapshotCreated === true, 'Safety snapshot was created prior to overwrite');
  assert(restoreResult.restoredState?.transactions.length === 1, 'Restored state has 1 transaction');
  assert(restoreResult.restoredState?.transactions[0].id === 'tx-restored-1', 'Restored state has correct ID');

  // Verify that previous state was saved in snapshot
  const preSnapshot = getPreRestoreSnapshot(userId);
  assert(preSnapshot?.state.transactions.length === 2, 'Pre-restore snapshot preserved previous 2 transactions');
}

// Clear mock storage so isolated tests do not leak into other test suites
if ((globalThis as any).localStorage?.clear) {
  (globalThis as any).localStorage.clear();
}

console.log(`\n======================================================================`);
console.log(`TEST SUITE SUMMARY: ${passedCount} passed, ${failedCount} failed`);
console.log(`======================================================================\n`);

if (failedCount > 0) {
  process.exit(1);
}
