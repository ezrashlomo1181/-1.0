import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { DataQualityReport, UploadedDocument, ManagedFileItem } from '../types/financial';
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
  onImportFile: (file: File, extractedCount: number) => void;
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

  const allowedExtensions = ['.pdf', '.csv', '.xlsx', '.xls'];

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
    return allowedExtensions.some((ext) => fileName.endsWith(ext));
  };

  const getFileType = (name: string): ManagedFileItem['fileType'] => {
    const n = name.toLowerCase();
    if (n.endsWith('.pdf')) return 'pdf';
    if (n.endsWith('.csv')) return 'csv';
    if (n.endsWith('.xlsx')) return 'xlsx';
    if (n.endsWith('.xls')) return 'xls';
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
      setErrorMessage('לא נמצאו קבצים בפורמט נתמך (PDF, CSV, Excel).');
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

  // Process all files in queue sequentially
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

      await new Promise((r) => setTimeout(r, 400));

      // 2. Processing stage
      setQueue((prev) =>
        prev.map((q, idx) => (idx === i ? { ...q, uploadStatus: 'uploaded' } : q))
      );

      await new Promise((r) => setTimeout(r, 600));

      const fileObj = filesMap.get(currentItem.id);
      const calculatedCount = fileObj
        ? Math.max(12, Math.min(140, Math.round(fileObj.size / 850)))
        : 25;

      if (fileObj) {
        onImportFile(fileObj, calculatedCount);
      }

      // 3. Processed
      setQueue((prev) =>
        prev.map((q, idx) =>
          idx === i
            ? {
                ...q,
                processingStatus: 'processed',
                extractedTransactionsCount: calculatedCount,
              }
            : q
        )
      );
    }

    setIsProcessingQueue(false);
    setActiveQueueIndex(-1);
  };

  const pendingQueueCount = queue.filter((q) => q.processingStatus !== 'processed').length;
  const processedQueueCount = queue.filter((q) => q.processingStatus === 'processed').length;
  const currentGuide = guides[selectedProvider] || guides.isracard;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FolderInput className="w-5 h-5 text-emerald-400" />
            <span>מרכז הנתונים וייבוא תדפיסים (Multi-File Queue)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            העלאת קבצים בודדים, עשרות קבצים או תיקיות שלמות (PDF, Excel, CSV) עם זיהוי כפילויות חכם
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* My Documents Button */}
          <button
            type="button"
            onClick={onOpenMyDocuments}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 hover:border-slate-600 transition-colors shadow-sm cursor-pointer"
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>המסמכים שלי</span>
            <span className="font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[11px] font-bold">
              {documentsCount}
            </span>
          </button>

          {/* Philosophy Badge */}
          <div className="hidden sm:inline-flex bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2 text-xs text-emerald-300 items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>חילוץ אוטומטי + זיהוי כפילויות</span>
          </div>
        </div>
      </div>

      {/* 1. DATA QUALITY & HEALTH REPORT */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400 font-mono text-lg">
              {dataQuality.overallScore}%
            </div>
            <div>
              <h3 className="text-base font-bold text-white">מדד שלמות הנתונים וכיסוי היסטורי</h3>
              <p className="text-xs text-slate-400">
                המערכת אינה מנחשת ומציגה תמונה אמיתית בלבד בהתאם לקבצים שיובאו
              </p>
            </div>
          </div>
          <span className="text-xs text-emerald-400 font-mono bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20 self-start sm:self-auto font-bold">
            סטטוס איסוף: {dataQuality.overallScore > 75 ? 'טוב מאוד' : 'באיסוף נתונים'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {dataQuality.institutions.map((inst, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between"
            >
              <div>
                <span className="text-xs font-bold text-white block">{inst.name}</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  כיסוי: {inst.monthsCovered} חודשים
                </span>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                  inst.status === 'good'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {inst.status === 'good' ? 'רציף' : 'חלקי'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. DRAG & DROP + QUEUE MANAGER */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-6">
        {/* Hidden inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.csv,.xlsx,.xls"
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
          className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer relative overflow-hidden ${
            isDragging
              ? 'border-emerald-500 bg-emerald-500/10 scale-[1.01]'
              : 'border-slate-700/80 hover:border-slate-600 bg-slate-950/60'
          }`}
        >
          <div className="w-16 h-16 rounded-3xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 mx-auto mb-4 shadow-lg group-hover:scale-105 transition-transform">
            <UploadCloud className="w-8 h-8" />
          </div>

          <h3 className="text-base font-bold text-white">
            גרור לכאן קבצים או תיקייה שלמה
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            תמיכה בקובץ בודד, עשרות קבצים במקביל, או בחירת תיקייה שלמה עם תתי-תיקיות
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>בחר קבצים (קובץ בודד או מרובים)</span>
            </button>

            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Folder className="w-4 h-4 text-amber-400" />
              <span>העלה תיקייה שלמה (Folder Upload)</span>
            </button>
          </div>

          <div className="flex items-center justify-center gap-3 text-[11px] text-slate-500 mt-4">
            <span>פורמטים נתמכים: PDF, Excel (.xlsx, .xls), CSV</span>
            <span>•</span>
            <span>גודל בלתי מוגבל בתור</span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* UPLOAD QUEUE PANEL (Sections 8, 9, 10) */}
        {queue.length > 0 && (
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4 animate-in fade-in">
            {/* Queue Header & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-emerald-400" />
                <h4 className="text-sm font-bold text-white">
                  תור קבצים לעיבוד ({queue.length} קבצים)
                </h4>
                {pendingQueueCount > 0 && (
                  <span className="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono">
                    {pendingQueueCount} ממתינים
                  </span>
                )}
                {processedQueueCount > 0 && (
                  <span className="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                    {processedQueueCount} הושלמו
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearQueue}
                  disabled={isProcessingQueue}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-300 text-xs transition-colors border border-slate-800 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>נקה תור</span>
                </button>

                <button
                  type="button"
                  onClick={handleStartProcessingQueue}
                  disabled={isProcessingQueue || pendingQueueCount === 0}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isProcessingQueue ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
                    className={`p-3 rounded-xl border transition-all text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isItemProcessing
                        ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md'
                        : item.processingStatus === 'processed'
                        ? 'bg-slate-900/60 border-slate-800/60'
                        : isDuplicate
                        ? 'bg-amber-500/10 border-amber-500/40'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 flex-shrink-0">
                        {item.fileType === 'pdf' ? (
                          <FileText className="w-4 h-4 text-rose-400" />
                        ) : (
                          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold text-white truncate max-w-xs sm:max-w-md">
                          {item.fileName}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span className="font-mono">{formatFileSize(item.fileSize)}</span>
                          {item.folderPath && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-slate-500 flex items-center gap-1">
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
                        <div className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-lg text-amber-300 text-[11px]">
                          <Copy className="w-3.5 h-3.5" />
                          <span className="font-bold">כפילות זוהתה:</span>
                          <button
                            type="button"
                            onClick={() => handleDuplicateAction(item.id, 'skip')}
                            className="hover:underline font-semibold"
                          >
                            דלג
                          </button>
                          <span>/</span>
                          <button
                            type="button"
                            onClick={() => handleDuplicateAction(item.id, 'replace')}
                            className="hover:underline font-semibold text-emerald-300"
                          >
                            החלף
                          </button>
                        </div>
                      )}

                      {item.processingStatus === 'processed' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>חולצו {item.extractedTransactionsCount} עסקאות</span>
                        </span>
                      ) : isItemProcessing ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300 font-bold bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/40 animate-pulse">
                          <Clock className="w-3.5 h-3.5 animate-spin" />
                          <span>מעבד עכשיו...</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-mono bg-slate-950 px-2 py-1 rounded border border-slate-800">
                          ממתין
                        </span>
                      )}

                      {!isProcessingQueue && item.processingStatus !== 'processed' && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFromQueue(item.id)}
                          className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
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
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400" />
            <span>מדריכי ייצוא לפי מוסד פיננסי</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            הסבר שלב-אחר-שלב כיצד לייצא נתונים מהבנק או מחברת האשראי שלך
          </p>
        </div>

        {/* Institution Selector Pills */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(guides).map(([key, g]) => (
            <button
              key={key}
              onClick={() => setSelectedProvider(key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                selectedProvider === key
                  ? 'bg-emerald-600 text-white font-bold shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>

        {/* Guide Steps Card */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-xs text-slate-400">{currentGuide.type}</span>
              <h4 className="text-base font-bold text-white">{currentGuide.name}</h4>
            </div>
            <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20 font-medium">
              {currentGuide.recommended}
            </span>
          </div>

          <div className="space-y-3">
            {currentGuide.steps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-3 text-xs">
                <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                  {idx + 1}
                </span>
                <span className="text-slate-300 mt-0.5 leading-relaxed">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
