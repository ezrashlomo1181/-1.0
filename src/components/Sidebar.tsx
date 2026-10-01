import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  PieChart,
  Target,
  TrendingUp,
  Cpu,
  CalendarClock,
  LineChart,
  FolderInput,
  BotMessageSquare,
  Settings,
  ShieldAlert,
  ChevronLeft,
  X,
  Compass,
  FlaskConical,
} from 'lucide-react';
import { areTestingToolsEnabled } from '../config/testingConfig';

export type NavSection =
  | 'dashboard'
  | 'transactions'
  | 'budget'
  | 'goals'
  | 'investments'
  | 'simulations'
  | 'commitments'
  | 'analytics'
  | 'datacenter'
  | 'ask'
  | 'settings'
  | 'admin'
  | 'developer';

interface SidebarProps {
  currentSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  needsReviewCount: number;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  isAdmin?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentSection,
  onSelectSection,
  needsReviewCount,
  isOpenMobile,
  onCloseMobile,
  isAdmin = false,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'דף הבית', icon: LayoutDashboard },
    {
      id: 'transactions',
      label: 'עסקאות',
      icon: Receipt,
      badge: needsReviewCount > 0 ? `${needsReviewCount} לבדיקה` : undefined,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    },
    { id: 'budget', label: 'תקציב', icon: PieChart },
    { id: 'goals', label: 'מטרות וחסכונות', icon: Target },
    { id: 'investments', label: 'השקעות', icon: TrendingUp },
    { id: 'simulations', label: 'סימולציות', icon: Cpu },
    { id: 'commitments', label: 'התחייבויות', icon: CalendarClock },
    { id: 'analytics', label: 'ניתוחים', icon: LineChart },
    { id: 'datacenter', label: 'מרכז הנתונים', icon: FolderInput },
    { id: 'ask', label: 'שאל את הכספים שלי', icon: BotMessageSquare, special: true },
    ...(isAdmin
      ? [
          {
            id: 'admin',
            label: 'ניהול מערכת (Admin)',
            icon: ShieldAlert,
            badge: 'Admin',
            badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
          },
        ]
      : []),
    ...(areTestingToolsEnabled()
      ? [
          {
            id: 'developer',
            label: 'סביבת בדיקות (Dev Panel)',
            icon: FlaskConical,
            badge: 'Test',
            badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          },
        ]
      : []),
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 right-0 bottom-0 z-40 w-64 bg-slate-900/95 border-l border-slate-800/80 flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Compass className="w-5 h-5 text-slate-950 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-tight text-white">
                מצפן פיננסי
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">בינה פיננסית אישית</p>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectSection(item.id as NavSection);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                  isActive
                    ? item.special
                      ? 'bg-gradient-to-l from-emerald-500/20 to-teal-500/10 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'bg-slate-800 text-white border border-slate-700/80 shadow-sm'
                    : item.special
                    ? 'text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110 ${
                      isActive
                        ? item.special
                          ? 'text-emerald-400'
                          : 'text-white'
                        : item.special
                        ? 'text-emerald-400'
                        : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge ? (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-medium ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                ) : (
                  isActive && <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Review Queue alert shortcut if pending */}
        {needsReviewCount > 0 && (
          <div className="px-3 pb-2">
            <button
              onClick={() => {
                onSelectSection('transactions');
                onCloseMobile();
              }}
              className="w-full text-right p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-all flex items-start gap-2.5"
            >
              <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-amber-300">
                  {needsReviewCount} עסקאות דורשות בדיקה
                </div>
                <div className="text-[11px] text-amber-200/70 mt-0.5">
                  אי-ודאות זוהתה. אשר סיווג כדי לדייק את המערכת.
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Bottom Profile / Settings */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/60">
          <button
            onClick={() => {
              onSelectSection('settings');
              onCloseMobile();
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              currentSection === 'settings'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Settings className="w-4 h-4 text-slate-400" />
              <span>הגדרות וכללים שלמדתי</span>
            </div>
            <span className="text-[10px] text-slate-500">v1.2</span>
          </button>
        </div>
      </aside>
    </>
  );
};
