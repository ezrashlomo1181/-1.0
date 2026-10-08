import { TransactionType, ConfidenceLevel, LearnedRule } from '../types/financial';
import { getStoredLearnedRules } from './storage';

export interface SemanticClassificationResult {
  category: string;
  type: TransactionType;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  isInternalTransfer: boolean;
  isUserRule: boolean;
  matchedRuleId?: string;
  needsReview: boolean;
  reviewReason?: string;
}

// Predefined comprehensive category keyword mappings
export const CATEGORY_MAP: {
  keywords: string[];
  category: string;
  type?: TransactionType;
}[] = [
  // Supermarkets & Groceries
  {
    keywords: [
      'שופרסל', 'רמי לוי', 'יוחננוף', 'קרפור', 'carrefour', 'ויקטורי', 'טיב טעם', 'מגה', 'אושר עד',
      'חצי חינם', 'יינות ביתן', 'מעדני מניה', 'מחסני השוק', 'פרשמרקט', 'סטופ מרקט', 'am:pm', 'ampm',
      'סופר יודה', 'זול ובגדול', 'קואופ', 'מינימרקט', 'מכולת', 'סופרמרקט', 'ירקות', 'פירות', 'קצביה',
      'דגים', 'מאפיה', 'מאפיית', 'מעדניה', 'פיצוציה', 'פיצוחי', 'טבע קסטל', 'ניצת הדובדבן', 'אניס'
    ],
    category: 'מזון וסופר',
    type: 'expense'
  },
  // Dining & Restaurants
  {
    keywords: [
      'וולט', 'wolt', 'תן ביס', '10bis', 'משלוחה', 'ארומה', 'aroma', 'מקדונלדס', 'mcdonalds',
      'קפה קפה', 'לנדוור', 'גרג', 'ביגה', 'רולדין', 'ארקפה', 'קפית', 'קפה גו', 'פיצה האט',
      'דומינוס פיצה', 'פיצה', 'בורגר ראנץ', 'בורגרים', 'מוזס', 'bbb', 'אגאדיר', 'גולדה', 'וניליה',
      'קפה נאמן', 'שניצל', 'פלאפל', 'שווארמה', 'חומוס', 'סושי', 'גפניקה', 'אושי אושי', 'מסעדה',
      'בית קפה', 'בר', 'פאב', 'טברנה', 'ביסטרו', 'גלידריה', 'מזנון'
    ],
    category: 'מסעדות ובילויים',
    type: 'expense'
  },
  // Transportation & Fuel
  {
    keywords: [
      'פז', 'דלק', 'סונול', 'דור אלון', 'טן', 'מיקה', 'תדלוק', 'ילו', 'yellow', 'sogood',
      'מנטה', 'אלונית', 'רב קו', 'רב-קו', 'רכבת ישראל', 'אגד', 'דן', 'מטרופולין', 'קווים',
      'אלקטרה אפיקים', 'סופרבוס', 'מוביט', 'moovit', 'הופאון', 'hopon', 'פנגו', 'pango',
      'סלופארק', 'cellopark', 'אחוזות החוף', 'חניון', 'גט טקסי', 'gett', 'יאנגו', 'yango',
      'טסלה', 'tesla', 'מוסך', 'טסט', 'מכון רישוי', 'שטיפת רכב', 'כביש 6', 'מנהרות הכרמל',
      'הנתיב המהיר', 'שטיפומט', 'צמיגי', 'חלקי חילוף'
    ],
    category: 'תחבורה ורכב',
    type: 'expense'
  },
  // Housing, Utilities & Municipal
  {
    keywords: [
      'שכר דירה', 'שכירות', 'משכנתא', 'ועד בית', 'חברת חשמל', 'חשמל', 'מי אביבים', 'מי כרמל',
      'הגיחון', 'מי רעננה', 'פלגי מים', 'עיריית', 'עירייה', 'מועצה אזורית', 'מועצה מקומית',
      'ארנונה', 'גז יגור', 'אמישראגז', 'סופרגז', 'פזגז', 'דורגז', 'אינטרנט', 'בזק', 'הוט',
      'hot', 'סלקום', 'פרטנר', 'יס', 'yes', 'wecom', 'גולן טלקום', 'רמי לוי תקשורת', '019',
      '012', 'פלאפון', 'רימון'
    ],
    category: 'דיור וחשבונות',
    type: 'expense'
  },
  // Retail, Clothing & Shopping
  {
    keywords: [
      'זארה', 'zara', 'קסטרו', 'castro', 'רנואר', 'renuar', 'h&m', 'hm', 'מנגו', 'mango',
      'פול אנד בר', 'pull&bear', 'ברשקה', 'bershka', 'סטראדיווריוס', 'stradivarius', 'פוקס',
      'fox', 'טרמינל איקס', 'terminal x', 'עדיקה', 'adika', 'אסוס', 'asos', 'שיין', 'shein',
      'אמזון', 'amazon', 'אליאקספרס', 'aliexpress', 'איביי', 'ebay', 'איקאה', 'ikea',
      'הום סנטר', 'אייס', 'ace', 'מחסני חשמל', 'שקם אלקטריק', 'קיי אס פי', 'ksp', 'איבורי',
      'ivory', 'באג', 'bug', 'איידיגיטל', 'idigital', 'מחסני תאורה', 'המשביר', 'דלתא', 'delta',
      'הו הו', 'hoodies', 'אדידס', 'adidas', 'נייקי', 'nike', 'פוט לוקר', 'foot locker',
      'שילב', 'מוצצים', 'טויס אר אס', 'toys r us', 'מקס סטוק', 'max stock', 'גמבו', 'jumbo',
      'הסטוק', 'דייסון', 'dyson', 'עולם הקולנוע', 'נעלי', 'בגדי', 'אופטיקה', 'אופטיקנה',
      'הלפרין', 'קרביץ', 'סטימצקי', 'צומת ספרים'
    ],
    category: 'קניות וביגוד',
    type: 'expense'
  },
  // Health & Pharmacy
  {
    keywords: [
      'סופר פארם', 'סופר-פארם', 'super-pharm', 'be פארם', 'be all', 'מכבי', 'כללית', 'מאוחדת',
      'לאומית', 'מדיקל סנטר', 'אסותא', 'בית מרקחת', 'פארם', 'רופא', 'רופאת', 'מרפאת', 'שיניים',
      'אופטיקה', 'משקפיים', 'פסיכולוג', 'פסיכותרפיה', 'פיזיותרפיה', 'iherb', 'אייהרב', 'ויטמינים'
    ],
    category: 'בריאות ופארם',
    type: 'expense'
  },
  // Subscriptions & Tech
  {
    keywords: [
      'נטפליקס', 'netflix', 'ספוטיפיי', 'spotify', 'אפל', 'apple', 'גוגל', 'google',
      'יוטיוב', 'youtube', 'מיקרוסופט', 'microsoft', 'אמזון פריים', 'amazon prime',
      'דיסני', 'disney', 'openai', 'chatgpt', 'github', 'claude', 'anthropic', 'midjourney',
      'פלייסטיישן', 'playstation', 'steam', 'playtika', 'כושר', 'הולמס פלייס', 'קאנטרי',
      'ספייס', 'space', 'פרופיט', 'profit', 'חדר כושר', 'סטודיו', 'מנוי'
    ],
    category: 'תקשורת וטכנולוגיה',
    type: 'expense'
  },
  // Insurance & Bank Fees
  {
    keywords: [
      'הראל', 'מגדל', 'כלל', 'הפניקס', 'מנורה', 'ביטוח ישיר', 'אליהו', 'ליברה', 'wobi', 'וובי',
      'עמלת', 'עמלה', 'דמי כרטיס', 'דמי ניהול', 'ריבית חובה', 'ריבית פיגורים', 'עמלת שורה',
      'הקצאת אשראי', 'עמלת המרה'
    ],
    category: 'ביטוח ופיננסים',
    type: 'expense'
  },
  // Investments
  {
    keywords: [
      'מיטב', 'איביאי', 'ibi', 'אקסלנס', 'פסגות', 'אלטשולר', 'אנליסט', 'מור', 'ילין לפידות',
      'קסם', 'הפקדה לחיסכון', 'ניירות ערך', 'מניות', 'קרן השתלמות', 'קופת גמל', 'פנסיה',
      'קריפטו', 'ביטקוין', 'בינאנס', 'binance', 'קראקן', 'תוכנית חיסכון', 'קופת גמל להשקעה'
    ],
    category: 'השקעות וחיסכון',
    type: 'investment_contribution'
  },
];

