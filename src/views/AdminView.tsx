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
  Users,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  RefreshCw,
  Lock,
  EyeOff,
  AlertTriangle,
  Calendar,
} from 'lucide-react';

interface AdminViewProps {
  currentUserEmail: string;
}

export const AdminView: React.FC<AdminViewProps> = ({ currentUserEmail }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
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
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-indigo-400" />
            <span>ניהול משתמשים ומערכת (Admin)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            מעקב אחר קיום חשבונות, סטטוסים ותקופות חסד למחיקה
          </p>
        </div>

        <button
          onClick={fetchUsers}
          disabled={isLoading}
          className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-2 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>רענן נתונים</span>
        </button>
      </div>

      {/* Privacy Guarantee Box */}
      <div className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-4 shadow-xl flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0 mt-0.5">
          <EyeOff className="w-4 h-4" />
        </div>
        <div className="text-xs text-slate-300 space-y-1">
          <div className="font-bold text-white flex items-center gap-1.5">
            <span>מדיניות אפס-גישה פיננסית (Zero-Knowledge Financial Privacy)</span>
          </div>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            מערכת הניהול מאפשרת אך ורק מעקב אחר קיום החשבון ומצבו התפעולי. על פי ארכיטקטורת האבטחה
            וחוקי השרת (Firestore Rules), אין למנהל גישה לשום מידע פיננסי אישי (עסקאות, יתרות,
            תקציבים או מסמכים).
          </p>
        </div>
      </div>

      {/* Success Alert */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Search and Table */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש לפי שם, דוא״ל או User ID..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-500"
            />
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {filtered.length} משתמשים רשומים
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">משתמש</th>
                <th className="py-3 px-4">דוא״ל</th>
                <th className="py-3 px-4">ספק הזדהות</th>
                <th className="py-3 px-4">תאריך הרשמה</th>
                <th className="py-3 px-4">כניסה אחרונה</th>
                <th className="py-3 px-4">סטטוס</th>
                <th className="py-3 px-4 text-left">פעולות ניהול</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
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
                    <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white">
                        <div className="flex items-center gap-2">
                          <span>{u.name}</span>
                          {u.role === 'admin' && (
                            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.2 rounded font-mono font-bold">
                              ADMIN
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 font-normal mt-0.5">
                          UID: {u.id.substring(0, 10)}...
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300" dir="ltr">
                        {u.email}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="capitalize px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300 font-mono">
                          {u.authProvider.replace('.com', '')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono">
                        {u.createdAt ? u.createdAt.split('T')[0] : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono">
                        {u.lastLogin ? u.lastLogin.split('T')[0] : '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        {isPendingDeletion ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 font-medium">
                            <Clock className="w-3 h-3" />
                            <span>מיועד למחיקה (חסד)</span>
                          </span>
                        ) : isDeactivated ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
                            <XCircle className="w-3 h-3" />
                            <span>מושבת</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium">
                            <CheckCircle className="w-3 h-3" />
                            <span>פעיל</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Toggle Active / Deactivate */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors border ${
                              isDeactivated
                                ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {isDeactivated ? 'הפעל חשבון' : 'השבת חשבון'}
                          </button>

                          {/* Deletion Grace Actions */}
                          {isPendingDeletion ? (
                            <button
                              type="button"
                              onClick={() => handleCancelDeletion(u)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                            >
                              בטל מחיקה
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleInitiateDeletion(u)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-colors flex items-center gap-1"
                              title="תזמן מחיקה (30 ימי חסד)"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>מחיקה (30 יום)</span>
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
