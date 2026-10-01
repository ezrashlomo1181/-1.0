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
  Sparkles,
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
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>מטרות וחסכונות ייעודיים</span>
            <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
              {goals.length} מטרות פעילות
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            מעקב תחזיות, חישוב הפקדה חודשית נדרשת, וסנכרון מול חשבונות החיסכון
          </p>
        </div>

        <button
          onClick={() => setShowAddGoal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-emerald-900/30"
        >
          <Plus className="w-4 h-4" />
          <span>הגדר מטרה חדשה</span>
        </button>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400">נצבר במטרות פעילות</span>
          <div className="text-2xl font-bold text-white font-mono mt-1">
            ₪{totalSavedAcrossGoals.toLocaleString()}
          </div>
          <span className="text-[11px] text-emerald-400 mt-1 block">
            {totalTargetAcrossGoals > 0
              ? `${Math.round((totalSavedAcrossGoals / totalTargetAcrossGoals) * 100)}% מסך היעדים הכולל`
              : ''}
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400">יעד כולל מצטבר</span>
          <div className="text-2xl font-bold text-slate-200 font-mono mt-1">
            ₪{totalTargetAcrossGoals.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            נשארו ₪{(totalTargetAcrossGoals - totalSavedAcrossGoals).toLocaleString()} להשלמה
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400">הפקדות חודשיות מתוכננות</span>
          <div className="text-2xl font-bold text-indigo-300 font-mono mt-1">
            ₪{totalMonthlyPledged.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">מוקצה ישירות מהחיסכון החודשי</span>
        </div>
      </div>

      {/* Add Goal Drawer/Form */}
      {showAddGoal && (
        <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-5 shadow-2xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>הגדרת יעד פיננסי חדש</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">שם היעד</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="למשל: שיפוץ מטבח"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">סכום יעד (₪)</label>
              <input
                type="number"
                value={targetAmount}
                onChange={(e) => setTargetAmount(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">הון ראשוני שנצבר (₪)</label>
              <input
                type="number"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">תאריך יעד</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">הפקדה חודשית (₪)</label>
              <input
                type="number"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">סוג יעד</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
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
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white text-xs"
            >
              ביטול
            </button>
            <button
              onClick={handleAddGoal}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-900/30"
            >
              שמור מטרה
            </button>
          </div>
        </div>
      )}

      {/* Goal Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {goals.map((goal) => {
          const Icon = getCategoryIcon(goal.category);
          const progress = Math.round((goal.currentAmount / goal.targetAmount) * 100);
          const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

          // Calculate months needed at current monthly contribution
          const monthsNeeded =
            goal.monthlyContribution > 0 ? Math.ceil(remaining / goal.monthlyContribution) : 0;

          return (
            <div
              key={goal.id}
              className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-5 shadow-xl flex flex-col justify-between hover:border-slate-700 transition-all"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">{goal.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>יעד: {goal.targetDate}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-left font-mono">
                    <span className="text-lg font-extrabold text-emerald-400">{progress}%</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-3 bg-slate-800 rounded-full mt-4 overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-l from-emerald-400 via-teal-400 to-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>

                {/* Financial stats */}
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-800/80 text-xs">
                  <div>
                    <span className="text-slate-400 block">נצבר עד כה:</span>
                    <span className="text-white font-mono font-bold text-sm">
                      ₪{goal.currentAmount.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">יעד סופי:</span>
                    <span className="text-slate-300 font-mono font-bold text-sm">
                      ₪{goal.targetAmount.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Projection / dynamic calculation */}
                <div className="mt-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>הפקדה חודשית נוכחית:</span>
                    <span className="font-mono font-semibold text-emerald-400">
                      ₪{goal.monthlyContribution.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    💡 בקצב זה, היעד יושלם בעוד <strong>{monthsNeeded} חודשים</strong> (כ-
                    {Math.ceil(monthsNeeded / 12)} שנים).
                  </div>
                  {goal.notes && (
                    <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800">
                      {goal.notes}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick deposit button */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">הפקדה מהירה לחיסכון:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleQuickDeposit(goal.id, 500)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 font-mono text-xs border border-slate-700"
                  >
                    +₪500
                  </button>
                  <button
                    onClick={() => handleQuickDeposit(goal.id, 1000)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 font-mono text-xs border border-slate-700"
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