// Helper to safely check keyword matches with word boundaries for short words
export function matchesKeyword(text: string, kw: string): boolean {
  const kwLower = kw.toLowerCase().trim();
  const textLower = text.toLowerCase().trim();
  if (!kwLower || !textLower) return false;

  if (kwLower.length <= 3) {
    // Exact word boundary check for short words (avoids substring false positives like "אל" in "אלקטרוניקה")
    const words = textLower.split(/[\s,.\-_/\\()"'׳״;:]+/);
    return words.includes(kwLower);
  }
  return textLower.includes(kwLower);
}

// Match user learned rules with priority and safe token bounds
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

/**
 * CENTRAL SEMANTIC CLASSIFICATION ENGINE
 *
 * Implements strict hierarchy:
 * 1. User learned rules (highest priority)
 * 2. Explicit transaction semantics (ATM, consolidated card settlements, internal transfers, salary/allowance)
 * 3. Merchant & context evidence
 * 4. Document semantics
 * 5. Impossible combination validation (Prevents income + clothing, income + groceries)
 * 6. Fallback (needsReview instead of silent guesswork)
 */
export function classifyTransactionSemantics(params: {
  merchant: string;
  description: string;
  rawCategory?: string;
  isCreditRow?: boolean;
  isDebitRow?: boolean;
  amountIsNegative?: boolean;
  isCreditCardSource?: boolean;
  customRules?: LearnedRule[];
}): SemanticClassificationResult {
  const {
    merchant,
    description,
    rawCategory = '',
    isCreditRow = false,
    isDebitRow = false,
    amountIsNegative = false,
    isCreditCardSource = false,
    customRules,
  } = params;

  const mClean = merchant.trim();
  const dClean = description.trim();
  const combined = `${mClean} ${dClean} ${rawCategory}`.toLowerCase();

  // 1. PRIORITY 1: User learned rule
  const userRule = matchLearnedRule(mClean, dClean, customRules);
  if (userRule) {
    const assignedType = userRule.assignedType || 'expense';
    return {
      category: userRule.assignedCategory,
      type: assignedType,
      confidenceScore: 1.0,
      confidenceLevel: 'high',
      isInternalTransfer: assignedType === 'transfer',
      isUserRule: true,
      matchedRuleId: userRule.id,
      needsReview: false,
    };
  }

  // 2. PRIORITY 2: Explicit Transaction Semantics

  // A. ATM / Cash Withdrawal: ALWAYS an expense, NEVER a transfer!
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
      confidenceLevel: 'high',
      isInternalTransfer: false,
      isUserRule: false,
      needsReview: false,
    };
  }

  // B. Consolidated Credit Card Settlement in Bank Statement
  // IMPORTANT: Do NOT automatically treat as internal transfer!
  // If detailed card transactions do not exist, this spending must NOT disappear from financial analysis.
  // It starts as an expense with needsReview=true and reconciliationStatus=unreconciled.
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
      confidenceLevel: 'medium',
      isInternalTransfer: false,
      isUserRule: false,
      needsReview: true,
      reviewReason:
        'חיוב כרטיס אשראי מרוכז בחשבון העו"ש – נספר כהוצאה כוללת עד לייבוא קובץ פירוט כרטיס האשראי.',
    };
  }

  // C. Inter-account & Savings Transfers
  if (
    combined.includes('העברה בין חשבונות') ||
    combined.includes('העברה עצמית') ||
    combined.includes('העברה מחשבון') ||
    combined.includes('העברה לחשבון') ||
    combined.includes('העברה לחיסכון') ||
    combined.includes('העברה מחיסכון') ||
    combined.includes('הפקדה לפיקדון') ||
    combined.includes('העברה לפקדון')
  ) {
    return {
      category: 'העברות ומזומן',
      type: 'transfer',
      confidenceScore: 0.94,
      confidenceLevel: 'high',
      isInternalTransfer: true,
      isUserRule: false,
      needsReview: false,
    };
  }

  // D. Explicit Refunds & Credits
  const hasExplicitRefundWords =
    (combined.includes('זיכוי') && !combined.includes('זיכוי שכר')) ||
    combined.includes('החזר כספי') ||
    combined.includes('ביטול עסקה') ||
    combined.includes('החזר חיוב') ||
    combined.includes('זיכוי כרטיס') ||
    combined.includes('refund') ||
    combined.includes('reversal') ||
    amountIsNegative;

  // E. Explicit Genuine Income
  const hasExplicitIncomeWords =
    combined.includes('משכורת') ||
    combined.includes('שכר עבודה') ||
    combined.includes('העברת שכר') ||
    combined.includes('שכר חודשי') ||
    combined.includes('זיכוי שכר') ||
    (combined.includes('שכר') &&
      !combined.includes('שכר דירה') &&
      !combined.includes('שכר לימוד') &&
      !combined.includes('שכירות')) ||
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
    combined.includes('מענק משרד') ||
    combined.includes('מענק קורונה') ||
    combined.includes('מענק מילואים');

  // 3. PRIORITY 3: Merchant context lookup
  let matchedCategory = rawCategory || '';
  for (const rule of CATEGORY_MAP) {
    for (const kw of rule.keywords) {
      if (matchesKeyword(combined, kw)) {
        matchedCategory = rule.category;
        break;
      }
    }
    if (matchedCategory) break;
  }

  // 4. PRIORITY 4: Handle Credit Rows / Positive Amounts Without Falling into the "Positive = Income" Trap
  const isRowInCreditOrDeposit = isCreditRow || (amountIsNegative && isCreditCardSource);

  // If explicit income words exist (salary, dividend, etc.):
  if (hasExplicitIncomeWords) {
    return {
      category: matchedCategory || 'משכורת והכנסות',
      type: 'income',
      confidenceScore: 0.95,
      confidenceLevel: 'high',
      isInternalTransfer: false,
      isUserRule: false,
      needsReview: false,
    };
  }

  // If merchant has consumer category (e.g. Shopping, Supermarket, Dining, Pharmacy)
  const isConsumerCategory = [
    'קניות וביגוד',
    'מזון וסופר',
    'מסעדות ובילויים',
    'בריאות ופארם',
    'תחבורה ורכב',
    'תקשורת וטכנולוגיה',
  ].includes(matchedCategory);

  if (isConsumerCategory) {
    if (hasExplicitRefundWords || isRowInCreditOrDeposit) {
      // CRITICAL REQUIREMENT #2 & #3:
      // A credit row / positive amount from a consumer merchant (e.g. Zara ₪2,000 credit)
      // MUST NEVER become Income + Clothing! It is a REFUND that reduces expenses.
      return {
        category: matchedCategory,
        type: 'refund',
        confidenceScore: 0.94,
        confidenceLevel: 'high',
        isInternalTransfer: false,
        isUserRule: false,
        needsReview: false,
      };
    }

    // Normal debit/expense in consumer category
    return {
      category: matchedCategory,
      type: 'expense',
      confidenceScore: 0.92,
      confidenceLevel: 'high',
      isInternalTransfer: false,
      isUserRule: false,
      needsReview: false,
    };
  }

  // If explicit refund words are present:
  if (hasExplicitRefundWords) {
    return {
      category: matchedCategory || 'החזרים וזיכויים',
      type: 'refund',
      confidenceScore: 0.9,
      confidenceLevel: 'high',
      isInternalTransfer: false,
      isUserRule: false,
      needsReview: false,
    };
  }

  // If row is in credit column but has NO evidence of salary or consumer merchant:
  if (isRowInCreditOrDeposit) {
    // CRITICAL: A credit column alone is NOT evidence of income.
    // Flag for review as potential credit/refund/deposit rather than silently creating fake salary.
    return {
      category: matchedCategory || 'אחר / ללא סיווג',
      type: 'refund',
      confidenceScore: 0.6,
      confidenceLevel: 'medium',
      isInternalTransfer: false,
      isUserRule: false,
      needsReview: true,
      reviewReason: 'זוהתה תנועת זכות/זיכוי ללא פירוט מספק – נדרש אימות האם זהו החזר כספי (הקטנת הוצאות) או הכנסה',
    };
  }

  // 5. Normal Category Expense Fallback
  if (matchedCategory) {
    return {
      category: matchedCategory,
      type: 'expense',
      confidenceScore: 0.88,
      confidenceLevel: 'medium',
      isInternalTransfer: false,
      isUserRule: false,
      needsReview: false,
    };
  }

  // 6. Generic Fallback with NeedsReview
  return {
    category: 'אחר / ללא סיווג',
    type: 'expense',
    confidenceScore: 0.5,
    confidenceLevel: 'low',
    isInternalTransfer: false,
    isUserRule: false,
    needsReview: true,
    reviewReason: 'דרוש אימות סיווג קטגוריה וסוג תנועה',
  };
}

