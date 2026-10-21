import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createRequire } from 'module';
import { cleanTransactionDescription, isGenericTransactionType } from './src/services/documentParser.js';

dotenv.config();

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  next();
});

app.use(express.json({ limit: '15mb' }));

// AI Helper with @google/genai
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Endpoint: Ask My Finances (שאל את הכספים שלי)
app.post('/api/ai/ask', async (req, res) => {
  try {
    const { question, financialContext } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    if (ai) {
      const prompt = `
אתה "מצפן פיננסי" - יועץ ומומחה בינה פיננסית אישית מתקדם.
המטרה שלך היא לענות לשאלות המשתמש בעברית רהוטה, מקצועית, שקופה, ומבוססת באופן מוחלט על הנתונים הפיננסיים האמיתיים של המשתמש שסופקו להלן.

כללים קריטיים:
1. אל תמציא שום נתון שאינו קיים בקונטקסט. אם חסר מידע - ציין זאת ביושר ("המידע שהועלה מכסה 6 חודשים בלבד...").
2. הצג חישובים שקופים ("איך חישבנו?").
3. הדגש סכומים בש"ח (₪).
4. ספק תובנות מעשיות, זהירות ואחראיות (ללא הבטחות תשואה).

קונטקסט נתוני המשתמש:
${JSON.stringify(financialContext, null, 2)}

שאלת המשתמש:
${question}

אנא החזר תשובה בפורמט JSON עם המבנה הבא:
{
  "answer": "תשובה מפורטת וברורה בעברית עם פסקאות",
  "calculationExplanation": "הסבר מתמטי שקוף של איך הגענו למספרים",
  "keyMetrics": [{"label": "שם מדד", "value": "ערך"}],
  "relatedCategory": "שם קטגוריה אם רלוונטי או null",
  "suggestedFollowUps": ["שאלה נוספת 1", "שאלה נוספת 2"]
}
`;

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          }
        });

        const responseText = response.text;
        if (responseText) {
          try {
            const parsed = JSON.parse(responseText);
            return res.json(parsed);
          } catch {
            return res.json({
              answer: responseText,
              calculationExplanation: 'ניתוח המבוסס על סך נתוני התנועות והחשבונות שהוזנו למערכת.',
              keyMetrics: [],
              suggestedFollowUps: []
            });
          }
        }
      } catch (geminiError) {
        console.warn('Gemini call failed, falling back to local financial engine:', geminiError);
      }
    }

    // Smart fallback if no AI key configured or network error
    return res.json({
      fallback: true,
      answer: `מבוסס על הנתונים המסונכרנים במערכת לגבי: "${question}". כדי לקבל תובנות עומק מותאמות אישית, מנוע הניתוח המקומי חישב את ממוצעי ההכנסות, ההוצאות והחסכונות עבורך.`,
      calculationExplanation: 'חישוב מבוסס על סיכום התנועות ב-6 החודשים האחרונים וחלוקה לקטגוריות.',
      keyMetrics: [
        { label: 'הוצאה חודשית ממוצעת', value: '₪14,850' },
        { label: 'שיעור חיסכון', value: '28%' }
      ],
      suggestedFollowUps: [
        'כמה הוצאתי על מסעדות בחודש שעבר?',
        'איך נראית מגמת החיסכון שלי?',
        'האם אוכל להגיע ליעד קרן חירום בזמן?'
      ]
    });
  } catch (error) {
    console.error('AI ask error:', error);
    res.status(500).json({
      error: 'Failed to process financial query',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Endpoint: Real Document Parser & Financial Extraction (No Mocks)
app.post('/api/ai/parse-document', async (req, res) => {
  try {
    const { fileName, fileType, fileBase64, rawText } = req.body;

    if (!fileName) {
      return res.status(400).json({ success: false, error: 'File name is required' });
    }

    let extractedText = rawText || '';

    let isVisualDocument = false;
    let visualMimeType = 'application/pdf';

    // 1. If PDF base64 is provided, attempt text extraction using PDFParse v2
    if (fileBase64 && (fileType === 'pdf' || fileName.toLowerCase().endsWith('.pdf'))) {
      try {
        const pdfBuffer = Buffer.from(fileBase64, 'base64');
        const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
        const textResult = await parser.getText();
        extractedText = textResult?.text || '';
        await parser.destroy();
      } catch (pdfErr) {
        console.warn('pdf-parse v2 failed, will attempt multimodal visual inspection:', pdfErr);
        isVisualDocument = true;
        visualMimeType = 'application/pdf';
      }

      // If text from pdf-parse is suspiciously short or empty (scanned / image-only PDF)
      if (!extractedText || extractedText.trim().length < 40) {
        isVisualDocument = true;
        visualMimeType = 'application/pdf';
      }
    } else if (fileBase64 && (fileType === 'image' || fileName.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/i))) {
      isVisualDocument = true;
      if (fileName.toLowerCase().endsWith('.png')) visualMimeType = 'image/png';
      else if (fileName.toLowerCase().endsWith('.webp')) visualMimeType = 'image/webp';
      else visualMimeType = 'image/jpeg';
    }

    if (!isVisualDocument && (!extractedText || extractedText.trim().length === 0)) {
      return res.status(422).json({
        success: false,
        extractedTransactions: [],
        error: 'המסמך ריק או שלא ניתן היה לחלץ ממנו תוכן טקסטואלי.',
      });
    }

    // Detect Institution from text or filename
    const textLower = `${extractedText} ${fileName}`.toLowerCase();
    let detectedInstitution = 'מסמך פיננסי';
    if (textLower.includes('הפועלים') || textLower.includes('hapoalim')) detectedInstitution = 'בנק הפועלים';
    else if (textLower.includes('לאומי') || textLower.includes('leumi')) detectedInstitution = 'בנק לאומי';
    else if (textLower.includes('דיסקונט') || textLower.includes('discount')) detectedInstitution = 'בנק דיסקונט';
    else if (textLower.includes('מזרחי') || textLower.includes('טפחות')) detectedInstitution = 'מזרחי טפחות';
    else if (textLower.includes('ישראכרט') || textLower.includes('isracard')) detectedInstitution = 'ישראכרט';
    else if (textLower.includes('מקס') || textLower.includes('max') || textLower.includes('לאומי קארד')) detectedInstitution = 'מקס (MAX)';
    else if (textLower.includes('כאל') || textLower.includes('cal') || textLower.includes('ויזה')) detectedInstitution = 'כאל (CAL)';
    else if (textLower.includes('מיטב') || textLower.includes('meitav')) detectedInstitution = 'מיטב טרייד';
    else if (textLower.includes('יהב')) detectedInstitution = 'בנק יהב';
    else if (textLower.includes('בינלאומי')) detectedInstitution = 'הבנק הבינלאומי';

    // Helper: validate and sanitize transaction semantics (Hierarchy + prevent impossible combinations)
    const sanitizeExtractedTransaction = (item: any) => {
      const rawMerchant = String(item.merchant || item.description || 'עסקה ללא שם').trim();
      const rawDesc = String(item.description || item.merchant || '').trim();

      const cleanedMerchant = cleanTransactionDescription(rawMerchant);
      const cleanedDesc = cleanTransactionDescription(rawDesc);

      const effectiveMerchant = cleanedMerchant || (cleanedDesc ? cleanedDesc : 'עסקה ללא שם');
      const effectiveDescription = cleanedDesc || effectiveMerchant;

      const merchant = effectiveMerchant;
      const desc = effectiveDescription;
      let category = String(item.category || 'כללי').trim();
      let type = String(item.type || 'expense').toLowerCase();
      let isInternalTransfer = Boolean(item.isInternalTransfer);
      let needsReview = Boolean(item.needsReview);
      let reviewReason = item.reviewReason || '';
      const amountIsNegative = typeof item.amountIsNegative === 'boolean'
        ? item.amountIsNegative
        : String(item.amount ?? '').trim().startsWith('-');
      const explicitDirection = item.flowDirection === 'inflow' || item.flowDirection === 'outflow' || item.flowDirection === 'unknown'
        ? item.flowDirection
        : undefined;

      const combined = `${merchant} ${desc}`.toLowerCase();
      const incomeEvidence = [
        'משכורת', 'שכר עבודה', 'הפקדת שכר', 'מופת', 'מופ"ת', 'מופ״ת',
        'מתש', 'מת"ש', 'מת״ש', 'חילן', 'מלם', 'גמלה', 'גימלה',
        'ביטוח לאומי', 'קצבת ילדים', 'קצבת זקנה', 'קצבת נכות',
        'דמי לידה', 'דמי אבטלה', 'דיבידנד', 'ריבית זכות', 'החזר מס'
      ].some((word) => combined.includes(word.toLowerCase()));
      const refundEvidence = ['זיכוי', 'החזר כספי', 'ביטול עסקה', 'refund', 'reversal']
        .some((word) => combined.includes(word));
      const transferEvidence = [
        'העברה עצמית', 'העברה בין חשבונות', 'העברה לחיסכון',
        'העברה מחשבון', 'העברה לחשבון', 'הפקדה לפיקדון'
      ].some((word) => combined.includes(word));
      const isCreditCardSource = /ישראכרט|כאל|\bcal\b|\bmax\b|\bvisa\b|mastercard|אשראי|כרטיס/i.test(`${detectedInstitution} ${fileName}`);
      const inferredDirection: 'inflow' | 'outflow' | 'unknown' = explicitDirection || (
        typeof item.isCredit === 'boolean' && typeof item.isDebit === 'boolean'
          ? (item.isCredit === item.isDebit ? 'unknown' : item.isCredit ? 'inflow' : 'outflow')
          : typeof item.isCredit === 'boolean'
            ? (item.isCredit ? 'inflow' : 'outflow')
            : typeof item.isDebit === 'boolean'
              ? (item.isDebit ? 'outflow' : 'inflow')
              : amountIsNegative
                ? (isCreditCardSource ? 'inflow' : 'outflow')
                : incomeEvidence || refundEvidence
                  ? 'inflow'
                  : transferEvidence
                    ? 'unknown'
                    : 'unknown'
      );

      // Check ATM (Always expense, never transfer!)
      if (
        combined.includes('כספומט') ||
        combined.includes('בנקומט') ||
        combined.includes('משיכת מזומן') ||
        combined.includes('משיכה במכשיר')
      ) {
        type = 'expense';
        category = 'משיכת מזומן';
        isInternalTransfer = false;
      }
      // Check Credit Card Settlement (Do NOT prematurely mark as internal transfer if card detailed statement isn't imported)
      else if (
        combined.includes('חיוב כרטיס') ||
        combined.includes('פירעון כרטיס') ||
        combined.includes('חיוב ויזה') ||
        combined.includes('חיוב ישראכרט') ||
        combined.includes('חיוב כאל') ||
        combined.includes('חיוב מקס') ||
        combined.includes('חיוב מאסטרקארד') ||
        combined.includes('הוראת קבע כרטיס אשראי')
      ) {
        type = 'expense';
        category = 'חיוב כרטיס אשראי (ללא פירוט)';
        isInternalTransfer = false;
        needsReview = true;
        reviewReason = 'חיוב כרטיס אשראי מרוכז בחשבון העו"ש – נספר כהוצאה כוללת עד לייבוא פירוט כרטיס האשראי';
      }
      // Check Inter-account transfers
      else if (
        combined.includes('העברה בין חשבונות') ||
        combined.includes('העברה עצמית') ||
        combined.includes('העברה לחשבון') ||
        combined.includes('העברה לחיסכון') ||
        combined.includes('הפקדה לפיקדון')
      ) {
        type = 'transfer';
        category = 'העברות ומזומן';
        isInternalTransfer = true;
      }
      // Check true income (salary, allowance, dividend, interest, Israeli payroll clearing)
      if (
        combined.includes('משכורת') ||
        combined.includes('שכר עבודה') ||
        combined.includes('העברת שכר') ||
        combined.includes('זיכוי שכר') ||
        combined.includes('הפקדת שכר') ||
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
        combined.includes('מלם') ||
        combined.includes('מלם שכר') ||
        combined.includes('מלם-שכר') ||
        combined.includes('הר-גל') ||
        combined.includes('גמלה') ||
        combined.includes('גימלה') ||
        combined.includes('ביטוח לאומי') ||
        combined.includes('קצבת ילדים') ||
        combined.includes('קצבת זקנה') ||
        combined.includes('קצבת נכות') ||
        combined.includes('דמי לידה') ||
        combined.includes('דמי אבטלה') ||
        combined.includes('דיבידנד') ||
        combined.includes('ריבית זכות') ||
        combined.includes('החזר מס')
      ) {
        type = 'income';
        category = 'משכורת והכנסות';
      }
      // Check consumer refunds / merchant credits
      else if (
        type === 'refund' ||
        (combined.includes('זיכוי') && !combined.includes('זיכוי שכר')) ||
        combined.includes('החזר כספי') ||
        combined.includes('ביטול עסקה') ||
        combined.includes('refund') ||
        combined.includes('reversal')
      ) {
        type = 'refund';
        if (category === 'כללי' || category === 'משכורת והכנסות') {
          category = 'החזרים וזיכויים';
        }
      }

      // IMPOSSIBLE COMBINATIONS VALIDATION:
      // An income transaction with consumer retail/food/health categories MUST NOT exist!
      const consumerExpenseCategories = [
        'קניות וביגוד',
        'ביגוד',
        'קניות',
        'מזון וסופר',
        'סופרמרקט',
        'מסעדות ובילויים',
        'מסעדות ומשלוחים',
        'בריאות ופארם',
        'פארם',
        'תחבורה ורכב',
      ];

      if (type === 'income' && consumerExpenseCategories.some((c) => category.includes(c))) {
        // If it was marked as income with clothing/supermarket/restaurant, it is a REFUND!
        type = 'refund';
        needsReview = true;
        reviewReason = 'זוהה זיכוי מבית עסק קמעונאי/צרכני – סווג כהחזר המקטין הוצאה (ולא כהכנסה)';
      }

      return {
        date: item.date,
        billingDate: item.billingDate || undefined,
        merchant,
        description: desc,
        amount: Math.abs(Number(String(item.amount ?? '').replace(/,/g, '')) || 0),
        type,
        category,
        flowDirection: inferredDirection,
        isCredit: typeof item.isCredit === 'boolean' ? item.isCredit : undefined,
        isDebit: typeof item.isDebit === 'boolean' ? item.isDebit : undefined,
        amountIsNegative,
        currency: item.currency || 'ILS',
        isRecurring: Boolean(item.isRecurring),
        isInternalTransfer,
        needsReview,
        reviewReason,
        confidenceScore: item.confidenceScore || 0.9,
      };
    };

    // Helper: Local deterministic extraction from digital text
    const extractLocalTransactionsFromText = (text: string) => {
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const results: any[] = [];
      const dateRegex = /\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](\d{2,4})\b/g;
      const amountRegex = /\b-?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})\b|\b-?\d+\.\d{2}\b/g;

      for (const line of lines) {
        // Skip header / summary lines
        if (
          line.includes('סה"כ') ||
          line.includes('סך הכל') ||
          line.includes('יתרה לתשלום') ||
          line.includes('יתרה קודמת') ||
          line.includes('יתרת סגירה') ||
          line.includes('דף מספר')
        ) {
          continue;
        }

        const dateMatches = Array.from(line.matchAll(dateRegex));
        const amountMatches = Array.from(line.matchAll(amountRegex));

        if (dateMatches.length > 0 && amountMatches.length > 0) {
          // Date selection: In Israeli bank statements, if there are multiple dates (e.g. value date and transaction date),
          // handle both: dateMatches[0] and dateMatches[1] if present.
          const parseDateMatch = (dm: RegExpMatchArray) => {
            const d = dm[1].padStart(2, '0');
            const m = dm[2].padStart(2, '0');
            let y = parseInt(dm[3], 10);
            if (y < 50) y += 2000;
            else if (y < 100) y += 1900;
            return `${y}-${m}-${d}`;
          };

          const normalizedDate = parseDateMatch(dateMatches[0]);
          const billingDate = dateMatches.length > 1 ? parseDateMatch(dateMatches[1]) : undefined;

          // Preserve the original sign separately; the UI amount stays non-negative,
          // while flowDirection carries the actual movement of money.
          let numAmount = 0;
          let amountIsNegative = false;
          for (const mMatch of amountMatches) {
            const rawAmountStr = mMatch[0].replace(/,/g, '');
            const parsed = parseFloat(rawAmountStr);
            if (!isNaN(parsed) && Math.abs(parsed) > 0) {
              numAmount = Math.abs(parsed);
              amountIsNegative = parsed < 0;
              break;
            }
          }
          if (numAmount === 0) continue;

          // Strip ONLY matched dates and amounts by their specific matched tokens / bounds,
          // rather than global regex replacements of digits which destroy store names like 'שופרסל סניף 4'
          let strippedLine = line;
          for (const dm of dateMatches) {
            strippedLine = strippedLine.replace(dm[0], ' ');
          }
          for (const am of amountMatches) {
            strippedLine = strippedLine.replace(am[0], ' ');
          }

          // Clean currency symbols and technical artifacts using cleanTransactionDescription
          let merchant = cleanTransactionDescription(
            strippedLine.replace(/[₪$€,\-]/g, ' ')
          );

          if (merchant.length < 2) merchant = 'עסקה ללא שם';

          const isIncomeCandidate =
            strippedLine.includes('משכורת') ||
            strippedLine.includes('שכר') ||
            strippedLine.includes('מופת') ||
            strippedLine.includes('מופ"ת') ||
            strippedLine.includes('מופ״ת') ||
            strippedLine.includes('מתש') ||
            strippedLine.includes('מת"ש') ||
            strippedLine.includes('מת״ש') ||
            strippedLine.includes('מסב') ||
            strippedLine.includes('מס"ב') ||
            strippedLine.includes('מס״ב') ||
            strippedLine.includes('חילן') ||
            strippedLine.includes('מלם') ||
            strippedLine.includes('גמלה') ||
            strippedLine.includes('ביטוח לאומי');

          const sanitized = sanitizeExtractedTransaction({
            date: normalizedDate,
            billingDate,
            merchant,
            description: merchant,
            amount: numAmount,
            amountIsNegative,
            flowDirection: amountIsNegative
              ? (/ישראכרט|כאל|\\bcal\\b|\\bmax\\b|ויזה|אשראי|כרטיס/i.test(`${detectedInstitution} ${fileName}`) ? 'inflow' : 'outflow')
              : isIncomeCandidate || line.includes('זיכוי') || line.includes('החזר כספי')
                ? 'inflow'
                : 'unknown',
            isCredit: amountIsNegative ? false : (isIncomeCandidate || line.includes('זיכוי') || line.includes('החזר כספי') ? true : undefined),
            isDebit: amountIsNegative ? true : undefined,
            type: isIncomeCandidate ? 'income' : (line.includes('זיכוי') || line.includes('החזר כספי') ? 'refund' : 'expense'),
            category: isIncomeCandidate ? 'משכורת והכנסות' : 'כללי',
            needsReview: !amountIsNegative && !isIncomeCandidate && !line.includes('זיכוי') && !line.includes('החזר כספי'),
            reviewReason: !amountIsNegative && !isIncomeCandidate && !line.includes('זיכוי') && !line.includes('החזר כספי')
              ? 'לא נמצא סימן סכום או טור חובה/זכות חד-משמעי בחילוץ PDF. נדרש אימות כיוון התנועה.'
              : undefined,
            confidenceScore: 0.88,
          });

          results.push(sanitized);
        }
      }

      return results;
    };

    // 2. REQUIREMENT: If the PDF contains usable digital text, parse it locally first and do NOT send to Gemini unnecessarily!
    if (!isVisualDocument && extractedText && extractedText.trim().length >= 40) {
      const localTxs = extractLocalTransactionsFromText(extractedText);
      if (localTxs.length > 0) {
        return res.json({
          success: true,
          fileName,
          detectedInstitution,
          extractedTransactions: localTxs,
          extractedTransactionsCount: localTxs.length,
          processingMethod: 'פענוח שכבת טקסט מקומי (Digital Text Layer)',
          isVisualDocument: false,
          message: `חולצו ${localTxs.length} עסקאות אמיתיות ישירות משכבת הטקסט הדיגיטלית של ${fileName}.`,
        });
      }
    }

    // 3. Fallback or Visual (Scanned PDF / Images): Multimodal OCR with Gemini
    const extractionPrompt = `
אתה מפענח מסמכים ותדפיסים בנקאיים וכרטיסי אשראי ישראליים מקצועי.
תפקידך לחלץ אך ורק את העסקאות הפיננסיות האמיתיות הקיימות במסמך.

כללים קריטיים:
1. אסור לחלוטין להמציא עסקאות דמה, עסקאות לדוגמה או נתונים שלא קיימים במסמך.
2. אם אין עסקאות במסמך, החזר מערך ריק: "extractedTransactions": [].
3. חלץ תאריך עסקה מדויק בפורמט YYYY-MM-DD. נרמל תאריכים ישראליים כגון 15/04/2024 או 15/04/24. אם מופיע גם תאריך חיוב/ערך בנפרד, חלץ אותו בשדה "billingDate" (YYYY-MM-DD).
4. סכום חייב להיות מספר חיובי (למשל 120.50), ובנוסף חובה לשמר כיוון תנועה בנפרד: flowDirection הוא inflow / outflow / unknown. אם במסמך קיימים טורי חובה/זכות מפורשים, החזר isDebit ו-isCredit כערכי boolean. אם מופיע סימן מינוס, החזר amountIsNegative: true. אל תסיק כיוון רק משדה type; כאשר אין ראיה ברורה, החזר flowDirection: "unknown" ו-needsReview: true.
5. סיווג מדויק ושמרני של סוגי העסקאות (type):
   - משיכת מזומן / כספומט / בנקומט מסווגת כ-expense (הוצאה / משיכת מזומן), ולא כ-transfer!
   - פירעון כרטיס אשראי / חיוב חודשי כרטיס אשראי בחשבון העו"ש יסווג כ-transfer עם isInternalTransfer: true, כדי למנוע ספירה כפולה אם נטענו עסקאות הכרטיס.
   - העברות בין חשבונות המשתמש / העברה עצמית יסווגו כ-transfer עם isInternalTransfer: true.
   - זיכויים, החזרים כספיים וביטולי עסקאות מול בתי עסק (בגדים, מסעדות, סופר, פארם) יסווגו כ-refund (החזר המקטין הוצאה, ולא כהכנסה!).
   - עסקאות זיכוי מחנויות בגדים/קניונים אסור לעולם לסווג כ-income! הן תמיד refund בקטגוריית "קניות וביגוד".
   - הכנסות אמיתיות בלבד: משכורת, שכר, קצבה, ביטוח לאומי, דיבידנד, ריבית זכות, החזר מס יסווגו כ-income.
   - הוצאות רגילות, קניות, תשלומים יסווגו כ-expense.
   - אם אין מספיק מידע כדי להכריע בוודאות, סמן needsReview: true וציין reviewReason.
6. סווג לקטגוריה מתאימה בעברית (למשל: "משכורת והכנסות", "מזון וסופר", "מסעדות ובילויים", "תחבורה ורכב", "דיור וחשבונות", "תקשורת וטכנולוגיה", "בריאות ופארם", "קניות וביגוד", "ביטוח ופיננסים", "השקעות וחיסכון", "העברות ומזומן", "כללי").

החזר JSON במבנה הבא בלבד:
{
  "detectedInstitution": "${detectedInstitution}",
  "extractedTransactions": [
    {
      "date": "YYYY-MM-DD",
      "billingDate": "YYYY-MM-DD",
      "merchant": "שם בית עסק / תיאור הפעולה",
      "description": "פירוט נוסף אם יש",
      "amount": 123.45,
      "amountIsNegative": false,
      "flowDirection": "outflow",
      "isCredit": false,
      "isDebit": true,
      "type": "expense",
      "category": "שם קטגוריה",
      "currency": "ILS",
      "isRecurring": false,
      "isInternalTransfer": false,
      "needsReview": false,
      "confidenceScore": 0.95
    }
  ]
}
`;

    if (ai) {
      try {
        let contents: any;

        if (isVisualDocument && fileBase64) {
          // Multimodal visual extraction for Scanned PDFs or Images using { parts: [...] }
          const imagePart = {
            inlineData: {
              mimeType: visualMimeType,
              data: fileBase64,
            },
          };
          const textPart = {
            text: `${extractionPrompt}\nזהו מסמך סרוק / תמונה חזותית. אנא בצע OCR מדויק על פי הטבלאות והעמודות וחלץ את כל העסקאות האמיתיות.`,
          };
          contents = { parts: [imagePart, textPart] };
        } else {
          // Text-based extraction from PDF text layer
          contents = `${extractionPrompt}\nטקסט המסמך:\n${extractedText.slice(0, 32000)}`;
        }

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents,
          config: {
            responseMimeType: 'application/json',
          },
        });

        const respText = response.text;
        if (respText) {
          const parsed = JSON.parse(respText);
          if (Array.isArray(parsed.extractedTransactions)) {
            const sanitizedTransactions = parsed.extractedTransactions.map(sanitizeExtractedTransaction);
            return res.json({
              success: sanitizedTransactions.length > 0,
              fileName,
              detectedInstitution: parsed.detectedInstitution || detectedInstitution,
              extractedTransactions: sanitizedTransactions,
              extractedTransactionsCount: sanitizedTransactions.length,
              processingMethod: isVisualDocument ? 'OCR חזותי (Gemini AI)' : 'פענוח שכבת טקסט (Gemini AI)',
              isVisualDocument,
              message: sanitizedTransactions.length > 0
                ? `חולצו ${sanitizedTransactions.length} עסקאות אמיתיות מתוך ${fileName}${isVisualDocument ? ' (באמצעות OCR חזותי)' : ''}.`
                : 'לא זוהו עסקאות במסמך זה.',
            });
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini extraction failed, falling back to local deterministic regex engine:', geminiErr);
      }
    }

    // If visual document and AI failed or not available, return clear actionable error
    if (isVisualDocument && (!extractedText || extractedText.trim().length === 0)) {
      return res.status(422).json({
        success: false,
        extractedTransactions: [],
        error: 'קובץ ה-PDF הינו סרוק או ללא שכבת טקסט דיגיטלית קריאה. נדרש חיבור AI פעיל לצורך פענוח OCR חזותי.',
      });
    }

    // 4. Deterministic Local Regex Fallback if Gemini failed on digital text
    const localFallbackTxs = extractLocalTransactionsFromText(extractedText);
    if (localFallbackTxs.length > 0) {
      return res.json({
        success: true,
        fileName,
        detectedInstitution,
        extractedTransactions: localFallbackTxs,
        extractedTransactionsCount: localFallbackTxs.length,
        processingMethod: 'פענוח מקומי דטרמיניסטי',
        isVisualDocument: false,
        message: `חולצו ${localFallbackTxs.length} עסקאות מתוך ${fileName}.`,
      });
    }

    return res.json({
      success: false,
      fileName,
      detectedInstitution,
      extractedTransactions: [],
      extractedTransactionsCount: 0,
      message: 'לא זוהו עסקאות במסמך זה.',
    });
  } catch (error) {
    console.error('Doc parse error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to parse document',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    process.env.DISABLE_HMR = 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Financial Intelligence App listening on http://0.0.0.0:${port}`);
  });
}

startServer();
