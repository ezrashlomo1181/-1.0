import * as XLSX from 'xlsx';
import { Transaction, TransactionType, ConfidenceLevel } from '../types/financial';

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
const INSTITUTION_RULES: { keywords: string[]; name: string; accountName: string; accountId: string; defaultPayment: Transaction['paymentMethod'] }[] = [
  { keywords: ['הפועלים', 'hapoalim', 'poalim', 'פועלים'], name: 'בנק הפועלים', accountName: 'עו"ש פועלים', accountId: 'acc-hapoalim', defaultPayment: 'bank_transfer' },
  { keywords: ['לאומי', 'leumi'], name: 'בנק לאומי', accountName: 'עו"ש לאומי', accountId: 'acc-leumi', defaultPayment: 'bank_transfer' },
  { keywords: ['דיסקונט', 'discount'], name: 'בנק דיסקונט', accountName: 'עו"ש דיסקונט', accountId: 'acc-discount', defaultPayment: 'bank_transfer' },
  { keywords: ['מזרחי', 'טפחות', 'mizrahi', 'tefahot'], name: 'מזרחי טפחות', accountName: 'עו"ש מזרחי', accountId: 'acc-mizrahi', defaultPayment: 'bank_transfer' },
  { keywords: ['ישראכרט', 'isracard', 'mastercard', 'מאסטרקארד'], name: 'ישראכרט', accountName: 'ישראכרט Gold', accountId: 'acc-isracard', defaultPayment: 'credit_card' },
  { keywords: ['מקס', 'max', 'לאומי קארד', 'leumicard'], name: 'מקס (MAX)', accountName: 'כרטיס MAX', accountId: 'acc-max', defaultPayment: 'credit_card' },
  { keywords: ['כאל', 'cal', 'ויזה כאל', 'visacal', 'דיינרס', 'diners'], name: 'כאל (CAL)', accountName: 'כרטיס כאל', accountId: 'acc-cal', defaultPayment: 'credit_card' },
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
  // Salary & Income
  {
    keywords: [
      'משכורת', 'שכר', 'העברת שכר', 'שכר חודשי', 'משכורת חודשית', 'זיכוי שכר', 'ביטוח לאומי', 'מס הכנסה', 'קצבה',
      'דיבידנד', 'ריבית זכות', 'החזר מס', 'תקבול', 'בונוס', 'מענק', 'קצבת ילדים', 'נכות', 'אבטלה', 'מלגה',
      'פדיון', 'הכנסה עצמאית', 'תשלום מלקוח', 'תקבול מ-'
    ],
    category: 'משכורת והכנסות',
    type: 'income'
  },
  // Internal Transfers
  {
    keywords: [
      'העברה מחשבון', 'העברה לחשבון', 'העברה עצמית', 'העברה לכרטיס', 'הפקדת מזומן', 'משיכת מזומן', 'משיכה בכספומט',
      'כספומט', 'העברה בין חשבונות', 'פירעון כרטיס'
    ],
    category: 'העברות ומזומן',
    type: 'transfer'
  }
];

