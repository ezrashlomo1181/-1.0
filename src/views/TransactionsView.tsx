import React, { useState } from 'react';
import { Transaction } from '../types/financial';
import {
  Search,
  ShieldAlert,
  CheckCircle,
  HelpCircle,
  RefreshCw,
  Clock,
  ArrowDown,
  ArrowUp,
  FileText,
  ChevronDown,
  ChevronLeft,
  CreditCard,
  CornerDownLeft,
} from 'lucide-react';
import {
  getFixedExpenseCategories,
  resolveToCanonicalExpenseCategory,
  isTechnicalTransactionType,
} from '../services/categoriesService';

interface TransactionsViewProps {
  transactions: Transaction[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenReviewModal: (tx: Transaction) => void;
  onOpenTraceModal: (title: string, amount: number, txList: Transaction[]) => void;
}

export type DisplayDirection = 'inflow' | 'outflow' | 'unknown';

/**
 * Pure Read-Only Presentation Helper:
 * Determines the visual flow direction without mutating the transaction or its saved type.
 */
export function getDisplayDirection(tx: Transaction): DisplayDirection {
  // 1. Direct saved flowDirection from source row
  if (tx.flowDirection) {
    return tx.flowDirection;
  }

  // 2. Fallback for historical transactions without flowDirection:
  // Check unambiguous explicit text evidence in description / rawText:
  const raw = `${tx.merchant || ''} ${tx.description || ''} ${tx.rawText || ''}`.toLowerCase();

  // A. Explicit Credit Evidence:
  const hasExplicitCreditEvidence =
    raw.includes('זיכוי') ||
    raw.includes('החזר כספי') ||
    raw.includes('החזרת פריט') ||
    raw.includes('משכורת') ||
    raw.includes('שכר עבודה') ||
    raw.includes('העברת שכר') ||
    raw.includes('הפקדת שכר') ||
    raw.includes('זיכוי שכר') ||
    raw.includes('מופת') ||
    raw.includes('מופ"ת') ||
    raw.includes('מופ״ת') ||
    raw.includes('מתש') ||
    raw.includes('מת"ש') ||
    raw.includes('מת״ש') ||
    raw.includes('מסב') ||
    raw.includes('מס"ב') ||
    raw.includes('מס״ב') ||
    raw.includes('חילן') ||
    raw.includes('מלם שכר') ||
    raw.includes('מלם-שכר') ||
    raw.includes('קצבת') ||
    raw.includes('ביטוח לאומי') ||
    raw.includes('הפקדת משכורת') ||
    raw.includes('הפקדת שיק') ||
    raw.includes('הפקדת צ\'ק') ||
    raw.includes('הפקדת מזומן') ||
    raw.includes('העברה לזכות') ||
    (raw.includes('זכות') && !raw.includes('ריבית חובה') && !raw.includes('ביטול זכות'));

  if (hasExplicitCreditEvidence) {
    return 'inflow';
  }

  // B. Explicit Debit Evidence:
  const hasExplicitDebitEvidence =
    raw.includes('משיכת מזומן') ||
    raw.includes('משיכה במכשיר') ||
    raw.includes('העברה לחובה') ||
    raw.includes('עמלת') ||
    (raw.includes('חובה') && !raw.includes('מופת') && !raw.includes('מופ"ת') && !raw.includes('מופ״ת'));

  if (hasExplicitDebitEvidence) {
    return 'outflow';
  }

  // C. In the absence of explicit direction evidence, do NOT guess based on type: 'expense'!
  // Mark as unknown so that the UI presents it neutrally without misleading +/- signs.
  return 'unknown';
}

/**
 * Helper to ensure the merchant name is prominent and description is only shown
 * if it exists and is distinct from the merchant name (preventing duplicates).
 */
export function formatMerchantAndDescription(tx: Transaction): {
  merchant: string;
  secondaryDescription: string | null;
} {
  const merchant = (tx.merchant || 'עסקה ללא שם').trim();
  const rawDesc = (tx.description || '').trim();
  const secondaryDescription = rawDesc && rawDesc !== merchant ? rawDesc : null;
  return { merchant, secondaryDescription };
}

/**
 * Pure presentation helper for the two separate amount columns: 'יצא' (outflow) and 'נכנס' (inflow).
 * Enforces the strict rule: amount appears in exactly one column, never both.
 * Unknown flow direction does NOT guess or assign +/- signs.
 */
export function formatAmountColumns(tx: Transaction): {
  outflowText: string | null;
  inflowText: string | null;
  isUnknown: boolean;
  direction: DisplayDirection;
} {
  const dir = getDisplayDirection(tx);
  const formattedAbs = `₪${Math.abs(tx.amount).toLocaleString()}`;

  if (dir === 'outflow') {
    return {
      outflowText: `−${formattedAbs}`,
      inflowText: null,
      isUnknown: false,
      direction: 'outflow',
    };
  }

  if (dir === 'inflow') {
    return {
      outflowText: null,
      inflowText: `+${formattedAbs}`,
      isUnknown: false,
      direction: 'inflow',
    };
  }

  // Unknown direction: do NOT guess into either column, mark as unknown
  return {
    outflowText: `${formattedAbs} (לבדיקה)`,
    inflowText: null,
    isUnknown: true,
    direction: 'unknown',
  };
}

/**
 * Resolves legacy aliases to the 11 approved clean categories.
 * Rejects technical transaction types so they never display as categories.
 */
export function getCanonicalCategoryName(category: string): string {
  if (!category) return '';
  const trimmed = category.trim();
  if (isTechnicalTransactionType(trimmed)) return '';
  return resolveToCanonicalExpenseCategory(trimmed) || trimmed;
}

/**
 * Pure helper: tests whether an individual transaction matches current filters.
 */
export function matchesTransactionFilter(
  tx: Transaction,
  query: string,
  category: string,
  type: string,
  onlyNeedsReview: boolean
): boolean {
  if (onlyNeedsReview && !tx.needsReview) return false;

  if (category !== 'all') {
    const canonicalCat = getCanonicalCategoryName(tx.category);
    if (canonicalCat !== category && tx.category !== category) {
      return false;
    }
  }

  if (type !== 'all') {
    if (type === 'internal' && !tx.isInternalTransfer) return false;
    if (type === 'income' && tx.type !== 'income') return false;
    if (type === 'expense' && (tx.type !== 'expense' || tx.isInternalTransfer)) return false;
    if (type === 'refund' && tx.type !== 'refund') return false;
  }

  if (query.trim()) {
    const q = query.toLowerCase();
    const matchMerchant = (tx.merchant || '').toLowerCase().includes(q);
    const matchDesc = (tx.description || '').toLowerCase().includes(q);
    const matchCat = (tx.category || '').toLowerCase().includes(q);
    const matchAmount = (tx.amount ?? '').toString().includes(q);
    return matchMerchant || matchDesc || matchCat || matchAmount;
  }

  return true;
}

export interface HierarchicalTransactionItem {
  parent: Transaction;
  children: Transaction[];
  matchingChildren: Transaction[];
  hasChildren: boolean;
  isConfirmedSettlement: boolean;
}

/**
 * Builds the hierarchical display structure:
 * - Bank consolidated settlements serve as parent rows.
 * - Confirmed detailed card transactions are nested under their matching parent and
 *   never duplicated at the root level.
 * - Partial or unconfirmed settlements remain standalone root rows with their review alerts.
 * - When filters or search are active, child transactions are filtered cleanly while
 *   retaining the parent context.
 */
export function buildHierarchicalTransactions(
  transactions: Transaction[],
  query: string,
  category: string,
  type: string,
  onlyNeedsReview: boolean,
  sortDirection: 'desc' | 'asc'
): HierarchicalTransactionItem[] {
  const isFilterActive =
    Boolean(query.trim()) || category !== 'all' || type !== 'all' || onlyNeedsReview;

  // 1. Identify confirmed parent settlements
  const parentMap = new Map<string, Transaction>();
  const childrenMap = new Map<string, Transaction[]>();
  const confirmedChildIds = new Set<string>();

  for (const tx of transactions) {
    if (tx.isAggregateSettlement && tx.reconciliationStatus === 'settlement_matched') {
      parentMap.set(tx.id, tx);
      if (!childrenMap.has(tx.id)) {
        childrenMap.set(tx.id, []);
      }
    }
  }

  // 2. Map confirmed child transactions pointing to a known parent
  for (const tx of transactions) {
    if (tx.parentTransactionId && parentMap.has(tx.parentTransactionId)) {
      confirmedChildIds.add(tx.id);
      childrenMap.get(tx.parentTransactionId)!.push(tx);
    }
  }

  // Support settlements where linkedTransactionIds reference card details
  for (const [parentId, parentTx] of parentMap.entries()) {
    if (parentTx.linkedTransactionIds && parentTx.linkedTransactionIds.length > 0) {
      const existingChildren = childrenMap.get(parentId) || [];
      const existingChildIds = new Set(existingChildren.map((c) => c.id));
      for (const linkedId of parentTx.linkedTransactionIds) {
        if (!existingChildIds.has(linkedId)) {
          const linkedTx = transactions.find((t) => t.id === linkedId);
          if (linkedTx && linkedTx.sourceDocumentType === 'credit_card_statement') {
            existingChildren.push(linkedTx);
            confirmedChildIds.add(linkedTx.id);
          }
        }
      }
      childrenMap.set(parentId, existingChildren);
    }
  }

  // 3. Sort children chronologically
  for (const [, children] of childrenMap.entries()) {
    children.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      return sortDirection === 'desc' ? -cmp : cmp;
    });
  }

  // 4. Assemble root-level items (standalone transactions + parent settlements)
  // Confirmed child transactions are strictly excluded from root level
  const rootItems: HierarchicalTransactionItem[] = [];

  for (const tx of transactions) {
    if (confirmedChildIds.has(tx.id)) {
      continue;
    }

    const isParent = parentMap.has(tx.id);
    const allChildren = isParent ? childrenMap.get(tx.id) || [] : [];

    const matchingChildren = allChildren.filter((c) =>
      matchesTransactionFilter(c, query, category, type, onlyNeedsReview)
    );

    const parentMatches = matchesTransactionFilter(tx, query, category, type, onlyNeedsReview);

    if (isFilterActive) {
      if (parentMatches || matchingChildren.length > 0) {
        rootItems.push({
          parent: tx,
          children: allChildren,
          matchingChildren,
          hasChildren: allChildren.length > 0,
          isConfirmedSettlement: isParent,
        });
      }
    } else {
      rootItems.push({
        parent: tx,
        children: allChildren,
        matchingChildren: allChildren,
        hasChildren: allChildren.length > 0,
        isConfirmedSettlement: isParent,
      });
    }
  }

  // 5. Sort root items chronologically based on parent date
  rootItems.sort((a, b) => {
    const cmp = a.parent.date.localeCompare(b.parent.date);
    return sortDirection === 'desc' ? -cmp : cmp;
  });

  return rootItems;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  searchQuery,
  onSearchChange,
  onOpenReviewModal,
  onOpenTraceModal,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [onlyNeedsReview, setOnlyNeedsReview] = useState<boolean>(false);
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc'); // Default: newest first
  const [manuallyToggled, setManuallyToggled] = useState<Record<string, boolean>>({});

  // Single Source of Truth: exactly the 11 approved expense categories in the requested order
  const categories = getFixedExpenseCategories().map((c) => c.name);

  const isFilterActive =
    Boolean(searchQuery.trim()) ||
    selectedCategory !== 'all' ||
    selectedType !== 'all' ||
    onlyNeedsReview;

  const hierarchicalItems = buildHierarchicalTransactions(
    transactions,
    searchQuery,
    selectedCategory,
    selectedType,
    onlyNeedsReview,
    sortDirection
  );

  const needsReviewCount = transactions.filter((t) => t.needsReview).length;

  const toggleParent = (parentId: string, currentExpanded: boolean, e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setManuallyToggled((prev) => ({
      ...prev,
      [parentId]: !currentExpanded,
    }));
  };

  return (
    <div className="space-y-5 pb-12 animate-in fade-in duration-200">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>יומן עסקאות ותנועות</span>
            <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
              {transactions.length} סה״כ
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            מעקב מדויק, קישור חיוב כרטיס לפירוט עסקאות ומניעת ספירה כפולה
          </p>
        </div>

        {/* Action / Review badge */}
        {needsReviewCount > 0 && (
          <button
            onClick={() => setOnlyNeedsReview(!onlyNeedsReview)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              onlyNeedsReview
                ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>
              {onlyNeedsReview
                ? `מציג ${needsReviewCount} עסקאות לאימות (לחץ לחזרה)`
                : `הצג ${needsReviewCount} עסקאות הדורשות אימות`}
            </span>
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1F2937] p-3 shadow-xs space-y-3 transition-colors">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="חיפוש לפי עסק, סכום, או תיאור..."
              className="w-full bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] rounded-lg pr-9 pl-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-slate-600 dark:focus:border-slate-500 transition-colors"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-600 dark:focus:border-slate-500 cursor-pointer"
            >
              <option value="all">כל הקטגוריות</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-600 dark:focus:border-slate-500 cursor-pointer"
            >
              <option value="all">כל סוגי הפעולות</option>
              <option value="expense">הוצאות רגילות</option>
              <option value="income">הכנסות</option>
              <option value="refund">זיכויים והחזרים</option>
              <option value="internal">העברות פנימיות מנוטרלות</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Table Card */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1F2937] shadow-xs overflow-hidden transition-colors">
        {hierarchicalItems.length === 0 ? (
          <div className="text-center py-12 px-4">
            <HelpCircle className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-700 dark:text-slate-300 font-semibold">לא נמצאו עסקאות תואמות לסינון</p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">נסה לאפס את החיפוש או לבחור קטגוריה אחרת.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#1F2937] bg-slate-50 dark:bg-[#0B0F17] text-slate-600 dark:text-slate-400 font-semibold">
                  <th
                    onClick={() => setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc')}
                    className="py-2.5 px-3 font-medium cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>תאריך</span>
                      {sortDirection === 'desc' ? (
                        <ArrowDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <ArrowUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                  </th>
                  <th className="py-2.5 px-4 font-medium">בית עסק</th>
                  <th className="py-2.5 px-4 font-medium">חשבון מקור</th>
                  <th className="py-2.5 px-4 font-medium">קטגוריה</th>
                  <th className="py-2.5 px-4 font-medium text-left text-rose-700 dark:text-rose-400">יצא</th>
                  <th className="py-2.5 px-4 font-medium text-left text-emerald-700 dark:text-emerald-400">נכנס</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1F2937]/80">
                {hierarchicalItems.map((item) => {
                  const tx = item.parent;
                  const { merchant, secondaryDescription } = formatMerchantAndDescription(tx);
                  const amountCols = formatAmountColumns(tx);

                  // Expand state logic:
                  // 1. Explicit user toggle takes precedence.
                  // 2. Otherwise, if search/filters matched child items, auto-expand so user sees results.
                  // 3. Otherwise collapsed.
                  const isExpanded =
                    tx.id in manuallyToggled
                      ? manuallyToggled[tx.id]
                      : isFilterActive && item.matchingChildren.length > 0;

                  const displayedChildren = isFilterActive ? item.matchingChildren : item.children;

                  return (
                    <React.Fragment key={tx.id}>
                      {/* Parent or Standalone Row */}
                      <tr
                        onClick={() => onOpenReviewModal(tx)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onOpenReviewModal(tx);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`עסקה מאת ${merchant}, תאריך ${tx.date}`}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer select-none focus:outline-none focus:bg-slate-100 dark:focus:bg-slate-800/60 ${
                          tx.needsReview ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                        } ${item.hasChildren && isExpanded ? 'bg-indigo-50/20 dark:bg-indigo-950/10' : ''}`}
                      >
                        {/* Date & Expand/Collapse Toggle */}
                        <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {item.hasChildren ? (
                              <button
                                type="button"
                                onClick={(e) => toggleParent(tx.id, isExpanded, e)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleParent(tx.id, isExpanded, e);
                                  }
                                }}
                                aria-expanded={isExpanded}
                                aria-label={
                                  isExpanded
                                    ? `סגור פירוט של ${item.children.length} עסקאות כרטיס`
                                    : `הצג פירוט של ${item.children.length} עסקאות כרטיס`
                                }
                                className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                ) : (
                                  <ChevronLeft className="w-4 h-4" />
                                )}
                              </button>
                            ) : (
                              <span className="w-6 shrink-0" />
                            )}
                            <div>
                              <div className="font-semibold text-xs">{tx.date}</div>
                              {tx.additionalSources && tx.additionalSources.length > 0 && (
                                <div
                                  className="inline-flex items-center gap-1 text-[9px] text-blue-600 dark:text-blue-400 font-sans mt-0.5"
                                  title={`זוהה גם במסמכים: ${tx.additionalSources.join(', ')}`}
                                >
                                  <FileText className="w-2.5 h-2.5" />
                                  <span>+{tx.additionalSources.length} מקורות</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Merchant */}
                        <td className="py-3 px-4 max-w-xs">
                          <div className="font-semibold text-[#0F172A] dark:text-white text-xs flex items-center gap-1.5 flex-wrap">
                            <span>{merchant}</span>
                            {item.isConfirmedSettlement && (
                              <>
                                {tx.cardLastDigits && (
                                  <span className="text-[10px] text-indigo-700 dark:text-indigo-300 font-mono bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.2 rounded border border-indigo-200 dark:border-indigo-800">
                                    כרטיס {tx.cardLastDigits}
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                                  {isFilterActive && item.matchingChildren.length !== item.children.length
                                    ? `מציג ${displayedChildren.length} מתוך ${item.children.length} עסקאות`
                                    : `${item.children.length} עסקאות בפירוט`}
                                </span>
                              </>
                            )}
                            {tx.isRecurring && (
                              <span className="text-[10px] text-slate-700 dark:text-slate-300 font-normal bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                                קבוע
                              </span>
                            )}
                          </div>
                          {secondaryDescription && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {secondaryDescription}
                            </div>
                          )}
                        </td>

                        {/* Account */}
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">{tx.accountName}</span>
                            {tx.isInternalTransfer && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-[#1F2937] px-1.5 py-0.5 rounded"
                                title="העברה פנימית מנוטרלת"
                              >
                                <RefreshCw className="w-2.5 h-2.5 text-slate-500" />
                                <span>העברה פנימית</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {item.isConfirmedSettlement ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-[11px] font-medium">
                                <CreditCard className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                <span>חיוב כרטיס מרוכז</span>
                              </span>
                            ) : (
                              (() => {
                                const canonical = getCanonicalCategoryName(tx.category);
                                if (!canonical) {
                                  return (
                                    <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-[11px] font-medium">
                                      דרוש סיווג
                                    </span>
                                  );
                                }
                                return (
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#1F2937] text-[11px] font-medium">
                                    {canonical}
                                  </span>
                                );
                              })()
                            )}
                            {tx.needsReview && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
                                title="עסקה הדורשת בדיקה ואימות"
                              >
                                <ShieldAlert className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                                <span>לבדיקה</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Outflow (יצא) */}
                        <td className="py-3 px-4 text-left font-mono whitespace-nowrap text-xs">
                          {amountCols.isUnknown ? (
                            <span
                              className="text-slate-700 dark:text-slate-300 font-medium inline-flex items-center gap-1"
                              title="כיוון תנועה אינו ודאי (מצב ניטרלי לבדיקה)"
                            >
                              <span>₪{Math.abs(tx.amount).toLocaleString()}</span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.2 font-sans">
                                לא נקבע
                              </span>
                            </span>
                          ) : amountCols.outflowText ? (
                            <span className="text-rose-700 dark:text-rose-400 font-bold">
                              {amountCols.outflowText}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 font-normal">—</span>
                          )}
                        </td>

                        {/* Inflow (נכנס) */}
                        <td className="py-3 px-4 text-left font-mono whitespace-nowrap text-xs">
                          {amountCols.isUnknown ? (
                            <span className="text-slate-300 dark:text-slate-600 font-normal">—</span>
                          ) : amountCols.inflowText ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                              {amountCols.inflowText}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 font-normal">—</span>
                          )}
                        </td>
                      </tr>

                      {/* Nested Child Rows */}
                      {item.hasChildren &&
                        isExpanded &&
                        displayedChildren.map((child) => {
                          const childMerchantInfo = formatMerchantAndDescription(child);
                          const childAmountCols = formatAmountColumns(child);
                          const childCanonicalCat = getCanonicalCategoryName(child.category);

                          return (
                            <tr
                              key={child.id}
                              onClick={() => onOpenReviewModal(child)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  onOpenReviewModal(child);
                                }
                              }}
                              tabIndex={0}
                              role="button"
                              aria-label={`עסקת פירוט מאת ${childMerchantInfo.merchant}, תאריך ${child.date}, סכום ₪${Math.abs(child.amount)}`}
                              className="bg-slate-50/70 dark:bg-slate-900/40 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 border-r-4 border-indigo-400 dark:border-indigo-500 transition-colors cursor-pointer select-none focus:outline-none focus:bg-indigo-50 dark:focus:bg-indigo-950/40"
                            >
                              {/* Child Date */}
                              <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                <div className="flex items-center gap-1.5 pr-6">
                                  <CornerDownLeft className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                                  <span className="text-xs">{child.date}</span>
                                </div>
                              </td>

                              {/* Child Merchant */}
                              <td className="py-2.5 px-4 max-w-xs">
                                <div className="font-medium text-slate-900 dark:text-slate-100 text-xs flex items-center gap-1.5 flex-wrap">
                                  <span>{childMerchantInfo.merchant}</span>
                                  <span className="text-[10px] text-indigo-700 dark:text-indigo-300 font-normal bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.2 rounded border border-indigo-200/60 dark:border-indigo-800/60">
                                    פירוט כרטיס
                                  </span>
                                  {child.isRecurring && (
                                    <span className="text-[10px] text-slate-700 dark:text-slate-300 font-normal bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                                      קבוע
                                    </span>
                                  )}
                                </div>
                                {childMerchantInfo.secondaryDescription && (
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 pr-2">
                                    {childMerchantInfo.secondaryDescription}
                                  </div>
                                )}
                              </td>

                              {/* Child Account */}
                              <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                <span className="text-xs">{child.accountName}</span>
                              </td>

                              {/* Child Category */}
                              <td className="py-2.5 px-4 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  {childCanonicalCat ? (
                                    <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-medium">
                                      {childCanonicalCat}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-[11px] font-medium">
                                      דרוש סיווג
                                    </span>
                                  )}
                                  {child.needsReview && (
                                    <span
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
                                      title="עסקה הדורשת בדיקה ואימות"
                                    >
                                      <ShieldAlert className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                                      <span>לבדיקה</span>
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Child Outflow */}
                              <td className="py-2.5 px-4 text-left font-mono whitespace-nowrap text-xs">
                                {childAmountCols.isUnknown ? (
                                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                                    ₪{Math.abs(child.amount).toLocaleString()}
                                  </span>
                                ) : childAmountCols.outflowText ? (
                                  <span className="text-rose-700 dark:text-rose-400 font-medium">
                                    {childAmountCols.outflowText}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-600 font-normal">—</span>
                                )}
                              </td>

                              {/* Child Inflow */}
                              <td className="py-2.5 px-4 text-left font-mono whitespace-nowrap text-xs">
                                {childAmountCols.isUnknown ? (
                                  <span className="text-slate-300 dark:text-slate-600 font-normal">—</span>
                                ) : childAmountCols.inflowText ? (
                                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                                    {childAmountCols.inflowText}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-600 font-normal">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}

                      {/* When parent matched filter, but none of its children matched the filter */}
                      {item.hasChildren && isExpanded && displayedChildren.length === 0 && (
                        <tr className="bg-slate-50/50 dark:bg-slate-900/20 border-r-4 border-indigo-200 dark:border-indigo-900">
                          <td colSpan={6} className="py-2 px-8 text-xs text-slate-400 dark:text-slate-500 italic">
                            אין עסקאות פירוט התואמות את הסינון הנבחר ({item.children.length} עסקאות בסה״כ בפירוט זה)
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};


