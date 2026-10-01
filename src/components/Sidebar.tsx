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
      badgeClass: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
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
            badgeClass: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60',
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
            badgeClass: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
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
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 right-0 bottom-0 z-40 w-64 bg-white dark:bg-[#111827] border-l border-slate-200 dark:border-[#1F2937] flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-200 dark:border-[#1F2937] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-slate-800 border border-slate-800 dark:border-slate-700 flex items-center justify-center text-white shadow-xs">
              <Compass className="w-5 h-5 stroke-[2.2] text-slate-200" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">
                מצפן פיננסי
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">ניהול עושר ובינה אישית</p>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="lg:hidden text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
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
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors group cursor-pointer ${
                  isActive
                    ? item.special
                      ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-300 font-semibold'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-white font-semibold'
                    : item.special
                    ? 'text-blue-700 dark:text-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 flex-shrink-0 transition-colors ${
                      isActive
                        ? item.special
                          ? 'text-blue-700 dark:text-blue-400'
                          : 'text-slate-900 dark:text-white'
                        : item.special
                        ? 'text-blue-700 dark:text-blue-400'
                        : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge ? (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-md border font-mono font-medium ${item.badgeClass}`}
                  >
                    {item.badge}
                  </span>
                ) : (
                  isActive && <ChevronLeft className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Review Queue alert shortcut if pending */}
        {needsReviewCount > 0 && (
          <div className="px-2 pb-2">
            <button
              onClick={() => {
                onSelectSection('transactions');
                onCloseMobile();
              }}
              className="w-full text-right p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 hover:bg-amber-100/70 dark:hover:bg-amber-950/50 transition-colors flex items-start gap-2 cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-amber-900 dark:text-amber-300">
                  {needsReviewCount} עסקאות לאימות
                </div>
                <div className="text-[11px] text-amber-700 dark:text-amber-400/80 mt-0.5">
                  ודאות סיווג דורשת את אישורך
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Bottom Profile / Settings */}
        <div className="p-2 border-t border-slate-200 dark:border-[#1F2937] bg-slate-50/70 dark:bg-[#0B0F17]">
          <button
            onClick={() => {
              onSelectSection('settings');
              onCloseMobile();
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              currentSection === 'settings'
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Settings className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span>הגדרות ופרטיות</span>
            </div>
            <ChevronLeft className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          </button>
        </div>
      </aside>
    </>
  );
};
