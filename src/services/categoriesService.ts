import { CategoryDefinition } from '../types/financial';

/**
 * CENTRAL CATEGORIES SERVICE — COMPASS (מצפן)
 *
 * Single Source of Truth for:
 * 1. The 11 Clean Fixed Expense Categories.
 * 2. Special System Categories (strictly segregated from standard expense categories).
 * 3. Validation, creation and resolution of Custom Categories.
 */

// ----------------------------------------------------------------------
// 1. THE 11 CLEAN FIXED EXPENSE CATEGORIES
// ----------------------------------------------------------------------
export const FIXED_EXPENSE_CATEGORIES: ReadonlyArray<CategoryDefinition> = Object.freeze([
  {
    id: 'cat_food',
    name: 'מזון וקניות לבית',
    isCustom: false,
    color: '#059669', // Emerald
    iconName: 'ShoppingCart',
    description: 'סופרמרקטים, מכולות, ירקנים, מאפיות ומצרכים ביתיים',
  },
  {
    id: 'cat_pharm',
    name: 'פארם',
    isCustom: false,
    color: '#0284c7', // Sky blue
    iconName: 'Pill',
    description: 'רשתות פארם, מוצרי תינוקות, עזרה ראשונה ותרופות ללא מרשם',
  },
  {
    id: 'cat_hygiene',
    name: 'היגיינה וטיפוח',
    isCustom: false,
    color: '#ec4899', // Pink
    iconName: 'Sparkles',
    description: 'מספרות, מכוני יופי, קוסמטיקה, ספא וטיפוח אישי',
  },
  {
    id: 'cat_transport',
    name: 'רכב ותחבורה',
    isCustom: false,
    color: '#6366f1', // Indigo
    iconName: 'Car',
    description: 'דלק, טעינה חשמלית, חניה, מוסכים, תחבורה ציבורית ואגרות',
  },
  {
    id: 'cat_housing',
    name: 'דיור וחשבונות הבית',
    isCustom: false,
    color: '#2563eb', // Royal blue
    iconName: 'Home',
    description: 'שכר דירה, משכנתה, ועד בית, ארנונה, חשמל, מים וגז',
  },
  {
    id: 'cat_dining',
    name: 'מסעדות, קפה ומשלוחים',
    isCustom: false,
    color: '#d97706', // Amber
    iconName: 'UtensilsCrossed',
    description: 'בתי קפה, מסעדות, וולט, תן ביס, משלוחים ומזון מהיר',
  },
  {
    id: 'cat_leisure',
    name: 'פנאי ובילויים',
    isCustom: false,
    color: '#8b5cf6', // Violet
    iconName: 'Film',
    description: 'קולנוע, הופעות, תיאטרון, חדרי כושר, חוגים וספורט',
  },
  {
    id: 'cat_shopping',
    name: 'ביגוד וקניות אישיות',
    isCustom: false,
    color: '#9333ea', // Purple
    iconName: 'Shirt',
    description: 'רשתות אופנה, ביגוד, הנעלה, אביזרים וקניות אישיות',
  },
  {
    id: 'cat_health',
    name: 'בריאות ורפואה',
    isCustom: false,
    color: '#0f766e', // Teal
    iconName: 'HeartPulse',
    description: 'קופות חולים, מרפאות שיניים, רופאים פרטיים, בדיקות וטיפולים',
  },
  {
    id: 'cat_travel',
    name: 'חופשות ונסיעות',
    isCustom: false,
    color: '#f59e0b', // Warm Amber
    iconName: 'Plane',
    description: 'טיסות, מלונות, צימרים, השכרת רכב בחו"ל וחבילות נופש',
  },
  {
    id: 'cat_subscriptions',
    name: 'תקשורת ומנויים',
    isCustom: false,
    color: '#4f46e5', // Deep Indigo
    iconName: 'Smartphone',
    description: 'אינטרנט, סלולר, טלוויזיה, שירותי סטרימינג ומנויים קבועים',
  },
]);

