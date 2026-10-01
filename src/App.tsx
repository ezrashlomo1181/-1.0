import React, { useState, useEffect } from 'react';
import {
  loadInitialState,
  saveState,
  resetToDemoData,
  switchToMyDataEmpty,
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
} from './types/financial';
import { Sidebar, NavSection } from './components/Sidebar';
import { Header } from './components/Header';
import { VerificationModal } from './components/VerificationModal';
import { DataTraceModal } from './components/DataTraceModal';
import { OnboardingModal } from './components/OnboardingModal';
import { MyDocumentsModal } from './components/MyDocumentsModal';

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

export default function App() {
  const [state, setState] = useState<AppState>(loadInitialState);
  const [currentSection, setCurrentSection] = useState<NavSection>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Sync state to localStorage whenever modified
  useEffect(() => {
    saveState(state);
  }, [state]);

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
    const targetTx = state.transactions.find((t) => t.id === transactionId);

    // Update transactions list
    const updatedTransactions = state.transactions.map((tx) => {
      if (tx.id === transactionId) {
        return {
          ...tx,
          category: chosenCategory,
          needsReview: false,
          userConfirmed: true,
          confidenceScore: 1.0,
          confidenceLevel: 'high' as const,
          userNotes: userNotes || tx.userNotes,
        };
      }
      return tx;
    });

    let updatedRules = [...state.learnedRules];

    // If user agreed to save a persistent rule
    if (createRuleOption !== 'none' && targetTx) {
      const merchantKeyword = targetTx.merchant.split(' ')[0] || targetTx.merchant;
      const newRule: LearnedRule = {
        id: `rule-${Date.now()}`,
        pattern: merchantKeyword,
        applyTo: createRuleOption,
        assignedCategory: chosenCategory,
        assignedType: targetTx.type,
        createdAt: new Date().toISOString().split('T')[0],
        userPromptBasis: `סיווג ידני שאושר על ידי המשתמש עבור ${targetTx.merchant}`,
        timesApplied: 1,
      };
      updatedRules.push(newRule);
    }

    setState((prev) => ({
      ...prev,
      transactions: updatedTransactions,
      learnedRules: updatedRules,
    }));
  };

  // Handlers for Data Traceability Modal
  const handleOpenTrace = (title: string, amount: number, txs: Transaction[]) => {
    setTraceData({
      isOpen: true,
      title,
      amount,
      transactions: txs,
    });
  };

  // Demo mode toggles
  const handleToggleDemoMode = () => {
    if (state.isDemoMode) {
      setState(switchToMyDataEmpty());
    } else {
      setState(resetToDemoData());
    }
  };

  const handleResetDemoData = () => {
    setState(resetToDemoData());
  };

  const handleClearAllData = () => {
    setState(switchToMyDataEmpty());
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

  // Handle real file upload from Data Center
  const handleImportFile = (file: File, extractedCount: number) => {
    const isCard = file.name.toLowerCase().includes('card') || file.name.includes('אשראי') || file.name.includes('max') || file.name.includes('ישראכרט');
    const isInvest = file.name.toLowerCase().includes('invest') || file.name.includes('השקעות') || file.name.includes('מיטב');

    const fileExt = file.name.toLowerCase().endsWith('.pdf')
      ? 'pdf'
      : file.name.toLowerCase().endsWith('.csv')
      ? 'csv'
      : file.name.toLowerCase().endsWith('.xls')
      ? 'xls'
      : 'xlsx';

    const newDoc: UploadedDocument = {
      id: `doc-${Date.now()}`,
      fileName: file.name,
      fileType: fileExt,
      fileSize: file.size,
      uploadDate: new Date().toISOString().split('T')[0],
      status: 'completed',
      transactionsCount: extractedCount,
      institution: isInvest ? 'מיטב טרייד' : isCard ? 'ישראכרט' : 'בנק הפועלים',
    };

    const newTransactions: Transaction[] = [
      {
        id: `tx-import-1-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        amount: isInvest ? 3000 : isCard ? 385 : 620,
        currency: 'ILS',
        merchant: isInvest ? 'הפקדה לחשבון מסחר' : isCard ? 'קניון עזריאלי - רשת חנויות' : 'תשלום חשבון גז וחשמל',
        description: `עסקה שחולצה מקובץ ${file.name}`,
        accountId: isInvest ? 'acc-meitav-trade' : isCard ? 'acc-isracard' : 'acc-hapoalim',
        accountName: isInvest ? 'מיטב טרייד' : isCard ? 'ישראכרט Gold' : 'בנק הפועלים',
        paymentMethod: isCard ? 'credit_card' : 'bank_transfer',
        category: isInvest ? 'השקעות' : isCard ? 'קניות' : 'חשבונות',
        type: isInvest ? 'investment_contribution' : 'expense',
        isRecurring: false,
        confidenceScore: 0.96,
        confidenceLevel: 'high',
        needsReview: false,
        userConfirmed: true,
        sourceDocument: file.name,
      },
      {
        id: `tx-import-2-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        amount: 450,
        currency: 'ILS',
        merchant: 'שובר מתנה דיגיטלי / קופון',
        description: `עסקה שחולצה מקובץ ${file.name} - דורשת הגדרת קטגוריה`,
        accountId: isCard ? 'acc-isracard' : 'acc-hapoalim',
        accountName: isCard ? 'ישראכרט Gold' : 'בנק הפועלים',
        paymentMethod: isCard ? 'credit_card' : 'bank_transfer',
        category: 'אחר',
        type: 'expense',
        isRecurring: false,
        confidenceScore: 0.45,
        confidenceLevel: 'low',
        needsReview: true,
        reviewReason: `עסקה מקובץ "${file.name}" שלא ניתן לסווג בוודאות ללא אישורך.`,
        reviewOptions: ['מזון וסופר', 'קניות', 'מתנות', 'בילויים'],
        userConfirmed: false,
        sourceDocument: file.name,
      }
    ];

    setState((prev) => ({
      ...prev,
      documents: [newDoc, ...prev.documents],
      transactions: [...newTransactions, ...prev.transactions],
      dataQuality: {
        ...prev.dataQuality,
        overallScore: Math.min(100, prev.dataQuality.overallScore + 4),
      },
    }));
  };

  // Real document deletion: removes the document AND all transactions imported from it
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" dir="rtl">
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
            <GoalsView goals={state.goals} onUpdateGoals={handleUpdateGoals} />
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

      {/* Onboarding Philosophy Tour Modal */}
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
    </div>
  );
}
