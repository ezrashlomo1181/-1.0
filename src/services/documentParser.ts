import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { Transaction, TransactionType, ConfidenceLevel, LearnedRule } from '../types/financial';
import { getStoredLearnedRules } from './storage';
import {
  classifyTransactionSemantics,
  validateAndFixTransactionCombination,
} from './classificationEngine';
import {
  identifyDocumentRole,
  reconcileCrossDocumentTransactions,
} from './reconciliationEngine';

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

  // 5. Refunds & Credits Check (Refund decreases expenses, never counted as regular income!)
  if (
    (combined.includes('זיכוי') && !combined.includes('זיכוי שכר')) ||
    combined.includes('החזר כספי') ||
    combined.includes('ביטול עסקה') ||
    combined.includes('החזר חיוב') ||
    combined.includes('זיכוי כרטיס') ||
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

  // 6. Real Income Check (Salary, allowances, pensions, dividends, check deposits)
  if (
    combined.includes('משכורת') ||
    combined.includes('שכר עבודה') ||
    combined.includes('העברת שכר') ||
    combined.includes('שכר חודשי') ||
    combined.includes('זיכוי שכר') ||
    (combined.includes('שכר') && !combined.includes('שכר דירה') && !combined.includes('שכר לימוד') && !combined.includes('שכירות')) ||
    combined.includes('ביטוח לאומי') ||
    combined.includes('קצבת ילדים') ||
    combined.includes('קצבת זקנה') ||
    combined.includes('קצבת נכות') ||
    combined.includes('דמי לידה') ||
    combined.includes('דמי אבטלה') ||
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
  } = params;

  const isCreditCardSource =
    institutionInfo.defaultPayment === 'credit_card' ||
    Boolean(institutionInfo.isCreditCardOnly) ||
    sourceFileName.toLowerCase().includes('אשראי') ||
    sourceFileName.toLowerCase().includes('כרטיס');

  // 1. Central Semantic Classification Engine
  const classification = classifyTransactionSemantics({
    merchant,
    description: description || rawCategory,
    rawCategory,
    isCreditRow,
    isDebitRow,
    amountIsNegative,
    isCreditCardSource,
  });

  // 2. Prevent impossible combinations (e.g. Income + Clothing, Income + Supermarket)
  const validated = validateAndFixTransactionCombination({
    merchant,
    category: rawCategory || classification.category,
    type: classification.type,
  });

  const finalType = validated.type;
  let finalCategory = validated.category;
  if (finalType === 'refund' && (finalCategory === 'אחר / ללא סיווג' || finalCategory === 'כללי')) {
    finalCategory = 'החזרים וזיכויים';
  } else if (finalType === 'income' && (finalCategory === 'אחר / ללא סיווג' || finalCategory === 'כללי')) {
    finalCategory = 'משכורת והכנסות';
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
    description,
    paymentMethod: institutionInfo.defaultPayment,
  } as any);

  // Future-date detection relative to current system date (October 8, 2026)
  const isFuture = Boolean(date && date > '2026-10-08');

  return {
    id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    date,
    originalDate: date,
    billingDate: billingDate || undefined,
    amount: Math.round(amount * 100) / 100,
    currency: 'ILS',
    merchant: merchant || 'עסקה ללא שם',
    description: ref ? `${merchant} (אסמכתא: ${ref})` : (description || merchant),
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

    // Check if row is a section header row
    let fDate = -1;
    let fBillingDate = -1;
    let fDesc = -1;
    let fAmount = -1;
    let fBillingAmount = -1;
    let fDebit = -1;
    let fCredit = -1;
    let fCat = -1;
    let fRef = -1;

    row.forEach((colText, idx) => {
      const t = colText.toLowerCase();

      // 1. Billing / Value date
      if (
        t.includes('תאריך חיוב') ||
        t.includes('תאריך החיוב') ||
        t.includes('מועד חיוב') ||
        t.includes('מועד החיוב') ||
        t.includes('ת.חיוב') ||
        t.includes('תאריך ערך') ||
        t.includes('תאריך הערך') ||
        t.includes('מועד ערך') ||
        t.includes('ת.ערך') ||
        t.includes('billing date') ||
        t.includes('value date') ||
        t.includes('due date')
      ) {
        fBillingDate = idx;
      }
      // 2. Transaction / Purchase date
      else if (
        t.includes('תאריך רכישה') ||
        t.includes('תאריך קניה') ||
        t.includes('מועד רכישה') ||
        t.includes('מועד עסקה') ||
        t.includes('תאריך פעולה') ||
        t.includes('תאריך ביצוע') ||
        t.includes('תאריך עסקה') ||
        t.includes('תאריך העסקה') ||
        t.includes('ת.עסקה') ||
        t.includes('ת.רכישה') ||
        t.includes('תאריך רישום') ||
        t.includes('תאריך הצגה') ||
        t.includes('תאריך') ||
        t === 'date' ||
        t === 'transaction date' ||
        t === 'יום'
      ) {
        fDate = idx;
      }
      // 3. Merchant / Description
      else if (
        t.includes('שם בית עסק') ||
        t.includes('שם בית העסק') ||
        t.includes('שם ספק') ||
        t.includes('שם העסק') ||
        t.includes('בית עסק') ||
        t.includes('פרטי עסקה') ||
        t.includes('פרטי פעולה') ||
        t.includes('פירוט פעולה') ||
        t.includes('פירוט עסקה') ||
        t.includes('פירוט') ||
        t.includes('תיאור') ||
        t.includes('פעולה') ||
        t.includes('שם הפעולה') ||
        t.includes('תיאור הפעולה') ||
        t.includes('פרטים') ||
        t.includes('ספק') ||
        t.includes('merchant') ||
        t.includes('description') ||
        t.includes('details')
      ) {
        fDesc = idx;
      }
      // 4. Debit column
      else if (
        t.includes('חובה') ||
        t.includes('סכום חובה') ||
        t.includes('משיכה') ||
        t === 'debit'
      ) {
        fDebit = idx;
      }
      // 5. Credit column
      else if (
        t.includes('זכות') ||
        t.includes('סכום זכות') ||
        t.includes('זיכוי') ||
        t.includes('הפקדה') ||
        t.includes('הכנסה') ||
        t === 'credit' ||
        t === 'deposit'
      ) {
        fCredit = idx;
      }
      // 6. Billing amount (Actual ILS charge on Israeli cards)
      else if (
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
        fBillingAmount = idx;
      }
      // 7. Original / General amount
      else if (
        t.includes('סכום עסקה') ||
        t.includes('סכום בעסקה') ||
        t.includes('סכום מקורי') ||
        t.includes('סכום עסקה מקורי') ||
        t.includes('סכום') ||
        t === 'amount'
      ) {
        fAmount = idx;
      }
      // 8. Category / Sector
      else if (
        t.includes('קטגוריה') ||
        t.includes('ענף') ||
        t.includes('סוג עסקה') ||
        t.includes('סוג פעולה') ||
        t.includes('category')
      ) {
        fCat = idx;
      }
      // 9. Reference / Voucher
      else if (
        t.includes('אסמכתא') ||
        t.includes('שובר') ||
        t.includes('מספר שובר') ||
        t.includes('מספר אסמכתא') ||
        t.includes('ref') ||
        t.includes('voucher')
      ) {
        fRef = idx;
      }
    });

    // If row matches header criteria, update active mappings
    if (
      (fDate !== -1 || fBillingDate !== -1) &&
      (fDesc !== -1 || fAmount !== -1 || fBillingAmount !== -1 || fDebit !== -1 || fCredit !== -1)
    ) {
      activeDateCol = fDate !== -1 ? fDate : fBillingDate;
      activeBillingDateCol = fBillingDate;
      if (fDesc !== -1) activeDescCol = fDesc;
      if (fBillingAmount !== -1) activeBillingAmountCol = fBillingAmount;
      if (fAmount !== -1) activeAmountCol = fAmount;
      if (fDebit !== -1) activeDebitCol = fDebit;
      if (fCredit !== -1) activeCreditCol = fCredit;
      if (fCat !== -1) activeCategoryCol = fCat;
      if (fRef !== -1) activeRefCol = fRef;
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
      }
    }

    if (!foundValidAmount || txAmount === 0) continue;

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

    // Check if line is a header row
    let fDate = -1;
    let fBillingDate = -1;
    let fDesc = -1;
    let fAmount = -1;
    let fBillingAmount = -1;
    let fDebit = -1;
    let fCredit = -1;
    let fCat = -1;
    let fRef = -1;

    cols.forEach((col, idx) => {
      const c = col.toLowerCase();
      if (
        c.includes('תאריך חיוב') ||
        c.includes('תאריך החיוב') ||
        c.includes('מועד חיוב') ||
        c.includes('מועד החיוב') ||
        c.includes('ת.חיוב') ||
        c.includes('תאריך ערך') ||
        c.includes('תאריך הערך') ||
        c.includes('מועד ערך') ||
        c.includes('ת.ערך') ||
        c.includes('billing date') ||
        c.includes('value date') ||
        c.includes('due date')
      ) {
        fBillingDate = idx;
      } else if (
        c.includes('תאריך רכישה') ||
        c.includes('תאריך קניה') ||
        c.includes('מועד רכישה') ||
        c.includes('מועד עסקה') ||
        c.includes('תאריך פעולה') ||
        c.includes('תאריך ביצוע') ||
        c.includes('תאריך עסקה') ||
        c.includes('תאריך העסקה') ||
        c.includes('ת.עסקה') ||
        c.includes('ת.רכישה') ||
        c.includes('תאריך רישום') ||
        c.includes('תאריך הצגה') ||
        c.includes('תאריך') ||
        c === 'date' ||
        c === 'transaction date' ||
        c === 'יום'
      ) {
        fDate = idx;
      } else if (
        c.includes('שם בית עסק') ||
        c.includes('שם בית העסק') ||
        c.includes('שם ספק') ||
        c.includes('שם העסק') ||
        c.includes('בית עסק') ||
        c.includes('פרטי עסקה') ||
        c.includes('פרטי פעולה') ||
        c.includes('פירוט פעולה') ||
        c.includes('פירוט עסקה') ||
        c.includes('פירוט') ||
        c.includes('תיאור') ||
        c.includes('פעולה') ||
        c.includes('שם הפעולה') ||
        c.includes('תיאור הפעולה') ||
        c.includes('פרטים') ||
        c.includes('ספק') ||
        c.includes('merchant') ||
        c.includes('description') ||
        c.includes('business')
      ) {
        fDesc = idx;
      } else if (
        c.includes('חובה') ||
        c.includes('סכום חובה') ||
        c.includes('משיכה') ||
        c === 'debit'
      ) {
        fDebit = idx;
      } else if (
        c.includes('זכות') ||
        c.includes('סכום זכות') ||
        c.includes('זיכוי') ||
        c.includes('הפקדה') ||
        c.includes('הכנסה') ||
        c === 'credit'
      ) {
        fCredit = idx;
      } else if (
        c.includes('סכום חיוב') ||
        c.includes('סכום לחיוב') ||
        c.includes('סכום לתשלום') ||
        c.includes('סכום בפועל') ||
        c.includes('סכום בש"ח') ||
        c.includes('סכום בשח') ||
        c.includes('סכום חיוב בש"ח') ||
        c.includes('סכום חיוב בשח')
      ) {
        fBillingAmount = idx;
      } else if (
        c.includes('סכום עסקה') ||
        c.includes('סכום בעסקה') ||
        c.includes('סכום מקורי') ||
        c.includes('סכום עסקה מקורי') ||
        c.includes('סכום') ||
        c === 'amount'
      ) {
        fAmount = idx;
      } else if (c.includes('קטגוריה') || c.includes('ענף') || c.includes('סוג עסקה')) {
        fCat = idx;
      } else if (c.includes('אסמכתא') || c.includes('שובר') || c.includes('מספר שובר') || c.includes('ref')) {
        fRef = idx;
      }
    });

    if (
      (fDate !== -1 || fBillingDate !== -1) &&
      (fDesc !== -1 || fAmount !== -1 || fBillingAmount !== -1 || fDebit !== -1 || fCredit !== -1)
    ) {
      activeDateCol = fDate !== -1 ? fDate : fBillingDate;
      activeBillingDateCol = fBillingDate;
      if (fDesc !== -1) activeDescCol = fDesc;
      if (fBillingAmount !== -1) activeBillingAmountCol = fBillingAmount;
      if (fAmount !== -1) activeAmountCol = fAmount;
      if (fDebit !== -1) activeDebitCol = fDebit;
      if (fCredit !== -1) activeCreditCol = fCredit;
      if (fCat !== -1) activeCategoryCol = fCat;
      if (fRef !== -1) activeRefCol = fRef;
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
      let fDate = -1;
      let fBillingDate = -1;
      let fDesc = -1;
      let fAmount = -1;
      let fDebit = -1;
      let fCredit = -1;

      cells.forEach((text, idx) => {
        const t = text.toLowerCase();
        if (
          t.includes('תאריך חיוב') ||
          t.includes('מועד חיוב') ||
          t.includes('ת.חיוב') ||
          t.includes('billing date') ||
          t.includes('value date')
        ) {
          fBillingDate = idx;
        } else if (
          t.includes('תאריך רכישה') ||
          t.includes('תאריך עסקה') ||
          t.includes('מועד רכישה') ||
          t.includes('ת.עסקה') ||
          t.includes('תאריך') ||
          t === 'date'
        ) {
          fDate = idx;
        } else if (
          t.includes('שם בית עסק') ||
          t.includes('בית עסק') ||
          t.includes('שם ספק') ||
          t.includes('תיאור') ||
          t.includes('פרטים') ||
          t.includes('פעולה') ||
          t.includes('merchant') ||
          t.includes('description')
        ) {
          fDesc = idx;
        } else if (t.includes('חובה') || t.includes('חיוב') || t === 'debit') {
          fDebit = idx;
        } else if (t.includes('זכות') || t.includes('זיכוי') || t.includes('הפקדה') || t.includes('הכנסה') || t === 'credit') {
          fCredit = idx;
        } else if (t.includes('סכום') || t === 'amount') {
          fAmount = idx;
        } else if (t.includes('קטגוריה') || t.includes('ענף')) {
          categoryCol = idx;
        } else if (t.includes('אסמכתא') || t.includes('שובר')) {
          refCol = idx;
        }
      });

      if ((fDate !== -1 || fBillingDate !== -1) && (fDesc !== -1 || fAmount !== -1 || fDebit !== -1 || fCredit !== -1)) {
        headerIndex = i;
        dateCol = fDate !== -1 ? fDate : fBillingDate;
        billingDateCol = fBillingDate;
        descCol = fDesc;
        amountCol = fAmount;
        debitCol = fDebit;
        creditCol = fCredit;
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
): { uniqueTxs: Transaction[]; duplicatesCount: number; updatedExistingTxs?: Transaction[] } {
  const normalizeMerchant = (m: string) =>
    (m || '')
      .toLowerCase()
      .replace(/(\*\*\*\d+|\d{4}$|כרטיס\s*\d+|סניף\s*\d+|בע"?מ|ltd|inc)/gi, '')
      .replace(/["'״׳\-–_.,()/\\:;#]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  // Index existing transactions
  const strongMap = new Map<string, Transaction>();
  const dateAmountMap = new Map<string, Transaction[]>();
  const billingAmountMap = new Map<string, Transaction[]>();

  for (const t of existingTxs) {
    const normM = normalizeMerchant(t.merchant);
    const amtStr = t.amount.toFixed(2);
    const key = `${t.date}_${amtStr}_${normM}`;
    strongMap.set(key, t);

    const daKey = `${t.date}_${amtStr}`;
    if (!dateAmountMap.has(daKey)) {
      dateAmountMap.set(daKey, []);
    }
    dateAmountMap.get(daKey)!.push(t);

    if (t.billingDate) {
      const bKey = `${t.billingDate}_${amtStr}`;
      if (!billingAmountMap.has(bKey)) {
        billingAmountMap.set(bKey, []);
      }
      billingAmountMap.get(bKey)!.push(t);
    }
  }

  const uniqueTxs: Transaction[] = [];
  let duplicatesCount = 0;

  for (const t of newTxs) {
    const normM = normalizeMerchant(t.merchant);
    const amtStr = t.amount.toFixed(2);
    const strongKey = `${t.date}_${amtStr}_${normM}`;

    // Helper: merge metadata into canonical record
    const mergeIntoCanonical = (target: Transaction, source: Transaction) => {
      duplicatesCount++;
      if (source.sourceDocument && source.sourceDocument !== target.sourceDocument) {
        if (!target.additionalSources) target.additionalSources = [];
        if (!target.additionalSources.includes(source.sourceDocument)) {
          target.additionalSources.push(source.sourceDocument);
        }
      }
      if (source.billingDate && !target.billingDate) {
        target.billingDate = source.billingDate;
      }
      // If new transaction has a longer/richer merchant name, update it
      if (source.merchant.length > target.merchant.length && target.merchant.includes('עסקה ללא')) {
        target.merchant = source.merchant;
        target.description = source.description;
      }
    };

    // 1. Direct strong match (identical date + amount + normalized merchant)
    if (strongMap.has(strongKey)) {
      const existing = strongMap.get(strongKey)!;
      mergeIntoCanonical(existing, t);
      continue;
    }

    // 2. Strong candidate match on date and amount (merchant substring or containment)
    const daKey = `${t.date}_${amtStr}`;
    const candidates = dateAmountMap.get(daKey);
    let matchedCandidate: Transaction | null = null;

    if (candidates && candidates.length > 0) {
      for (const cand of candidates) {
        const candM = normalizeMerchant(cand.merchant);
        if (
          candM === normM ||
          (candM.length > 2 && normM.length > 2 && (candM.includes(normM) || normM.includes(candM))) ||
          // Generic merchant name matching specific merchant
          ((candM.includes('עסקה') || candM.includes('תשלום') || candM.includes('חיוב')) && normM.length > 2)
        ) {
          matchedCandidate = cand;
          break;
        }
      }
    }

    // 3. Billing date match candidate
    if (!matchedCandidate && t.billingDate) {
      const bKey = `${t.billingDate}_${amtStr}`;
      const bCandidates = billingAmountMap.get(bKey);
      if (bCandidates && bCandidates.length > 0) {
        for (const cand of bCandidates) {
          const candM = normalizeMerchant(cand.merchant);
          if (candM === normM || (candM.length > 2 && normM.length > 2 && (candM.includes(normM) || normM.includes(candM)))) {
            matchedCandidate = cand;
            break;
          }
        }
      }
    }

    if (matchedCandidate) {
      mergeIntoCanonical(matchedCandidate, t);
    } else {
      // 4. Conservative review check: if same date and amount exist but distinct merchants
      if (candidates && candidates.length > 0) {
        // Keep both records to avoid dropping legitimate distinct transactions!
        t.needsReview = true;
        t.reviewReason = `נמצאה עסקה נוספת בסכום ₪${t.amount} בתאריך זה (${candidates[0].merchant}) – נדרש אימות שאינה כפולה`;
      }

      strongMap.set(strongKey, t);
      if (!dateAmountMap.has(daKey)) {
        dateAmountMap.set(daKey, []);
      }
      dateAmountMap.get(daKey)!.push(t);
      if (t.billingDate) {
        const bKey = `${t.billingDate}_${amtStr}`;
        if (!billingAmountMap.has(bKey)) billingAmountMap.set(bKey, []);
        billingAmountMap.get(bKey)!.push(t);
      }
      uniqueTxs.push(t);
    }
  }

  return { uniqueTxs, duplicatesCount, updatedExistingTxs: existingTxs };
}
