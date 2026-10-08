import React, { useState } from 'react';
import { UploadedDocument } from '../types/financial';
import {
  FileText,
  FileSpreadsheet,
  File,
  FileCode,
  Archive,
  Image as ImageIcon,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  Database,
  Building,
} from 'lucide-react';

interface MyDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: UploadedDocument[];
  onDeleteDocument: (docId: string, fileName: string) => void;
}

export const MyDocumentsModal: React.FC<MyDocumentsModalProps> = ({
  isOpen,
  onClose,
  documents,
  onDeleteDocument,
}) => {
  const [docToDelete, setDocToDelete] = useState<UploadedDocument | null>(null);

  if (!isOpen) return null;

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case 'xlsx':
      case 'xls':
      case 'ods':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />;
      case 'csv':
      case 'tsv':
      case 'txt':
        return <FileSpreadsheet className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'html':
      case 'htm':
        return <FileCode className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />;
      case 'pdf':
        return <FileText className="w-5 h-5 text-rose-500 dark:text-rose-400" />;
      case 'json':
      case 'xml':
      case 'ofx':
      case 'qfx':
        return <FileCode className="w-5 h-5 text-amber-500 dark:text-amber-400" />;
      case 'zip':
        return <Archive className="w-5 h-5 text-purple-500 dark:text-purple-400" />;
      case 'image':
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'webp':
        return <ImageIcon className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />;
      default:
        return <File className="w-5 h-5 text-slate-400" />;
    }
  };

  const confirmDelete = () => {
    if (docToDelete) {
      onDeleteDocument(docToDelete.id, docToDelete.fileName);
      setDocToDelete(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] text-[#0F172A] dark:text-slate-100">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#0B0F17] border-b border-slate-200 dark:border-[#1F2937] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0F172A] dark:text-white">
                המסמכים שלי
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {documents.length} קבצי מקור שמורים ומסונכרנים במערכת
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {documents.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <File className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">עדיין לא הועלו מסמכים למערכת</p>
              <p className="text-xs text-slate-500">
                גרור קובץ באזור ההעלאה של מרכז הנתונים כדי לראות אותו כאן.
              </p>
            </div>
          ) : (
            documents.map((doc) => (
              <div
                key={doc.id}
                className="p-4 rounded-xl bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {getFileIcon(doc.fileType)}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="font-bold text-[#0F172A] dark:text-white text-sm truncate" title={doc.fileName}>
                      {doc.fileName}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-mono uppercase bg-slate-200/70 dark:bg-slate-800 px-1.5 py-0.2 rounded text-slate-700 dark:text-slate-300">
                        {doc.fileType}
                      </span>
                      <span>•</span>
                      <span className="font-mono">{formatFileSize(doc.fileSize)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {doc.uploadDate}
                      </span>
                      {doc.institution && (
                        <>
                          <span>•</span>
                          <span className="text-slate-700 dark:text-slate-300">{doc.institution}</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-3 pt-1 text-xs">
                      <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-500" />
                        <span>חולצו {doc.transactionsCount} עסקאות</span>
                      </span>
                      <span className="text-slate-400 text-[11px]">• מעובד ומסונכרן</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200 dark:border-[#1F2937]">
                  <button
                    onClick={() => setDocToDelete(doc)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 transition-colors cursor-pointer"
                    title="מחק מסמך ועסקאותיו"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>מחק מסמך</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-[#0B0F17] border-t border-slate-200 dark:border-[#1F2937] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            מחיקת מסמך מסירה לצמיתות את כל העסקאות שחולצו ממנו ממאגר הנתונים.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 font-semibold transition-colors cursor-pointer"
          >
            סגור
          </button>
        </div>
      </div>

      {/* Confirmation Sub-Modal for Real Deletion */}
      {docToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 text-[#0F172A] dark:text-slate-100">
            <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center text-rose-700 dark:text-rose-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h4 className="text-base font-bold text-[#0F172A] dark:text-white">
                אישור מחיקת מסמך ועסקאות
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                האם אתה בטוח שברצונך למחוק את המסמך:
              </p>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] font-mono text-xs text-rose-700 dark:text-rose-400 font-semibold break-all">
                {docToDelete.fileName}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-right pt-2 leading-relaxed">
                ⚠️ <strong>שים לב:</strong> זוהי מחיקה ממשית. כל{' '}
                <span className="font-bold text-[#0F172A] dark:text-white">{docToDelete.transactionsCount} העסקאות</span>{' '}
                שחולצו ממסמך זה יימחקו לחלוטין מיומן העסקאות, התקציב ופילוח ההוצאות.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDocToDelete(null)}
                className="flex-1 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
              >
                כן, מחק לצמיתות
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
