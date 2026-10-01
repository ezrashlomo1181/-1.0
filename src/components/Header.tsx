import React, { useState } from 'react';
import {
  Menu,
  ShieldAlert,
  HelpCircle,
  Database,
  Search,
  User,
  LogOut,
  LogIn,
  ChevronDown,
} from 'lucide-react';
import { DataQualityReport, UserProfile } from '../types/financial';

interface HeaderProps {
  isDemoMode: boolean;
  onToggleDemoMode: () => void;
  dataQuality: DataQualityReport;
  needsReviewCount: number;
  onOpenReviewModal: () => void;
  onOpenOnboarding: () => void;
  onOpenDataCenter: () => void;
  onOpenMobileMenu: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  user: UserProfile | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isDemoMode,
  onToggleDemoMode,
  dataQuality,
  needsReviewCount,
  onOpenReviewModal,
  onOpenOnboarding,
  onOpenDataCenter,
  onOpenMobileMenu,
  searchQuery,
  onSearchChange,
  user,
  onOpenAuth,
  onSignOut,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3 flex items-center justify-between gap-4">
      {/* Right side (RTL start): Mobile toggle + Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800/60 border border-slate-700/60"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="חיפוש עסקה, ספק, סכום..."
            className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pr-9 pl-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>

      {/* Left side (RTL end): Statuses, User Profile & Auth */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Needs Review Pill button */}
        {needsReviewCount > 0 && (
          <button
            onClick={onOpenReviewModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 text-xs font-semibold transition-all animate-pulse"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">דורש אימות</span>
            <span className="font-mono bg-amber-500/30 px-1.5 py-0.2 rounded-full text-[10px]">
              {needsReviewCount}
            </span>
          </button>
        )}

        {/* Data Quality Health Pill */}
        <button
          onClick={onOpenDataCenter}
          className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/70 hover:border-slate-600 text-slate-300 text-xs font-medium transition-colors"
          title="ציון שלמות וכיסוי הנתונים"
        >
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span>שלמות נתונים:</span>
          <span className="font-mono font-bold text-emerald-400">{dataQuality.overallScore}%</span>
        </button>

        {/* Demo Mode Toggle */}
        <div className="hidden sm:flex items-center bg-slate-950/90 border border-slate-800 rounded-xl p-1 text-xs">
          <button
            onClick={!isDemoMode ? onToggleDemoMode : undefined}
            className={`px-2.5 py-1 rounded-lg transition-all font-medium ${
              isDemoMode
                ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            נתוני דוגמה
          </button>
          <button
            onClick={isDemoMode ? onToggleDemoMode : undefined}
            className={`px-2.5 py-1 rounded-lg transition-all font-medium ${
              !isDemoMode
                ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            הנתונים שלי
          </button>
        </div>

        {/* User Account / Auth Button */}
        {user ? (
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors text-xs text-white"
            >
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[11px]">
                {user.name.charAt(0)}
              </div>
              <span className="font-semibold hidden sm:inline max-w-[100px] truncate">
                {user.name}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Dropdown menu */}
            {isUserMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsUserMenuOpen(false)}
                />
                <div className="absolute left-0 mt-2 w-56 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-40 space-y-1 animate-in fade-in">
                  <div className="p-2.5 border-b border-slate-800">
                    <div className="font-bold text-white text-xs truncate">{user.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono truncate" dir="ltr">
                      {user.email}
                    </div>
                    {user.role === 'admin' && (
                      <span className="inline-block mt-1 text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.2 rounded font-mono font-bold">
                        ADMIN
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onSignOut();
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-xl text-xs text-rose-300 hover:bg-rose-500/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>התנתקות</span>
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-sm cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>התחברות</span>
          </button>
        )}

        {/* Help / Tour */}
        <button
          onClick={onOpenOnboarding}
          className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition-colors"
          title="אודות המערכת"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
