import React, { useState, useEffect } from 'react';
import {
  subscribeToLocalAuth,
  logoutLocalUser,
  requestLocalAccountDeletion,
  cancelLocalAccountDeletion,
} from './services/localAuth';
import {
  loadInitialState,
  saveState,
  resetToDemoData,
  switchToMyDataEmpty,
  loadUserSpecificState,
  saveUserSpecificState,
  createEmptyUserState,
  AppState,
} from './services/storage';
import {
  Transaction,
  LearnedRule,
  BudgetCategory,
  FinancialGoal,
  RecurringCommitment,
  InvestmentAsset,
  UploadedDocument,
  UserProfile,
} from './types/financial';
import { deduplicateTransactions, parseFinancialDocument } from './services/documentParser';
import { Sidebar, NavSection } from './components/Sidebar';
import { Header } from './components/Header';
import { VerificationModal } from './components/VerificationModal';
import { DataTraceModal } from './components/DataTraceModal';
import { OnboardingModal } from './components/OnboardingModal';
import { MyDocumentsModal } from './components/MyDocumentsModal';
import { AuthModal } from './components/AuthModal';
import { UserOnboardingModal } from './components/UserOnboardingModal';

// Views
import { DashboardView } from './views/DashboardView';
import { TransactionsView } from './views/TransactionsView';
import { BudgetView } from './views/BudgetView';
import { GoalsView } from './views/GoalsView';
import { InvestmentsView } from './views/InvestmentsView';
import { SimulationsView } from './views/SimulationsView';
import { CommitmentsView } from './views/CommitmentsView';
import { AnalyticsView } from './views/AnalyticsView';
import { DataCenterView } from './views/DataCenterView';
import { AskFinancesView } from './views/AskFinancesView';
import { SettingsView } from './views/SettingsView';
import { DeveloperTestView } from './views/DeveloperTestView';
import { areTestingToolsEnabled } from './config/testingConfig';

import { AlertTriangle, Clock } from 'lucide-react';