export function categorizeMerchant(merchant: string, description: string): {
  category: string;
  type: TransactionType;
  confidenceScore: number;
} {
  const combined = `${merchant} ${description}`.toLowerCase();

  for (const rule of CATEGORY_MAP) {
    for (const kw of rule.keywords) {
      if (combined.includes(kw.toLowerCase())) {
        return {
          category: rule.category,
          type: rule.type || 'expense',
          confidenceScore: 0.94,
        };
      }
    }
  }

  return {
    category: 'אחר / ללא סיווג',
    type: 'expense',
    confidenceScore: 0.5,
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
// 5. EXCEL PARSER (Browser / SheetJS)
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
      let descCol = -1;
      let amountCol = -1;
      let debitCol = -1;
      let creditCol = -1;
      let categoryCol = -1;
      let refCol = -1;

      for (let r = 0; r < Math.min(rawRows.length, 25); r++) {
        const row = rawRows[r].map((cell) => String(cell || '').trim());
        
        let foundDate = -1;
        let foundDesc = -1;
        let foundAmount = -1;
        let foundDebit = -1;
        let foundCredit = -1;

        row.forEach((colText, idx) => {
          const t = colText.toLowerCase();
          if (
            t.includes('תאריך') ||
            t.includes('ת.עסקה') ||
            t.includes('תאריך עסקה') ||
            t.includes('תאריך ערך') ||
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
        if (foundDate !== -1 && (foundDesc !== -1 || foundAmount !== -1 || foundDebit !== -1)) {
          headerRowIndex = r;
          dateCol = foundDate;
          descCol = foundDesc;
          amountCol = foundAmount;
          debitCol = foundDebit;
          creditCol = foundCredit;
          break;
        }
      }

      // If no explicit header row, try heuristic column deduction
      if (headerRowIndex === -1) {
        // Inspect first 5 rows to deduce date and amount columns
        continue;
      }

      // Parse data rows
      for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.length === 0) continue;

        const rawDate = row[dateCol];
        const normalizedDate = normalizeDate(rawDate);
        if (!normalizedDate) continue; // Skip non-data rows or summary rows

        const rawDesc = descCol !== -1 ? String(row[descCol] || '').trim() : '';
        const rawCategory = categoryCol !== -1 ? String(row[categoryCol] || '').trim() : '';
        const rawRef = refCol !== -1 ? String(row[refCol] || '').trim() : '';

        let txAmount = 0;
        let txType: TransactionType = 'expense';
        let foundValidAmount = false;

        // Check Debit vs Credit columns first
        if (debitCol !== -1 || creditCol !== -1) {
          const debitVal = debitCol !== -1 ? parseIsraeliAmount(row[debitCol]) : null;
          const creditVal = creditCol !== -1 ? parseIsraeliAmount(row[creditCol]) : null;

          if (creditVal && creditVal.amount > 0) {
            txAmount = creditVal.amount;
            txType = 'income';
            foundValidAmount = true;
          } else if (debitVal && debitVal.amount > 0) {
            txAmount = debitVal.amount;
            txType = 'expense';
            foundValidAmount = true;
          }
        }

        // If not found in debit/credit, check amount column
        if (!foundValidAmount && amountCol !== -1) {
          const parsedAmount = parseIsraeliAmount(row[amountCol]);
          if (parsedAmount && parsedAmount.amount > 0) {
            txAmount = parsedAmount.amount;
            // Negative amount in bank statement -> expense; positive -> income
            // In credit card statements, amount is usually positive charges -> check institution
            if (institutionInfo.defaultPayment === 'credit_card') {
              txType = parsedAmount.isNegative ? 'income' : 'expense';
            } else {
              txType = parsedAmount.isNegative ? 'expense' : 'income';
            }
            foundValidAmount = true;
          }
        }

        if (!foundValidAmount || txAmount === 0) continue;

        const merchantName = rawDesc || rawCategory || 'עסקה ללא פירוט';
        const classification = categorizeMerchant(merchantName, rawCategory);

        // If detected as income keywords (משכורת, העברה מ-), set income
        if (classification.type === 'income') {
          txType = 'income';
        } else if (classification.type === 'investment_contribution') {
          txType = 'investment_contribution';
        } else if (classification.type === 'transfer') {
          txType = 'transfer';
        }

        const category = rawCategory || classification.category;
        const confidenceLevel: ConfidenceLevel = classification.confidenceScore > 0.8 ? 'high' : 'medium';

        const tx: Transaction = {
          id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          date: normalizedDate,
          amount: Math.round(txAmount * 100) / 100,
          currency: 'ILS',
          merchant: merchantName,
          description: rawRef ? `${merchantName} (אסמכתא: ${rawRef})` : merchantName,
          accountId: institutionInfo.accountId,
          accountName: institutionInfo.accountName,
          paymentMethod: institutionInfo.defaultPayment,
          category,
          type: txType,
          isRecurring: false,
          confidenceScore: classification.confidenceScore,
          confidenceLevel,
          needsReview: confidenceLevel === 'medium',
          userConfirmed: confidenceLevel === 'high',
          sourceDocument: file.name,
        };

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

    // Sort by date ascending
    allTransactions.sort((a, b) => a.date.localeCompare(b.date));

    return {
      success: true,
      transactions: allTransactions,
      institution: detectedInstName || 'בנק / כרטיס אשראי',
      earliestDate: allTransactions[0].date,
      latestDate: allTransactions[allTransactions.length - 1].date,
      totalIncome: allTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      totalExpense: allTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    };
  } catch (err) {
    console.error('Excel parse failed:', err);
    return {
      success: false,
      transactions: [],
      institution: 'שגיאה',
      error: `שגיאה בקריאת קובץ האקסל: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// -------------------------------------------------------------
// 6. CSV & TEXT PARSER (Browser)
// -------------------------------------------------------------
export async function parseCsvFile(file: File): Promise<ParseResult> {
  try {
    // Try reading as UTF-8 first
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
  const firstLines = lines.slice(0, 5).join('\n');
  const commaCount = (firstLines.match(/,/g) || []).length;
  const tabCount = (firstLines.match(/\t/g) || []).length;
  const semiCount = (firstLines.match(/;/g) || []).length;
  const pipeCount = (firstLines.match(/\|/g) || []).length;

  let delimiter = ',';
  if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';
  else if (semiCount > commaCount) delimiter = ';';
  else if (pipeCount > commaCount) delimiter = '|';

  // Helper to split CSV row respecting quotes
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
  let descCol = -1;
  let amountCol = -1;
  let debitCol = -1;
  let creditCol = -1;
  let categoryCol = -1;
  let refCol = -1;

  for (let i = 0; i < Math.min(lines.length, 25); i++) {
    const cols = parseLine(lines[i]);
    let fDate = -1;
    let fDesc = -1;
    let fAmount = -1;
    let fDebit = -1;
    let fCredit = -1;

    cols.forEach((col, idx) => {
      const c = col.toLowerCase();
      if (c.includes('תאריך') || c.includes('date') || c.includes('ת.עסקה')) fDate = idx;
      else if (c.includes('תיאור') || c.includes('פרטים') || c.includes('בית עסק') || c.includes('פעולה') || c.includes('merchant') || c.includes('description')) fDesc = idx;
      else if (c.includes('חובה') || c.includes('חיוב') || c === 'debit') fDebit = idx;
      else if (c.includes('זכות') || c.includes('זיכוי') || c === 'credit') fCredit = idx;
      else if (c.includes('סכום') || c === 'amount') fAmount = idx;
      else if (c.includes('קטגוריה') || c.includes('ענף')) categoryCol = idx;
      else if (c.includes('אסמכתא') || c.includes('שובר')) refCol = idx;
    });

    if (fDate !== -1 && (fDesc !== -1 || fAmount !== -1 || fDebit !== -1)) {
      headerIndex = i;
      dateCol = fDate;
      descCol = fDesc;
      amountCol = fAmount;
      debitCol = fDebit;
      creditCol = fCredit;
      break;
    }
  }

  if (headerIndex === -1) {
    return {
      success: false,
      transactions: [],
      institution: institutionInfo.name,
      error: 'לא זוהו כותרות עמודות תקינות (תאריך, תיאור, סכום) בקובץ ה-CSV.',
    };
  }

  const transactions: Transaction[] = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (cols.length <= 1) continue;

    const rawDate = cols[dateCol];
    const normalizedDate = normalizeDate(rawDate);
    if (!normalizedDate) continue;

    const rawDesc = descCol !== -1 ? cols[descCol] : '';
    const rawCategory = categoryCol !== -1 ? cols[categoryCol] : '';
    const rawRef = refCol !== -1 ? cols[refCol] : '';

    let txAmount = 0;
    let txType: TransactionType = 'expense';
    let foundAmount = false;

    if (debitCol !== -1 || creditCol !== -1) {
      const debitVal = debitCol !== -1 ? parseIsraeliAmount(cols[debitCol]) : null;
      const creditVal = creditCol !== -1 ? parseIsraeliAmount(cols[creditCol]) : null;

      if (creditVal && creditVal.amount > 0) {
        txAmount = creditVal.amount;
        txType = 'income';
        foundAmount = true;
      } else if (debitVal && debitVal.amount > 0) {
        txAmount = debitVal.amount;
        txType = 'expense';
        foundAmount = true;
      }
    }

    if (!foundAmount && amountCol !== -1) {
      const parsedAmount = parseIsraeliAmount(cols[amountCol]);
      if (parsedAmount && parsedAmount.amount > 0) {
        txAmount = parsedAmount.amount;
        if (institutionInfo.defaultPayment === 'credit_card') {
          txType = parsedAmount.isNegative ? 'income' : 'expense';
        } else {
          txType = parsedAmount.isNegative ? 'expense' : 'income';
        }
        foundAmount = true;
      }
    }

    if (!foundAmount || txAmount === 0) continue;

    const merchantName = rawDesc || rawCategory || 'עסקה ללא פירוט';
    const classification = categorizeMerchant(merchantName, rawCategory);

    if (classification.type === 'income') txType = 'income';
    else if (classification.type === 'investment_contribution') txType = 'investment_contribution';
    else if (classification.type === 'transfer') txType = 'transfer';

    const category = rawCategory || classification.category;
    const confidenceLevel: ConfidenceLevel = classification.confidenceScore > 0.8 ? 'high' : 'medium';

    transactions.push({
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      date: normalizedDate,
      amount: Math.round(txAmount * 100) / 100,
      currency: 'ILS',
      merchant: merchantName,
      description: rawRef ? `${merchantName} (אסמכתא: ${rawRef})` : merchantName,
      accountId: institutionInfo.accountId,
      accountName: institutionInfo.accountName,
      paymentMethod: institutionInfo.defaultPayment,
      category,
      type: txType,
      isRecurring: false,
      confidenceScore: classification.confidenceScore,
      confidenceLevel,
      needsReview: confidenceLevel === 'medium',
      userConfirmed: confidenceLevel === 'high',
      sourceDocument: fileName,
    });
  }

  if (transactions.length === 0) {
    return {
      success: false,
      transactions: [],
      institution: institutionInfo.name,
      error: 'לא זוהו עסקאות תקינות בקובץ ה-CSV. אנא בדוק את מבנה הקובץ.',
    };
  }

  transactions.sort((a, b) => a.date.localeCompare(b.date));

  return {
    success: true,
    transactions,
    institution: institutionInfo.name,
    earliestDate: transactions[0].date,
    latestDate: transactions[transactions.length - 1].date,
    totalIncome: transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    totalExpense: transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
  };
}

// -------------------------------------------------------------
// 7. PDF PARSER (Server API with Client Fallback)
// -------------------------------------------------------------
export async function parsePdfFile(file: File): Promise<ParseResult> {
  try {
    // Convert PDF to base64
    const buffer = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    // Call server endpoint
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

    // Map extracted items to full Transaction objects
    const instInfo = detectInstitution(data.detectedInstitution || '', file.name);

    const transactions: Transaction[] = data.extractedTransactions.map((item: any) => {
      const normalizedDate = normalizeDate(item.date) || new Date().toISOString().split('T')[0];
      const parsedAmount = parseIsraeliAmount(item.amount) || { amount: Math.abs(Number(item.amount) || 0), isNegative: false };
      const merchant = String(item.merchant || item.description || 'עסקה ללא שם').trim();
      const rawCategory = String(item.category || '').trim();
      const classification = categorizeMerchant(merchant, rawCategory);

      let txType: TransactionType = item.type || classification.type || 'expense';
      if (item.type === 'income' || item.isCredit) txType = 'income';

      return {
        id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        date: normalizedDate,
        amount: Math.round(parsedAmount.amount * 100) / 100,
        currency: (item.currency === 'USD' || item.currency === 'EUR') ? item.currency : 'ILS',
        merchant,
        description: item.description || merchant,
        accountId: instInfo.accountId,
        accountName: instInfo.accountName,
        paymentMethod: instInfo.defaultPayment,
        category: rawCategory || classification.category,
        type: txType,
        isRecurring: Boolean(item.isRecurring),
        confidenceScore: item.confidenceScore || classification.confidenceScore,
        confidenceLevel: (item.confidenceScore || 0.9) > 0.8 ? 'high' : 'medium',
        needsReview: Boolean(item.needsReview),
        reviewReason: item.reviewReason,
        userConfirmed: !item.needsReview,
        sourceDocument: file.name,
      };
    });

    transactions.sort((a, b) => a.date.localeCompare(b.date));

    return {
      success: true,
      transactions,
      institution: data.detectedInstitution || instInfo.name,
      earliestDate: transactions[0]?.date,
      latestDate: transactions[transactions.length - 1]?.date,
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
// 8. MASTER DISPATCHER & DEDUPLICATION
// -------------------------------------------------------------
export async function parseFinancialDocument(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return parseExcelFile(file);
  }

  if (name.endsWith('.csv') || name.endsWith('.txt') || name.endsWith('.tsv')) {
    return parseCsvFile(file);
  }

  if (name.endsWith('.pdf')) {
    return parsePdfFile(file);
  }

  return {
    success: false,
    transactions: [],
    institution: 'פורמט לא נתמך',
    error: `פורמט הקובץ ${file.name} אינו נתמך. תומך ב-Excel (.xlsx, .xls), CSV (.csv, .txt), או PDF (.pdf).`,
  };
}

export function deduplicateTransactions(
  existingTxs: Transaction[],
  newTxs: Transaction[]
): { uniqueTxs: Transaction[]; duplicatesCount: number } {
  // Key composed of date + normalized amount + normalized merchant
  const existingKeys = new Set<string>();

  for (const t of existingTxs) {
    const key = `${t.date}_${t.amount.toFixed(2)}_${t.merchant.trim().toLowerCase()}_${t.type}`;
    existingKeys.add(key);
  }

  const uniqueTxs: Transaction[] = [];
  let duplicatesCount = 0;

  for (const t of newTxs) {
    const key = `${t.date}_${t.amount.toFixed(2)}_${t.merchant.trim().toLowerCase()}_${t.type}`;
    if (existingKeys.has(key)) {
      duplicatesCount++;
    } else {
      existingKeys.add(key);
      uniqueTxs.push(t);
    }
  }

  return { uniqueTxs, duplicatesCount };
}
