import React from 'react';
import { Menu, ShieldAlert, Sparkles, HelpCircle, Database, CheckCircle2, Search } from 'lucide-react';
import { DataQualityReport } from '../types/financial';

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
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3.5 flex items-center justify-between gap-4">
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
            placeholder="חיפוש עסקה, ספק, סכום (למשל: BUYME, שופרסל, 500)..."
            className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pr-9 pl-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>

      {/* Left side (RTL end): Statuses, Review button & Demo mode switch */}
      <div className="flex items-center gap-2.5">
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
        <div className="flex items-center bg-slate-950/90 border border-slate-800 rounded-xl p-1 text-xs">
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

        {/* Help / Tour */}
        <button
          onClick={onOpenOnboarding}
          className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition-colors"
          title="אודות המערכת ועקרונות הבינה הפיננסית"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
