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
import { ThemeToggle } from './ThemeToggle';

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
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#1F2937] px-4 lg:px-6 py-2.5 flex items-center justify-between gap-4 transition-colors">
      {/* Right side (RTL start): Mobile toggle + Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="חיפוש עסקה, ספק, סכום..."
            className="w-full bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] rounded-lg pr-9 pl-4 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-slate-600 dark:focus:border-slate-500 transition-colors"
          />
        </div>
      </div>

      {/* Left side (RTL end): Theme Toggle, Statuses, User Profile & Auth */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Needs Review Button */}
        {needsReviewCount > 0 && (
          <button
            onClick={onOpenReviewModal}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-300 hover:bg-amber-100/70 text-xs font-medium transition-colors cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
            <span className="hidden sm:inline">לאימות</span>
            <span className="font-mono bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.2 rounded-md text-[10px] font-bold text-amber-900 dark:text-amber-200">
              {needsReviewCount}
            </span>
          </button>
        )}

        {/* Data Quality Indicator */}
        <button
          onClick={onOpenDataCenter}
          className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-[#1F2937] hover:bg-slate-200/60 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors cursor-pointer"
          title="כיסוי ושלמות הנתונים"
        >
          <Database className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-500" />
          <span>כיסוי:</span>
          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{dataQuality.overallScore}%</span>
        </button>

        {/* Mode Toggle (Demo / User Data) */}
        <div className="hidden sm:flex items-center bg-slate-100 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] rounded-lg p-0.5 text-xs">
          <button
            onClick={!isDemoMode ? onToggleDemoMode : undefined}
            className={`px-2 py-1 rounded-md transition-colors font-medium cursor-pointer ${
              isDemoMode
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            דוגמה
          </button>
          <button
            onClick={isDemoMode ? onToggleDemoMode : undefined}
            className={`px-2 py-1 rounded-md transition-colors font-medium cursor-pointer ${
              !isDemoMode
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            הנתונים שלי
          </button>
        </div>

        {/* Theme Mode Switcher (Light / Dark / System) */}
        <ThemeToggle compact={true} />

        {/* User Account / Auth Button */}
        {user ? (
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 p-1 pr-2 rounded-lg bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors text-xs text-slate-900 dark:text-white cursor-pointer"
            >
              <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center font-bold text-[11px]">
                {user.name.charAt(0)}
              </div>
              <span className="font-medium hidden sm:inline max-w-[100px] truncate">
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
                <div className="absolute left-0 mt-2 w-56 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] shadow-lg p-2 z-40 space-y-1 animate-in fade-in">
                  <div className="p-2 border-b border-slate-100 dark:border-[#1F2937]">
                    <div className="font-bold text-slate-900 dark:text-white text-xs truncate">{user.name}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate" dir="ltr">
                      {user.email}
                    </div>
                    {user.role === 'admin' && (
                      <span className="inline-block mt-1 text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-1.5 py-0.2 rounded font-mono font-bold">
                        ADMIN
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onSignOut();
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-lg text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>התנתקות מהמערכת</span>
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 font-semibold text-xs border border-slate-800 dark:border-slate-700 transition-colors shadow-xs cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5 text-slate-300 dark:text-slate-400" />
            <span>התחברות</span>
          </button>
        )}

        {/* Help / Tour */}
        <button
          onClick={onOpenOnboarding}
          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="אודות המערכת"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