// ----------------------------------------------------------------------
// 2. SPECIAL SYSTEM CATEGORIES (STRICTLY NON-EXPENSE / SYSTEM SCOPE)
// ----------------------------------------------------------------------
export const SPECIAL_SYSTEM_CATEGORIES: ReadonlyArray<CategoryDefinition> = Object.freeze([
  {
    id: 'sys_income',
    name: 'משכורת והכנסות',
    isCustom: false,
    color: '#059669',
    iconName: 'ArrowDownLeft',
    description: 'הכנסות מעבודה, משכורת, קצבאות ותקבולים',
  },
  {
    id: 'sys_transfer',
    name: 'העברות ומזומן',
    isCustom: false,
    color: '#64748b',
    iconName: 'ArrowRightLeft',
    description: 'העברות פנימיות בין חשבונות ומשיכות מזומן',
  },
  {
    id: 'sys_refund',
    name: 'החזרים וזיכויים',
    isCustom: false,
    color: '#10b981',
    iconName: 'RotateCcw',
    description: 'זיכויי קניות, החזרי חיוב והחזר כספי',
  },
  {
    id: 'sys_investment',
    name: 'השקעות',
    isCustom: false,
    color: '#3b82f6',
    iconName: 'TrendingUp',
    description: 'הפקדות ומשיכות מתיקי השקעות וחסכונות',
  },
  {
    id: 'sys_debt',
    name: 'הלוואות והתחייבויות',
    isCustom: false,
    color: '#be123c',
    iconName: 'CreditCard',
    description: 'תשלומי הלוואות, פירעון חובות והתחייבויות',
  },
  {
    id: 'sys_review',
    name: 'אחר / לבירור',
    isCustom: false,
    color: '#94a3b8',
    iconName: 'HelpCircle',
    description: 'עסקאות ללא סיווג ודאי או בהסגר חשבונאי הממתינות לאימות',
  },
]);

// ----------------------------------------------------------------------
// 3. RETRIEVAL & QUERY FUNCTIONS
// ----------------------------------------------------------------------

/**
 * Returns a cloned array of the 11 clean fixed expense categories.
 */
export function getFixedExpenseCategories(): CategoryDefinition[] {
  return FIXED_EXPENSE_CATEGORIES.map((c) => ({ ...c }));
}

/**
 * Returns a cloned array of the special system categories.
 */
export function getSpecialSystemCategories(): CategoryDefinition[] {
  return SPECIAL_SYSTEM_CATEGORIES.map((c) => ({ ...c }));
}

/**
 * Returns all standard categories (11 fixed expense + 6 special system).
 */
export function getAllStandardCategories(): CategoryDefinition[] {
  return [...getFixedExpenseCategories(), ...getSpecialSystemCategories()];
}

/**
 * Checks if a category name or ID represents one of the 11 fixed expense categories.
 */
export function isFixedExpenseCategory(categoryNameOrId: string): boolean {
  if (!categoryNameOrId) return false;
  const trimmed = categoryNameOrId.trim();
  return FIXED_EXPENSE_CATEGORIES.some(
    (c) => c.id === trimmed || c.name.toLowerCase() === trimmed.toLowerCase()
  );
}

/**
 * Checks if a category name or ID represents a special system category.
 */
export function isSpecialSystemCategory(categoryNameOrId: string): boolean {
  if (!categoryNameOrId) return false;
  const trimmed = categoryNameOrId.trim();
  return SPECIAL_SYSTEM_CATEGORIES.some(
    (c) => c.id === trimmed || c.name.toLowerCase() === trimmed.toLowerCase()
  );
}

/**
 * Finds a category definition by its stable ID across fixed, system and custom categories.
 */
export function findCategoryById(
  id: string,
  customCategories: CategoryDefinition[] = []
): CategoryDefinition | undefined {
  if (!id) return undefined;
  const trimmed = id.trim();
  const all = [...FIXED_EXPENSE_CATEGORIES, ...SPECIAL_SYSTEM_CATEGORIES, ...customCategories];
  return all.find((c) => c.id === trimmed);
}

/**
 * Finds a category definition by its display name across fixed, system and custom categories.
 */
export function findCategoryByName(
  name: string,
  customCategories: CategoryDefinition[] = []
): CategoryDefinition | undefined {
  if (!name) return undefined;
  const trimmed = name.trim().toLowerCase();
  const all = [...FIXED_EXPENSE_CATEGORIES, ...SPECIAL_SYSTEM_CATEGORIES, ...customCategories];
  return all.find((c) => c.name.toLowerCase() === trimmed);
}

