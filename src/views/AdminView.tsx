import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types/financial';
import {
  getAllUsersForAdmin,
  updateUserProfileDoc,
  requestAccountDeletion,
  cancelAccountDeletion,
} from '../services/firebase';
import {
  ShieldAlert,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  RefreshCw,
  EyeOff,
} from 'lucide-react';

interface AdminViewProps {
  currentUserEmail: string;
}

export const AdminView: React.FC<AdminViewProps> = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const list = await getAllUsersForAdmin();
      setUsers(list);
    } catch (err) {
      console.error('Error fetching admin users list:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleStatus = async (user: UserProfile) => {
    const nextStatus = user.accountStatus === 'active' ? 'deactivated' : 'active';
    try {
      await updateUserProfileDoc(user.id, { accountStatus: nextStatus });
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, accountStatus: nextStatus } : u))
      );
      setActionSuccess(
        `סטטוס המשתמש ${user.name} עודכן ל-${nextStatus === 'active' ? 'פעיל' : 'מושבת'}.`
      );
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleInitiateDeletion = async (user: UserProfile) => {
    try {
      await requestAccountDeletion(user.id);
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + 30);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? {
                ...u,
                deletionStatus: 'pending_deletion',
                scheduledDeletionDate: scheduledDate.toISOString(),
              }
            : u
        )
      );
      setActionSuccess(`החשבון של ${user.name} הועבר לתקופת חסד של 30 יום לפני מחיקה.`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancelDeletion = async (user: UserProfile) => {
    try {
      await cancelAccountDeletion(user.id);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? {
                ...u,
                deletionStatus: 'none',
                scheduledDeletionDate: null,
                accountStatus: 'active',
              }
            : u
        )
      );
      setActionSuccess(`בקשת המחיקה עבור ${user.name} בוטלה בהצלחה.`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      (u.username && u.username.toLowerCase().includes(search.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(search.toLowerCase())) ||
      u.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>ניהול משתמשים ומערכת (Admin)</span>
            <span className="text-xs font-mono bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
              Admin Console
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            מעקב אחר קיום חשבונות, סטטוסים תפעוליים ותקופות חסד למחיקה
          </p>
        </div>

        <button
          onClick={fetchUsers}
          disabled={isLoading}
          className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-2 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>רענן נתונים</span>
        </button>
      </div>

      {/* Privacy Guarantee Box */}
      <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-xl p-4 shadow-xs flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-300 dark:border-indigo-700/60 flex items-center justify-center text-indigo-700 dark:text-indigo-300 flex-shrink-0 mt-0.5">
          <EyeOff className="w-4 h-4" />
        </div>
        <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <span>מדיניות אפס-גישה פיננסית (Zero-Knowledge Financial Privacy)</span>
          </div>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
            מערכת הניהול מאפשרת אך ורק מעקב אחר קיום החשבון ומצבו התפעולי. על פי ארכיטקטורת האבטחה
            וחוקי השרת (Firestore Rules), אין למנהל גישה לשום מידע פיננסי אישי (עסקאות, יתרות,
            תקציבים או מסמכים).
          </p>
        </div>
      </div>

      {/* Success Alert */}
      {actionSuccess && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Search and Table */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl overflow-hidden shadow-xs transition-colors">
        <div className="p-3.5 border-b border-slate-200 dark:border-[#1F2937] flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש לפי שם, דוא״ל או User ID..."
              className="w-full bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] rounded-lg pr-9 pl-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {filtered.length} משתמשים
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-[#0B0F17] text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-[#1F2937]">
              <tr>
                <th className="py-2.5 px-4 font-medium">משתמש</th>
                <th className="py-2.5 px-4 font-medium">דוא״ל</th>
                <th className="py-2.5 px-4 font-medium">ספק הזדהות</th>
                <th className="py-2.5 px-4 font-medium">תאריך הרשמה</th>
                <th className="py-2.5 px-4 font-medium">כניסה אחרונה</th>
                <th className="py-2.5 px-4 font-medium">סטטוס</th>
                <th className="py-2.5 px-4 font-medium text-left">פעולות ניהול</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1F2937]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-500">
                    לא נמצאו משתמשים התואמים לחיפוש
                  </td>
                </tr>
              ) : (
                filtered.map((u) => {
                  const isPendingDeletion = u.deletionStatus === 'pending_deletion';
                  const isDeactivated = u.accountStatus === 'deactivated';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span>{u.name}</span>
                          {u.role === 'admin' && (
                            <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-1.5 py-0.2 rounded font-mono font-bold">
                              ADMIN
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 font-normal mt-0.5">
                          UID: {u.id.substring(0, 10)}...
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                        {u.username ? `@${u.username}` : (u.email || '—')}
                      </td>
                      <td className="py-3 px-4">
                        <span className="capitalize px-2 py-0.5 rounded-md text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
                          {u.authProvider.replace('.com', '')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono">
                        {u.createdAt ? u.createdAt.split('T')[0] : '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono">
                        {u.lastLogin ? u.lastLogin.split('T')[0] : '—'}
                      </td>
                      <td className="py-3 px-4">
                        {isPendingDeletion ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-medium">
                            <Clock className="w-3 h-3" />
                            <span>מיועד למחיקה</span>
                          </span>
                        ) : isDeactivated ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-medium">
                            <XCircle className="w-3 h-3" />
                            <span>מושבת</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-medium">
                            <CheckCircle className="w-3 h-3" />
                            <span>פעיל</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Toggle Active / Deactivate */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors border cursor-pointer ${
                              isDeactivated
                                ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                            }`}
                          >
                            {isDeactivated ? 'הפעל חשבון' : 'השבת חשבון'}
                          </button>

                          {/* Deletion Grace Actions */}
                          {isPendingDeletion ? (
                            <button
                              type="button"
                              onClick={() => handleCancelDeletion(u)}
                              className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                            >
                              בטל מחיקה
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleInitiateDeletion(u)}
                              className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-colors flex items-center gap-1 cursor-pointer"
                              title="תזמן מחיקה (30 ימי חסד)"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>מחיקה</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
