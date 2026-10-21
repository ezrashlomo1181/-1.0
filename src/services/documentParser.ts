import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import {
  Transaction,
  TransactionType,
  ConfidenceLevel,
  LearnedRule,
  SourceRecord,
  MergeHistorySnapshot,
  DuplicateCandidate,
} from '../types/financial';
import { getStoredLearnedRules } from './storage';
import {
  classifyTransactionSemantics,
  validateAndFixTransactionCombination,
} from './classificationEngine';
import {
  identifyDocumentRole,
  reconcileCrossDocumentTransactions,
} from './reconciliationEngine';

/**
 * Generate a deterministic idempotency key for a source record row.
 * Does NOT rely on filename or row number.
 * Uses normalized date, rounded amount, currency, normalized merchant, account ID, reference, and occurrence index.
 */
export function generateRowIdempotencyKey(params: {
  date: string;
  amount: number;
  merchant?: string;
  ref?: string;
  accountId?: string;
  currency?: string;
  occurrence?: number;
}): string {
  const normDate = (params.date || '').trim();
  const normAmt = (Math.round(Math.abs(params.amount || 0) * 100) / 100).toFixed(2);
  const normMerchant = (params.merchant || '')
    .toLowerCase()
    .replace(/["'״׳\-–_.,()/\\:;#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const normRef = (params.ref || '')
    .trim()
    .replace(/[^0-9a-zA-Z]/g, '');
  const normAcc = (params.accountId || '').trim().toLowerCase();
  const normCurr = (params.currency || 'ILS').trim().toUpperCase();
  const occSuffix = params.occurrence && params.occurrence > 1 ? `:occ_${params.occurrence}` : '';

  // If a reliable reference exists, it is primary evidence alongside date and amount
  if (normRef.length >= 3) {
    return `idem:ref:${normRef}_${normAmt}_${normCurr}_${normAcc}${occSuffix}`;
  }

  // Content-based idempotent fingerprint
  return `idem:fp:${normDate}_${normAmt}_${normCurr}_${normMerchant}_${normAcc}${occSuffix}`;
}

/**
 * Returns the base idempotency key without the occurrence suffix (:occ_X).
 */
export function getBaseIdempotencyKey(key?: string): string {
  if (!key) return '';
  return key.replace(/:occ_\d+$/, '');
}

/**
 * Ensures stable occurrence indexing for a list of transactions.
 * If multiple transactions have identical content fingerprints,
 * occurrences are indexed deterministically: occurrence 1 has base key, occurrence 2 has :occ_2, etc.
 */
export function assignTransactionOccurrences(txs: Transaction[]): Transaction[] {
  const occurrenceTracker = new Map<string, number>();

  for (const tx of txs) {
    let baseKey = getBaseIdempotencyKey(tx.idempotencyKey);
    if (!baseKey) {
      baseKey = generateRowIdempotencyKey({
        date: tx.date,
        amount: tx.amount,
        merchant: tx.merchant,
        accountId: tx.accountId,
        currency: tx.currency,
      });
    }

    const currentOcc = (occurrenceTracker.get(baseKey) || 0) + 1;
    occurrenceTracker.set(baseKey, currentOcc);

    const stableKey = currentOcc > 1 ? `${baseKey}:occ_${currentOcc}` : baseKey;
    tx.idempotencyKey = stableKey;

    if (tx.sourceRecords && tx.sourceRecords.length > 0) {
      for (const sr of tx.sourceRecords) {
        if (!sr.idempotencyKey || sr.idempotencyKey === baseKey || sr.idempotencyKey.startsWith(baseKey)) {
          sr.idempotencyKey = stableKey;
        }
      }
    }
  }

  return txs;
}

export interface ParseResult {
  success: boolean;
  transactions: Transaction[];
  institution: string;
  error?: string;
  earliestDate?: string;
  latestDate?: string;
  totalIncome?: number;
  totalExpense?: number;
  duplicatesSkipped?: number;
  processingMethod?: string;
}

// -------------------------------------------------------------
// 1. INSTITUTION & BANK DETECTION
// -------------------------------------------------------------
const INSTITUTION_RULES: {
  keywords: string[];
  name: string;
  accountName: string;
  accountId: string;
  defaultPayment: Transaction['paymentMethod'];
  isCreditCardOnly?: boolean;
}[] = [
  { keywords: ['הפועלים', 'hapoalim', 'poalim', 'פועלים'], name: 'בנק הפועלים', accountName: 'עו"ש פועלים', accountId: 'acc-hapoalim', defaultPayment: 'bank_transfer' },
  { keywords: ['לאומי', 'leumi'], name: 'בנק לאומי', accountName: 'עו"ש לאומי', accountId: 'acc-leumi', defaultPayment: 'bank_transfer' },
  { keywords: ['דיסקונט', 'discount'], name: 'בנק דיסקונט', accountName: 'עו"ש דיסקונט', accountId: 'acc-discount', defaultPayment: 'bank_transfer' },
  { keywords: ['מזרחי', 'טפחות', 'mizrahi', 'tefahot'], name: 'מזרחי טפחות', accountName: 'עו"ש מזרחי', accountId: 'acc-mizrahi', defaultPayment: 'bank_transfer' },
  { keywords: ['ישראכרט', 'isracard', 'mastercard', 'מאסטרקארד'], name: 'ישראכרט', accountName: 'ישראכרט Gold', accountId: 'acc-isracard', defaultPayment: 'credit_card', isCreditCardOnly: true },
  { keywords: ['מקס', 'max', 'לאומי קארד', 'leumicard'], name: 'מקס (MAX)', accountName: 'כרטיס MAX', accountId: 'acc-max', defaultPayment: 'credit_card', isCreditCardOnly: true },
  { keywords: ['כאל', 'cal', 'ויזה כאל', 'visacal', 'דיינרס', 'diners'], name: 'כאל (CAL)', accountName: 'כרטיס כאל', accountId: 'acc-cal', defaultPayment: 'credit_card', isCreditCardOnly: true },
  { keywords: ['יהב', 'yahav'], name: 'בנק יהב', accountName: 'עו"ש יהב', accountId: 'acc-yahav', defaultPayment: 'bank_transfer' },
  { keywords: ['בינלאומי', 'fibi', 'הבינלאומי'], name: 'הבנק הבינלאומי', accountName: 'עו"ש בינלאומי', accountId: 'acc-fibi', defaultPayment: 'bank_transfer' },
  { keywords: ['פאגי', 'pagi'], name: 'בנק פאגי', accountName: 'עו"ש פאגי', accountId: 'acc-pagi', defaultPayment: 'bank_transfer' },
  { keywords: ['מסד', 'massad'], name: 'בנק מסד', accountName: 'עו"ש מסד', accountId: 'acc-massad', defaultPayment: 'bank_transfer' },
  { keywords: ['וואן זירו', 'one zero', 'onezero'], name: 'One Zero', accountName: 'חשבון וואן זירו', accountId: 'acc-onezero', defaultPayment: 'bank_transfer' },
  { keywords: ['מיטב', 'meitav'], name: 'מיטב טרייד', accountName: 'תיק מיטב טרייד', accountId: 'acc-meitav', defaultPayment: 'bank_transfer' },
  { keywords: ['איביאי', 'ibi'], name: 'IBI בית השקעות', accountName: 'תיק IBI', accountId: 'acc-ibi', defaultPayment: 'bank_transfer' },
  { keywords: ['אקסלנס', 'excellence'], name: 'אקסלנס', accountName: 'תיק אקסלנס', accountId: 'acc-excellence', defaultPayment: 'bank_transfer' },
  { keywords: ['אלטשולר', 'altshuler'], name: 'אלטשולר שחם', accountName: 'קופת אלטשולר', accountId: 'acc-altshuler', defaultPayment: 'bank_transfer' },
  { keywords: ['הפניקס', 'phoenix'], name: 'הפניקס', accountName: 'הפניקס השקעות', accountId: 'acc-phoenix', defaultPayment: 'bank_transfer' },
  { keywords: ['הראל', 'harel'], name: 'הראל', accountName: 'הראל פיננסים', accountId: 'acc-harel', defaultPayment: 'bank_transfer' },
  { keywords: ['מגדל', 'migdal'], name: 'מגדל', accountName: 'מגדל ביטוח', accountId: 'acc-migdal', defaultPayment: 'bank_transfer' },
  { keywords: ['כלל', 'clal'], name: 'כלל פיננסים', accountName: 'כלל ביטוח', accountId: 'acc-clal', defaultPayment: 'bank_transfer' },
  { keywords: ['מנורה', 'menora'], name: 'מנורה מבטחים', accountName: 'מנורה פנסיה', accountId: 'acc-menora', defaultPayment: 'bank_transfer' },
];

export function detectInstitution(content: string, fileName: string) {
  const normalized = `${content.slice(0, 4000)} ${fileName}`.toLowerCase();
  for (const rule of INSTITUTION_RULES) {
    if (rule.keywords.some((kw) => normalized.includes(kw.toLowerCase()))) {
      return rule;
    }
  }
  return {
    name: 'מסמך פיננסי עצמאי',
    accountName: 'חשבון ראשי',
    accountId: 'acc-general',
    defaultPayment: 'bank_transfer' as Transaction['paymentMethod'],
    isCreditCardOnly: false,
  };
}

// -------------------------------------------------------------
// 2. ISRAELI MERCHANT & CATEGORY CLASSIFIER
// -------------------------------------------------------------
const CATEGORY_MAP: { keywords: string[]; category: string; type?: TransactionType }[] = [
  // Supermarkets & Food
  {
    keywords: [
      'שופרסל', 'רמי לוי', 'יוחננוף', 'ויקטורי', 'טיב טעם', 'קרפור', 'יינות ביתן', 'סופר יודה', 'am:pm', 'ampm',
      'מכולת', 'ירקן', 'מאפיה', 'מאפיית', 'קשת טעמים', 'אושר עד', 'ברכל', 'מחסני השוק', 'שוק העיר', 'נתיב החסד',
      'סופרמרקט', 'מעדניה', 'קצב', 'קצביה', 'ירקות', 'פירות', 'סופר דיל', 'חצי חינם', 'סטופ מרקט', 'קינג סטור',
      'שוק הכרמל', 'שוק מחנה יהודה', 'שוק התקווה', 'דבאח', 'סאלח דבאח', 'מינימרקט', 'סופר ספיר'
    ],
    category: 'מזון וסופר',
    type: 'expense'
  },
  // Dining & Restaurants
  {
    keywords: [
      'וולט', 'wolt', 'תן ביס', '10bis', 'קפה', 'ארומה', 'מקדונלדס', 'פיצה', 'גולדה', 'ריבר', 'מסעדה', 'פאב',
      'שווארמה', 'בורגר', 'סושי', 'בלאק', 'bbb', 'לנדוור', 'ארקפה', 'קפית', 'דומינוס', 'גלידה', 'מאפה', 'קופיקס',
      'אגאדיר', 'מוזס', 'ג\'פניקה', 'שגב', 'קפה קפה', 'רולדין', 'לחמים', 'ביגה', 'גרג', 'פאפא ג\'ונס', 'קנטה',
      'סינמה סיטי', 'יס פלאנט', 'קולנוע', 'הוט סינמה', 'זאפה', 'לב דיזנגוף', 'רב חן', 'בראסרי', 'קפה נואר', 'ביסטרו',
      'בר'
    ],
    category: 'מסעדות ובילויים',
    type: 'expense'
  },
  // Transportation & Auto
  {
    keywords: [
      'דלק', 'פז', 'סונול', 'דור אלון', 'טן', 'יילו', 'yellow', 'מנטה', 'רב קו', 'רב-קו', 'rav kav', 'רכבת ישראל',
      'רכבת', 'גט', 'gett', 'יאנגו', 'yango', 'פנגו', 'סלו', 'cango', 'כביש 6', 'דרך ארץ', 'הנתיב המהיר', 'מוסך',
      'טסט', 'חניון', 'אגד', 'דן', 'מטרופולין', 'קווים', 'אלקטרה אפיקים', 'מונית', 'שטיפת רכב', 'מצבר', 'צמיגי',
      'אובר', 'uber', 'אוטובוס', 'חניוני אחוזת חוף', 'סופרבוס', 'תחבורה ציבורית'
    ],
    category: 'תחבורה ורכב',
    type: 'expense'
  },
  // Housing, Municipal & Utilities
  {
    keywords: [
      'חברת החשמל', 'חשמל', 'מי אביבים', 'מניב', 'מי כרמל', 'מי תל אביב', 'מי שבע', 'מי רעננה', 'עיריית', 'עירייה',
      'מועצה אזורית', 'מועצה מקומית', 'ארנונה', 'בזק', 'בזק בינלאומי', 'גז', 'אמישראגז', 'סופרגז', 'פזגז', 'ועד בית',
      'שכר דירה', 'משכנתא', 'שכירות', 'פנגסוס', 'גז יגור', 'תאגיד מים', 'דורגז', 'קבוצת חג\'ג\'', 'שכר דירה חודשי'
    ],
    category: 'דיור וחשבונות',
    type: 'expense'
  },
  // Telecom, Tech & Media Subscriptions
  {
    keywords: [
      'פרטנר', 'סלקום', 'פלאפון', 'הוט', 'hot', 'yes', 'יס', 'wecom', '012', '019', 'גולן טלקום', 'נטפליקס', 'netflix',
      'ספוטיפיי', 'spotify', 'אפל', 'apple', 'גוגל', 'google', 'יוטיוב', 'youtube', 'ksp', 'באג', 'אייבורי', 'איבורי',
      'סמסונג', 'אמזון', 'amazon', 'איידיגיטל', 'idigital', 'דיסני', 'disney', 'טלפון', 'אינטרנט', 'ספק אינטרנט'
    ],
    category: 'תקשורת וטכנולוגיה',
    type: 'expense'
  },
  // Health & Pharmacy
  {
    keywords: [
      'סופר פארם', 'סופר-פארם', 'super-pharm', 'be פארם', 'בי פארם', 'ניו פארם', 'מכבי', 'כללית', 'מאוחדת', 'לאומית',
      'בית מרקחת', 'קופת חולים', 'רופא', 'רופא שיניים', 'מרפאת', 'אופטיקה', 'הלפרין', 'אסותא', 'מדיקל סנטר',
      'טבע', 'מרכז רפואי', 'סופרפארם', 'סופר פארם אונליין', 'מכבי שירותי בריאות', 'כללית מושלם', 'אופטיקנה'
    ],
    category: 'בריאות ופארם',
    type: 'expense'
  },
  // Shopping & Clothing
  {
    keywords: [
      'זארה', 'zara', 'קסטרו', 'פוקס', 'fox', 'h&m', 'מנגו', 'mango', 'שיין', 'shein', 'עלי אקספרס', 'aliexpress',
      'אסוס', 'asos', 'טרמינל איקס', 'terminal x', 'אייס', 'ace', 'הום סנטר', 'איקאה', 'ikea', 'דלתא', 'רנואר',
      'גולף', 'הודיס', 'hoodies', 'שילב', 'קרטרס', 'טויס אר אס', 'מגה ספורט', 'נייקי', 'nike', 'אדידס', 'adidas',
      'פוט לוקר', 'foot locker', 'אורבניקה', 'אמריקן איגל', 'קניון', 'סטימצקי', 'צומת ספרים'
    ],
    category: 'קניות וביגוד',
    type: 'expense'
  },
  // Education & Children
  {
    keywords: [
      'מעון', 'גן ילדים', 'חוג', 'צהרון', 'בית ספר', 'שכר לימוד', 'אוניברסיטה', 'מכללה', 'ספרים', 'מתנ"ס',
      'אונ תל אביב', 'העברית', 'טכניון', 'בר אילן', 'הפתוחה', 'בן גוריון', 'ויצו', 'נעמת', 'קייטנה', 'הוראה פרטית'
    ],
    category: 'חינוך וילדים',
    type: 'expense'
  },
  // Insurance & Bank Fees
  {
    keywords: [
      'הראל', 'מגדל', 'כלל', 'הפניקס', 'מנורה', 'ביטוח ישיר', 'אליהו', 'ליברה', 'wobi', 'וובי', 'איחוד ישיר',
      'עמלת', 'עמלה', 'דמי כרטיס', 'דמי ניהול', 'ריבית חובה', 'ריבית פיגורים', 'דמי עריכת מסמכים', 'עמלת שורה',
      'עמלת הקצאת אשראי', 'עמלת המרה', 'בנק דיסקונט עמלות'
    ],
    category: 'ביטוח ופיננסים',
    type: 'expense'
  },
  // Investments & Long Term Savings
  {
    keywords: [
      'מיטב', 'איביאי', 'ibi', 'אקסלנס', 'פסגות', 'אלטשולר', 'אנליסט', 'מור', 'ילין לפידות', 'קסם', 'הפקדה לחיסכון',
      'ניירות ערך', 'מניות', 'קרן השתלמות', 'קופת גמל', 'פנסיה', 'קריפטו', 'ביטקוין', 'בינאנס', 'binance', 'קראקן',
      'תוכנית חיסכון', 'פיקדון', 'קופת גמל להשקעה', 'הוראת קבע לחיסכון'
    ],
    category: 'השקעות וחיסכון',
    type: 'investment_contribution'
  },
];

// Helper to safely check keyword matches with word boundaries for short words
export function matchesKeyword(text: string, kw: string): boolean {
  const kwLower = kw.toLowerCase();
  const textLower = text.toLowerCase();
  if (kwLower.length <= 3) {
    const words = textLower.split(/[\s,.\-_/\\()]+/);
    return words.includes(kwLower);
  }
  return textLower.includes(kwLower);
}

// Helper to check user learned rules with absolute precedence
export function matchLearnedRule(
  merchant: string,
  description: string,
  customRules?: LearnedRule[]
): LearnedRule | null {
  const rules = customRules || getStoredLearnedRules();
  if (!rules || rules.length === 0) return null;

  const mClean = merchant.trim().toLowerCase();
  const dClean = description.trim().toLowerCase();
  const combined = `${mClean} ${dClean}`.trim();

  for (const rule of rules) {
    if (!rule.pattern) continue;
    const pat = rule.pattern.trim().toLowerCase();

    if (rule.applyTo === 'exact' || rule.applyTo === 'exact_only') {
      if (mClean === pat || combined === pat) {
        return rule;
      }
    } else {
      if (matchesKeyword(combined, pat) || matchesKeyword(mClean, pat)) {
        return rule;
      }

      // Check multi-word phrase
      const patWords = pat.split(/\s+/).filter((w) => w.length > 1);
      if (patWords.length > 0 && patWords.every((w) => combined.includes(w))) {
        return rule;
      }
    }
  }

  return null;
}

export function categorizeMerchant(
  merchant: string,
  description: string,
  customRules?: LearnedRule[]
): {
  category: string;
  type: TransactionType;
  confidenceScore: number;
  matchedRuleId?: string;
  isUserRule?: boolean;
  isInternalTransfer?: boolean;
  needsReview?: boolean;
  reviewReason?: string;
} {
  // 1. HIGHEST PRIORITY: Check user learned rules
  const userRule = matchLearnedRule(merchant, description, customRules);
  if (userRule) {
    return {
      category: userRule.assignedCategory,
      type: userRule.assignedType || 'expense',
      confidenceScore: 1.0,
      matchedRuleId: userRule.id,
      isUserRule: true,
      isInternalTransfer: userRule.assignedType === 'transfer',
      needsReview: false,
    };
  }

  const combined = `${merchant} ${description}`.toLowerCase();

  // 2. ATM Cash Withdrawal Check (High priority: ALWAYS expense, NOT transfer!)
  if (
    combined.includes('כספומט') ||
    combined.includes('בנקומט') ||
    combined.includes('משיכת מזומן') ||
    combined.includes('משיכה במכשיר') ||
    combined.includes('משיכת מזומנים')
  ) {
    return {
      category: 'משיכת מזומן',
      type: 'expense',
      confidenceScore: 0.95,
      isInternalTransfer: false,
      needsReview: false,
    };
  }

  // 3. Credit Card Settlement Check
  // IMPORTANT: Do NOT automatically treat as internal transfer!
  // If detailed card transactions do not exist, this spending must NOT disappear from financial analysis.
  // It starts as an expense with needsReview=true.
  // Cross-document reconciliation will only convert it to an internal transfer if detailed card transactions exist and match.
  if (
    combined.includes('חיוב כרטיס') ||
    combined.includes('פירעון כרטיס') ||
    combined.includes('חיוב ויזה') ||
    combined.includes('חיוב ישראכרט') ||
    combined.includes('חיוב כאל') ||
    combined.includes('חיוב מקס') ||
    combined.includes('חיוב מאסטרקארד') ||
    combined.includes('חיוב לאומי קארד') ||
    combined.includes('הוראת קבע כרטיס אשראי') ||
    combined.includes('חיוב ח-ן כרטיס')
  ) {
    return {
      category: 'חיוב כרטיס אשראי (ללא פירוט)',
      type: 'expense',
      confidenceScore: 0.85,
      isInternalTransfer: false,
      needsReview: true,
      reviewReason:
        'חיוב כרטיס אשראי מרוכז בחשבון העו"ש – נספר כהוצאה כוללת עד לייבוא קובץ פירוט כרטיס האשראי.',
    };
  }

  // 4. Inter-account Transfers Check
  if (
    combined.includes('העברה בין חשבונות') ||
    combined.includes('העברה עצמית') ||
    combined.includes('העברה מחשבון') ||
    combined.includes('העברה לחשבון') ||
    combined.includes('העברה לחיסכון') ||
    combined.includes('העברה מחיסכון') ||
    combined.includes('העברה לפיקדון')
  ) {
    return {
      category: 'העברות ומזומן',
      type: 'transfer',
      confidenceScore: 0.93,
      isInternalTransfer: true,
      needsReview: false,
    };
  }

  // 5. Real Income Check (Salary, allowances, pensions, dividends, check deposits, Israeli payroll clearing)
  if (
    combined.includes('משכורת') ||
    combined.includes('שכר עבודה') ||
    combined.includes('העברת שכר') ||
    combined.includes('שכר חודשי') ||
    combined.includes('זיכוי שכר') ||
    combined.includes('הפקדת שכר') ||
    combined.includes('משכורות') ||
    (combined.includes('שכר') &&
      !combined.includes('שכר דירה') &&
      !combined.includes('שכר לימוד') &&
      !combined.includes('שכירות') &&
      !combined.includes('דמי שכירות') &&
      !combined.includes('שכר טרחה')) ||
    combined.includes('מופת') ||
    combined.includes('מופ"ת') ||
    combined.includes('מופ״ת') ||
    combined.includes('מתש') ||
    combined.includes('מת"ש') ||
    combined.includes('מת״ש') ||
    combined.includes('מסב') ||
    combined.includes('מס"ב') ||
    combined.includes('מס״ב') ||
    combined.includes('חילן') ||
    combined.includes('hilan') ||
    combined.includes('מלם שכר') ||
    combined.includes('מלם-שכר') ||
    combined.includes('מלם') ||
    combined.includes('הר-גל') ||
    combined.includes('הר גל') ||
    combined.includes('סינאל') ||
    combined.includes('synel') ||
    combined.includes('ביטוח לאומי') ||
    combined.includes('קצבת ילדים') ||
    combined.includes('קצבת זקנה') ||
    combined.includes('קצבת נכות') ||
    combined.includes('קצבת שארים') ||
    combined.includes('דמי לידה') ||
    combined.includes('דמי אבטלה') ||
    combined.includes('קצבה') ||
    combined.includes('קצבת') ||
    combined.includes('גמלה') ||
    combined.includes('גימלה') ||
    combined.includes('הפקדת צ\'ק') ||
    combined.includes('הפקדת שיק') ||
    combined.includes('הפקדת שק') ||
    combined.includes('הפקדת מזומן') ||
    combined.includes('הפקדה לעו"ש') ||
    combined.includes('הפקדה עצמית') ||
    combined.includes('דיבידנד') ||
    combined.includes('ריבית זכות') ||
    combined.includes('החזר מס') ||
    combined.includes('תקבול') ||
    combined.includes('תקבולים') ||
    combined.includes('בונוס') ||
    combined.includes('מענק')
  ) {
    return {
      category: 'משכורת והכנסות',
      type: 'income',
      confidenceScore: 0.96,
      isInternalTransfer: false,
      needsReview: false,
    };
  }

  // 6. Explicit Refunds & Credits Check (Requires explicit refund words: החזר כספי, ביטול עסקה, החזר חיוב)
  if (
    combined.includes('החזר כספי') ||
    combined.includes('ביטול עסקה') ||
    combined.includes('החזר חיוב') ||
    combined.includes('זיכוי בגין ביטול') ||
    (combined.includes('החזר') &&
      !combined.includes('החזר מס') &&
      !combined.includes('החזר הלוואה') &&
      !combined.includes('החזר משכנתא')) ||
    combined.includes('refund') ||
    combined.includes('reversal')
  ) {
    return {
      category: 'החזרים וזיכויים',
      type: 'refund',
      confidenceScore: 0.95,
      isInternalTransfer: false,
      needsReview: false,
    };
  }

  // 7. General Categories mapping
  for (const rule of CATEGORY_MAP) {
    for (const kw of rule.keywords) {
      if (matchesKeyword(combined, kw)) {
        return {
          category: rule.category,
          type: rule.type || 'expense',
          confidenceScore: 0.92,
          isInternalTransfer: rule.type === 'transfer',
          needsReview: false,
        };
      }
    }
  }

  // 8. Fallback: conservative classification with needsReview flag
  return {
    category: 'אחר / ללא סיווג',
    type: 'expense',
    confidenceScore: 0.5,
    needsReview: true,
    reviewReason: 'דרוש אימות סיווג קטגוריה וסוג תנועה',
  };
}

// -------------------------------------------------------------
// 3. ROBUST DATE & STRING NORMALIZATION
// -------------------------------------------------------------
const HEBREW_MONTHS: Record<string, string> = {
  'ינואר': '01', 'ינו': '01',
  'פברואר': '02', 'פבר': '02',
  'מרץ': '03', 'מרס': '03',
  'אפריל': '04', 'אפר': '04',
  'מאי': '05',
  'יוני': '06',
  'יולי': '07',
  'אוגוסט': '08', 'אוג': '08',
  'ספטמבר': '09', 'ספט': '09',
  'אוקטובר': '10', 'אוק': '10',
  'נובמבר': '11', 'נוב': '11',
  'דצמבר': '12', 'דצמ': '12',
};

// -------------------------------------------------------------
// TRANSACTION DESCRIPTION CLEANING & EXTRACTION HELPERS
// -------------------------------------------------------------

/**
 * Checks if a description string is only a technical / generic transaction classification
 * (e.g. "עסקה רגילה (כולל דביט)") rather than an actual merchant name.
 */
export function isGenericTransactionType(desc: string): boolean {
  if (!desc) return true;
  const cleaned = desc.trim();
  if (cleaned.length < 2) return true;

  const genericPatterns = [
    /^עסקה רגילה(?:\s*\(כולל דביט\))?$/i,
    /^עסקה רגילה$/i,
    /^דביט$/i,
    /^עסקת דביט$/i,
    /^כרטיס דביט$/i,
    /^משיכת מזומן(?:\s*במכשיר)?$/i,
    /^חיוב כרטיס(?:\s*אשראי)?$/i,
    /^העברה בנקאית$/i,
    /^העברה$/i,
    /^העברה בין חשבונות$/i,
    /^העברה עצמית$/i,
    /^הוראת קבע$/i,
    /^פירעון כרטיס$/i,
    /^עסקה ללא שם$/i,
    /^עסקה ללא פירוט$/i,
  ];

  return genericPatterns.some((pattern) => pattern.test(cleaned));
}

/**
 * Cleans extracted transaction descriptions to eliminate embedded technical artifacts
 * such as duplicate currency codes and amounts (e.g., "ILS 7.23 ILS עסקה רגילה (כולל דביט)"
 * or "שופרסל דיל ₪ 250.00"), while strictly preserving legitimate merchant names and details
 * including legitimate numbers (e.g. "סופר-פארם סניף 120", "קפה 4", "7-Eleven").
 */
export function cleanTransactionDescription(rawDesc: string): string {
  if (!rawDesc) return '';
  let str = cleanFinancialString(rawDesc);
  if (!str) return '';

  // 1. Remove wrapping outer quotes
  str = str.replace(/^["']+|["']+$/g, '').trim();

  // 2. Remove recognized technical currency + amount prefixes / suffixes / duplicates:
  // E.g. "ILS 7.23 ILS ...", "USD 50.00 ...", "₪ 120.50 ..."
  // Matches: (CURRENCY + AMOUNT + OPTIONAL_CURRENCY) at the start or end
  const currencyAmountPrefixRegex = /^(?:(?:ILS|USD|EUR|GBP|₪|\$|€)\s+)?\b\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\b\s*(?:ILS|USD|EUR|GBP|₪|\$|€)?\s*/i;
  const currencyPrefixRegex = /^(?:ILS|USD|EUR|GBP|₪|\$|€)\s+\b\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\b\s*(?:ILS|USD|EUR|GBP|₪|\$|€)?\s*/i;

  // If starts with "ILS 7.23 ILS " or "ILS 7.23 " or "7.23 ILS "
  let prevStr = '';
  while (str !== prevStr) {
    prevStr = str;
    str = str.replace(/^(?:ILS|USD|EUR|GBP|₪|\$|€)\s+[-+]?\d+(?:,\d{3})*(?:\.\d{1,2})?\s*(?:ILS|USD|EUR|GBP|₪|\$|€)?\s*/i, '').trim();
    str = str.replace(/^[-+]?\d+(?:,\d{3})*(?:\.\d{1,2})?\s*(?:ILS|USD|EUR|GBP|₪|\$|€)\s*/i, '').trim();
  }

  // Trailing currency + amount artifacts: e.g. "... ILS 7.23" or "... 7.23 ILS" or "... ₪ 120.00"
  prevStr = '';
  while (str !== prevStr) {
    prevStr = str;
    str = str.replace(/\s*(?:ILS|USD|EUR|GBP|₪|\$|€)\s*[-+]?\d+(?:,\d{3})*(?:\.\d{1,2})?$/i, '').trim();
    str = str.replace(/\s*[-+]?\d+(?:,\d{3})*(?:\.\d{1,2})?\s*(?:ILS|USD|EUR|GBP|₪|\$|€)$/i, '').trim();
  }

  // Standalone orphaned currency codes leftover at edges (e.g. "ILS עסקה...", "ILS ...", "... ₪")
  prevStr = '';
  while (str !== prevStr) {
    prevStr = str;
    str = str.replace(/^(?:ILS|USD|EUR|GBP|₪|\$|€)\s+/i, '').trim();
    str = str.replace(/\s+(?:ILS|USD|EUR|GBP|₪|\$|€)$/i, '').trim();
  }

  // Normalize multi-spaces
  str = str.replace(/\s{2,}/g, ' ').trim();

  return str;
}

export function cleanFinancialString(raw: any): string {
  if (raw === null || raw === undefined) return '';
  return String(raw)
    .replace(/[\u200E\u200F\u202A-\u202E\uFEFF\u200B\u200C\u200D]/g, '')
    .replace(/\u00A0/g, ' ')
    .trim();
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

export function normalizeDate(raw: any): string | null {
  if (raw === null || raw === undefined) return null;

  if (raw instanceof Date) {
    if (!isNaN(raw.getTime())) {
      const y = raw.getFullYear();
      const m = String(raw.getMonth() + 1).padStart(2, '0');
      const d = String(raw.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return null;
  }

  // Excel serial number (e.g. 45396)
  if (typeof raw === 'number') {
    if (raw > 20000 && raw < 70000) {
      const date = new Date(Math.round((raw - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }

  let str = cleanFinancialString(raw);
  if (!str) return null;

  // Strip wrapping quotes, brackets
  str = str.replace(/^["'([{]+|[)"'\]}]+$/g, '').trim();

  // Strip timestamps e.g. "2024-05-14 10:20:30" or "14/05/2024 10:20"
  const cleanStr = str.replace(/T.*$/, '').split(/\s+/)[0];
  if (!cleanStr) return null;

  // Regex ISO: YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const isoMatch = cleanStr.match(/^(\d{4})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])$/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Regex DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY
  const dmyMatch = cleanStr.match(/^(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // Regex DD/MM/YY (2-digit year e.g. 15.02.26, 15/02/26, 15-02-26)
  const dmyShortMatch = cleanStr.match(/^(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](\d{2})$/);
  if (dmyShortMatch) {
    const d = dmyShortMatch[1].padStart(2, '0');
    const m = dmyShortMatch[2].padStart(2, '0');
    let y = parseInt(dmyShortMatch[3], 10);
    y = y < 50 ? 2000 + y : 1900 + y;
    return `${y}-${m}-${d}`;
  }

  // Regex MM/DD/YYYY (US format where day > 12)
  const mdyMatch = cleanStr.match(/^(0?[1-9]|1[0-2])[-/.]([12]\d|3[01])[-/.](\d{4})$/);
  if (mdyMatch) {
    const m = mdyMatch[1].padStart(2, '0');
    const d = mdyMatch[2].padStart(2, '0');
    const y = mdyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // Regex Month-Year MM/YY or MM.YY or MM/YYYY (e.g. "12.25", "10.25", "02/26")
  const myMatch = cleanStr.match(/^(0?[1-9]|1[0-2])[-/.](20\d{2}|\d{2})$/);
  if (myMatch) {
    const m = myMatch[1].padStart(2, '0');
    let y = parseInt(myMatch[2], 10);
    if (y < 50) y += 2000;
    else if (y < 100) y += 1900;
    return `${y}-${m}-01`;
  }

  // Compact 8-digit date: YYYYMMDD
  const compactYmd = cleanStr.match(/^(\d{4})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/);
  if (compactYmd) {
    return `${compactYmd[1]}-${compactYmd[2]}-${compactYmd[3]}`;
  }

  // Compact 8-digit date: DDMMYYYY
  const compactDmy = cleanStr.match(/^(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])(\d{4})$/);
  if (compactDmy) {
    return `${compactDmy[3]}-${compactDmy[2]}-${compactDmy[1]}`;
  }

  // Compact 6-digit date: DDMMYY
  const compactDmyShort = cleanStr.match(/^(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])(\d{2})$/);
  if (compactDmyShort) {
    const d = compactDmyShort[1];
    const m = compactDmyShort[2];
    let y = parseInt(compactDmyShort[3], 10);
    y = y < 50 ? 2000 + y : 1900 + y;
    return `${y}-${m}-${d}`;
  }

  // Check Hebrew month format: e.g. "15 בינואר 2024" or "15-ינואר-2024"
  for (const [hebMonth, num] of Object.entries(HEBREW_MONTHS)) {
    if (str.includes(hebMonth)) {
      const match = str.match(new RegExp(`(\\d{1,2})\\s*(?:ב)?${hebMonth}\\s*(\\d{2,4})`));
      if (match) {
        const d = match[1].padStart(2, '0');
        let y = parseInt(match[2], 10);
        if (y < 100) y += 2000;
        return `${y}-${num}-${d}`;
      }
    }
  }

  return null;
}

// -------------------------------------------------------------
// 4. AMOUNT NORMALIZATION
// -------------------------------------------------------------
export function parseIsraeliAmount(raw: any): { amount: number; isNegative: boolean } | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    if (isNaN(raw) || raw === 0) return null;
    return {
      amount: Math.abs(raw),
      isNegative: raw < 0,
    };
  }

  let s = cleanFinancialString(raw);
  if (!s || s === '-' || s === '--' || s === '0' || s === '0.00' || s === '0.0') return null;

  let isNegative = false;
  // Parentheses check e.g. (1,250.00)
  if (s.startsWith('(') && s.endsWith(')')) {
    isNegative = true;
    s = s.slice(1, -1);
  }

  // Hebrew debit/credit indicators
  if (s.includes('חובה')) {
    isNegative = true;
    s = s.replace(/חובה/g, '');
  }
  if (s.includes('זכות') || s.includes('זיכוי')) {
    s = s.replace(/זכות|זיכוי/g, '');
  }

  // Trailing or leading minus e.g. -150 or 150-
  if (s.includes('-')) {
    isNegative = true;
    s = s.replace(/-/g, '');
  }

  // Handle European comma/dot if e.g. 1.234,56
  if (/^\d{1,3}(?:\.\d{3})+,\d{2}$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d+,\d{2}$/.test(s)) {
    s = s.replace(',', '.');
  }

  // Remove currency signs, thousand-separator commas, quotes and spaces
  s = s.replace(/[₪$€,\s"']/g, '').replace(/ש"?ח/g, '').replace(/NIS/gi, '').replace(/ILS/gi, '');

  const val = parseFloat(s);
  if (isNaN(val) || val === 0) return null;

  return {
    amount: Math.abs(val),
    isNegative,
  };
}

// -------------------------------------------------------------
// 5. TEXT ENCODING DECODER (Handles Windows-1255, UTF-8, BOM)
// -------------------------------------------------------------
export async function decodeTextBuffer(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);

  // 1. Check for UTF-8 BOM (0xEF, 0xBB, 0xBF)
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    try {
      const decoded = new TextDecoder('utf-8').decode(bytes.slice(3));
      return cleanFinancialString(decoded);
    } catch {
      // fallback
    }
  }

  // 2. Check for UTF-16 LE BOM (0xFF, 0xFE) or BE BOM (0xFE, 0xFF)
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    try {
      const decoded = new TextDecoder('utf-16le').decode(bytes.slice(2));
      return cleanFinancialString(decoded);
    } catch {
      // fallback
    }
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    try {
      const decoded = new TextDecoder('utf-16be').decode(bytes.slice(2));
      return cleanFinancialString(decoded);
    } catch {
      // fallback
    }
  }

  // 3. Try decoding as strict UTF-8
  let isStrictUtf8 = false;
  let utf8Text = '';
  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
    utf8Text = utf8Decoder.decode(bytes);
    isStrictUtf8 = true;
  } catch {
    isStrictUtf8 = false;
  }

  // If strict UTF-8 decoded successfully AND contains Hebrew letters:
  if (isStrictUtf8 && /[\u0590-\u05FF]/.test(utf8Text)) {
    return cleanFinancialString(utf8Text);
  }

  // 4. Try Windows-1255 decoder (Standard Israeli bank / credit card encoding: Isracard, Max, Cal, Hapoalim)
  try {
    const win1255Decoder = new TextDecoder('windows-1255');
    const win1255Text = win1255Decoder.decode(bytes);
    if (/[\u0590-\u05FF]/.test(win1255Text)) {
      return cleanFinancialString(win1255Text);
    }
  } catch {
    // Windows-1255 TextDecoder not available
  }

  // 5. Try ISO-8859-8 (Hebrew)
  try {
    const iso88598Decoder = new TextDecoder('iso-8859-8');
    const isoText = iso88598Decoder.decode(bytes);
    if (/[\u0590-\u05FF]/.test(isoText)) {
      return cleanFinancialString(isoText);
    }
  } catch {
    // ignore
  }

  // 6. Manual single-byte Hebrew decoding fallback (Windows-1255 mapping):
  // In Windows-1255:
  // Bytes 0xE0 through 0xFA (224-250) correspond to Hebrew letters א-ת (1488-1514).
  // 0xA5 is ₪, 0xDF is ׳, 0x9E is ״.
  let hasHebrewBytes = false;
  for (let i = 0; i < Math.min(bytes.length, 50000); i++) {
    if (bytes[i] >= 0xe0 && bytes[i] <= 0xfa) {
      hasHebrewBytes = true;
      break;
    }
  }

  if (hasHebrewBytes) {
    let manualStr = '';
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if (b >= 0xe0 && b <= 0xfa) {
        manualStr += String.fromCharCode(b - 0xe0 + 0x05d0);
      } else if (b === 0xa5) {
        manualStr += '₪';
      } else if (b === 0xdf) {
        manualStr += '׳';
      } else if (b === 0x9e) {
        manualStr += '״';
      } else {
        manualStr += String.fromCharCode(b);
      }
    }
    return cleanFinancialString(manualStr);
  }

  // 7. If strict UTF-8 decoded without error
  if (isStrictUtf8) {
    return cleanFinancialString(utf8Text);
  }

  // 8. Fallback to standard UTF-8 (non-fatal)
  return cleanFinancialString(utf8Text || new TextDecoder('utf-8').decode(bytes));
}

// -------------------------------------------------------------
// CENTRAL TRANSACTION BUILDER
// -------------------------------------------------------------
function buildTransactionObject(params: {
  date: string;
  billingDate?: string | null;
  amount: number;
  merchant: string;
  description: string;
  rawCategory?: string;
  ref?: string;
  isCreditRow: boolean;
  isDebitRow: boolean;
  amountIsNegative: boolean;
  institutionInfo: ReturnType<typeof detectInstitution>;
  sourceFileName: string;
  occurrence?: number;
}): Transaction {
  const {
    date,
    billingDate,
    amount,
    merchant,
    description,
    rawCategory = '',
    ref = '',
    isCreditRow,
    isDebitRow,
    amountIsNegative,
    institutionInfo,
    sourceFileName,
    occurrence,
  } = params;

  // Clean technical currency/amount artifacts from raw merchant & description
  const cleanedMerchant = cleanTransactionDescription(merchant);
  const cleanedDesc = cleanTransactionDescription(description);

  // If the description is a generic classification (e.g. "עסקה רגילה (כולל דביט)"),
  // preserve it truthfully as the description/source description, but do NOT invent a fake merchant name!
  // If merchant is purely generic, keep merchant as the specific generic string or 'עסקה ללא שם'
  const isGeneric = isGenericTransactionType(cleanedMerchant);
  const effectiveMerchant = cleanedMerchant || (cleanedDesc ? cleanedDesc : 'עסקה ללא שם');
  const effectiveDescription = cleanedDesc || effectiveMerchant;

  const isCreditCardSource =
    institutionInfo.defaultPayment === 'credit_card' ||
    Boolean(institutionInfo.isCreditCardOnly) ||
    sourceFileName.toLowerCase().includes('אשראי') ||
    sourceFileName.toLowerCase().includes('כרטיס');

  // 1. Central Semantic Classification Engine
  const classification = classifyTransactionSemantics({
    merchant: effectiveMerchant,
    description: effectiveDescription || rawCategory,
    rawCategory,
    isCreditRow,
    isDebitRow,
    amountIsNegative,
    isCreditCardSource,
  });

  // 2. Prevent impossible combinations (e.g. Income + Clothing, Income + Supermarket)
  const isGenericRawCategory = !rawCategory || rawCategory === 'כללי' || rawCategory === 'אחר / ללא סיווג';
  const effectiveCategory = isGenericRawCategory ? classification.category : (rawCategory || classification.category);

  const validated = validateAndFixTransactionCombination({
    merchant: effectiveMerchant,
    category: effectiveCategory,
    type: classification.type,
  });

  const finalType = validated.type;
  let finalCategory = validated.category;
  if (finalType === 'refund' && (finalCategory === 'אחר / ללא סיווג' || finalCategory === 'כללי')) {
    finalCategory = 'החזרים וזיכויים';
  } else if (finalType === 'income' && (finalCategory === 'אחר / ללא סיווג' || finalCategory === 'כללי' || !finalCategory)) {
    finalCategory = 'משכורת והכנסות';
  } else if (finalType === 'other' && (finalCategory === 'אחר / ללא סיווג' || finalCategory === 'כללי' || !finalCategory)) {
    finalCategory = 'אחר / לבירור';
  }

  const confidenceLevel: ConfidenceLevel = classification.isUserRule
    ? 'high'
    : classification.confidenceScore > 0.8
    ? 'high'
    : 'medium';

  const needsReview = classification.needsReview || validated.needsReview;
  const reviewReason = validated.reviewReason || classification.reviewReason;

  const docRole = identifyDocumentRole({
    sourceDocument: sourceFileName,
    accountName: institutionInfo.accountName,
    description: effectiveDescription,
    paymentMethod: institutionInfo.defaultPayment,
  } as any);

  // Future-date detection relative to current system date (October 8, 2026)
  const isFuture = Boolean(date && date > '2026-10-08');

  const roundedAmount = Math.round(amount * 100) / 100;
  const initialTxId = `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const fullDesc = ref ? `${effectiveMerchant} (אסמכתא: ${ref})` : (effectiveDescription || effectiveMerchant);
  const rowIdempotency = generateRowIdempotencyKey({
    date,
    amount: roundedAmount,
    merchant: effectiveMerchant,
    ref,
    accountId: institutionInfo.accountId,
    currency: 'ILS',
    occurrence,
  });

  const initialSourceRecord: SourceRecord = {
    id: `src-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    sourceDocument: sourceFileName,
    sourceDocumentType: docRole,
    amount: roundedAmount,
    date,
    originalDate: date,
    description: fullDesc,
    merchant: effectiveMerchant,
    accountId: institutionInfo.accountId,
    accountName: institutionInfo.accountName,
    paymentMethod: institutionInfo.defaultPayment,
    importedAt: new Date().toISOString(),
    idempotencyKey: rowIdempotency,
  };

  return {
    id: initialTxId,
    date,
    originalDate: date,
    billingDate: billingDate || undefined,
    amount: roundedAmount,
    currency: 'ILS',
    merchant: effectiveMerchant,
    description: fullDesc,
    accountId: institutionInfo.accountId,
    accountName: institutionInfo.accountName,
    paymentMethod: institutionInfo.defaultPayment,
    category: finalCategory,
    type: finalType,
    isRecurring: false,
    isInternalTransfer: classification.isInternalTransfer,
    confidenceScore: classification.confidenceScore,
    confidenceLevel,
    needsReview,
    reviewReason,
    userConfirmed: confidenceLevel === 'high' || Boolean(classification.isUserRule),
    sourceDocument: sourceFileName,
    sourceDocumentType: docRole,
    isFuture,
    idempotencyKey: rowIdempotency,
    sourceRecords: [initialSourceRecord],
  };
}

// -------------------------------------------------------------
// HEADER COLUMN CLASSIFIER & SPECIFICITY RESOLVER
// -------------------------------------------------------------
export interface HeaderColumnMapping {
  dateCol: number;
  billingDateCol: number;
  descCol: number;
  amountCol: number;
  billingAmountCol: number;
  debitCol: number;
  creditCol: number;
  categoryCol: number;
  refCol: number;
  isHeaderRow: boolean;
}

export function identifyHeaderColumns(rowCells: string[]): HeaderColumnMapping {
  let bestDateCol = -1;
  let bestDateScore = 0;

  let bestBillingDateCol = -1;
  let bestBillingDateScore = 0;

  let bestDescCol = -1;
  let bestDescScore = 0;

  let fAmount = -1;
  let fBillingAmount = -1;
  let fDebit = -1;
  let fCredit = -1;
  let fCat = -1;
  let fRef = -1;

  rowCells.forEach((cell, idx) => {
    const raw = cleanFinancialString(cell || '').trim();
    if (!raw) return;
    const t = raw.toLowerCase();

    // -------------------------------------------------------------
    // 1. DATE CLASSIFICATION WITH EXPLICIT SPECIFICITY PRIORITY
    // -------------------------------------------------------------
    const isExplicitBillingDate =
      t.includes('תאריך חיוב') ||
      t.includes('תאריך החיוב') ||
      t.includes('מועד חיוב') ||
      t.includes('מועד החיוב') ||
      t.includes('ת.חיוב') ||
      t.includes('תאריך ערך') ||
      t.includes('תאריך הערך') ||
      t.includes('מועד ערך') ||
      t.includes('מועד הערך') ||
      t.includes('ת.ערך') ||
      t.includes('יום ערך') ||
      t === 'billing date' ||
      t === 'value date' ||
      t === 'due date';

    const isExplicitTxDate =
      t.includes('תאריך עסקה') ||
      t.includes('תאריך העסקה') ||
      t.includes('מועד עסקה') ||
      t.includes('מועד העסקה') ||
      t.includes('ת.עסקה') ||
      t.includes('תאריך רכישה') ||
      t.includes('תאריך הרכישה') ||
      t.includes('מועד רכישה') ||
      t.includes('מועד הרכישה') ||
      t.includes('ת.רכישה') ||
      t.includes('תאריך קניה') ||
      t.includes('תאריך פעולה') ||
      t.includes('תאריך הפעולה') ||
      t.includes('מועד פעולה') ||
      t.includes('מועד הפעולה') ||
      t.includes('תאריך ביצוע') ||
      t.includes('תאריך הביצוע') ||
      t.includes('מועד ביצוע') ||
      t === 'transaction date' ||
      t === 'trans date' ||
      t === 'tx date' ||
      t === 'purchase date';

    const isPostingDate =
      t.includes('תאריך רישום') ||
      t.includes('תאריך הצגה') ||
      t.includes('posting date');

    const isGeneralDate =
      !isExplicitBillingDate &&
      !isExplicitTxDate &&
      !isPostingDate &&
      (t === 'תאריך' ||
       t === 'ת.תאריך' ||
       t === 'date' ||
       t === 'יום' ||
       /^תאריך\b/.test(t));

    if (isExplicitBillingDate) {
      if (bestBillingDateScore < 100) {
        bestBillingDateCol = idx;
        bestBillingDateScore = 100;
      }
      // Can serve as fallback date if no transaction/general date exists
      if (bestDateScore < 20) {
        bestDateCol = idx;
        bestDateScore = 20;
      }
    } else if (isExplicitTxDate) {
      if (bestDateScore < 100) {
        bestDateCol = idx;
        bestDateScore = 100;
      }
    } else if (isGeneralDate) {
      if (bestDateScore < 70) {
        bestDateCol = idx;
        bestDateScore = 70;
      }
    } else if (isPostingDate) {
      if (bestDateScore < 40) {
        bestDateCol = idx;
        bestDateScore = 40;
      }
    }

    // -------------------------------------------------------------
    // 2. DESCRIPTION & MERCHANT VS. ACTION TYPE / CATEGORY
    // -------------------------------------------------------------
    const isActionTypeOrCategory =
      t.includes('סוג פעולה') ||
      t.includes('סוג הפעולה') ||
      t.includes('סוג עסקה') ||
      t.includes('סוג העסקה') ||
      t.includes('סוג תנועה') ||
      t.includes('סוג התנועה') ||
      t.includes('קטגוריה') ||
      t.includes('ענף') ||
      t === 'category' ||
      t === 'sector' ||
      t === 'action type' ||
      t === 'transaction type';

    if (isActionTypeOrCategory) {
      // Prioritize setting category column; NEVER set as primary description
      if (fCat === -1 || t.includes('סוג פעולה') || t.includes('קטגוריה')) {
        fCat = idx;
      }
    } else {
      // Explicit Merchant / Payee
      const isExplicitMerchant =
        t.includes('שם בית עסק') ||
        t.includes('שם בית העסק') ||
        t.includes('בית עסק') ||
        t.includes('שם ספק') ||
        t.includes('שם העסק') ||
        t.includes('שם מוטב') ||
        t.includes('מוטב') ||
        t.includes('שם הנמען') ||
        t.includes('נמען') ||
        t === 'merchant' ||
        t === 'payee' ||
        t === 'business' ||
        t === 'vendor';

      // Explicit Description / Details (Must NOT be pure action type)
      const isExplicitDescription =
        t.includes('תיאור הפעולה') ||
        t.includes('תיאור פעולה') ||
        t.includes('שם הפעולה') ||
        t.includes('מהות הפעולה') ||
        t.includes('פרטי פעולה') ||
        t.includes('פרטי הפעולה') ||
        t.includes('פירוט פעולה') ||
        t.includes('פירוט הפעולה') ||
        t.includes('פרטי עסקה') ||
        t.includes('פרטי העסקה') ||
        t.includes('פירוט עסקה') ||
        t.includes('פירוט העסקה') ||
        t.includes('תיאור עסקה') ||
        t.includes('פרטים נוספים') ||
        t.includes('תיאור') ||
        t.includes('פירוט') ||
        t.includes('פרטים') ||
        t.includes('ספק') ||
        t === 'description' ||
        t === 'details' ||
        t === 'memo';

      if (isExplicitMerchant) {
        if (bestDescScore < 100) {
          bestDescCol = idx;
          bestDescScore = 100;
        }
      } else if (isExplicitDescription) {
        if (bestDescScore < 80) {
          bestDescCol = idx;
          bestDescScore = 80;
        }
      } else if (t === 'פעולה' || t === 'operation') {
        // Low priority fallback only if no explicit merchant or description found
        if (bestDescScore < 30) {
          bestDescCol = idx;
          bestDescScore = 30;
        }
      }
    }

    // -------------------------------------------------------------
    // 3. AMOUNTS (DEBIT, CREDIT, BILLING AMOUNT, ORIGINAL AMOUNT)
    // -------------------------------------------------------------
    if (
      t.includes('חובה') ||
      t.includes('סכום חובה') ||
      t.includes('משיכה') ||
      t === 'debit'
    ) {
      if (fDebit === -1 || t.includes('חובה')) fDebit = idx;
    } else if (
      t.includes('זכות') ||
      t.includes('סכום זכות') ||
      t.includes('זיכוי') ||
      t.includes('הפקדה') ||
      t.includes('הכנסה') ||
      t === 'credit' ||
      t === 'deposit'
    ) {
      if (fCredit === -1 || t.includes('זכות')) fCredit = idx;
    } else if (
      t.includes('סכום חיוב') ||
      t.includes('סכום לחיוב') ||
      t.includes('סכום לתשלום') ||
      t.includes('סכום בפועל') ||
      t.includes('סכום בש"ח') ||
      t.includes('סכום בשח') ||
      t.includes('סכום חיוב בש"ח') ||
      t.includes('סכום חיוב בשח') ||
      t.includes('billing amount')
    ) {
      if (fBillingAmount === -1) fBillingAmount = idx;
    } else if (
      t.includes('סכום עסקה') ||
      t.includes('סכום בעסקה') ||
      t.includes('סכום מקורי') ||
      t.includes('סכום עסקה מקורי') ||
      t.includes('סכום') ||
      t === 'amount'
    ) {
      if (fAmount === -1) fAmount = idx;
    }

    // -------------------------------------------------------------
    // 4. REFERENCE / VOUCHER
    // -------------------------------------------------------------
    if (
      t.includes('אסמכתא') ||
      t.includes('שובר') ||
      t.includes('מספר שובר') ||
      t.includes('מספר אסמכתא') ||
      t.includes('אסמכתה') ||
      t.includes('ref') ||
      t.includes('voucher') ||
      t.includes('reference')
    ) {
      if (fRef === -1) fRef = idx;
    }
  });

  const finalDateCol = bestDateCol !== -1 ? bestDateCol : bestBillingDateCol;
  const finalBillingDateCol = bestBillingDateCol;

  const isHeaderRow =
    (finalDateCol !== -1 || finalBillingDateCol !== -1) &&
    (bestDescCol !== -1 || fAmount !== -1 || fBillingAmount !== -1 || fDebit !== -1 || fCredit !== -1);

  return {
    dateCol: finalDateCol,
    billingDateCol: finalBillingDateCol,
    descCol: bestDescCol,
    amountCol: fAmount,
    billingAmountCol: fBillingAmount,
    debitCol: fDebit,
    creditCol: fCredit,
    categoryCol: fCat,
    refCol: fRef,
    isHeaderRow,
  };
}

// -------------------------------------------------------------
// UNIFIED SPREADSHEET & CSV ROW EXTRACTOR
// -------------------------------------------------------------
export function extractTransactionsFromRawRows(
  rawRows: any[][],
  sourceFileName: string,
  defaultInstitutionName?: string
): { transactions: Transaction[]; detectedInst: string } {
  if (!rawRows || rawRows.length < 2) {
    return { transactions: [], detectedInst: defaultInstitutionName || 'לא זוהה' };
  }

  const headerSnippet = rawRows.slice(0, 20).map((r) => r.join(' ')).join(' ');
  const institutionInfo = detectInstitution(headerSnippet, sourceFileName);
  const detectedInst = defaultInstitutionName || institutionInfo.name;

  const allTransactions: Transaction[] = [];
  const rowOccurrenceTracker = new Map<string, number>();

  let activeDateCol = -1;
  let activeBillingDateCol = -1;
  let activeDescCol = -1;
  let activeAmountCol = -1;
  let activeBillingAmountCol = -1;
  let activeDebitCol = -1;
  let activeCreditCol = -1;
  let activeCategoryCol = -1;
  let activeRefCol = -1;

  for (let r = 0; r < rawRows.length; r++) {
    const row = rawRows[r].map((cell) => cleanFinancialString(cell));
    if (row.length === 0 || row.every((c) => !c)) continue;

    // Check if row is a section header row using prioritized classification
    const headerMapping = identifyHeaderColumns(row);
    if (headerMapping.isHeaderRow) {
      activeDateCol = headerMapping.dateCol;
      activeBillingDateCol = headerMapping.billingDateCol;
      if (headerMapping.descCol !== -1) activeDescCol = headerMapping.descCol;
      if (headerMapping.billingAmountCol !== -1) activeBillingAmountCol = headerMapping.billingAmountCol;
      if (headerMapping.amountCol !== -1) activeAmountCol = headerMapping.amountCol;
      if (headerMapping.debitCol !== -1) activeDebitCol = headerMapping.debitCol;
      if (headerMapping.creditCol !== -1) activeCreditCol = headerMapping.creditCol;
      if (headerMapping.categoryCol !== -1) activeCategoryCol = headerMapping.categoryCol;
      if (headerMapping.refCol !== -1) activeRefCol = headerMapping.refCol;
      continue;
    }

    // Skip summary or title rows
    const rowStr = row.join(' ');
    if (
      rowStr.includes('סה"כ') ||
      rowStr.includes('סך הכל') ||
      rowStr.includes('יתרה לתשלום') ||
      rowStr.includes('סה״כ') ||
      rowStr.includes('סך חיוב לחשבון') ||
      rowStr.includes('סך חיוב חודשי')
    ) {
      continue;
    }

    // Heuristic deduction if no header mapped yet
    if (
      activeDateCol === -1 ||
      (activeAmountCol === -1 && activeBillingAmountCol === -1 && activeDebitCol === -1 && activeCreditCol === -1)
    ) {
      let pDate = -1;
      let pAmt = -1;
      row.forEach((cell, idx) => {
        if (normalizeDate(cell) && pDate === -1) pDate = idx;
        else if (parseIsraeliAmount(cell) && pAmt === -1) pAmt = idx;
      });
      if (pDate !== -1 && pAmt !== -1) {
        activeDateCol = pDate;
        activeAmountCol = pAmt;
        activeDescCol = pDate === 0 ? 1 : 0;
      } else {
        continue;
      }
    }

    // Process transaction data row
    const rawDate = row[activeDateCol];
    const normalizedDate = normalizeDate(rawDate);
    if (!normalizedDate) continue;

    const rawBillingDate = activeBillingDateCol !== -1 ? row[activeBillingDateCol] : null;
    const normalizedBillingDate = rawBillingDate ? normalizeDate(rawBillingDate) : undefined;

    const rawDesc = activeDescCol !== -1 ? String(row[activeDescCol] || '').trim() : '';
    const rawCategory = activeCategoryCol !== -1 ? String(row[activeCategoryCol] || '').trim() : '';
    const rawRef = activeRefCol !== -1 ? String(row[activeRefCol] || '').trim() : '';

    let txAmount = 0;
    let isCreditRow = false;
    let isDebitRow = false;
    let amountIsNegative = false;
    let foundValidAmount = false;

    // Check Debit / Credit columns
    if (activeDebitCol !== -1 || activeCreditCol !== -1) {
      const debitVal = activeDebitCol !== -1 ? parseIsraeliAmount(row[activeDebitCol]) : null;
      const creditVal = activeCreditCol !== -1 ? parseIsraeliAmount(row[activeCreditCol]) : null;

      if (creditVal && creditVal.amount > 0) {
        txAmount = creditVal.amount;
        isCreditRow = true;
        foundValidAmount = true;
      } else if (debitVal && debitVal.amount > 0) {
        txAmount = debitVal.amount;
        isDebitRow = true;
        foundValidAmount = true;
      }
    }

    // Check Billing Amount column (priority in Israeli cards)
    if (!foundValidAmount && activeBillingAmountCol !== -1) {
      const parsedBilling = parseIsraeliAmount(row[activeBillingAmountCol]);
      if (parsedBilling && parsedBilling.amount > 0) {
        txAmount = parsedBilling.amount;
        amountIsNegative = parsedBilling.isNegative;
        foundValidAmount = true;
      }
    }

    // Check Original / General Amount column
    if (!foundValidAmount && activeAmountCol !== -1) {
      const parsedAmount = parseIsraeliAmount(row[activeAmountCol]);
      if (parsedAmount && parsedAmount.amount > 0) {
        txAmount = parsedAmount.amount;
        amountIsNegative = parsedAmount.isNegative;
        foundValidAmount = true;

        const isCard =
          institutionInfo.defaultPayment === 'credit_card' ||
          Boolean(institutionInfo.isCreditCardOnly) ||
          sourceFileName.toLowerCase().includes('אשראי') ||
          sourceFileName.toLowerCase().includes('כרטיס');

        if (!isCard) {
          if (amountIsNegative) {
            isDebitRow = true;
            isCreditRow = false;
          } else {
            isCreditRow = true;
            isDebitRow = false;
          }
        }
      }
    }

    if (!foundValidAmount || txAmount === 0) continue;

    const baseSig = generateRowIdempotencyKey({
      date: normalizedDate,
      amount: txAmount,
      merchant: rawDesc || rawCategory || 'עסקה ללא פירוט',
      ref: rawRef,
      accountId: institutionInfo.accountId,
      currency: 'ILS',
    });
    const currentOcc = (rowOccurrenceTracker.get(baseSig) || 0) + 1;
    rowOccurrenceTracker.set(baseSig, currentOcc);

    const tx = buildTransactionObject({
      date: normalizedDate,
      billingDate: normalizedBillingDate,
      amount: txAmount,
      merchant: rawDesc || rawCategory || 'עסקה ללא פירוט',
      description: rawDesc,
      rawCategory,
      ref: rawRef,
      isCreditRow,
      isDebitRow,
      amountIsNegative,
      institutionInfo,
      sourceFileName,
      occurrence: currentOcc,
    });

    allTransactions.push(tx);
  }

  return { transactions: allTransactions, detectedInst };
}

// -------------------------------------------------------------
// 6. EXCEL PARSER (Spreadsheets: .xlsx, .xls, .xlsm, .xlsb, .ods)
// -------------------------------------------------------------
export async function parseExcelFile(file: File): Promise<ParseResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return {
        success: false,
        transactions: [],
        institution: 'לא זוהה',
        error: 'קובץ האקסל אינו מכיל גיליונות נתונים.',
      };
    }

    const allTransactions: Transaction[] = [];
    let detectedInstName = '';

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        defval: '',
      });

      const { transactions, detectedInst } = extractTransactionsFromRawRows(rawRows, file.name, detectedInstName);
      if (!detectedInstName) detectedInstName = detectedInst;
      allTransactions.push(...transactions);
    }

    if (allTransactions.length === 0) {
      return {
        success: false,
        transactions: [],
        institution: detectedInstName || 'קובץ אקסל',
        error: 'לא זוהו עסקאות תקינות בתוך קובץ האקסל. ודא כי הקובץ מכיל עמודות תאריך וסכום.',
      };
    }

    allTransactions.sort((a, b) => b.date.localeCompare(a.date));

    return {
      success: true,
      transactions: allTransactions,
      institution: detectedInstName || 'קובץ אקסל',
      processingMethod: 'פענוח גיליון אלקטרוני (SheetJS)',
      earliestDate: allTransactions[allTransactions.length - 1].date,
      latestDate: allTransactions[0].date,
      totalIncome: allTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      totalExpense: allTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    };
  } catch (err) {
    return {
      success: false,
      transactions: [],
      institution: 'שגיאה',
      error: `שגיאה בפענוח קובץ האקסל: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// -------------------------------------------------------------
// 7. ROBUST CSV & DELIMITED TEXT PARSER (.csv, .tsv, .txt)
// -------------------------------------------------------------
export async function parseCsvFile(file: File): Promise<ParseResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const text = await decodeTextBuffer(arrayBuffer);
    const cleanText = cleanFinancialString(text);

    // 1. Primary engine: Parse via SheetJS string mode with shared rawRows extractor
    // (Ensures 100% feature and transaction parity with XLSX exports!)
    try {
      const workbook = XLSX.read(cleanText, { type: 'string', raw: false });
      if (workbook.SheetNames && workbook.SheetNames.length > 0) {
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (sheet) {
          const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            raw: false,
            defval: '',
          });

          const { transactions, detectedInst } = extractTransactionsFromRawRows(rawRows, file.name);
          if (transactions.length > 0) {
            transactions.sort((a, b) => b.date.localeCompare(a.date));
            return {
              success: true,
              transactions,
              institution: detectedInst || 'קובץ CSV',
              processingMethod: 'פענוח CSV מובנה (SheetJS)',
              earliestDate: transactions[transactions.length - 1].date,
              latestDate: transactions[0].date,
              totalIncome: transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
              totalExpense: transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
            };
          }
        }
      }
    } catch {
      // continue to secondary line-by-line engine
    }

    // 2. Secondary engine: Line-by-line custom delimited text scanner
    const secondaryResult = parseCsvContent(cleanText, file.name);
    if (secondaryResult.success && secondaryResult.transactions.length > 0) {
      return secondaryResult;
    }

    return {
      success: false,
      transactions: [],
      institution: secondaryResult.institution || 'קובץ CSV',
      error: secondaryResult.error || 'לא זוהו עסקאות תקינות בקובץ ה-CSV. אנא ודא כי הקובץ מכיל עמודות תאריך, בית עסק וסכום.',
    };
  } catch (err) {
    return {
      success: false,
      transactions: [],
      institution: 'שגיאה',
      error: `שגיאה בקריאת קובץ CSV: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export function parseCsvContent(text: string, fileName: string): ParseResult {
  const lines = text.split(/\r\n|\r|\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    return {
      success: false,
      transactions: [],
      institution: 'לא זוהה',
      error: 'קובץ ה-CSV ריק או מכיל שורה בודדת בלבד.',
    };
  }

  // 1. Detect Delimiter across non-empty lines with content
  const delimiters = [',', ';', '\t', '|'];
  const candidateLines = lines.filter((l) => l.length > 10).slice(0, 60);

  let bestDelim = ',';
  let bestScore = -1;

  for (const d of delimiters) {
    const counts = candidateLines.map((line) => {
      let c = 0;
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') inQuotes = !inQuotes;
        else if (line[i] === d && !inQuotes) c++;
      }
      return c;
    });

    const nonZero = counts.filter((c) => c > 0);
    if (nonZero.length > 0) {
      const avg = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
      const score = nonZero.length * (avg > 1 ? avg : 0.5);
      if (score > bestScore) {
        bestScore = score;
        bestDelim = d;
      }
    }
  }

  const delimiter = bestDelim;

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(cleanFinancialString(current.replace(/^"|"$/g, '')));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(cleanFinancialString(current.replace(/^"|"$/g, '')));
    return result;
  };

  const institutionInfo = detectInstitution(text, fileName);
  const transactions: Transaction[] = [];

  let activeDateCol = -1;
  let activeBillingDateCol = -1;
  let activeDescCol = -1;
  let activeAmountCol = -1;
  let activeBillingAmountCol = -1;
  let activeDebitCol = -1;
  let activeCreditCol = -1;
  let activeCategoryCol = -1;
  let activeRefCol = -1;

  for (let i = 0; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (cols.length <= 1) continue;

    // Check if line is a header row using prioritized classification
    const headerMapping = identifyHeaderColumns(cols);
    if (headerMapping.isHeaderRow) {
      activeDateCol = headerMapping.dateCol;
      activeBillingDateCol = headerMapping.billingDateCol;
      if (headerMapping.descCol !== -1) activeDescCol = headerMapping.descCol;
      if (headerMapping.billingAmountCol !== -1) activeBillingAmountCol = headerMapping.billingAmountCol;
      if (headerMapping.amountCol !== -1) activeAmountCol = headerMapping.amountCol;
      if (headerMapping.debitCol !== -1) activeDebitCol = headerMapping.debitCol;
      if (headerMapping.creditCol !== -1) activeCreditCol = headerMapping.creditCol;
      if (headerMapping.categoryCol !== -1) activeCategoryCol = headerMapping.categoryCol;
      if (headerMapping.refCol !== -1) activeRefCol = headerMapping.refCol;
      continue;
    }

    // Skip summary lines
    const lineStr = lines[i];
    if (
      lineStr.includes('סה"כ') ||
      lineStr.includes('סך הכל') ||
      lineStr.includes('יתרה לתשלום') ||
      lineStr.includes('סה״כ') ||
      lineStr.includes('סך חיוב לחשבון')
    ) {
      continue;
    }

    // Heuristic deduction if no header mapped yet
    if (
      activeDateCol === -1 ||
      (activeAmountCol === -1 && activeBillingAmountCol === -1 && activeDebitCol === -1 && activeCreditCol === -1)
    ) {
      let pDate = -1;
      let pAmt = -1;
      cols.forEach((col, idx) => {
        if (normalizeDate(col) && pDate === -1) pDate = idx;
        else if (parseIsraeliAmount(col) && pAmt === -1) pAmt = idx;
      });
      if (pDate !== -1 && pAmt !== -1) {
        activeDateCol = pDate;
        activeAmountCol = pAmt;
        activeDescCol = pDate === 0 ? 1 : 0;
      } else {
        continue;
      }
    }

    // Extract transaction
    const rawDate = cols[activeDateCol];
    const normalizedDate = normalizeDate(rawDate);
    if (!normalizedDate) continue;

    const rawBillingDate = activeBillingDateCol !== -1 ? cols[activeBillingDateCol] : null;
    const normalizedBillingDate = rawBillingDate ? normalizeDate(rawBillingDate) : undefined;

    let txAmount = 0;
    let isCreditRow = false;
    let isDebitRow = false;
    let amountIsNegative = false;
    let foundValidAmount = false;

    if (activeDebitCol !== -1 || activeCreditCol !== -1) {
      const debitParsed = activeDebitCol !== -1 ? parseIsraeliAmount(cols[activeDebitCol]) : null;
      const creditParsed = activeCreditCol !== -1 ? parseIsraeliAmount(cols[activeCreditCol]) : null;

      if (creditParsed && creditParsed.amount > 0) {
        txAmount = creditParsed.amount;
        isCreditRow = true;
        foundValidAmount = true;
      } else if (debitParsed && debitParsed.amount > 0) {
        txAmount = debitParsed.amount;
        isDebitRow = true;
        foundValidAmount = true;
      }
    }

    if (!foundValidAmount && activeBillingAmountCol !== -1) {
      const parsedBilling = parseIsraeliAmount(cols[activeBillingAmountCol]);
      if (parsedBilling && parsedBilling.amount > 0) {
        txAmount = parsedBilling.amount;
        amountIsNegative = parsedBilling.isNegative;
        foundValidAmount = true;
      }
    }

    if (!foundValidAmount && activeAmountCol !== -1) {
      const parsed = parseIsraeliAmount(cols[activeAmountCol]);
      if (parsed && parsed.amount > 0) {
        txAmount = parsed.amount;
        amountIsNegative = parsed.isNegative;
        foundValidAmount = true;

        const isCard =
          institutionInfo.defaultPayment === 'credit_card' ||
          Boolean(institutionInfo.isCreditCardOnly) ||
          fileName.toLowerCase().includes('אשראי') ||
          fileName.toLowerCase().includes('כרטיס');

        if (!isCard) {
          if (amountIsNegative) {
            isDebitRow = true;
            isCreditRow = false;
          } else {
            isCreditRow = true;
            isDebitRow = false;
          }
        }
      }
    }

    if (!foundValidAmount || txAmount === 0) continue;

    const merchantName = activeDescCol !== -1 && cols[activeDescCol] ? cols[activeDescCol].trim() : 'עסקה ללא שם';
    const rawCategory = activeCategoryCol !== -1 && cols[activeCategoryCol] ? cols[activeCategoryCol].trim() : '';
    const rawRef = activeRefCol !== -1 && cols[activeRefCol] ? cols[activeRefCol].trim() : '';

    const tx = buildTransactionObject({
      date: normalizedDate,
      billingDate: normalizedBillingDate,
      amount: txAmount,
      merchant: merchantName,
      description: merchantName,
      rawCategory,
      ref: rawRef,
      isCreditRow,
      isDebitRow,
      amountIsNegative,
      institutionInfo,
      sourceFileName: fileName,
    });

    transactions.push(tx);
  }

  if (transactions.length === 0) {
    return {
      success: false,
      transactions: [],
      institution: institutionInfo.name,
      error: 'לא זוהו עסקאות תקינות בקובץ ה-CSV. אנא בדוק את מבנה הקובץ.',
    };
  }

  transactions.sort((a, b) => b.date.localeCompare(a.date));

  return {
    success: true,
    transactions,
    institution: institutionInfo.name,
    processingMethod: 'פענוח CSV סמנטי חכם',
    earliestDate: transactions[transactions.length - 1].date,
    latestDate: transactions[0].date,
    totalIncome: transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    totalExpense: transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
  };
}

// -------------------------------------------------------------
// 8. HTML TABLE PARSER (.html, .htm, or HTML disguised as .xls)
// -------------------------------------------------------------
export async function parseHtmlFile(file: File): Promise<ParseResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const text = await decodeTextBuffer(arrayBuffer);
    return parseHtmlContent(text, file.name);
  } catch (err) {
    return {
      success: false,
      transactions: [],
      institution: 'שגיאה',
      error: `שגיאה בפענוח קובץ HTML: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export function parseHtmlContent(html: string, fileName: string): ParseResult {
  // Polyfill or native DOMParser
  let doc: Document;
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    doc = parser.parseFromString(html, 'text/html');
  } else {
    // Regex based mock for non-browser / test environments
    return parseCsvContent(html.replace(/<[^>]+>/g, ','), fileName);
  }

  const tables = Array.from(doc.querySelectorAll('table'));
  if (tables.length === 0) {
    return parseCsvContent(doc.body?.textContent || html, fileName);
  }

  const institutionInfo = detectInstitution(doc.body?.textContent || html, fileName);
  const allTransactions: Transaction[] = [];

  // Evaluate all tables in HTML
  for (const table of tables) {
    const trs = Array.from(table.querySelectorAll('tr'));
    if (trs.length < 2) continue;

    let dateCol = -1;
    let billingDateCol = -1;
    let descCol = -1;
    let amountCol = -1;
    let debitCol = -1;
    let creditCol = -1;
    let categoryCol = -1;
    let refCol = -1;

    let headerIndex = -1;

    for (let i = 0; i < Math.min(trs.length, 30); i++) {
      const cells = Array.from(trs[i].querySelectorAll('th, td')).map((c) => (c.textContent || '').trim());
      const headerMapping = identifyHeaderColumns(cells);
      if (headerMapping.isHeaderRow) {
        headerIndex = i;
        dateCol = headerMapping.dateCol;
        billingDateCol = headerMapping.billingDateCol;
        descCol = headerMapping.descCol;
        amountCol = headerMapping.amountCol;
        debitCol = headerMapping.debitCol;
        creditCol = headerMapping.creditCol;
        if (headerMapping.categoryCol !== -1) categoryCol = headerMapping.categoryCol;
        if (headerMapping.refCol !== -1) refCol = headerMapping.refCol;
        break;
      }
    }

    // Heuristic deduction if header row missing
    if (headerIndex === -1) {
      for (let i = 0; i < Math.min(trs.length, 10); i++) {
        const cells = Array.from(trs[i].querySelectorAll('td')).map((c) => (c.textContent || '').trim());
        if (cells.length >= 2) {
          let pDate = -1;
          let pAmt = -1;
          cells.forEach((c, idx) => {
            if (normalizeDate(c) && pDate === -1) pDate = idx;
            else if (parseIsraeliAmount(c) && pAmt === -1) pAmt = idx;
          });
          if (pDate !== -1 && pAmt !== -1) {
            headerIndex = i - 1;
            dateCol = pDate;
            amountCol = pAmt;
            descCol = pDate === 0 ? 1 : 0;
            break;
          }
        }
      }
    }

    if (headerIndex === -1 && dateCol === -1) continue;

    for (let i = Math.max(0, headerIndex + 1); i < trs.length; i++) {
      const cells = Array.from(trs[i].querySelectorAll('td')).map((c) => (c.textContent || '').trim());
      if (cells.length < 2) continue;

      const rawDate = cells[dateCol];
      const normalizedDate = normalizeDate(rawDate);
      if (!normalizedDate) continue;

      const rawBillingDate = billingDateCol !== -1 ? cells[billingDateCol] : null;
      const normalizedBillingDate = rawBillingDate ? normalizeDate(rawBillingDate) : undefined;

      let txAmount = 0;
      let isCreditRow = false;
      let isDebitRow = false;
      let amountIsNegative = false;
      let foundValidAmount = false;

      if (debitCol !== -1 || creditCol !== -1) {
        const debitParsed = debitCol !== -1 ? parseIsraeliAmount(cells[debitCol]) : null;
        const creditParsed = creditCol !== -1 ? parseIsraeliAmount(cells[creditCol]) : null;

        if (creditParsed && creditParsed.amount > 0) {
          txAmount = creditParsed.amount;
          isCreditRow = true;
          foundValidAmount = true;
        } else if (debitParsed && debitParsed.amount > 0) {
          txAmount = debitParsed.amount;
          isDebitRow = true;
          foundValidAmount = true;
        }
      }

      if (!foundValidAmount && amountCol !== -1) {
        const parsed = parseIsraeliAmount(cells[amountCol]);
        if (parsed && parsed.amount > 0) {
          txAmount = parsed.amount;
          amountIsNegative = parsed.isNegative;
          foundValidAmount = true;

          const isCard =
            institutionInfo.defaultPayment === 'credit_card' ||
            Boolean(institutionInfo.isCreditCardOnly) ||
            fileName.toLowerCase().includes('אשראי') ||
            fileName.toLowerCase().includes('כרטיס');

          if (!isCard) {
            if (amountIsNegative) {
              isDebitRow = true;
              isCreditRow = false;
            } else {
              isCreditRow = true;
              isDebitRow = false;
            }
          }
        }
      }

      if (!foundValidAmount || txAmount === 0) continue;

      const merchantName = descCol !== -1 && cells[descCol] ? cells[descCol].trim() : 'עסקה ללא שם';
      const rawCategory = categoryCol !== -1 && cells[categoryCol] ? cells[categoryCol].trim() : '';
      const rawRef = refCol !== -1 && cells[refCol] ? cells[refCol].trim() : '';

      const tx = buildTransactionObject({
        date: normalizedDate,
        billingDate: normalizedBillingDate,
        amount: txAmount,
        merchant: merchantName,
        description: merchantName,
        rawCategory,
        ref: rawRef,
        isCreditRow,
        isDebitRow,
        amountIsNegative,
        institutionInfo,
        sourceFileName: fileName,
      });

      allTransactions.push(tx);
    }
  }

  if (allTransactions.length === 0) {
    return {
      success: false,
      transactions: [],
      institution: institutionInfo.name,
      error: 'לא זוהו עסקאות תקינות בטבלת ה-HTML.',
    };
  }

  allTransactions.sort((a, b) => b.date.localeCompare(a.date));

  return {
    success: true,
    transactions: allTransactions,
    institution: institutionInfo.name,
    processingMethod: 'פענוח HTML טבלאי',
    earliestDate: allTransactions[allTransactions.length - 1].date,
    latestDate: allTransactions[0].date,
    totalIncome: allTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    totalExpense: allTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
  };
}

// -------------------------------------------------------------
// 9. OFX / QFX / XML PARSER
// -------------------------------------------------------------
export function parseOfxContent(text: string, fileName: string): ParseResult {
  const institutionInfo = detectInstitution(text, fileName);
  const transactions: Transaction[] = [];

  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|$))/gi;
  let match: RegExpExecArray | null;

  while ((match = stmtTrnRegex.exec(text)) !== null) {
    const block = match[1];

    const trnType = (block.match(/<TRNTYPE>([^<\r\n]+)/i)?.[1] || '').trim().toUpperCase();
    const dtPosted = (block.match(/<DTPOSTED>([^<\r\n]+)/i)?.[1] || '').trim();
    const trnAmt = (block.match(/<TRNAMT>([^<\r\n]+)/i)?.[1] || '').trim();
    const fitId = (block.match(/<FITID>([^<\r\n]+)/i)?.[1] || '').trim();
    const name = (block.match(/<NAME>([^<\r\n]+)/i)?.[1] || '').trim();
    const memo = (block.match(/<MEMO>([^<\r\n]+)/i)?.[1] || '').trim();

    if (!dtPosted || !trnAmt) continue;

    const dateMatch = dtPosted.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!dateMatch) continue;
    const normalizedDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;

    const numAmt = parseFloat(trnAmt);
    if (isNaN(numAmt) || numAmt === 0) continue;

    const isCreditRow = trnType === 'CREDIT' || trnType === 'DEP' || numAmt > 0;
    const merchantName = name || memo || 'עסקה ללא שם';

    const tx = buildTransactionObject({
      date: normalizedDate,
      amount: Math.abs(numAmt),
      merchant: merchantName,
      description: memo ? `${merchantName} (${memo})` : merchantName,
      ref: fitId,
      isCreditRow,
      isDebitRow: !isCreditRow,
      amountIsNegative: numAmt < 0,
      institutionInfo,
      sourceFileName: fileName,
    });

    transactions.push(tx);
  }

  if (transactions.length === 0) {
    return {
      success: false,
      transactions: [],
      institution: institutionInfo.name,
      error: 'לא זוהו עסקאות תקינות בקובץ OFX/QFX.',
    };
  }

  transactions.sort((a, b) => b.date.localeCompare(a.date));

  return {
    success: true,
    transactions,
    institution: institutionInfo.name,
    processingMethod: 'פענוח OFX/QFX ישיר',
    earliestDate: transactions[transactions.length - 1].date,
    latestDate: transactions[0].date,
    totalIncome: transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    totalExpense: transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
  };
}

// -------------------------------------------------------------
// 10. JSON PARSER
// -------------------------------------------------------------
export function parseJsonContent(text: string, fileName: string): ParseResult {
  try {
    const data = JSON.parse(text);
    const institutionInfo = detectInstitution(text, fileName);

    let rawList: any[] = [];
    if (Array.isArray(data)) {
      rawList = data;
    } else if (Array.isArray(data.transactions)) {
      rawList = data.transactions;
    } else if (Array.isArray(data.data)) {
      rawList = data.data;
    } else if (Array.isArray(data.records)) {
      rawList = data.records;
    } else if (Array.isArray(data.items)) {
      rawList = data.items;
    } else if (Array.isArray(data.extractedTransactions)) {
      rawList = data.extractedTransactions;
    }

    if (rawList.length === 0) {
      return {
        success: false,
        transactions: [],
        institution: institutionInfo.name,
        error: 'מבנה ה-JSON אינו מכיל מערך עסקאות.',
      };
    }

    const transactions: Transaction[] = [];

    for (const item of rawList) {
      if (!item || typeof item !== 'object') continue;

      const rawDate =
        item.date ||
        item.transactionDate ||
        item.txDate ||
        item['תאריך'] ||
        item['תאריך עסקה'] ||
        item.Date;
      const normalizedDate = normalizeDate(rawDate);
      if (!normalizedDate) continue;

      const rawBillingDate = item.billingDate || item.valueDate || item['תאריך חיוב'] || item['ת.חיוב'];
      const normalizedBillingDate = rawBillingDate ? normalizeDate(rawBillingDate) : undefined;

      const rawAmt =
        item.amount ??
        item.sum ??
        item.total ??
        item['סכום'] ??
        item['סכום חיוב'] ??
        item['סכום עסקה'] ??
        item.Amount;
      const parsedAmt = parseIsraeliAmount(rawAmt);
      if (!parsedAmt || parsedAmt.amount <= 0) continue;

      const merchant = String(
        item.merchant ||
        item.name ||
        item.business ||
        item.payee ||
        item['בית עסק'] ||
        item['תיאור'] ||
        item['פרטים'] ||
        'עסקה ללא שם'
      ).trim();
      const desc = String(item.description || item.details || item.memo || merchant).trim();
      const rawCat = String(item.category || item['קטגוריה'] || '').trim();

      const tx = buildTransactionObject({
        date: normalizedDate,
        billingDate: normalizedBillingDate,
        amount: parsedAmt.amount,
        merchant,
        description: desc,
        rawCategory: rawCat,
        ref: item.id || item.ref,
        isCreditRow: Boolean(item.isCredit || item.isIncome || item.type === 'income'),
        isDebitRow: Boolean(item.isDebit || item.type === 'expense'),
        amountIsNegative: parsedAmt.isNegative || Boolean(item.isRefund || item.type === 'refund'),
        institutionInfo,
        sourceFileName: fileName,
      });

      transactions.push(tx);
    }

    if (transactions.length === 0) {
      return {
        success: false,
        transactions: [],
        institution: institutionInfo.name,
        error: 'לא חולצו עסקאות תקינות מקובץ ה-JSON.',
      };
    }

    transactions.sort((a, b) => b.date.localeCompare(a.date));

    return {
      success: true,
      transactions,
      institution: institutionInfo.name,
      processingMethod: 'פענוח JSON ישיר',
      earliestDate: transactions[transactions.length - 1].date,
      latestDate: transactions[0].date,
      totalIncome: transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      totalExpense: transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    };
  } catch (err) {
    return {
      success: false,
      transactions: [],
      institution: 'שגיאה',
      error: `שגיאה בפענוח JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// -------------------------------------------------------------
// 11. ZIP ARCHIVE PARSER
// -------------------------------------------------------------
export async function parseZipFile(file: File): Promise<ParseResult> {
  try {
    const jszip = new JSZip();
    let zip: JSZip;
    try {
      zip = await jszip.loadAsync(file);
    } catch (zipLoadErr: any) {
      if (zipLoadErr && (zipLoadErr.message?.includes('encrypted') || zipLoadErr.message?.includes('password'))) {
        return {
          success: false,
          transactions: [],
          institution: 'ארכיון ZIP',
          error: 'קובץ ה-ZIP מוגן בסיסמה. אנא חלץ את הקבצים והעלה אותם ללא הגנת סיסמה.',
        };
      }
      throw zipLoadErr;
    }

    const extractedFiles: { name: string; file: File }[] = [];

    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue;
      if (
        relativePath.startsWith('__MACOSX/') ||
        relativePath.includes('/.DS_Store') ||
        relativePath.startsWith('.DS_Store')
      )
        continue;

      const blob = await zipEntry.async('blob');
      const innerName = relativePath.split('/').pop() || relativePath;
      const innerFile = new File([blob], innerName, { type: blob.type });
      extractedFiles.push({ name: innerName, file: innerFile });
    }

    if (extractedFiles.length === 0) {
      return {
        success: false,
        transactions: [],
        institution: 'ארכיון ZIP',
        error: 'קובץ ה-ZIP ריק או שאינו מכיל קבצים תקפים.',
      };
    }

    const allTransactions: Transaction[] = [];
    const institutionsFound = new Set<string>();
    let totalDuplicatesAcrossFiles = 0;

    for (const item of extractedFiles) {
      if (item.name.toLowerCase().endsWith('.zip')) continue;

      try {
        const res = await parseFinancialDocument(item.file);
        if (res.success && res.transactions.length > 0) {
          institutionsFound.add(res.institution);
          const dedup = deduplicateTransactions(allTransactions, res.transactions);
          allTransactions.push(...dedup.uniqueTxs);
          totalDuplicatesAcrossFiles += dedup.duplicatesCount;
        }
      } catch (innerErr) {
        console.warn(`Failed parsing inner file ${item.name} inside zip:`, innerErr);
      }
    }

    if (allTransactions.length === 0) {
      return {
        success: false,
        transactions: [],
        institution: 'ארכיון ZIP',
        error: 'לא זוהו עסקאות באף אחד מהקבצים שבתוך ארכיון ה-ZIP.',
      };
    }

    allTransactions.sort((a, b) => b.date.localeCompare(a.date));

    return {
      success: true,
      transactions: allTransactions,
      institution: Array.from(institutionsFound).join(', ') || 'ארכיון מסמכים',
      processingMethod: 'חילוץ ועיבוד ארכיון ZIP',
      earliestDate: allTransactions[allTransactions.length - 1].date,
      latestDate: allTransactions[0].date,
      totalIncome: allTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      totalExpense: allTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      duplicatesSkipped: totalDuplicatesAcrossFiles,
    };
  } catch (err) {
    return {
      success: false,
      transactions: [],
      institution: 'ארכיון ZIP',
      error: `שגיאה בחילוץ קובץ ה-ZIP: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// -------------------------------------------------------------
// 12. IMAGE PARSER (Receipts, Invoices, Slips: JPG, PNG, WEBP)
// -------------------------------------------------------------
export async function parseImageFile(file: File): Promise<ParseResult> {
  try {
    const buffer = await file.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);

    const response = await fetch('/api/ai/parse-document', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: file.name,
        fileType: 'image',
        fileSize: file.size,
        fileBase64: base64,
      }),
    });

    if (!response.ok) {
      throw new Error(`שרת החזיר קוד שגיאה: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !Array.isArray(data.extractedTransactions) || data.extractedTransactions.length === 0) {
      return {
        success: false,
        transactions: [],
        institution: data.detectedInstitution || 'תמונה פיננסית',
        error: data.message || data.error || 'לא זוהו עסקאות בתמונה זו.',
      };
    }

    const instInfo = detectInstitution(data.detectedInstitution || '', file.name);

    const transactions: Transaction[] = data.extractedTransactions.map((item: any) => {
      const normalizedDate = normalizeDate(item.date) || new Date().toISOString().split('T')[0];
      const normalizedBillingDate = item.billingDate ? normalizeDate(item.billingDate) : undefined;
      const parsedAmount = parseIsraeliAmount(item.amount) || { amount: Math.abs(Number(item.amount) || 0), isNegative: false };
      const merchant = String(item.merchant || item.description || 'עסקה').trim();
      const rawCategory = String(item.category || '').trim();

      return buildTransactionObject({
        date: normalizedDate,
        billingDate: normalizedBillingDate,
        amount: parsedAmount.amount,
        merchant,
        description: item.description || merchant,
        rawCategory,
        isCreditRow: item.type === 'income' || item.isCredit,
        isDebitRow: item.type === 'expense' || !item.isCredit,
        amountIsNegative: parsedAmount.isNegative || item.type === 'refund',
        institutionInfo: instInfo,
        sourceFileName: file.name,
      });
    });

    transactions.sort((a, b) => b.date.localeCompare(a.date));

    return {
      success: true,
      transactions,
      institution: data.detectedInstitution || instInfo.name,
      processingMethod: 'OCR חזותי לתמונה (Gemini AI)',
      earliestDate: transactions[transactions.length - 1]?.date,
      latestDate: transactions[0]?.date,
      totalIncome: transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      totalExpense: transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    };
  } catch (err) {
    return {
      success: false,
      transactions: [],
      institution: 'תמונה',
      error: `שגיאה בפענוח תמונה: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// -------------------------------------------------------------
// 13. PDF PARSER (Server API with Multimodal & Text Support)
// -------------------------------------------------------------
export async function parsePdfFile(file: File): Promise<ParseResult> {
  try {
    const buffer = await file.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);

    const response = await fetch('/api/ai/parse-document', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: file.name,
        fileType: 'pdf',
        fileSize: file.size,
        fileBase64: base64,
      }),
    });

    if (!response.ok) {
      throw new Error(`שרת החזיר קוד שגיאה: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !Array.isArray(data.extractedTransactions) || data.extractedTransactions.length === 0) {
      return {
        success: false,
        transactions: [],
        institution: data.detectedInstitution || 'קובץ PDF',
        error: data.message || data.error || 'לא זוהו עסקאות במסמך ה-PDF שהועלה.',
      };
    }

    const instInfo = detectInstitution(data.detectedInstitution || '', file.name);

    const transactions: Transaction[] = data.extractedTransactions.map((item: any) => {
      const normalizedDate = normalizeDate(item.date) || new Date().toISOString().split('T')[0];
      const normalizedBillingDate = item.billingDate ? normalizeDate(item.billingDate) : undefined;
      const parsedAmount = parseIsraeliAmount(item.amount) || {
        amount: Math.abs(Number(item.amount) || 0),
        isNegative: false,
      };
      const merchant = String(item.merchant || item.description || 'עסקה ללא שם').trim();
      const rawCategory = String(item.category || '').trim();

      return buildTransactionObject({
        date: normalizedDate,
        billingDate: normalizedBillingDate,
        amount: parsedAmount.amount,
        merchant,
        description: item.description || merchant,
        rawCategory,
        isCreditRow: item.type === 'income' || Boolean(item.isCredit),
        isDebitRow: item.type === 'expense' || (!item.isCredit && item.type !== 'income'),
        amountIsNegative: parsedAmount.isNegative || item.type === 'refund',
        institutionInfo: instInfo,
        sourceFileName: file.name,
      });
    });

    transactions.sort((a, b) => b.date.localeCompare(a.date));

    return {
      success: true,
      transactions,
      institution: data.detectedInstitution || instInfo.name,
      processingMethod: data.processingMethod || (data.isVisualDocument ? 'OCR חזותי (Gemini AI)' : 'פענוח שכבת טקסט'),
      earliestDate: transactions[transactions.length - 1]?.date,
      latestDate: transactions[0]?.date,
      totalIncome: transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      totalExpense: transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    };
  } catch (err) {
    console.error('PDF parsing error:', err);
    return {
      success: false,
      transactions: [],
      institution: 'קובץ PDF',
      error: `שגיאה בפענוח קובץ ה-PDF: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// -------------------------------------------------------------
// 14. MASTER DISPATCHER & FORMAT IDENTIFIER
// -------------------------------------------------------------
export async function parseFinancialDocument(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase();

  // 1. Image formats
  if (name.match(/\.(jpg|jpeg|png|webp)$/i) || (file.type && file.type.startsWith('image/'))) {
    return parseImageFile(file);
  }

  // 2. Read preview bytes to sniff content signature
  let headerPrefix = '';
  try {
    const slice = file.slice(0, 2048);
    headerPrefix = await slice.text();
  } catch {
    // ignore
  }

  const prefixTrimmed = headerPrefix.trim();

  // 3. PDF
  if (name.endsWith('.pdf') || prefixTrimmed.startsWith('%PDF')) {
    return parsePdfFile(file);
  }

  // 4. HTML tables (including bank exports named .xls or .csv that are actually HTML tables)
  if (
    name.endsWith('.html') ||
    name.endsWith('.htm') ||
    (file.type && file.type.includes('html')) ||
    prefixTrimmed.toLowerCase().startsWith('<!doctype html') ||
    prefixTrimmed.toLowerCase().startsWith('<html') ||
    prefixTrimmed.toLowerCase().includes('<table')
  ) {
    return parseHtmlFile(file);
  }

  // 5. OFX / QFX / XML
  if (
    name.endsWith('.ofx') ||
    name.endsWith('.qfx') ||
    name.endsWith('.xml') ||
    prefixTrimmed.includes('OFXHEADER') ||
    prefixTrimmed.includes('<OFX>') ||
    prefixTrimmed.includes('<STMTTRN>')
  ) {
    const arrayBuffer = await file.arrayBuffer();
    const text = await decodeTextBuffer(arrayBuffer);
    return parseOfxContent(text, file.name);
  }

  // 6. JSON
  if (name.endsWith('.json') || prefixTrimmed.startsWith('{') || prefixTrimmed.startsWith('[')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const text = await decodeTextBuffer(arrayBuffer);
      return parseJsonContent(text, file.name);
    } catch {
      // not valid json
    }
  }

  // 7. ZIP Archive
  if (name.endsWith('.zip')) {
    return parseZipFile(file);
  }

  // 8. Excel Spreadsheets (.xlsx, .xls, .xlsm, .xlsb, .ods)
  if (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    name.endsWith('.xlsm') ||
    name.endsWith('.xlsb') ||
    name.endsWith('.ods')
  ) {
    return parseExcelFile(file);
  }

  // 9. Delimited / Text files (.csv, .tsv, .txt)
  if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) {
    return parseCsvFile(file);
  }

  // 10. Fallbacks: Try CSV first, then Excel
  try {
    const csvRes = await parseCsvFile(file);
    if (csvRes.success && csvRes.transactions.length > 0) {
      return csvRes;
    }
  } catch {
    // continue
  }

  try {
    const excelRes = await parseExcelFile(file);
    if (excelRes.success && excelRes.transactions.length > 0) {
      return excelRes;
    }
  } catch {
    // continue
  }

  return {
    success: false,
    transactions: [],
    institution: 'פורמט לא נתמך',
    error: `לא ניתן היה לפענח את הקובץ ${file.name}. המערכת תומכת ב-Excel, CSV, PDF, HTML, JSON, OFX, XML, תמונות וארכיוני ZIP.`,
  };
}

// -------------------------------------------------------------
// 15. CONSERVATIVE DEDUPLICATION & PROVENANCE PRESERVATION
// -------------------------------------------------------------
export function deduplicateTransactions(
  existingTxs: Transaction[],
  newTxs: Transaction[]
): {
  uniqueTxs: Transaction[];
  duplicatesCount: number;
  updatedExistingTxs: Transaction[];
  candidatesForReview?: DuplicateCandidate[];
} {
  const normalizeMerchant = (m: string) =>
    (m || '')
      .toLowerCase()
      .replace(/(\*\*\*\d+|\d{4}$|כרטיס\s*\d+|סניף\s*\d+|בע"?מ|ltd|inc)/gi, '')
      .replace(/["'״׳\-–_.,()/\\:;#]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  // Helper to extract clean reference code if any
  const extractRef = (tx: Transaction): string => {
    const raw = `${tx.description || ''} ${tx.rawText || ''}`;
    const m = raw.match(/אסמכתא[:\s]+([0-9a-zA-Z\-_/]+)/);
    if (m && m[1]) return m[1].replace(/[^0-9a-zA-Z]/g, '');
    const m2 = raw.match(/ref[:\s]+([0-9a-zA-Z\-_/]+)/i);
    if (m2 && m2[1]) return m2[1].replace(/[^0-9a-zA-Z]/g, '');
    return '';
  };

  // Helper: check if transaction represents a refund/credit
  const isRefundOrCredit = (t: Transaction): boolean => {
    return t.type === 'refund' || t.category === 'החזרים וזיכויים' || t.amount < 0;
  };

  // Helper: check if two document names indicate copies of the same document
  const isSameSourceDocument = (docA?: string, docB?: string): boolean => {
    if (!docA || !docB) return false;
    if (docA === docB) return true;
    const clean = (name: string) =>
      name
        .toLowerCase()
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/[\s_\-]*copy[\s_\-]*\d*/gi, '')
        .replace(/[\s_\-]*\(\d+\)/g, '')
        .replace(/[\s_\-]*duplicate/gi, '')
        .replace(/[\s_\-]*עותק/gi, '')
        .replace(/[\s_\-]+\d+$/g, '')
        .trim();
    const cA = clean(docA);
    const cB = clean(docB);
    return Boolean(cA && cB && cA === cB);
  };

  // Shallow copy existing transactions to allow non-destructive updates
  const updatedExisting: Transaction[] = existingTxs.map((t) => ({ ...t }));

  // 1. Index existing transactions by IdempotencyKey, References, and Date+Amount
  const existingIdempotencySet = new Set<string>();
  const existingIdempotencyMap = new Map<string, Transaction>();
  const existingRefMap = new Map<string, Transaction[]>();
  const dateAmountMap = new Map<string, Transaction[]>();
  const strongMap = new Map<string, Transaction[]>();
  const existingOccTracker = new Map<string, number>();

  for (const t of updatedExisting) {
    let key = t.idempotencyKey;
    if (key) {
      const baseKey = getBaseIdempotencyKey(key);
      const occ = (existingOccTracker.get(baseKey) || 0) + 1;
      existingOccTracker.set(baseKey, occ);

      // If an existing transaction didn't have an occurrence suffix but appears multiple times:
      if (occ > 1 && !key.includes(':occ_')) {
        key = `${baseKey}:occ_${occ}`;
        t.idempotencyKey = key;
        if (t.sourceRecords && t.sourceRecords[0]) {
          t.sourceRecords[0].idempotencyKey = key;
        }
      }

      existingIdempotencySet.add(key);
      existingIdempotencyMap.set(key, t);
    }
    if (t.sourceRecords) {
      for (const sr of t.sourceRecords) {
        if (sr.idempotencyKey) {
          existingIdempotencySet.add(sr.idempotencyKey);
          existingIdempotencyMap.set(sr.idempotencyKey, t);
        }
      }
    }

    // Register reference
    const ref = extractRef(t);
    if (ref && ref.length >= 3) {
      if (!existingRefMap.has(ref)) existingRefMap.set(ref, []);
      existingRefMap.get(ref)!.push(t);
    }

    // Register by date and amount
    const amtStr = Math.abs(t.amount).toFixed(2);
    const daKey = `${t.date}_${amtStr}`;
    if (!dateAmountMap.has(daKey)) dateAmountMap.set(daKey, []);
    dateAmountMap.get(daKey)!.push(t);

    // Register by strong triple (date + amount + normalized merchant)
    const normM = normalizeMerchant(t.merchant);
    const strongKey = `${t.date}_${amtStr}_${normM}`;
    if (!strongMap.has(strongKey)) strongMap.set(strongKey, []);
    strongMap.get(strongKey)!.push(t);
  }

  // Ensure deterministic occurrence indexing for incoming batch of transactions
  assignTransactionOccurrences(newTxs);

  const uniqueTxs: Transaction[] = [];
  let duplicatesCount = 0;
  const candidatesForReview: DuplicateCandidate[] = [];

  for (const incoming of newTxs) {
    // 0. Ensure incoming transaction has valid sourceRecords
    if (!incoming.sourceRecords || incoming.sourceRecords.length === 0) {
      const initSrc: SourceRecord = {
        id: `src-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        sourceDocument: incoming.sourceDocument || 'ייבוא',
        sourceDocumentType: incoming.sourceDocumentType,
        amount: incoming.amount,
        date: incoming.date,
        originalDate: incoming.originalDate || incoming.date,
        description: incoming.description,
        merchant: incoming.merchant,
        accountId: incoming.accountId,
        accountName: incoming.accountName,
        paymentMethod: incoming.paymentMethod,
        importedAt: new Date().toISOString(),
        idempotencyKey: incoming.idempotencyKey,
      };
      incoming.sourceRecords = [initSrc];
    }
    const incomingSourceRecord = incoming.sourceRecords[0];
    const incomingIdemKey = incoming.idempotencyKey || incomingSourceRecord?.idempotencyKey;

    // RULE 1: Exact idempotency hit (re-import of exact identical source row from same document)
    if (incomingIdemKey && existingIdempotencySet.has(incomingIdemKey)) {
      const target = existingIdempotencyMap.get(incomingIdemKey);
      const isRefKey = incomingIdemKey.startsWith('idem:ref:');
      const isSameDoc = isSameSourceDocument(incoming.sourceDocument, target?.sourceDocument);

      // Proven re-import of the SAME document (or copy of it):
      if (isSameDoc) {
        duplicatesCount++;
        if (target) {
          // Safe enrichment of document name if from another file copy
          if (incoming.sourceDocument && target.sourceDocument !== incoming.sourceDocument) {
            if (!target.additionalSources) target.additionalSources = [];
            if (!target.additionalSources.includes(incoming.sourceDocument)) {
              target.additionalSources.push(incoming.sourceDocument);
            }
          }
        }
        continue;
      } else if (!isRefKey) {
        // Different document without reference!
        // Requirement 3: Do NOT automatically drop it! Keep as distinct transaction and flag for review.
        incoming.needsReview = true;
        incoming.reviewReason = `נמצאה עסקה מקבילה במסמך אחר (${target?.sourceDocument || 'מסמך קיים'}) בסכום ₪${Math.abs(incoming.amount).toFixed(2)} בתאריך זה ללא אסמכתא – נשמרה בנפרד לבדיקת משתמש`;
        if (target) {
          candidatesForReview.push({
            existingTransactionId: target.id,
            incomingRecord: incomingSourceRecord,
            confidenceScore: 0.6,
            matchType: 'competing_candidate',
            reasons: [`עסקה זהה בסכום ובתאריך במסמך חופף (${incoming.sourceDocument} מול ${target.sourceDocument}) ללא אסמכתא`],
            suggestedAction: 'review_required',
          });
        }
      }
      // If isRefKey and from a different document, fall through to Evidence Path A to preserve merge provenance!
    }

    // RULE 2: Prevent merging a refund/credit into an expense or vice versa!
    // A refund offsets an expense, it is NEVER a duplicate copy.
    const incomingIsRefund = isRefundOrCredit(incoming);

    const incomingAmtStr = Math.abs(incoming.amount).toFixed(2);
    const incomingNormM = normalizeMerchant(incoming.merchant);
    const incomingRef = extractRef(incoming);

    // Collect merge candidates with clear evidence
    let matchedTarget: Transaction | null = null;
    let matchReason = '';
    let matchConfidence = 0;

    // EVIDENCE PATH A: Reliable Reference Code (אסמכתא)
    if (incomingRef && incomingRef.length >= 3 && existingRefMap.has(incomingRef)) {
      const refMatches = existingRefMap.get(incomingRef)!;
      // Filter out opposing sign (refund vs expense) AND filter out same document rows
      const compatibleMatches = refMatches.filter((m) => {
        if (m.sourceDocument && incoming.sourceDocument && m.sourceDocument === incoming.sourceDocument) {
          return false;
        }
        return isRefundOrCredit(m) === incomingIsRefund;
      });
      if (compatibleMatches.length === 1) {
        // High confidence 1-to-1 match via reference
        const cand = compatibleMatches[0];
        if (Math.abs(cand.amount - incoming.amount) < 0.01) {
          matchedTarget = cand;
          matchReason = `התאמה מלאה באסמכתא משותפת (${incomingRef}) וסכום זהה`;
          matchConfidence = 0.98;
        }
      } else if (compatibleMatches.length > 1) {
        // Competing candidates with the same reference! DO NOT arbitrarily choose.
        incoming.needsReview = true;
        incoming.reviewReason = `זוהו מספר עסקאות עם אותה אסמכתא (${incomingRef}) – נדרשת בדיקה ידנית`;
        candidatesForReview.push({
          existingTransactionId: compatibleMatches[0].id,
          incomingRecord: incomingSourceRecord,
          confidenceScore: 0.5,
          matchType: 'competing_candidate',
          reasons: [`קיימים ${compatibleMatches.length} מועמדים מתחרים בעלי אותה אסמכתא`],
          suggestedAction: 'review_required',
        });
      }
    }

    // EVIDENCE PATH B: Cross-Document Merge between Debit and Bank Account
    if (!matchedTarget && !incoming.needsReview) {
      const daKey = `${incoming.date}_${incomingAmtStr}`;
      const daCandidates = (dateAmountMap.get(daKey) || []).filter(
        (c) => isRefundOrCredit(c) === incomingIsRefund
      );

      if (daCandidates.length > 0) {
        const strongMatches = daCandidates.filter((cand) => {
          // Rule: Two transactions from the SAME document can NEVER be cross-document merged!
          if (cand.sourceDocument && incoming.sourceDocument && cand.sourceDocument === incoming.sourceDocument) {
            return false;
          }

          const candNormM = normalizeMerchant(cand.merchant);
          const isDebitVsBank =
            (incoming.sourceDocumentType === 'credit_card_statement' && cand.sourceDocumentType === 'bank_statement') ||
            (incoming.sourceDocumentType === 'bank_statement' && cand.sourceDocumentType === 'credit_card_statement');

          // Strict evidence check: either debit-vs-bank with generic bank title or cross-document invoice/statement
          const genericBankDebit =
            isDebitVsBank &&
            (candNormM.includes('חיוב כרטיס') ||
              candNormM.includes('עסקה') ||
              candNormM.includes('דביט') ||
              candNormM.includes('תשלום') ||
              incomingNormM.includes('חיוב כרטיס') ||
              incomingNormM.includes('דביט'));

          const isDetailedVsStatement =
            ((incoming.sourceDocumentType === 'detailed_report' && (cand.sourceDocumentType === 'bank_statement' || cand.sourceDocumentType === 'credit_card_statement')) ||
             (cand.sourceDocumentType === 'detailed_report' && (incoming.sourceDocumentType === 'bank_statement' || incoming.sourceDocumentType === 'credit_card_statement'))) &&
            candNormM === incomingNormM;

          return (isDebitVsBank && (candNormM === incomingNormM || genericBankDebit)) || isDetailedVsStatement;
        });

        if (strongMatches.length === 1) {
          // Exactly one candidate meets the evidence threshold
          matchedTarget = strongMatches[0];
          matchReason = `הצלבת מסמכים מאומתת (${matchedTarget.sourceDocumentType || 'בנק'} מול ${incoming.sourceDocumentType || 'פירוט'})`;
          matchConfidence = 0.92;
        } else if (strongMatches.length > 1) {
          // Multiple competing candidates exist! Refuse arbitrary merge.
          incoming.needsReview = true;
          incoming.reviewReason = `נמצאו ${strongMatches.length} עסקאות מתחרות באותו תאריך וסכום – נדרשת בדיקת משתמש`;
          candidatesForReview.push({
            existingTransactionId: strongMatches[0].id,
            incomingRecord: incomingSourceRecord,
            confidenceScore: 0.5,
            matchType: 'competing_candidate',
            reasons: [`קיימים ${strongMatches.length} מועמדים מתחרים עם תאריך וסכום זהים`],
            suggestedAction: 'review_required',
          });
        } else {
          // Candidates exist by date and amount across DIFFERENT documents, but NO verified proof of identical transaction
          // Keep both separate as genuine distinct transactions and flag for user review!
          const crossDocCandidates = daCandidates.filter(
            (c) => c.sourceDocument && incoming.sourceDocument && c.sourceDocument !== incoming.sourceDocument
          );
          if (crossDocCandidates.length > 0) {
            incoming.needsReview = true;
            incoming.reviewReason = `נמצאה עסקה מקבילה במסמך אחר בסכום ₪${Math.abs(incoming.amount).toFixed(2)} בתאריך זה (${crossDocCandidates[0].merchant}) – נשמרה בנפרד לאימות`;
          }
        }
      }
    }

    // EXECUTE MERGE IF CONFIRMED WITH UNAMBIGUOUS EVIDENCE
    if (matchedTarget) {
      duplicatesCount++;

      // Create pre-merge snapshot for full Unmerge support
      const preMergeSnapshot: MergeHistorySnapshot = {
        mergedAt: new Date().toISOString(),
        reason: matchReason,
        confidenceScore: matchConfidence,
        originalTransactions: [
          JSON.parse(JSON.stringify(matchedTarget)),
          JSON.parse(JSON.stringify(incoming)),
        ],
      };

      if (!matchedTarget.mergeHistory) matchedTarget.mergeHistory = [];
      matchedTarget.mergeHistory.push(preMergeSnapshot);

      // Preserve provenance: append sourceRecords
      if (!matchedTarget.sourceRecords) {
        matchedTarget.sourceRecords = [
          {
            id: `src-${matchedTarget.id}`,
            sourceDocument: matchedTarget.sourceDocument || 'קובץ קיים',
            sourceDocumentType: matchedTarget.sourceDocumentType,
            amount: matchedTarget.amount,
            date: matchedTarget.date,
            originalDate: matchedTarget.originalDate || matchedTarget.date,
            description: matchedTarget.description,
            merchant: matchedTarget.merchant,
            accountId: matchedTarget.accountId,
            accountName: matchedTarget.accountName,
            paymentMethod: matchedTarget.paymentMethod,
            importedAt: new Date().toISOString(),
            idempotencyKey: matchedTarget.idempotencyKey,
          },
        ];
      }

      // Add incoming record
      matchedTarget.sourceRecords.push(incomingSourceRecord);

      // Maintain additionalSources list
      if (incoming.sourceDocument && matchedTarget.sourceDocument !== incoming.sourceDocument) {
        if (!matchedTarget.additionalSources) matchedTarget.additionalSources = [];
        if (!matchedTarget.additionalSources.includes(incoming.sourceDocument)) {
          matchedTarget.additionalSources.push(incoming.sourceDocument);
        }
      }

      // Enrich merchant/description if incoming is more specific
      if (
        incoming.merchant &&
        (matchedTarget.merchant.includes('עסקה ללא') ||
          matchedTarget.merchant.includes('חיוב כרטיס') ||
          matchedTarget.merchant === 'עסקה') &&
        incoming.merchant.length > 3
      ) {
        matchedTarget.merchant = incoming.merchant;
        matchedTarget.description = incoming.description;
        matchedTarget.category = incoming.category;
        if (matchedTarget.needsReview && matchedTarget.reviewReason?.includes('חיוב כרטיס אשראי מרוכז')) {
          matchedTarget.needsReview = false;
          matchedTarget.reviewReason = undefined;
        }
      }

      if (incoming.billingDate && !matchedTarget.billingDate) {
        matchedTarget.billingDate = incoming.billingDate;
      }

      // Register incoming idempotency key under target
      if (incomingIdemKey) {
        existingIdempotencySet.add(incomingIdemKey);
        existingIdempotencyMap.set(incomingIdemKey, matchedTarget);
      }
    } else {
      // KEEP AS DISTINCT TRANSACTION
      uniqueTxs.push(incoming);

      // Index newly admitted transaction into maps for subsequent rows in this batch
      if (incomingIdemKey) {
        existingIdempotencySet.add(incomingIdemKey);
        existingIdempotencyMap.set(incomingIdemKey, incoming);
      }
      if (incomingRef && incomingRef.length >= 3) {
        if (!existingRefMap.has(incomingRef)) existingRefMap.set(incomingRef, []);
        existingRefMap.get(incomingRef)!.push(incoming);
      }
      const daKey = `${incoming.date}_${incomingAmtStr}`;
      if (!dateAmountMap.has(daKey)) dateAmountMap.set(daKey, []);
      dateAmountMap.get(daKey)!.push(incoming);

      const strongKey = `${incoming.date}_${incomingAmtStr}_${incomingNormM}`;
      if (!strongMap.has(strongKey)) strongMap.set(strongKey, []);
      strongMap.get(strongKey)!.push(incoming);
    }
  }

  return {
    uniqueTxs,
    duplicatesCount,
    updatedExistingTxs: updatedExisting,
    candidatesForReview,
  };
}