/**
 * Resolves the display color for a given category name or ID.
 * Falls back gracefully to neutral slate (#94a3b8) if not found.
 */
export function getCategoryColor(
  categoryNameOrId: string,
  customCategories: CategoryDefinition[] = []
): string {
  if (!categoryNameOrId) return '#94a3b8';
  const found =
    findCategoryById(categoryNameOrId, customCategories) ||
    findCategoryByName(categoryNameOrId, customCategories);
  return found ? found.color : '#94a3b8';
}

// ----------------------------------------------------------------------
// 4. CUSTOM CATEGORY VALIDATION & CREATION
// ----------------------------------------------------------------------

export interface CategoryValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a proposed custom category name:
 * - Must not be empty or whitespace only.
 * - Must not collide with any of the 11 fixed category names.
 * - Must not collide with any special system category names.
 * - Must not collide with existing custom category names for this user.
 */
export function validateCustomCategoryName(
  name: string,
  existingCustomCategories: CategoryDefinition[] = []
): CategoryValidationResult {
  if (!name || !name.trim()) {
    return { valid: false, error: 'שם הקטגוריה אינו יכול להיות ריק.' };
  }

  const cleanName = name.trim();
  if (cleanName.length < 2) {
    return { valid: false, error: 'שם הקטגוריה חייב להכיל לפחות 2 תווים.' };
  }

  const cleanLower = cleanName.toLowerCase();

  // Collision check: 11 Fixed categories
  const fixedCollision = FIXED_EXPENSE_CATEGORIES.some(
    (c) => c.name.toLowerCase() === cleanLower
  );
  if (fixedCollision) {
    return { valid: false, error: `השם "${cleanName}" כבר קיים כאחת מקטגוריות המערכת הקבועות.` };
  }

  // Collision check: Special system categories
  const systemCollision = SPECIAL_SYSTEM_CATEGORIES.some(
    (c) => c.name.toLowerCase() === cleanLower
  );
  if (systemCollision) {
    return { valid: false, error: `השם "${cleanName}" שמור על ידי המערכת ולא ניתן לשימוש כקטגוריית הוצאה אישית.` };
  }

  // Collision check: Existing custom categories
  const customCollision = existingCustomCategories.some(
    (c) => c.name.toLowerCase() === cleanLower
  );
  if (customCollision) {
    return { valid: false, error: `כבר קיימת קטגוריה אישית בשם "${cleanName}".` };
  }

  return { valid: true };
}

// Palette of distinct, accessible colors for user-created custom categories
const CUSTOM_PALETTE = [
  '#0284c7', // Sky
  '#0d9488', // Teal
  '#16a34a', // Green
  '#ca8a04', // Yellow
  '#ea580c', // Orange
  '#e11d48', // Rose
  '#9333ea', // Purple
  '#4f46e5', // Indigo
  '#0891b2', // Cyan
  '#65a30d', // Lime
];

/**
 * Creates a new pristine CategoryDefinition for a custom user category.
 * Throws an Error if validation fails.
 */