export default function App() {
  const [state, setState] = useState<AppState>(loadInitialState);
  const [currentSection, setCurrentSection] = useState<NavSection>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // User Authentication & Profile
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isUserOnboardingOpen, setIsUserOnboardingOpen] = useState(false);

  // Modals state
  const [reviewingTx, setReviewingTx] = useState<Transaction | null>(null);
  const [traceData, setTraceData] = useState<{
    isOpen: boolean;
    title: string;
    amount: number;
    transactions: Transaction[];
  }>({
    isOpen: false,
    title: '',
    amount: 0,
    transactions: [],
  });
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isMyDocumentsOpen, setIsMyDocumentsOpen] = useState(false);

  // Listen to Local Auth state and manage isolated user data
  useEffect(() => {
    let previousUserId: string | null = null;

    const unsubscribe = subscribeToLocalAuth((localUser) => {
      setUserProfile(localUser);

      if (localUser) {
        if (previousUserId !== localUser.id) {
          previousUserId = localUser.id;
          const userState = loadUserSpecificState(localUser.id);
          if (userState) {
            setState(userState);
          } else {
            // New user without stored financial data yet -> initialize isolated empty state
            const cleanState = createEmptyUserState();
            saveUserSpecificState(localUser.id, cleanState);
            setState(cleanState);
          }

          if (!localUser.onboardingCompleted) {
            setIsUserOnboardingOpen(true);
          }
        }
      } else {
        if (previousUserId !== null) {
          previousUserId = null;
          // When logged out, reset to demo data so previous user's financial data is not visible
          setState(loadInitialState());
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Sync state to localStorage (Scoped strictly per user if logged in, otherwise global demo state)
  useEffect(() => {
    if (userProfile?.id) {
      saveUserSpecificState(userProfile.id, state);
    } else {
      saveState(state);
    }
  }, [state, userProfile]);

  // Compute profile completion score (Section 10)
  const calculateProfileCompletion = (): number => {
    let score = 20; // 20% for completed account creation
    if (state.accounts.length > 0) score += 25;
    if (state.transactions.length > 0) score += 25;
    if (state.budgets.some((b) => b.allocated > 0)) score += 15;
    if (state.goals.length > 0) score += 15;
    return Math.min(100, score);
  };

  const profileCompletionScore = calculateProfileCompletion();

  // Count items needing review
  const needsReviewList = state.transactions.filter((t) => t.needsReview);

  // Handlers for Verification
  const handleOpenReviewModal = (tx?: Transaction) => {
    if (tx) {
      setReviewingTx(tx);
    } else if (needsReviewList.length > 0) {
      setReviewingTx(needsReviewList[0]);
    }
  };

  const handleResolveTransaction = (
    transactionId: string,
    chosenCategory: string,
    userNotes: string,
    createRuleOption: 'all_similar' | 'exact_only' | 'none'
  ) => {
    setState((prev) => {
      const updatedTxs = prev.transactions.map((t) =>
        t.id === transactionId
          ? {
              ...t,
              category: chosenCategory,
              needsReview: false,
              userConfirmed: true,
              confidenceScore: 1.0,
              confidenceLevel: 'high' as const,
            }
          : t
      );

      let newRules = [...prev.learnedRules];
      if (createRuleOption !== 'none') {
        const targetTx = prev.transactions.find((t) => t.id === transactionId);
        newRules.push({
          id: `rule-${Date.now()}`,
          pattern: targetTx?.merchant || chosenCategory,
          applyTo: createRuleOption,
          assignedCategory: chosenCategory,
          assignedType: 'expense',
          createdAt: new Date().toISOString().split('T')[0],
          userPromptBasis: `אישור משתמש עבור ${targetTx?.merchant || chosenCategory}`,
          timesApplied: 1,
        });
      }

      return {
        ...prev,
        transactions: updatedTxs,
        learnedRules: newRules,
      };
    });
  };

  // Traceability Modal Opener
  const handleOpenTrace = (title: string, amount: number, transactions: Transaction[]) => {
    setTraceData({
      isOpen: true,
      title,
      amount,
      transactions,
    });
  };

  // Mode Toggle
  const handleToggleDemoMode = () => {
    if (state.isDemoMode) {
      const emptyState = switchToMyDataEmpty();
      setState(emptyState);
    } else {
      const demoState = resetToDemoData();
      setState(demoState);
    }
  };

  const handleResetDemoData = () => {
    const demo = resetToDemoData();
    setState(demo);
  };

  const handleClearAllData = () => {
    const empty = switchToMyDataEmpty();
    setState(empty);
  };

  // Handlers for Budgets, Goals, Commitments updates
  const handleUpdateBudgets = (updated: BudgetCategory[]) => {
    setState((prev) => ({ ...prev, budgets: updated }));
  };

  const handleUpdateGoals = (updated: FinancialGoal[]) => {
    setState((prev) => ({ ...prev, goals: updated }));
  };

  const handleUpdateCommitments = (updated: RecurringCommitment[]) => {
    setState((prev) => ({ ...prev, recurring: updated }));
  };

  const handleUpdateRules = (updated: LearnedRule[]) => {
    setState((prev) => ({ ...prev, learnedRules: updated }));
  };

  const handleDismissAnomaly = (id: string) => {
    setState((prev) => ({
      ...prev,
      anomalies: prev.anomalies.map((a) => (a.id === id ? { ...a, isDismissed: true } : a)),
    }));
  };

  // Handle real file upload from Data Center - Strictly real transactions, no mocks
  const handleImportFile = (file: File, extractedTransactions: Transaction[], detectedInstitution?: string) => {
    if (!extractedTransactions || extractedTransactions.length === 0) {
      // Strictly prevent creating any mock or dummy transactions
      return;
    }

    const fileExt = file.name.toLowerCase().endsWith('.pdf')
      ? 'pdf'
      : file.name.toLowerCase().endsWith('.csv')
      ? 'csv'
      : file.name.toLowerCase().endsWith('.xls')
      ? 'xls'
      : 'xlsx';

    const institution = detectedInstitution || (
      file.name.includes('לאומי') ? 'בנק לאומי' :
      file.name.includes('דיסקונט') ? 'בנק דיסקונט' :
      file.name.includes('מזרחי') ? 'מזרחי טפחות' :
      file.name.includes('ישראכרט') ? 'ישראכרט' :
      file.name.toLowerCase().includes('max') || file.name.includes('מקס') ? 'מקס (MAX)' :
      file.name.toLowerCase().includes('cal') || file.name.includes('כאל') ? 'כאל (CAL)' :
      'בנק / כרטיס אשראי'
    );

    setState((prev) => {
      // 1. Deduplicate new transactions against existing user transactions
      const { uniqueTxs } = deduplicateTransactions(prev.transactions, extractedTransactions);

      const newDoc: UploadedDocument = {
        id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        fileName: file.name,
        fileType: fileExt,
        fileSize: file.size,
        uploadDate: new Date().toISOString().split('T')[0],
        status: 'completed',
        transactionsCount: uniqueTxs.length,
        institution,
      };

      // 2. Register detected accounts if not already present
      const existingAccountIds = new Set(prev.accounts.map((a) => a.id));
      const newAccounts = [...prev.accounts];
      for (const tx of uniqueTxs) {
        if (!existingAccountIds.has(tx.accountId)) {
          existingAccountIds.add(tx.accountId);
          newAccounts.push({
            id: tx.accountId,
            name: tx.accountName,
            institution,
            type: tx.paymentMethod === 'credit_card' ? 'credit_card' : 'bank',
            balance: 0,
            currency: 'ILS',
            accountNumberMasked: `****${Math.floor(1000 + Math.random() * 9000)}`,
            lastUpdated: new Date().toISOString().split('T')[0],
            importedMonthsCount: 1,
          });
        }
      }

      return {
        ...prev,
        accounts: newAccounts,
        documents: [newDoc, ...prev.documents],
        transactions: [...uniqueTxs, ...prev.transactions],
        dataQuality: {
          ...prev.dataQuality,
          overallScore: Math.min(100, Math.max(prev.dataQuality.overallScore, 40) + Math.min(25, uniqueTxs.length * 2)),
        },
      };
    });
  };

  // Real document deletion
  const handleDeleteDocument = (docId: string, fileName: string) => {
    setState((prev) => {
      const remainingDocs = prev.documents.filter((d) => d.id !== docId);
      const remainingTxs = prev.transactions.filter((tx) => tx.sourceDocument !== fileName);

      return {
        ...prev,
        documents: remainingDocs,
        transactions: remainingTxs,
        dataQuality: {
          ...prev.dataQuality,
          overallScore: Math.max(25, prev.dataQuality.overallScore - 3),
        },
      };
    });
  };

  // Grace Period Deletion Request
  const handleRequestAccountDeletion = () => {
    if (!userProfile) return;
    requestLocalAccountDeletion(userProfile.id);
  };

  // Grace Period Deletion Cancel
  const handleCancelGraceDeletion = () => {
    if (!userProfile) return;
    cancelLocalAccountDeletion(userProfile.id);
  };

  // User Sign Out
  const handleSignOut = () => {
    logoutLocalUser();
    setUserProfile(null);
    setState(loadInitialState());
    setCurrentSection('dashboard');
    setIsAuthModalOpen(true);
  };

  // Switch demo user session (Section 15 & 16)
  const handleSwitchTestUser = (mockUser: UserProfile) => {
    setUserProfile(mockUser);
    setCurrentSection('dashboard');

    // Seed mockUser-specific financial isolation state
    if (mockUser.id === 'demo-user-1') {
      const demo1State = resetToDemoData();
      setState({
        ...demo1State,
        accounts: [
          {
            id: 'acc-poalim-demo',
            name: 'בנק הפועלים (עו״ש ראשי)',
            type: 'bank',
            balance: 24800,
            institution: 'בנק הפועלים',
            currency: 'ILS',
            accountNumberMasked: '•••• 4821',
            importedMonthsCount: 12,
            lastUpdated: new Date().toISOString(),
          },
          {
            id: 'acc-isracard-demo',
            name: 'ישראכרט Gold משפחתי',
            type: 'credit_card',
            balance: -4250,
            institution: 'ישראכרט',
            currency: 'ILS',
            accountNumberMasked: '•••• 9102',
            importedMonthsCount: 12,
            lastUpdated: new Date().toISOString(),
          },
        ],
      });
    } else if (mockUser.id === 'demo-user-2') {
      setState({
        accounts: [
          {
            id: 'acc-leumi-demo2',
            name: 'בנק לאומי עסקי ופרטי',
            type: 'bank',
            balance: 68500,
            institution: 'בנק לאומי',
            currency: 'ILS',
            accountNumberMasked: '•••• 7714',
            importedMonthsCount: 8,
            lastUpdated: new Date().toISOString(),
          },
          {
            id: 'acc-meitav-demo2',
            name: 'מיטב טרייד - תיק מניות',
            type: 'investment',
            balance: 142000,
            institution: 'מיטב טרייד',
            currency: 'ILS',
            accountNumberMasked: '•••• 3302',
            importedMonthsCount: 12,
            lastUpdated: new Date().toISOString(),
          },
        ],
        transactions: [
          {
            id: 'tx-d2-1',
            date: '2026-09-28',
            amount: 22000,
            currency: 'ILS',
            merchant: 'תקבול מלקוח עסקי - חברת הייטק',
            description: 'חשבונית מס קבלה 104',
            accountId: 'acc-leumi-demo2',
            accountName: 'בנק לאומי עסקי',
            paymentMethod: 'bank_transfer',
            category: 'הכנסה',
            type: 'income',
            isRecurring: false,
            confidenceScore: 0.99,
            confidenceLevel: 'high',
            needsReview: false,
            userConfirmed: true,
          },
          {
            id: 'tx-d2-2',
            date: '2026-09-25',
            amount: 8500,
            currency: 'ILS',
            merchant: 'רכישת מניות S&P 500 ETF',
            description: 'קנייה דרך מערכת מסחר',
            accountId: 'acc-meitav-demo2',
            accountName: 'מיטב טרייד',
            paymentMethod: 'bank_transfer',
            category: 'השקעות',
            type: 'investment_contribution',
            isRecurring: false,
            confidenceScore: 0.98,
            confidenceLevel: 'high',
            needsReview: false,
            userConfirmed: true,
          },
        ],
        budgets: [
          { id: 'b-d2-1', category: 'השקעות', allocated: 8000, spent: 8500, iconName: 'TrendingUp' },
          { id: 'b-d2-2', category: 'עסקי והוצאות', allocated: 5000, spent: 3400, iconName: 'Briefcase' },
        ],
        goals: [
          {
            id: 'g-d2-1',
            name: 'חיסכון לדירה להשקעה',
            targetAmount: 350000,
            currentAmount: 185000,
            targetDate: '2028-12-31',
            monthlyContribution: 5000,
            category: 'home',
          },
        ],
        investments: [
          {
            id: 'inv-d2-1',
            name: 'קרן סל מחקה מדד S&P 500',
            symbol: 'CSPX',
            type: 'etf',
            currentValue: 142000,
            investedAmount: 118000,
            unrealizedGain: 24000,
            gainPercentage: 20.3,
            allocationPercentage: 100,
            accountName: 'מיטב טרייד',
          },
        ],
        recurring: [],
        anomalies: [],
        learnedRules: [],
        dataQuality: {
          overallScore: 60,
          institutions: [{ name: 'בנק לאומי', type: 'בנק', status: 'good', monthsCovered: 8, recommendedMonths: 12, notes: 'תקין' }],
          recommendations: ['ייבא דוח שנתי ממיטב טרייד להשלמת התשואה'],
        },
        documents: [],
        isDemoMode: false,
      });
    } else if (mockUser.id === 'demo-user-3') {
      setState({
        accounts: [
          {
            id: 'acc-discount-demo3',
            name: 'בנק דיסקונט (חשבון סטודנט)',
            type: 'bank',
            balance: 1420,
            institution: 'בנק דיסקונט',
            currency: 'ILS',
            accountNumberMasked: '•••• 1209',
            importedMonthsCount: 3,
            lastUpdated: new Date().toISOString(),
          },
        ],
        transactions: [
          {
            id: 'tx-d3-1',
            date: '2026-09-29',
            amount: 3200,
            currency: 'ILS',
            merchant: 'מלגת לימודים אוניברסיטאית',
            description: 'העברה ממוסד אקדמי',
            accountId: 'acc-discount-demo3',
            accountName: 'בנק דיסקונט',
            paymentMethod: 'bank_transfer',
            category: 'הכנסה',
            type: 'income',
            isRecurring: true,
            confidenceScore: 0.98,
            confidenceLevel: 'high',
            needsReview: false,
            userConfirmed: true,
          },
          {
            id: 'tx-d3-2',
            date: '2026-09-24',
            amount: 1950,
            currency: 'ILS',
            merchant: 'שכר דירת שותפים',
            description: 'העברה בביט',
            accountId: 'acc-discount-demo3',
            accountName: 'בנק דיסקונט',
            paymentMethod: 'bit',
            category: 'דיור',
            type: 'expense',
            isRecurring: true,
            confidenceScore: 0.95,
            confidenceLevel: 'high',
            needsReview: false,
            userConfirmed: true,
          },
        ],
        budgets: [
          { id: 'b-d3-1', category: 'דיור', allocated: 2000, spent: 1950, iconName: 'Home' },
          { id: 'b-d3-2', category: 'מזון וסופר', allocated: 800, spent: 720, iconName: 'ShoppingBag' },
        ],
        goals: [
          {
            id: 'g-d3-1',
            name: 'קרן חירום סטודנטיאלית',
            targetAmount: 10000,
            currentAmount: 2500,
            targetDate: '2027-06-30',
            monthlyContribution: 300,
            category: 'emergency_fund',
          },
        ],
        investments: [],
        recurring: [],
        anomalies: [],
        learnedRules: [],
        dataQuality: {
          overallScore: 40,
          institutions: [{ name: 'בנק דיסקונט', type: 'בנק', status: 'partial', monthsCovered: 3, recommendedMonths: 12, notes: 'חסר כיסוי' }],
          recommendations: ['ייבא תדפיס של 6 חודשים לדיוק התקציב'],
        },
        documents: [],
        isDemoMode: false,
      });
    }
  };

  // Reset test environment (Section 17 & 20)
  const handleResetTestEnvironment = () => {
    // Clear only demo user keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('matzpen_user_demo') || key.includes('test'))) {
        localStorage.removeItem(key);
      }
    }
    const clean = switchToMyDataEmpty();
    setState(clean);
    alert('סביבת הבדיקות אופסה בהצלחה! כל נתוני ה-Demo נוקו. משתמשי אמת לא הושפעו.');
  };

  // Inject test file directly into data center
  const handleInjectTestFile = async (file: File) => {
    const parseResult = await parseFinancialDocument(file);
    if (parseResult.success && parseResult.transactions.length > 0) {
      handleImportFile(file, parseResult.transactions, parseResult.institution);
    }
    setCurrentSection('datacenter');
  };

  // Onboarding Completion Choice
  const handleOnboardingComplete = (choice: 'upload' | 'manual' | 'explore') => {
    setIsUserOnboardingOpen(false);
    setUserProfile((prev) => (prev ? { ...prev, onboardingCompleted: true } : null));

    if (choice === 'upload') {
      setCurrentSection('datacenter');
    } else if (choice === 'manual') {
      setCurrentSection('transactions');
    } else {
      setCurrentSection('dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] dark:bg-[#0B0F17] dark:text-slate-100 flex flex-col font-sans transition-colors duration-150" dir="rtl">
      {/* 30-Day Account Deletion Grace Period Banner (#6) */}
      {userProfile?.deletionStatus === 'pending_deletion' && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200 px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs z-50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
            <span>
              <strong>חשבונך מתוזמן למחיקה ב-{userProfile.scheduledDeletionDate?.split('T')[0] || 'עוד 30 יום'}.</strong>{' '}
              במהלך 30 ימי החסד כל הנתונים הפיננסיים שלך נשמרים. באפשרותך לבטל את המחיקה בכל רגע.
            </span>
          </div>
          <button
            onClick={handleCancelGraceDeletion}
            className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 font-semibold text-xs border border-slate-800 dark:border-slate-700 transition-colors shadow-xs cursor-pointer whitespace-nowrap"
          >
            בטל בקשת מחיקה
          </button>
        </div>
      )}

      {/* Sidebar Navigation */}
      <Sidebar
        currentSection={currentSection}
        onSelectSection={setCurrentSection}
        needsReviewCount={needsReviewList.length}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="lg:mr-64 flex-1 flex flex-col min-w-0">
        <Header
          isDemoMode={state.isDemoMode}
          onToggleDemoMode={handleToggleDemoMode}
          dataQuality={state.dataQuality}
          needsReviewCount={needsReviewList.length}
          onOpenReviewModal={() => handleOpenReviewModal()}
          onOpenOnboarding={() => setIsOnboardingOpen(true)}
          onOpenDataCenter={() => setCurrentSection('datacenter')}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          searchQuery={searchQuery}
          onSearchChange={(q) => {
            setSearchQuery(q);
            if (q.trim() && currentSection !== 'transactions') {
              setCurrentSection('transactions');
            }
          }}
          user={userProfile}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onSignOut={handleSignOut}
        />

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          {currentSection === 'dashboard' && (
            <DashboardView
              accounts={state.accounts}
              transactions={state.transactions}
              budgets={state.budgets}
              goals={state.goals}
              investments={state.investments}
              recurring={state.recurring}
              anomalies={state.anomalies}
              onNavigateToSection={setCurrentSection}
              onOpenTraceModal={handleOpenTrace}
              onOpenReviewTransaction={handleOpenReviewModal}
              financialProfileCompletion={profileCompletionScore}
              onLoadDemoData={handleResetDemoData}
            />
          )}

          {currentSection === 'transactions' && (
            <TransactionsView
              transactions={state.transactions}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onOpenReviewModal={handleOpenReviewModal}
              onOpenTraceModal={handleOpenTrace}
            />
          )}

          {currentSection === 'budget' && (
            <BudgetView
              budgets={state.budgets}
              transactions={state.transactions}
              onUpdateBudget={handleUpdateBudgets}
              onOpenTraceModal={handleOpenTrace}
            />
          )}

          {currentSection === 'goals' && (
            <GoalsView
              goals={state.goals}
              onUpdateGoals={handleUpdateGoals}
            />
          )}

          {currentSection === 'investments' && (
            <InvestmentsView
              investments={state.investments}
              transactions={state.transactions}
              onOpenTraceModal={handleOpenTrace}
            />
          )}

          {currentSection === 'simulations' && (
            <SimulationsView
              accounts={state.accounts}
              goals={state.goals}
              monthlySavings={3500}
              monthlyExpenses={14850}
            />
          )}

          {currentSection === 'commitments' && (
            <CommitmentsView
              commitments={state.recurring}
              onUpdateCommitments={handleUpdateCommitments}
            />
          )}

          {currentSection === 'analytics' && (
            <AnalyticsView
              anomalies={state.anomalies}
              transactions={state.transactions}
              onDismissAnomaly={handleDismissAnomaly}
              onOpenReviewModal={handleOpenReviewModal}
            />
          )}

          {currentSection === 'datacenter' && (
            <DataCenterView
              dataQuality={state.dataQuality}
              documentsCount={state.documents.length}
              existingDocuments={state.documents}
              onOpenMyDocuments={() => setIsMyDocumentsOpen(true)}
              onImportFile={handleImportFile}
            />
          )}

          {currentSection === 'ask' && (
            <AskFinancesView
              transactions={state.transactions}
              accounts={state.accounts}
              goals={state.goals}
              investments={state.investments}
            />
          )}

          {currentSection === 'settings' && (
            <SettingsView
              learnedRules={state.learnedRules}
              onUpdateRules={handleUpdateRules}
              onResetDemoData={handleResetDemoData}
              onClearAllData={handleClearAllData}
              userProfile={userProfile}
              onRequestAccountDeletion={handleRequestAccountDeletion}
              onCancelAccountDeletion={handleCancelGraceDeletion}
            />
          )}

          {/* Developer / Testing Panel (#15 - #20) */}
          {currentSection === 'developer' && areTestingToolsEnabled() && (
            <DeveloperTestView
              currentUser={userProfile}
              onSwitchUser={handleSwitchTestUser}
              onResetTestEnvironment={handleResetTestEnvironment}
              onInjectTestFile={handleInjectTestFile}
            />
          )}
        </main>
      </div>

      {/* Verification / Uncertainty Clarification Modal */}
      <VerificationModal
        transaction={reviewingTx}
        onClose={() => setReviewingTx(null)}
        onResolve={handleResolveTransaction}
      />

      {/* Traceability Audit Trail Modal */}
      {traceData.isOpen && (
        <DataTraceModal
          title={traceData.title}
          totalAmount={traceData.amount}
          transactions={traceData.transactions}
          onClose={() => setTraceData((prev) => ({ ...prev, isOpen: false }))}
          onSelectTransactionForReview={handleOpenReviewModal}
        />
      )}

      {/* Philosophy Tour Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onOpenDataCenter={() => setCurrentSection('datacenter')}
      />

      {/* My Documents Management Modal */}
      <MyDocumentsModal
        isOpen={isMyDocumentsOpen}
        onClose={() => setIsMyDocumentsOpen(false)}
        documents={state.documents}
        onDeleteDocument={handleDeleteDocument}
      />

      {/* Auth Modal (Google, Apple, Email/Password, Reset) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onSuccess={() => setIsAuthModalOpen(false)}
        onClose={() => setIsAuthModalOpen(false)}
        canDismiss={true}
      />

      {/* Progressive New User Onboarding Modal (#7 & #8) */}
      <UserOnboardingModal
        isOpen={isUserOnboardingOpen}
        initialName={userProfile?.name || ''}
        userId={userProfile?.id || ''}
        onComplete={handleOnboardingComplete}
      />
    </div>
  );
}