/**
 * Impossible Combination Validator
 * Protects existing or edited transactions from invalid accounting states.
 */
export function validateAndFixTransactionCombination(tx: {
  merchant: string;
  category: string;
  type: TransactionType;
}): { type: TransactionType; category: string; needsReview: boolean; reviewReason?: string } {
  const { merchant, category, type } = tx;
  const mLower = merchant.toLowerCase();

  const consumerCategories = [
    'קניות וביגוד',
    'קניות',
    'ביגוד',
    'מזון וסופר',
    'סופרמרקט',
    'מסעדות ובילויים',
    'מסעדות ומשלוחים',
    'בריאות ופארם',
    'פארם',
  ];

  const hasSalaryWords =
    mLower.includes('משכורת') ||
    mLower.includes('שכר') ||
    mLower.includes('ביטוח לאומי') ||
    mLower.includes('קצבה') ||
    mLower.includes('דיבידנד');

  if (type === 'income' && consumerCategories.some((c) => category.includes(c))) {
    if (!hasSalaryWords) {
      // Impossible combination detected! Fix to refund
      return {
        type: 'refund',
        category,
        needsReview: true,
        reviewReason: 'נחסם שילוב בלתי-תקין של הכנסה עם בית עסק צרכני/ביגוד. התנועה תוקנה להחזר (Refund).',
      };
    }
  }

  return { type, category, needsReview: false };
}