export function createCustomCategoryDefinition(
  params: {
    name: string;
    color?: string;
    userId?: string;
    description?: string;
  },
  existingCustomCategories: CategoryDefinition[] = []
): CategoryDefinition {
  const validation = validateCustomCategoryName(params.name, existingCustomCategories);
  if (!validation.valid) {
    throw new Error(validation.error || 'שם הקטגוריה אינו תקין.');
  }

  const assignedColor =
    params.color ||
    CUSTOM_PALETTE[existingCustomCategories.length % CUSTOM_PALETTE.length];

  return {
    id: `cust_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: params.name.trim(),
    isCustom: true,
    color: assignedColor,
    iconName: 'Tag',
    userId: params.userId,
    description: params.description?.trim(),
  };
}

// ----------------------------------------------------------------------
// 5. CANONICAL EXPENSE CATEGORY RESOLUTION & TECHNICAL FILTERING
// ----------------------------------------------------------------------

/**
 * Checks whether a given string is a technical transaction type or document artifact
 * (e.g. "עסקה רגילה (כולל דביט)", "סייקל חו״ל", "דביט", "הוראת קבע") rather than an actual expense category.
 */
export function isTechnicalTransactionType(val: string): boolean {
  if (!val) return false;
  const s = val.trim().toLowerCase();
  if (
    s === 'כללי' ||
    s === 'אחר' ||
    s === 'אחר / ללא סיווג' ||
    s === 'ללא סיווג' ||
    s === 'שונות' ||
    s === 'שירותים' ||
    s === 'שירותים כלליים' ||
    s === 'עסקאות אינטרנט' ||
    s === 'עסקה באינטרנט' ||
    s.includes('עסקה רגילה') ||
    s.includes('כולל דביט') ||
    s.includes('סייקל חו"ל') ||
    s.includes('סייקל חו״ל') ||
    s.includes('עסקאות חו"ל') ||
    s.includes('עסקאות חו״ל') ||
    s === 'דביט' ||
    s === 'עסקת דביט' ||
    s === 'כרטיס דביט' ||
    s === 'עסקת תשלומים' ||
    s === 'תשלומים' ||
    s === 'הוראת קבע' ||
    s === 'העברה בנקאית' ||
    s === 'משיכת מזומן' ||
    s === 'חיוב כרטיס' ||
    s === 'זיכוי כרטיס'
  ) {
    return true;
  }
  return false;
}

/**
 * Resolves legacy or alternate Hebrew category names to one of the 11 official clean fixed expense categories.
 * Returns null if the string is empty or represents a technical transaction artifact.
 */
export function resolveToCanonicalExpenseCategory(categoryName: string): string | null {
  if (!categoryName) return null;
  const trimmed = categoryName.trim();
  if (isTechnicalTransactionType(trimmed)) {
    return null;
  }

  // Check direct exact match with official names
  const directMatch = FIXED_EXPENSE_CATEGORIES.find((c) => c.name === trimmed);
  if (directMatch) return directMatch.name;

  // Resolve legacy / alternate names & unambiguous credit card sectors
  switch (trimmed) {
    case 'מזון וסופר':
    case 'מזון':
    case 'סופרמרקט':
    case 'מכולת':
    case 'רשתות שיווק ומזון':
    case 'סופרמרקטים':
      return 'מזון וקניות לבית';

    case 'פארם ומזון לתינוקות':
    case 'מוצרי תינוקות':
    case 'בתי מרקחת':
      return 'פארם';

    case 'טואלטיקה וטיפוח':
    case 'קוסמטיקה':
    case 'מספרה':
    case 'קוסמטיקה וטיפוח':
    case 'מספרות ויופי':
      return 'היגיינה וטיפוח';

    case 'תחבורה ורכב':
    case 'תחבורה':
    case 'רכב':
    case 'דלק':
    case 'דלק ושמנים':
    case 'תחבורה ציבורית':
      return 'רכב ותחבורה';

    case 'דיור וחשבונות':
    case 'חשבונות הבית':
    case 'חשבונות':
      return 'דיור וחשבונות הבית';

    case 'מסעדות ובילויים':
    case 'מסעדות ומשלוחים':
    case 'בתי קפה ומסעדות':
    case 'מסעדות':
    case 'מזון ואירוח':
    case 'בתי קפה':
      return 'מסעדות, קפה ומשלוחים';

    case 'פנאי וספורט':
    case 'ספורט':
    case 'כושר':
    case 'מופעים ופנאי':
      return 'פנאי ובילויים';

    case 'קניות וביגוד':
    case 'קניות':
    case 'ביגוד':
    case 'הלבשה':
    case 'הלבשה והנעלה':
    case 'אופנה והנעלה':
    case 'הנעלה':
      return 'ביגוד וקניות אישיות';

    case 'בריאות ופארם':
    case 'שירותי רפואה':
      return 'בריאות ורפואה';

    case 'חופשות וטיסות':
    case 'נופש ותיירות':
    case 'טיסות ומלונות':
    case 'תיירות ונופש':
      return 'חופשות ונסיעות';

    case 'מנויים ותקשורת':
    case 'תקשורת וטכנולוגיה':
    case 'אינטרנט וסלולר':
    case 'אינטרנט ותקשורת':
    case 'שירותי תקשורת':
      return 'תקשורת ומנויים';

    default:
      // Return null for unknown / technical strings so they do not pollute official categories
      return null;
  }
}

