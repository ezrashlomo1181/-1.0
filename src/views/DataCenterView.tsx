import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { DataQualityReport, UploadedDocument, ManagedFileItem, Transaction } from '../types/financial';
import { parseFinancialDocument } from '../services/documentParser';
import {
  FolderInput,
  UploadCloud,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Info,
  Sparkles,
  File,
  X,
  ArrowRight,
  ShieldCheck,
  Folder,
  Layers,
  Play,
  RotateCcw,
  Check,
  Clock,
  Trash2,
  Copy,
  AlertCircle,
} from 'lucide-react';

interface DataCenterViewProps {
  dataQuality: DataQualityReport;
  documentsCount: number;
  existingDocuments?: UploadedDocument[];
  onOpenMyDocuments: () => void;
  onImportFile: (file: File, extractedTransactions: Transaction[], detectedInstitution?: string) => void;
}

export const DataCenterView: React.FC<DataCenterViewProps> = ({
  dataQuality,
  documentsCount,
  existingDocuments = [],
  onOpenMyDocuments,
  onImportFile,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<string>('isracard');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessingQueue, setIsProcessingQueue] = useState<boolean>(false);
  const [activeQueueIndex, setActiveQueueIndex] = useState<number>(-1);
  const [queue, setQueue] = useState<ManagedFileItem[]>([]);
  const [filesMap, setFilesMap] = useState<Map<string, File>>(new Map());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const allowedExtensions = [
    '.pdf',
    '.csv',
    '.xlsx',
    '.xls',
    '.xlsm',
    '.xlsb',
    '.ods',
    '.tsv',
    '.txt',
    '.html',
    '.htm',
    '.json',
    '.xml',
    '.ofx',
    '.qfx',
    '.zip',
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
  ];

  const guides: Record<
    string,
    { name: string; type: string; steps: string[]; recommended: string }
  > = {
    isracard: {
      name: 'ישראכרט (Isracard)',
      type: 'כרטיסי אשראי',
      steps: [
        'התחבר לאתר או לאפליקציית ישראכרט באמצעות קוד חד-פעמי או סיסמה.',
        'בתפריט העליון לחץ על «פירוט חיובים ועסקאות».',
        'בחר טווח תאריכים מבוקש (מומלץ 6 עד 12 חודשים אחרונים).',
        'לחץ על כפתור «ייצוא לקובץ Excel» (או הורדת PDF חודשי).',
        'גרור את הקובץ או התיקייה שהורדו לאזור ההעלאה שלמעלה.',
      ],
      recommended: 'מומלץ להעלות לפחות 6 חודשים של מידע, ואם אפשר 12 חודשים.',
    },
    hapoalim: {
      name: 'בנק הפועלים',
      type: 'בנקים',
      steps: [
        'התחבר לאתר בנק הפועלים באינטרנט.',
        'היכנס לחשבון העו״ש ולחץ על «תנועות בחשבון».',
        'הגדר תאריכי סינון: בחר «שנה אחרונה» או טווח מותאם אישית.',
        'לחץ על סמל ההורדה ובחר «ייצוא לאקסל» (פורמט XLS / XLSX / CSV).',
        'העלה את הקובץ או תיקיית הדוחות למערכת «מצפן פיננסי».',
      ],
      recommended: '12 חודשים מומלצים לזיהוי מדויק של שכר והוראות קבע שנתיות.',
    },
    leumi: {
      name: 'בנק לאומי',
      type: 'בנקים',
      steps: [
        'היכנס לאתר לאומי באמצעות תעודת זהות וסיסמה.',
        'עבור ללשונית «עו״ש» ובחר «תנועות אחרונות».',
        'לחץ על «חיפוש מתקדם» והגדר טווח של 12 חודשים.',
        'לחץ על כפתור «הורד לאקסל».',
        'גרור לכאן את הקבצים.',
      ],
      recommended: 'מומלץ לייצא גם דוח פקדונות וחסכונות.',
    },
    max: {
      name: 'MAX (לאומי קארד לשעבר)',
      type: 'כרטיסי אשראי',
      steps: [
        'התחבר לחשבונך באתר MAX.',
        'לחץ על «פירוט עסקאות» ובחר את כל הכרטיסים הפעילים.',
        'בחר תקופה של 6-12 חודשים אחרונים.',
        'הורד את קובץ האקסל או דוח PDF מרוכז.',
        'העלה את הקבצים לאזור הגרירה.',
      ],
      recommended: 'וודא שהדוח כולל עסקאות חו״ל והוראות קבע.',
    },
    cal: {
      name: 'כרטיסי אשראי לישראל (Cal)',
      type: 'כרטיסי אשראי',
      steps: [
        'התחבר לאתר כאל (Cal Online).',
        'עבור ל«עסקאות וחיובים» ובחר «עסקאות שחויבו בעבר».',
        'סמן את טווח החודשים המבוקש.',
        'לחץ על כפתור «ייצוא ל-Excel».',
        'העלה את הקבצים כאן.',
      ],
      recommended: 'מומלץ לייצא לפחות 6 חודשים.',
    },
    meitav: {
      name: 'מיטב טרייד / בתי השקעות',
      type: 'השקעות',
      steps: [
        'התחבר למערכת המסחר העצמאית (Spark / Trade).',
        'עבור ל«דוחות» ולחץ על «דוח יתרות והחזקות» וכן «תנועות כספיות».',
        'ייצא כקובץ Excel או PDF שנתי.',
        'העלה למערכת לסנכרון שווי ורווחי הון.',
      ],
      recommended: 'דוח שנתי מלא מאפשר חישוב תשואה אמיתי ללא הערכות שווא.',
    },
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const isFileSupported = (file: File): boolean => {
    const fileName = file.name.toLowerCase();
    const hasAllowedExt = allowedExtensions.some((ext) => fileName.endsWith(ext));
    if (hasAllowedExt) return true;
    const mime = (file.type || '').toLowerCase();
    if (
      mime.includes('html') ||
      mime.includes('csv') ||
      mime.includes('spreadsheet') ||
      mime.includes('excel') ||
      mime.includes('pdf') ||
      mime.includes('json') ||
      mime.includes('xml') ||
      mime.includes('zip') ||
      mime.includes('image/')
    ) {
      return true;
    }
    return false;
  };

  const getFileType = (name: string): ManagedFileItem['fileType'] => {
    const n = name.toLowerCase();
    if (n.endsWith('.pdf')) return 'pdf';
    if (n.endsWith('.csv') || n.endsWith('.tsv') || n.endsWith('.txt')) return 'csv';
    if (n.endsWith('.xlsx') || n.endsWith('.xlsm') || n.endsWith('.xlsb') || n.endsWith('.ods')) return 'xlsx';
    if (n.endsWith('.xls')) return 'xls';
    if (n.endsWith('.html') || n.endsWith('.htm')) return 'html';
    if (n.endsWith('.json')) return 'json';
    if (n.endsWith('.ofx') || n.endsWith('.qfx') || n.endsWith('.xml')) return 'ofx';
    if (n.endsWith('.zip')) return 'zip';
    if (n.match(/\.(jpg|jpeg|png|webp)$/i)) return 'image';
    return 'unknown';
  };

  // Add files to queue with duplicate detection
  const addFilesToQueue = (filesList: { file: File; folderPath?: string }[]) => {
    setErrorMessage(null);

    const newQueueItems: ManagedFileItem[] = [];
    const newMap = new Map(filesMap);

    for (const item of filesList) {
      const file = item.file;
      if (!isFileSupported(file)) {
        continue;
      }

      const fileId = `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const fileHash = `${file.name}_${file.size}_${file.lastModified}`;

      // Check duplicate against existing documents and queue items
      const isDuplicateInExisting = existingDocuments.some(
        (doc) => doc.fileName === file.name && doc.fileSize === file.size
      );
      const isDuplicateInQueue = queue.some(
        (q) => q.fileName === file.name && q.fileSize === file.size
      );

      const isDuplicate = isDuplicateInExisting || isDuplicateInQueue;

      const queueItem: ManagedFileItem = {
        id: fileId,
        fileName: file.name,
        fileSize: file.size,
        fileType: getFileType(file.name),
        folderPath: item.folderPath || (file.webkitRelativePath ? file.webkitRelativePath.split('/').slice(0, -1).join('/') : undefined),
        fileHash,
        uploadStatus: 'waiting',
        processingStatus: 'waiting',
        duplicateStatus: isDuplicate ? 'potential_duplicate' : 'none',
        extractedTransactionsCount: 0,
        createdAt: new Date().toISOString(),
      };

      newQueueItems.push(queueItem);
      newMap.set(fileId, file);
    }

    if (newQueueItems.length === 0 && filesList.length > 0) {
      setErrorMessage('לא נמצאו קבצים בפורמט נתמך (Excel, CSV, PDF, HTML, JSON, OFX, תמונות, ZIP).');
      return;
    }

    setQueue((prev) => [...prev, ...newQueueItems]);
    setFilesMap(newMap);
  };

  // Drag & drop handlers supporting files and directories recursively
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    const collectedFiles: { file: File; folderPath?: string }[] = [];

    if (items && items.length > 0) {
      const traverseEntry = async (entry: any, path = ''): Promise<void> => {
        if (entry.isFile) {
          return new Promise<void>((resolve) => {
            entry.file((file: File) => {
              collectedFiles.push({ file, folderPath: path || undefined });
              resolve();
            });
          });
        } else if (entry.isDirectory) {
          const dirReader = entry.createReader();
          return new Promise<void>((resolve) => {
            const readEntries = () => {
              dirReader.readEntries(async (entries: any[]) => {
                if (entries.length === 0) {
                  resolve();
                } else {
                  for (const subEntry of entries) {
                    await traverseEntry(subEntry, `${path}${entry.name}/`);
                  }
                  readEntries();
                }
              });
            };
            readEntries();
          });
        }
      };

      const entryPromises: Promise<void>[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.webkitGetAsEntry) {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            entryPromises.push(traverseEntry(entry));
          }
        }
      }

      await Promise.all(entryPromises);

      if (collectedFiles.length > 0) {
        addFilesToQueue(collectedFiles);
        return;
      }
    }

    // Fallback to basic files list
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const arr = Array.from(e.dataTransfer.files).map((f) => ({ file: f }));
      addFilesToQueue(arr);
    }
  };

  const handleFilesSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const arr = Array.from(e.target.files).map((f) => ({ file: f }));
      addFilesToQueue(arr);
    }
  };

  const handleFolderSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const arr = Array.from(e.target.files).map((f) => {
        const path = f.webkitRelativePath ? f.webkitRelativePath.split('/').slice(0, -1).join('/') : undefined;
        return { file: f, folderPath: path };
      });
      addFilesToQueue(arr);
    }
  };

  // Queue actions
  const handleRemoveFromQueue = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
    setFilesMap((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  const handleClearQueue = () => {
    setQueue([]);
    setFilesMap(new Map());
  };

  const handleDuplicateAction = (id: string, action: 'skip' | 'replace' | 'review') => {
    if (action === 'skip') {
      handleRemoveFromQueue(id);
    } else {
      setQueue((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                duplicateStatus: action === 'replace' ? 'none' : 'confirmed_duplicate',
              }
            : item
        )
      );
    }
  };

  // Process all files in queue sequentially using real document parser
  const handleStartProcessingQueue = async () => {
    if (queue.length === 0 || isProcessingQueue) return;

    setIsProcessingQueue(true);

    for (let i = 0; i < queue.length; i++) {
      const currentItem = queue[i];

      // Skip already processed or skipped
      if (currentItem.processingStatus === 'processed') continue;

      setActiveQueueIndex(i);

      // 1. Uploading stage
      setQueue((prev) =>
        prev.map((q, idx) =>
          idx === i ? { ...q, uploadStatus: 'uploading', processingStatus: 'processing' } : q
        )
      );

      const fileObj = filesMap.get(currentItem.id);
      if (fileObj) {
        try {
          // Real document parsing (Excel, CSV, PDF)
          const parseResult = await parseFinancialDocument(fileObj);

          if (parseResult.success && parseResult.transactions.length > 0) {
            onImportFile(fileObj, parseResult.transactions, parseResult.institution);

            setQueue((prev) =>
              prev.map((q, idx) =>
                idx === i
                  ? {
                      ...q,
                      uploadStatus: 'uploaded',
                      processingStatus: 'processed',
                      extractedTransactionsCount: parseResult.transactions.length,
                      institutionDetected: parseResult.institution,
                      errorDetails: undefined,
                    }
                  : q
              )
            );
          } else {
            // File was empty or could not yield real transactions
            setQueue((prev) =>
              prev.map((q, idx) =>
                idx === i
                  ? {
                      ...q,
                      uploadStatus: 'uploaded',
                      processingStatus: 'needs_review',
                      extractedTransactionsCount: 0,
                      institutionDetected: parseResult.institution,
                      errorDetails: parseResult.error || 'לא זוהו עסקאות במסמך זה',
                    }
                  : q
              )
            );
          }
        } catch (err) {
          setQueue((prev) =>
            prev.map((q, idx) =>
              idx === i
                ? {
                    ...q,
                    uploadStatus: 'failed',
                    processingStatus: 'needs_review',
                    extractedTransactionsCount: 0,
                    errorDetails: err instanceof Error ? err.message : 'שגיאה בעיבוד הקובץ',
                  }
                : q
            )
          );
        }
      }
    }

    setIsProcessingQueue(false);
    setActiveQueueIndex(-1);
  };

  const pendingQueueCount = queue.filter((q) => q.processingStatus !== 'processed').length;
  const processedQueueCount = queue.filter((q) => q.processingStatus === 'processed').length;
  const currentGuide = guides[selectedProvider] || guides.isracard;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>מרכז הנתונים וייבוא תדפיסים</span>
            <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
              תור העלאות
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            העלאת קבצים בודדים, עשרות קבצים או תיקיות שלמות (PDF, Excel, CSV) עם זיהוי כפילויות חכם
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* My Documents Button */}
          <button
            type="button"
            onClick={onOpenMyDocuments}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-medium text-xs border border-slate-200 dark:border-slate-700 transition-colors shadow-xs cursor-pointer"
          >
            <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>המסמכים שלי</span>
            <span className="font-mono bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.2 rounded-md text-[11px] font-bold">
              {documentsCount}
            </span>
          </button>
        </div>
      </div>

      {/* 1. DATA QUALITY & HEALTH REPORT */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-5 shadow-xs space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#1F2937] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-slate-900 dark:text-white font-mono text-base">
              {dataQuality.overallScore}%
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">מדד שלמות הנתונים וכיסוי היסטורי</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                המערכת אינה מנחשת ומציגה תמונה אמיתית בלבד בהתאם לקבצים שיובאו
              </p>
            </div>
          </div>
          <span className="text-xs text-slate-700 dark:text-slate-300 font-mono bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 self-start sm:self-auto font-medium">
            סטטוס: {dataQuality.overallScore > 75 ? 'כיסוי מקיף' : 'באיסוף נתונים'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {dataQuality.institutions.map((inst, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] flex items-center justify-between"
            >
              <div>
                <span className="text-xs font-bold text-[#0F172A] dark:text-white block">{inst.name}</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  כיסוי: {inst.monthsCovered} חודשים
                </span>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                  inst.status === 'good'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                }`}
              >
                {inst.status === 'good' ? 'רציף' : 'חלקי'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. DRAG & DROP + QUEUE MANAGER */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-5 shadow-xs space-y-5 transition-colors">
        {/* Hidden inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.csv,.xlsx,.xls,.xlsm,.xlsb,.ods,.tsv,.txt,.html,.htm,.json,.xml,.ofx,.qfx,.zip,.jpg,.jpeg,.png,.webp,text/html,text/csv,text/plain,application/pdf,application/json,text/xml,application/xml,image/*,application/zip,application/x-zip-compressed,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.oasis.opendocument.spreadsheet"
          onChange={handleFilesSelect}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          {...({ webkitdirectory: '', directory: '' } as any)}
          onChange={handleFolderSelect}
          className="hidden"
        />

        {/* Dropzone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer relative overflow-hidden ${
            isDragging
              ? 'border-slate-800 bg-slate-100/60 dark:border-slate-500 dark:bg-slate-800/40'
              : 'border-slate-300 hover:border-slate-400 dark:border-[#1F2937] dark:hover:border-slate-600 bg-slate-50/60 dark:bg-[#0B0F17]'
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 mx-auto mb-3 shadow-xs">
            <UploadCloud className="w-6 h-6" />
          </div>

          <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">
            גרור לכאן קבצים או תיקייה שלמה
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            תמיכה בקובץ בודד, עשרות קבצים במקביל, או בחירת תיקייה שלמה
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 font-medium text-xs transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>בחר קבצים (Excel, CSV, PDF, HTML, עוד...)</span>
            </button>

            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs border border-slate-200 dark:border-slate-700 transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Folder className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>העלה תיקייה (Folder Upload)</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-3 max-w-2xl mx-auto">
            <span className="font-medium text-slate-700 dark:text-slate-300">פורמטים נתמכים:</span>
            <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">Excel (.xlsx, .xls, .ods)</span>
            <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">CSV / TSV / TXT</span>
            <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 rounded font-semibold">HTML / HTM (דפי פירוט תנועות)</span>
            <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">PDF (כולל סרוק)</span>
            <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">JSON / XML / OFX</span>
            <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">תמונות (JPG, PNG)</span>
            <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">ארכיוני ZIP</span>
            <span>• ללא מגבלת כמות</span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-600 dark:text-rose-400 hover:text-rose-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* UPLOAD QUEUE PANEL (Sections 8, 9, 10) */}
        {queue.length > 0 && (
          <div className="bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] rounded-xl p-4 space-y-4 animate-in fade-in">
            {/* Queue Header & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-[#1F2937] pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                <h4 className="text-xs font-bold text-[#0F172A] dark:text-white">
                  תור קבצים לעיבוד ({queue.length} קבצים)
                </h4>
                {pendingQueueCount > 0 && (
                  <span className="text-[11px] bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-1.5 py-0.2 rounded-md font-mono font-medium">
                    {pendingQueueCount} ממתינים
                  </span>
                )}
                {processedQueueCount > 0 && (
                  <span className="text-[11px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.2 rounded-md font-mono font-medium">
                    {processedQueueCount} הושלמו
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearQueue}
                  disabled={isProcessingQueue}
                  className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-rose-600 text-xs transition-colors border border-slate-200 dark:border-slate-700 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>נקה תור</span>
                </button>

                <button
                  type="button"
                  onClick={handleStartProcessingQueue}
                  disabled={isProcessingQueue || pendingQueueCount === 0}
                  className="px-3.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 font-semibold text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isProcessingQueue ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>מעבד קבצים...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>התחל עיבוד תור ({pendingQueueCount})</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Queue Items List */}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {queue.map((item, idx) => {
                const isItemProcessing = activeQueueIndex === idx;
                const isDuplicate = item.duplicateStatus !== 'none';

                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-lg border transition-all text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isItemProcessing
                        ? 'bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700'
                        : item.processingStatus === 'processed'
                        ? 'bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-[#1F2937]/80'
                        : isDuplicate
                        ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-[#1F2937]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 flex-shrink-0">
                        {item.fileType === 'pdf' ? (
                          <FileText className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        ) : (
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md">
                          {item.fileName}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <span className="font-mono">{formatFileSize(item.fileSize)}</span>
                          {item.folderPath && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-slate-400 flex items-center gap-1">
                                <Folder className="w-3 h-3" />
                                {item.folderPath}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status & Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {isDuplicate && item.processingStatus === 'waiting' && (
                        <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-md text-amber-800 dark:text-amber-300 text-[11px]">
                          <Copy className="w-3.5 h-3.5" />
                          <span className="font-bold">כפילות:</span>
                          <button
                            type="button"
                            onClick={() => handleDuplicateAction(item.id, 'skip')}
                            className="hover:underline font-semibold cursor-pointer"
                          >
                            דלג
                          </button>
                          <span>/</span>
                          <button
                            type="button"
                            onClick={() => handleDuplicateAction(item.id, 'replace')}
                            className="hover:underline font-semibold text-emerald-700 dark:text-emerald-300 cursor-pointer"
                          >
                            החלף
                          </button>
                        </div>
                      )}

                      {item.processingStatus === 'processed' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-800 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>חולצו {item.extractedTransactionsCount} עסקאות</span>
                        </span>
                      ) : item.processingStatus === 'needs_review' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-800 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800" title={item.errorDetails}>
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span className="truncate max-w-[140px]">{item.errorDetails || 'ללא עסקאות'}</span>
                        </span>
                      ) : isItemProcessing ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-800 dark:text-slate-300 font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 animate-pulse">
                          <Clock className="w-3.5 h-3.5 animate-spin text-slate-600" />
                          <span>מעבד עכשיו...</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-[#1F2937]">
                          ממתין
                        </span>
                      )}

                      {!isProcessingQueue && item.processingStatus !== 'processed' && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFromQueue(item.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                          title="הסר מהתור"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. IMPORT GUIDES */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-5 shadow-xs space-y-4 transition-colors">
        <div>
          <h3 className="text-sm font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>מדריכי ייצוא לפי מוסד פיננסי</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            הסבר שלב-אחר-שלב כיצד לייצא נתונים מהבנק או מחברת האשראי שלך
          </p>
        </div>

        {/* Institution Selector Pills */}
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(guides).map(([key, g]) => (
            <button
              key={key}
              onClick={() => setSelectedProvider(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                selectedProvider === key
                  ? 'bg-slate-900 text-white dark:bg-slate-800 dark:text-white font-semibold shadow-xs border border-slate-900 dark:border-slate-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800 border border-transparent'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>

        {/* Guide Steps Card */}
        <div className="bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1F2937] pb-2.5">
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{currentGuide.type}</span>
              <h4 className="text-sm font-bold text-[#0F172A] dark:text-white">{currentGuide.name}</h4>
            </div>
            <span className="text-[11px] text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 font-medium">
              {currentGuide.recommended}
            </span>
          </div>

          <div className="space-y-2">
            {currentGuide.steps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs">
                <span className="w-5 h-5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold flex items-center justify-center flex-shrink-0 text-[11px]">
                  {idx + 1}
                </span>
                <span className="text-slate-700 dark:text-slate-300 leading-relaxed">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
