import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { Transaction, TransactionType, ConfidenceLevel, LearnedRule } from '../types/financial';
import { getStoredLearnedRules } from './storage';

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
      'וולט', 'wolt', 'תן ביס', '10bis', 'קפה', 'ארומה', 'מקדונלדס', 'פיצה', 'גולדה', 'ריבר', 'מסעדה', 'בר', 'פאב',
      'שווארמה', 'בורגר', 'סושי', 'בלאק', 'bbb', 'לנדוור', 'ארקפה', 'קפית', 'דומינוס', 'גלידה', 'מאפה', 'קופיקס',
      'אגאדיר', 'מוזס', 'ג\'פניקה', 'שגב', 'קפה קפה', 'רולדין', 'לחמים', 'ביגה', 'גרג', 'פאפא ג\'ונס', 'קנטה',
      'סינמה סיטי', 'יס פלאנט', 'קולנוע', 'הוט סינמה', 'זאפה', 'לב דיזנגוף', 'רב חן', 'בראסרי', 'קפה נואר', 'ביסטרו'
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
  // Salary & Genuine Income (Never assume regular line is income unless explicit evidence)
  {
    keywords: [
      'משכורת', 'שכר', 'העברת שכר', 'שכר חודשי', 'משכורת חודשית', 'זיכוי שכר', 'שכר עבודה', 'ביטוח לאומי',
      'קצבה', 'קצבת ילדים', 'קצבת זקנה', 'קצבת נכות', 'דמי לידה', 'דמי אבטלה', 'הפקדת צ\'ק', 'הפקדת שיק', 'הפקדת שק',
      'הפקדת מזומן', 'הפקדה לעו"ש', 'הפקדה עצמית', 'דיבידנד', 'ריבית זכות', 'החזר מס', 'תקבול', 'תקבולים',
      'בונוס', 'מענק', 'מלגה', 'תשלום מלקוח', 'הכנסה עצמאית', 'תקבול מ-'
    ],
    category: 'משכורת והכנסות',
    type: 'income'
  },
  // Refunds & Credits (Refund decreases expenses; NOT counted as regular income!)
  {
    keywords: [
      'זיכוי', 'החזר כספי', 'ביטול עסקה', 'החזר חיוב', 'זיכוי עסקה', 'זיכוי כרטיס', 'refund', 'reversal', 'החזר דמי'
    ],
    category: 'החזרים וזיכויים',
    type: 'refund'
  },
  // Cash & ATM Withdrawals (Crucial: ATM cash withdrawal is an EXPENSE, NOT a transfer!)
  {
    keywords: [
      'משיכת מזומן', 'משיכה בכספומט', 'כספומט', 'בנקומט', 'משיכה במכשיר', 'משיכת מזומנים', 'משיכת שיק עצמי', 'משיכה אוטומטית'
    ],
    category: 'משיכת מזומן',
    type: 'expense'
  },
  // Credit Card Repayments in Bank Statement (Internal Transfer to avoid double-counting card expenses!)
  {
    keywords: [
      'חיוב כרטיס', 'פירעון כרטיס', 'חיוב ויזה', 'חיוב ישראכרט', 'חיוב כאל', 'חיוב מקס', 'חיוב מאסטרקארד',
      'חיוב לאומי קארד', 'הוראת קבע כרטיס אשראי', 'חיוב ח-ן כרטיס', 'הוראת קבע ויזה', 'הוראת קבע ישראכרט'
    ],
    category: 'פירעון כרטיס אשראי',
    type: 'transfer'
  },
  // Inter-account Transfers (Between owner's accounts)
  {
    keywords: [
      'העברה בין חשבונות', 'העברה עצמית', 'העברה מחשבון', 'העברה לחשבון', 'העברה לחיסכון', 'העברה מחיסכון', 'העברה לפיקדון'
    ],
    category: 'העברות ומזומן',
    type: 'transfer'
  }
];

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
      // similar or all_similar: substring or token overlap
      if (
        mClean.includes(pat) ||
        pat.includes(mClean) ||
        combined.includes(pat)
      ) {
        return rule;
      }

      // Check primary words (e.g. "Bit" in "Bit - תשלום")
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

  // 2. ATM Cash Withdrawal Check (High priority: do NOT treat as transfer)
  if (
    combined.includes('כספומט') ||
    combined.includes('בנקומט') ||
    combined.includes('משיכת מזומן') ||
    combined.includes('משיכה במכשיר')
  ) {
    return {
      category: 'משיכת מזומן',
      type: 'expense',
      confidenceScore: 0.95,
      isInternalTransfer: false,
      needsReview: false,
    };
  }

  // 3. Credit Card Settlement Check (Internal transfer to prevent double counting with card statement)
  if (
    combined.includes('חיוב כרטיס') ||
    combined.includes('פירעון כרטיס') ||
    combined.includes('חיוב ויזה') ||
    combined.includes('חיוב ישראכרט') ||
    combined.includes('חיוב כאל') ||
    combined.includes('חיוב מקס') ||
    combined.includes('חיוב מאסטרקארד') ||
    combined.includes('חיוב לאומי קארד') ||
    combined.includes('הוראת קבע כרטיס אשראי')
  ) {
    return {
      category: 'פירעון כרטיס אשראי',
      type: 'transfer',
      confidenceScore: 0.96,
      isInternalTransfer: true,
      needsReview: false,
    };
  }

  // 4. Inter-account Transfers Check
  if (
    combined.includes('העברה בין חשבונות') ||
    combined.includes('העברה עצמית') ||
    combined.includes('העברה מחשבון') ||
    combined.includes('העברה לחשבון')
  ) {
    return {
      category: 'העברות ומזומן',
      type: 'transfer',
      confidenceScore: 0.93,
      isInternalTransfer: true,
      needsReview: false,
    };
  }

  // 5. Refunds & Credits Check
  if (
    (combined.includes('זיכוי') && !combined.includes('זיכוי שכר')) ||
    combined.includes('החזר כספי') ||
    combined.includes('ביטול עסקה') ||
    combined.includes('החזר חיוב') ||
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

  // 6. Real Income Check (Salary, allowances, pensions, dividends)
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
    combined.includes('דיבידנד') ||
    combined.includes('ריבית זכות') ||
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

  // Helper for word-boundary matching especially for short 2-3 letter words
  const matchesKeyword = (text: string, kw: string): boolean => {
    if (kw.length <= 3) {
      const words = text.split(/[\s,.\-_/\\()]+/);
      return words.includes(kw);
    }
    return text.includes(kw);
  };

  // 7. General Categories mapping
  for (const rule of CATEGORY_MAP) {
    for (const kw of rule.keywords) {
      if (matchesKeyword(combined, kw.toLowerCase())) {
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

  // 7. Fallback: conservative classification with needsReview flag
  return {
    category: 'אחר / ללא סיווג',
    type: 'expense',
    confidenceScore: 0.5,
    needsReview: true,
    reviewReason: 'דרוש אימות סיווג קטגוריה וסוג תנועה',
  };
}

// -------------------------------------------------------------
// 3. ROBUST DATE NORMALIZATION
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

export function normalizeDate(raw: any): string | null {
  if (raw === null || raw === undefined) return null;

  // 1. If Date object
  if (raw instanceof Date) {
    if (!isNaN(raw.getTime())) {
      return raw.toISOString().split('T')[0];
    }
  }

  // 2. If Excel serial number (e.g. 45396)
  if (typeof raw === 'number') {
    if (raw > 20000 && raw < 70000) {
      // Excel epoch 1899-12-30
      const date = new Date(Math.round((raw - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }

  const str = String(raw).trim();
  if (!str) return null;

  // Strip timestamps e.g. "2024-05-14 10:20:30" or "14/05/2024 10:20"
  const cleanStr = str.replace(/T.*$/, '').split(/\s+/)[0];

  // Regex ISO: YYYY-MM-DD
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

  // Regex DD/MM/YY (2-digit year)
  const dmyShortMatch = cleanStr.match(/^(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](\d{2})$/);
  if (dmyShortMatch) {
    const d = dmyShortMatch[1].padStart(2, '0');
    const m = dmyShortMatch[2].padStart(2, '0');
    let y = parseInt(dmyShortMatch[3], 10);
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
    if (isNaN(raw)) return null;
    return {
      amount: Math.abs(raw),
      isNegative: raw < 0,
    };
  }

  let s = String(raw).trim();
  if (!s || s === '-' || s === '--') return null;

  let isNegative = false;
  // Parentheses check e.g. (1,250.00)
  if (s.startsWith('(') && s.endsWith(')')) {
    isNegative = true;
    s = s.slice(1, -1);
  }
  // Trailing or leading minus e.g. -150 or 150-
  if (s.includes('-')) {
    isNegative = true;
    s = s.replace(/-/g, '');
  }

  // Handle European comma/dot if e.g. 1.234,56
  if (/^\d{1,3}(?:\.\d{3})+,\d{2}$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  }

  // Remove currency signs and spaces
  s = s.replace(/[₪$€,\s]/g, '').replace(/ש"?ח/g, '').replace(/NIS/gi, '').replace(/ILS/gi, '');

  const val = parseFloat(s);
  if (isNaN(val) || val === 0) return null;

  return {
    amount: Math.abs(val),
    isNegative,
  };
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

  const classification = categorizeMerchant(merchant, description || rawCategory);

  let txType: TransactionType = classification.type;
  let isInternalTransfer = Boolean(classification.isInternalTransfer);

  if (amountIsNegative) {
    // In credit card, negative amount is a refund; in bank account, negative is usually debit/expense
    if (institutionInfo.defaultPayment === 'credit_card' || classification.type === 'refund') {
      txType = 'refund';
    } else {
      txType = 'expense';
    }
  } else if (isCreditRow) {
    // Row is in a credit/deposit column
    if (classification.type === 'refund' || merchant.includes('זיכוי')) {
      txType = 'refund';
    } else if (classification.type === 'transfer' && isInternalTransfer) {
      txType = 'transfer';
    } else {
      txType = 'income';
    }
  } else if (isDebitRow) {
    // Row is in a debit column
    if (classification.type === 'transfer' && isInternalTransfer) {
      txType = 'transfer';
    } else {
      txType = 'expense';
    }
  }

  let finalCategory = rawCategory || classification.category;
  if (txType === 'income' && (finalCategory === 'אחר / ללא סיווג' || finalCategory === 'כללי')) {
    finalCategory = 'משכורת והכנסות';
  } else if (txType === 'refund' && (finalCategory === 'אחר / ללא סיווג' || finalCategory === 'כללי')) {
    finalCategory = 'החזרים וזיכויים';
  }

  const confidenceLevel: ConfidenceLevel = classification.isUserRule
    ? 'high'
    : classification.confidenceScore > 0.8
    ? 'high'
    : 'medium';

  return {
    id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    date,
    billingDate: billingDate || undefined,
    amount: Math.round(amount * 100) / 100,
    currency: 'ILS',
    merchant: merchant || 'עסקה ללא שם',
    description: ref ? `${merchant} (אסמכתא: ${ref})` : (description || merchant),
    accountId: institutionInfo.accountId,
    accountName: institutionInfo.accountName,
    paymentMethod: institutionInfo.defaultPayment,
    category: finalCategory,
    type: txType,
    isRecurring: false,
    isInternalTransfer,
    confidenceScore: classification.confidenceScore,
    confidenceLevel,
    needsReview: classification.needsReview || (confidenceLevel === 'medium' && !classification.isUserRule),
    reviewReason: classification.reviewReason,
    userConfirmed: confidenceLevel === 'high' || Boolean(classification.isUserRule),
    sourceDocument: sourceFileName,
  };
}

// -------------------------------------------------------------
// 5. EXCEL PARSER (Spreadsheets: .xlsx, .xls, .xlsm, .xlsb, .ods)
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

    // Search across sheets
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        defval: '',
      });

      if (!rawRows || rawRows.length < 2) continue;

      // Extract raw text from top rows to identify institution
      const headerSnippet = rawRows.slice(0, 10).map((r) => r.join(' ')).join(' ');
      const institutionInfo = detectInstitution(headerSnippet, file.name);
      if (!detectedInstName) detectedInstName = institutionInfo.name;

      // Find Header Row
      let headerRowIndex = -1;
      let dateCol = -1;
      let billingDateCol = -1;
      let descCol = -1;
      let amountCol = -1;
      let debitCol = -1;
      let creditCol = -1;
      let categoryCol = -1;
      let refCol = -1;

      for (let r = 0; r < Math.min(rawRows.length, 30); r++) {
        const row = rawRows[r].map((cell) => String(cell || '').trim());

        let foundDate = -1;
        let foundBillingDate = -1;
        let foundDesc = -1;
        let foundAmount = -1;
        let foundDebit = -1;
        let foundCredit = -1;

        row.forEach((colText, idx) => {
          const t = colText.toLowerCase();
          if (
            t.includes('תאריך חיוב') ||
            t.includes('ת.חיוב') ||
            t.includes('תאריך ערך') ||
            t.includes('ת.ערך') ||
            t.includes('billing date') ||
            t.includes('value date')
          ) {
            foundBillingDate = idx;
          } else if (
            t.includes('תאריך') ||
            t.includes('ת.עסקה') ||
            t.includes('תאריך עסקה') ||
            t === 'date'
          ) {
            foundDate = idx;
          } else if (
            t.includes('תיאור') ||
            t.includes('פרטים') ||
            t.includes('בית עסק') ||
            t.includes('שם בית עסק') ||
            t.includes('פעולה') ||
            t.includes('שם בית העסק') ||
            t.includes('merchant') ||
            t.includes('description')
          ) {
            foundDesc = idx;
          } else if (
            t.includes('חובה') ||
            t.includes('סכום חיוב') ||
            t.includes('חיוב') ||
            t === 'debit'
          ) {
            foundDebit = idx;
          } else if (
            t.includes('זכות') ||
            t.includes('סכום זיכוי') ||
            t.includes('זיכוי') ||
            t.includes('הפקדה') ||
            t.includes('הכנסה') ||
            t === 'credit'
          ) {
            foundCredit = idx;
          } else if (
            t.includes('סכום') ||
            t.includes('סכום עסקה') ||
            t === 'amount'
          ) {
            foundAmount = idx;
          } else if (t.includes('קטגוריה') || t.includes('ענף') || t === 'category') {
            categoryCol = idx;
          } else if (t.includes('אסמכתא') || t.includes('מספר שובר') || t.includes('ref')) {
            refCol = idx;
          }
        });

        // A valid header row must have at least Date + (Desc or Amount)
        if (
          (foundDate !== -1 || foundBillingDate !== -1) &&
          (foundDesc !== -1 || foundAmount !== -1 || foundDebit !== -1 || foundCredit !== -1)
        ) {
          headerRowIndex = r;
          dateCol = foundDate !== -1 ? foundDate : foundBillingDate;
          billingDateCol = foundBillingDate !== -1 ? foundBillingDate : -1;
          descCol = foundDesc;
          amountCol = foundAmount;
          debitCol = foundDebit;
          creditCol = foundCredit;
          break;
        }
      }

      // If no explicit header, deduce columns from data rows
      if (headerRowIndex === -1) {
        for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
          const row = rawRows[r];
          if (!row || row.length < 2) continue;
          let possibleDateCol = -1;
          let possibleAmountCol = -1;

          row.forEach((cell, idx) => {
            if (normalizeDate(cell) && possibleDateCol === -1) possibleDateCol = idx;
            else if (parseIsraeliAmount(cell) && possibleAmountCol === -1) possibleAmountCol = idx;
          });

          if (possibleDateCol !== -1 && possibleAmountCol !== -1) {
            headerRowIndex = r - 1;
            dateCol = possibleDateCol;
            amountCol = possibleAmountCol;
            descCol = possibleDateCol === 0 ? 1 : 0;
            break;
          }
        }
      }

      if (headerRowIndex === -1 && dateCol === -1) continue;

      // Parse data rows
      for (let r = Math.max(0, headerRowIndex + 1); r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.length === 0) continue;

        const rawDate = row[dateCol];
        const normalizedDate = normalizeDate(rawDate);
        if (!normalizedDate) continue; // Skip non-data rows

        const rawBillingDate = billingDateCol !== -1 ? row[billingDateCol] : null;
        const normalizedBillingDate = rawBillingDate ? normalizeDate(rawBillingDate) : undefined;

        const rawDesc = descCol !== -1 ? String(row[descCol] || '').trim() : '';
        const rawCategory = categoryCol !== -1 ? String(row[categoryCol] || '').trim() : '';
        const rawRef = refCol !== -1 ? String(row[refCol] || '').trim() : '';

        let txAmount = 0;
        let isCreditRow = false;
        let isDebitRow = false;
        let amountIsNegative = false;
        let foundValidAmount = false;

        // Check Debit vs Credit columns first
        if (debitCol !== -1 || creditCol !== -1) {
          const debitVal = debitCol !== -1 ? parseIsraeliAmount(row[debitCol]) : null;
          const creditVal = creditCol !== -1 ? parseIsraeliAmount(row[creditCol]) : null;

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

        // Check unified amount column
        if (!foundValidAmount && amountCol !== -1) {
          const parsedAmount = parseIsraeliAmount(row[amountCol]);
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
          sourceFileName: file.name,
        });

        allTransactions.push(tx);
      }
    }

    if (allTransactions.length === 0) {
      return {
        success: false,
        transactions: [],
        institution: detectedInstName || 'קובץ אקסל',
        error: 'לא זוהו עסקאות תקינות בתוך קובץ האקסל. ודא כי הקובץ מכיל עמודות תאריך וסכום.',
      };
    }

    // Sort by date descending (newest on top)
    allTransactions.sort((a, b) => b.date.localeCompare(a.date));

    return {
      success: true,
      transactions: allTransactions,
      institution: detectedInstName || 'קובץ אקסל',
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
// 6. CSV & DELIMITED TEXT PARSER (.csv, .tsv, .txt)
// -------------------------------------------------------------
export async function parseCsvFile(file: File): Promise<ParseResult> {
  try {
    let text = await file.text();

    // Check if garbled Hebrew and decode with Windows-1255 if needed
    if (text.includes('') || /[\u0080-\u00FF]/.test(text)) {
      try {
        const buffer = await file.arrayBuffer();
        const decoder = new TextDecoder('windows-1255');
        const decoded = decoder.decode(buffer);
        if (/[\u0590-\u05FF]/.test(decoded)) {
          text = decoded;
        }
      } catch {
        // keep utf-8
      }
    }

    return parseCsvContent(text, file.name);
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
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    return {
      success: false,
      transactions: [],
      institution: 'לא זוהה',
      error: 'קובץ ה-CSV ריק או מכיל שורה בודדת בלבד.',
    };
  }

  // Detect Delimiter: comma, tab, semicolon, pipe
  const sample = lines.slice(0, 10).join('\n');
  const commaCount = (sample.match(/,/g) || []).length;
  const tabCount = (sample.match(/\t/g) || []).length;
  const semiCount = (sample.match(/;/g) || []).length;
  const pipeCount = (sample.match(/\|/g) || []).length;

  let delimiter = ',';
  if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';
  else if (semiCount > commaCount) delimiter = ';';
  else if (pipeCount > commaCount) delimiter = '|';

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
  };

  const institutionInfo = detectInstitution(text, fileName);

  // Find Header Line
  let headerIndex = -1;
  let dateCol = -1;
  let billingDateCol = -1;
  let descCol = -1;
  let amountCol = -1;
  let debitCol = -1;
  let creditCol = -1;
  let categoryCol = -1;
  let refCol = -1;

  for (let i = 0; i < Math.min(lines.length, 35); i++) {
    const cols = parseLine(lines[i]);
    let fDate = -1;
    let fBillingDate = -1;
    let fDesc = -1;
    let fAmount = -1;
    let fDebit = -1;
    let fCredit = -1;

    cols.forEach((col, idx) => {
      const c = col.toLowerCase();
      if (
        c.includes('תאריך חיוב') ||
        c.includes('ת.חיוב') ||
        c.includes('תאריך ערך') ||
        c.includes('ת.ערך') ||
        c.includes('billing date') ||
        c.includes('value date')
      ) {
        fBillingDate = idx;
      } else if (c.includes('תאריך') || c.includes('date') || c.includes('ת.עסקה')) {
        fDate = idx;
      } else if (
        c.includes('תיאור') ||
        c.includes('פרטים') ||
        c.includes('בית עסק') ||
        c.includes('פעולה') ||
        c.includes('merchant') ||
        c.includes('description')
      ) {
        fDesc = idx;
      } else if (c.includes('חובה') || c.includes('חיוב') || c === 'debit') {
        fDebit = idx;
      } else if (
        c.includes('זכות') ||
        c.includes('זיכוי') ||
        c.includes('הפקדה') ||
        c.includes('הכנסה') ||
        c === 'credit'
      ) {
        fCredit = idx;
      } else if (c.includes('סכום') || c === 'amount') {
        fAmount = idx;
      } else if (c.includes('קטגוריה') || c.includes('ענף')) {
        categoryCol = idx;
      } else if (c.includes('אסמכתא') || c.includes('שובר')) {
        refCol = idx;
      }
    });

    if (
      (fDate !== -1 || fBillingDate !== -1) &&
      (fDesc !== -1 || fAmount !== -1 || fDebit !== -1 || fCredit !== -1)
    ) {
      headerIndex = i;
      dateCol = fDate !== -1 ? fDate : fBillingDate;
      billingDateCol = fBillingDate !== -1 ? fBillingDate : -1;
      descCol = fDesc;
      amountCol = fAmount;
      debitCol = fDebit;
      creditCol = fCredit;
      break;
    }
  }

  // Heuristic deduction if header wasn't found by text
  if (headerIndex === -1) {
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const cols = parseLine(lines[i]);
      if (cols.length < 2) continue;
      let pDate = -1;
      let pAmt = -1;

      cols.forEach((col, idx) => {
        if (normalizeDate(col) && pDate === -1) pDate = idx;
        else if (parseIsraeliAmount(col) && pAmt === -1) pAmt = idx;
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

  if (headerIndex === -1 && dateCol === -1) {
    return {
      success: false,
      transactions: [],
      institution: institutionInfo.name,
      error: 'לא זוהו כותרות עמודות תקינות (תאריך, תיאור, סכום) בקובץ ה-CSV.',
    };
  }

  const transactions: Transaction[] = [];

  for (let i = Math.max(0, headerIndex + 1); i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (cols.length <= 1) continue;

    const rawDate = cols[dateCol];
    const normalizedDate = normalizeDate(rawDate);
    if (!normalizedDate) continue;

    const rawBillingDate = billingDateCol !== -1 ? cols[billingDateCol] : null;
    const normalizedBillingDate = rawBillingDate ? normalizeDate(rawBillingDate) : undefined;

    let txAmount = 0;
    let isCreditRow = false;
    let isDebitRow = false;
    let amountIsNegative = false;
    let foundValidAmount = false;

    if (debitCol !== -1 || creditCol !== -1) {
      const debitParsed = debitCol !== -1 ? parseIsraeliAmount(cols[debitCol]) : null;
      const creditParsed = creditCol !== -1 ? parseIsraeliAmount(cols[creditCol]) : null;

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
      const parsed = parseIsraeliAmount(cols[amountCol]);
      if (parsed && parsed.amount > 0) {
        txAmount = parsed.amount;
        amountIsNegative = parsed.isNegative;
        foundValidAmount = true;
      }
    }

    if (!foundValidAmount || txAmount === 0) continue;

    const merchantName = descCol !== -1 && cols[descCol] ? cols[descCol].trim() : 'עסקה ללא שם';
    const rawCategory = categoryCol !== -1 && cols[categoryCol] ? cols[categoryCol].trim() : '';
    const rawRef = refCol !== -1 && cols[refCol] ? cols[refCol].trim() : '';

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
    earliestDate: transactions[transactions.length - 1].date,
    latestDate: transactions[0].date,
    totalIncome: transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    totalExpense: transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
  };
}

// -------------------------------------------------------------
// 7. HTML TABLE PARSER (.html, .htm, or HTML disguised as .xls)
// -------------------------------------------------------------
export async function parseHtmlFile(file: File): Promise<ParseResult> {
  try {
    let text = await file.text();

    if (/[\u0080-\u00FF]/.test(text) && !/[\u0590-\u05FF]/.test(text)) {
      try {
        const buffer = await file.arrayBuffer();
        const decoder = new TextDecoder('windows-1255');
        const decoded = decoder.decode(buffer);
        if (/[\u0590-\u05FF]/.test(decoded)) {
          text = decoded;
        }
      } catch {
        // keep text
      }
    }

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
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const tables = Array.from(doc.querySelectorAll('table'));

  if (tables.length === 0) {
    return parseCsvContent(doc.body?.textContent || html, fileName);
  }

  // Find table with most rows
  let bestTable = tables[0];
  let maxRows = 0;
  for (const t of tables) {
    const rowCount = t.querySelectorAll('tr').length;
    if (rowCount > maxRows) {
      maxRows = rowCount;
      bestTable = t;
    }
  }

  const trs = Array.from(bestTable.querySelectorAll('tr'));
  if (trs.length < 2) {
    return {
      success: false,
      transactions: [],
      institution: 'לא זוהה',
      error: 'טבלת הנתונים ב-HTML ריקה.',
    };
  }

  const institutionInfo = detectInstitution(doc.body?.textContent || html, fileName);

  let headerIndex = -1;
  let dateCol = -1;
  let billingDateCol = -1;
  let descCol = -1;
  let amountCol = -1;
  let debitCol = -1;
  let creditCol = -1;
  let categoryCol = -1;
  let refCol = -1;

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
      if (t.includes('תאריך חיוב') || t.includes('ת.חיוב') || t.includes('billing date')) fBillingDate = idx;
      else if (t.includes('תאריך') || t.includes('ת.עסקה') || t === 'date') fDate = idx;
      else if (t.includes('תיאור') || t.includes('פרטים') || t.includes('בית עסק') || t.includes('פעולה') || t.includes('merchant')) fDesc = idx;
      else if (t.includes('חובה') || t.includes('חיוב') || t === 'debit') fDebit = idx;
      else if (t.includes('זכות') || t.includes('זיכוי') || t.includes('הפקדה') || t.includes('הכנסה') || t === 'credit') fCredit = idx;
      else if (t.includes('סכום') || t === 'amount') fAmount = idx;
      else if (t.includes('קטגוריה') || t.includes('ענף')) categoryCol = idx;
      else if (t.includes('אסמכתא') || t.includes('שובר')) refCol = idx;
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

  if (headerIndex === -1 && dateCol === -1) {
    return {
      success: false,
      transactions: [],
      institution: institutionInfo.name,
      error: 'לא זוהו עמודות תקינות (תאריך, תיאור, סכום) בטבלת ה-HTML.',
    };
  }

  const transactions: Transaction[] = [];

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

    transactions.push(tx);
  }

  if (transactions.length === 0) {
    return {
      success: false,
      transactions: [],
      institution: institutionInfo.name,
      error: 'לא זוהו עסקאות תקינות בטבלת ה-HTML.',
    };
  }

  transactions.sort((a, b) => b.date.localeCompare(a.date));

  return {
    success: true,
    transactions,
    institution: institutionInfo.name,
    earliestDate: transactions[transactions.length - 1].date,
    latestDate: transactions[0].date,
    totalIncome: transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    totalExpense: transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
  };
}

// -------------------------------------------------------------
// 8. OFX / QFX PARSER
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
    earliestDate: transactions[transactions.length - 1].date,
    latestDate: transactions[0].date,
    totalIncome: transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    totalExpense: transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
  };
}

// -------------------------------------------------------------
// 9. JSON PARSER
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
// 10. ZIP ARCHIVE PARSER
// -------------------------------------------------------------
export async function parseZipFile(file: File): Promise<ParseResult> {
  try {
    const jszip = new JSZip();
    const zip = await jszip.loadAsync(file);

    const extractedFiles: { name: string; file: File }[] = [];

    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue;
      // Skip Mac OS metadata files
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
// 11. IMAGE PARSER (Receipts, Invoices, Slips: JPG, PNG, WEBP)
// -------------------------------------------------------------
export async function parseImageFile(file: File): Promise<ParseResult> {
  try {
    const buffer = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

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

      const tx = buildTransactionObject({
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

      return tx;
    });

    transactions.sort((a, b) => b.date.localeCompare(a.date));

    return {
      success: true,
      transactions,
      institution: data.detectedInstitution || instInfo.name,
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
// 12. PDF PARSER (Server API with Multimodal & Text Support)
// -------------------------------------------------------------
export async function parsePdfFile(file: File): Promise<ParseResult> {
  try {
    const buffer = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

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

      const tx = buildTransactionObject({
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

      return tx;
    });

    transactions.sort((a, b) => b.date.localeCompare(a.date));

    return {
      success: true,
      transactions,
      institution: data.detectedInstitution || instInfo.name,
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
// 13. MASTER DISPATCHER & FORMAT IDENTIFIER
// -------------------------------------------------------------
export async function parseFinancialDocument(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase();

  // 1. Image formats
  if (name.match(/\.(jpg|jpeg|png|webp)$/i) || file.type.startsWith('image/')) {
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

  // 4. HTML tables (including bank exports named .xls that are actually HTML)
  if (
    name.endsWith('.html') ||
    name.endsWith('.htm') ||
    prefixTrimmed.toLowerCase().startsWith('<!doctype html') ||
    prefixTrimmed.toLowerCase().startsWith('<html') ||
    prefixTrimmed.toLowerCase().includes('<table')
  ) {
    return parseHtmlFile(file);
  }

  // 5. OFX / QFX
  if (
    name.endsWith('.ofx') ||
    name.endsWith('.qfx') ||
    prefixTrimmed.includes('OFXHEADER') ||
    prefixTrimmed.includes('<OFX>') ||
    prefixTrimmed.includes('<STMTTRN>')
  ) {
    const text = await file.text();
    return parseOfxContent(text, file.name);
  }

  // 6. JSON
  if (name.endsWith('.json') || prefixTrimmed.startsWith('{') || prefixTrimmed.startsWith('[')) {
    try {
      const text = await file.text();
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
    error: `פורמט הקובץ ${file.name} אינו נתמך. המערכת תומכת ב-Excel, CSV, PDF, HTML, JSON, OFX, XML, תמונות וארכיוני ZIP.`,
  };
}

// -------------------------------------------------------------
// 14. CONSERVATIVE DEDUPLICATION
// -------------------------------------------------------------
export function deduplicateTransactions(
  existingTxs: Transaction[],
  newTxs: Transaction[]
): { uniqueTxs: Transaction[]; duplicatesCount: number; updatedExistingTxs?: Transaction[] } {
  const cleanMerchant = (m: string) =>
    (m || '')
      .toLowerCase()
      .replace(/["'״׳\-–_.,()/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  // Index existing transactions
  const strongMap = new Map<string, Transaction>();
  const dateAmountMap = new Map<string, Transaction[]>();

  for (const t of existingTxs) {
    const normM = cleanMerchant(t.merchant);
    const amtStr = t.amount.toFixed(2);
    const key = `${t.date}_${amtStr}_${normM}`;
    strongMap.set(key, t);

    const daKey = `${t.date}_${amtStr}`;
    if (!dateAmountMap.has(daKey)) {
      dateAmountMap.set(daKey, []);
    }
    dateAmountMap.get(daKey)!.push(t);
  }

  const uniqueTxs: Transaction[] = [];
  let duplicatesCount = 0;

  for (const t of newTxs) {
    const normM = cleanMerchant(t.merchant);
    const amtStr = t.amount.toFixed(2);
    const strongKey = `${t.date}_${amtStr}_${normM}`;

    // 1. Direct strong match (identical date + amount + merchant)
    if (strongMap.has(strongKey)) {
      duplicatesCount++;
      const existing = strongMap.get(strongKey)!;
      // Record additional source document
      if (t.sourceDocument && t.sourceDocument !== existing.sourceDocument) {
        if (!existing.additionalSources) existing.additionalSources = [];
        if (!existing.additionalSources.includes(t.sourceDocument)) {
          existing.additionalSources.push(t.sourceDocument);
        }
      }
      if (t.billingDate && !existing.billingDate) {
        existing.billingDate = t.billingDate;
      }
      continue;
    }

    // 2. Strong candidate match (same date and amount, merchant contains or is contained)
    const daKey = `${t.date}_${amtStr}`;
    const candidates = dateAmountMap.get(daKey);
    let matchedCandidate: Transaction | null = null;

    if (candidates && candidates.length > 0) {
      for (const cand of candidates) {
        const candM = cleanMerchant(cand.merchant);
        if (
          (candM.length > 2 && normM.length > 2 && (candM.includes(normM) || normM.includes(candM))) ||
          candM === normM
        ) {
          matchedCandidate = cand;
          break;
        }
      }
    }

    if (matchedCandidate) {
      duplicatesCount++;
      if (t.sourceDocument && t.sourceDocument !== matchedCandidate.sourceDocument) {
        if (!matchedCandidate.additionalSources) matchedCandidate.additionalSources = [];
        if (!matchedCandidate.additionalSources.includes(t.sourceDocument)) {
          matchedCandidate.additionalSources.push(t.sourceDocument);
        }
      }
      if (t.billingDate && !matchedCandidate.billingDate) {
        matchedCandidate.billingDate = t.billingDate;
      }
    } else {
      // 3. Conservative review check: if same date and amount exist but merchant differs
      if (candidates && candidates.length > 0) {
        t.needsReview = true;
        t.reviewReason = `התאמה אפשרית: קיימת עסקה נוספת בסכום ₪${t.amount} בתאריך זה (${candidates[0].merchant})`;
      }

      strongMap.set(strongKey, t);
      if (!dateAmountMap.has(daKey)) {
        dateAmountMap.set(daKey, []);
      }
      dateAmountMap.get(daKey)!.push(t);
      uniqueTxs.push(t);
    }
  }

  return { uniqueTxs, duplicatesCount, updatedExistingTxs: existingTxs };
}
