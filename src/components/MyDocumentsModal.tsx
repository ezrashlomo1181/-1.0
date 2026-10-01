import React, { useState } from 'react';
import { UploadedDocument } from '../types/financial';
import {
  FileText,
  FileSpreadsheet,
  File,
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
        return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
      case 'csv':
        return <FileSpreadsheet className="w-5 h-5 text-cyan-400" />;
      case 'pdf':
        return <FileText className="w-5 h-5 text-rose-400" />;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                המסמכים שלי
              </h3>
              <p className="text-xs text-slate-400">
                {documents.length} קבצי מקור שמורים ומסונכרנים במערכת
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {documents.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <File className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">עדיין לא הועלו מסמכים למערכת</p>
              <p className="text-xs text-slate-500">
                גרור קובץ באזור ההעלאה של מרכז הנתונים כדי לראות אותו כאן.
              </p>
            </div>
          ) : (
            documents.map((doc) => (
              <div
                key={doc.id}
                className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {getFileIcon(doc.fileType)}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="font-bold text-white text-sm truncate" title={doc.fileName}>
                      {doc.fileName}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      <span className="font-mono uppercase bg-slate-800 px-1.5 py-0.2 rounded text-slate-300">
                        {doc.fileType}
                      </span>
                      <span>•</span>
                      <span className="font-mono">{formatFileSize(doc.fileSize)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        {doc.uploadDate}
                      </span>
                      {doc.institution && (
                        <>
                          <span>•</span>
                          <span className="text-slate-300">{doc.institution}</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-3 pt-1 text-xs">
                      <span className="text-emerald-400 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>חולצו {doc.transactionsCount} עסקאות</span>
                      </span>
                      <span className="text-slate-500 text-[11px]">• מעובד ומסונכרן</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                  <button
                    onClick={() => setDocToDelete(doc)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-300 hover:text-rose-100 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 transition-colors"
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
        <div className="px-6 py-3.5 bg-slate-800/50 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
          <span>
            מחיקת מסמך מסירה לצמיתות את כל העסקאות שחולצו ממנו ממאגר הנתונים.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
          >
            סגור
          </button>
        </div>
      </div>

      {/* Confirmation Sub-Modal for Real Deletion */}
      {docToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h4 className="text-base font-bold text-white">
                אישור מחיקת מסמך ועסקאות
              </h4>
              <p className="text-xs text-slate-300">
                האם אתה בטוח שברצונך למחוק את המסמך:
              </p>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-rose-300 font-semibold break-all">
                {docToDelete.fileName}
              </div>
              <p className="text-xs text-slate-400 text-right pt-2 leading-relaxed">
                ⚠️ <strong>שים לב:</strong> זוהי מחיקה ממשית. כל{' '}
                <span className="text-white font-bold">{docToDelete.transactionsCount} העסקאות</span>{' '}
                שחולצו ממסמך זה יימחקו לחלוטין מיומן העסקאות, התקציב ופילוח ההוצאות.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDocToDelete(null)}
                className="flex-1 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors shadow-lg shadow-rose-900/30"
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
