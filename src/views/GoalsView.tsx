import React, { useState } from 'react';
import { FinancialGoal } from '../types/financial';
import {
  Target,
  Plus,
  Calendar,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  Plane,
  Car,
  Home,
  Clock,
} from 'lucide-react';

interface GoalsViewProps {
  goals: FinancialGoal[];
  onUpdateGoals: (updated: FinancialGoal[]) => void;
}

export const GoalsView: React.FC<GoalsViewProps> = ({ goals, onUpdateGoals }) => {
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState(30000);
  const [currentAmount, setCurrentAmount] = useState(5000);
  const [targetDate, setTargetDate] = useState('2027-12-31');
  const [monthlyContribution, setMonthlyContribution] = useState(1500);
  const [category, setCategory] = useState<FinancialGoal['category']>('custom');

  const totalSavedAcrossGoals = goals.reduce((s, g) => s + g.currentAmount, 0);
  const totalTargetAcrossGoals = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalMonthlyPledged = goals.reduce((s, g) => s + g.monthlyContribution, 0);

  const getCategoryIcon = (cat: FinancialGoal['category']) => {
    switch (cat) {
      case 'emergency_fund':
        return ShieldCheck;
      case 'vacation':
        return Plane;
      case 'car':
        return Car;
      case 'home':
        return Home;
      default:
        return Target;
    }
  };

  const handleAddGoal = () => {
    if (!name.trim()) return;
    const newGoal: FinancialGoal = {
      id: `g-${Date.now()}`,
      name: name.trim(),
      targetAmount,
      currentAmount,
      targetDate,
      monthlyContribution,
      category,
    };
    onUpdateGoals([...goals, newGoal]);
    setName('');
    setShowAddGoal(false);
  };

  const handleQuickDeposit = (id: string, extra: number) => {
    const updated = goals.map((g) =>
      g.id === id ? { ...g, currentAmount: g.currentAmount + extra } : g
    );
    onUpdateGoals(updated);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>מטרות וחסכונות ייעודיים</span>
            <span className="text-xs font-mono bg-slate-100 dark:bg-[#0B0F17] text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-[#1F2937]">
              {goals.length} מטרות
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            מעקב תחזיות, חישוב הפקדה חודשית נדרשת, וסנכרון מול חשבונות החיסכון
          </p>
        </div>

        <button
          onClick={() => setShowAddGoal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 font-medium text-xs transition-colors shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>הגדר מטרה חדשה</span>
        </button>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-4 shadow-xs transition-colors">
          <span className="text-xs text-slate-500 dark:text-slate-400">נצבר במטרות פעילות</span>
          <div className="text-xl font-bold text-slate-900 dark:text-white font-mono mt-1">
            ₪{totalSavedAcrossGoals.toLocaleString()}
          </div>
          <span className="text-[11px] text-[#059669] dark:text-emerald-400 mt-1 block font-medium">
            {totalTargetAcrossGoals > 0
              ? `${Math.round((totalSavedAcrossGoals / totalTargetAcrossGoals) * 100)}% מסך היעדים הכולל`
              : ''}
          </span>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-4 shadow-xs transition-colors">
          <span className="text-xs text-slate-500 dark:text-slate-400">יעד כולל מצטבר</span>
          <div className="text-xl font-bold text-slate-800 dark:text-slate-200 font-mono mt-1">
            ₪{totalTargetAcrossGoals.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
            נשארו ₪{(totalTargetAcrossGoals - totalSavedAcrossGoals).toLocaleString()} להשלמה
          </span>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-4 shadow-xs transition-colors">
          <span className="text-xs text-slate-500 dark:text-slate-400">הפקדות חודשיות מתוכננות</span>
          <div className="text-xl font-bold text-slate-900 dark:text-white font-mono mt-1">
            ₪{totalMonthlyPledged.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">מוקצה ישירות מהחיסכון</span>
        </div>
      </div>

      {/* Add Goal Drawer/Form */}
      {showAddGoal && (
        <div className="bg-white dark:bg-[#111827] border border-slate-300 dark:border-[#1F2937] rounded-xl p-5 shadow-xs space-y-4 transition-colors">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            הגדרת יעד פיננסי חדש
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1 font-medium">שם היעד</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="למשל: שיפוץ מטבח / קרן חירום"
                className="w-full bg-slate-50 dark:bg-[#0B0F17] border border-slate-300 dark:border-[#1F2937] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1 font-medium">סכום יעד (₪)</label>
              <input
                type="number"
                value={targetAmount}
                onChange={(e) => setTargetAmount(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-[#0B0F17] border border-slate-300 dark:border-[#1F2937] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1 font-medium">הון ראשוני קיים (₪)</label>
              <input
                type="number"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-[#0B0F17] border border-slate-300 dark:border-[#1F2937] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1 font-medium">תאריך יעד</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#0B0F17] border border-slate-300 dark:border-[#1F2937] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1 font-medium">הפקדה חודשית (₪)</label>
              <input
                type="number"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-[#0B0F17] border border-slate-300 dark:border-[#1F2937] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1 font-medium">סוג יעד</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-[#0B0F17] border border-slate-300 dark:border-[#1F2937] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 cursor-pointer"
              >
                <option value="custom">מותאם אישית</option>
                <option value="emergency_fund">קרן חירום</option>
                <option value="vacation">חופשה / טיול</option>
                <option value="home">דירה / נדל״ן</option>
                <option value="car">רכב</option>
                <option value="education">לימודים</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowAddGoal(false)}
              className="px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs cursor-pointer"
            >
              ביטול
            </button>
            <button
              onClick={handleAddGoal}
              className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 font-medium text-xs cursor-pointer"
            >
              שמור מטרה
            </button>
          </div>
        </div>
      )}

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {goals.map((goal) => {
          const Icon = getCategoryIcon(goal.category);
          const progress = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
          const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
          const monthsLeft =
            goal.monthlyContribution > 0 ? Math.ceil(remaining / goal.monthlyContribution) : 0;

          return (
            <div
              key={goal.id}
              className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl p-5 shadow-xs flex flex-col justify-between transition-colors space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#0B0F17] border border-slate-200 dark:border-[#1F2937] flex items-center justify-center text-blue-700 dark:text-blue-400">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">{goal.name}</h4>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>יעד: {goal.targetDate}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className="font-mono text-sm font-bold text-[#059669] dark:text-emerald-400">
                    {progress}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="w-full h-2 bg-slate-100 dark:bg-[#0B0F17] border border-slate-200/50 dark:border-[#1F2937]/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#059669] dark:bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    <span>₪{goal.currentAmount.toLocaleString()}</span>
                    <span>₪{goal.targetAmount.toLocaleString()}</span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-[#1F2937] text-[11px]">
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block">הפקדה חודשית</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      ₪{goal.monthlyContribution.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block">צפי להשלמה</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      עוד {monthsLeft} חודשים
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="pt-2.5 border-t border-slate-100 dark:border-[#1F2937] flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">הפקדה מהירה:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleQuickDeposit(goal.id, 500)}
                    className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 hover:bg-slate-200 dark:bg-[#0B0F17] dark:hover:bg-slate-800 border border-slate-200 dark:border-[#1F2937] text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    +₪500
                  </button>
                  <button
                    onClick={() => handleQuickDeposit(goal.id, 1000)}
                    className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 hover:bg-slate-200 dark:bg-[#0B0F17] dark:hover:bg-slate-800 border border-slate-200 dark:border-[#1F2937] text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    +₪1,000
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
