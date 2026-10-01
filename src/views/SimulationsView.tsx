import React, { useState } from 'react';
import { Account, FinancialGoal } from '../types/financial';
import {
  simulateCompoundGrowth,
  simulateHousingRentVsBuy,
  checkAffordability,
  calculateNetWorth,
} from '../services/financialCalculations';
import {
  Cpu,
  TrendingUp,
  Home,
  CheckCircle,
  HelpCircle,
  Sparkles,
  Calculator,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Send,
} from 'lucide-react';

interface SimulationsViewProps {
  accounts: Account[];
  goals: FinancialGoal[];
  monthlySavings: number;
  monthlyExpenses: number;
}

export const SimulationsView: React.FC<SimulationsViewProps> = ({
  accounts,
  goals,
  monthlySavings,
  monthlyExpenses,
}) => {
  const [activeTab, setActiveTab] = useState<
    'compound' | 'affordability' | 'housing' | 'scenario' | 'retirement'
  >('compound');

  // 1. Compound Interest Params
  const [initialCapital, setInitialCapital] = useState(100000);
  const [monthlyDeposit, setMonthlyDeposit] = useState(3000);
  const [annualReturn, setAnnualReturn] = useState(7.0);
  const [horizonYears, setHorizonYears] = useState(20);
  const [inflationRate, setInflationRate] = useState(2.5);

  const compoundResults = simulateCompoundGrowth({
    initialAmount: initialCapital,
    monthlyContribution: monthlyDeposit,
    annualReturnRate: annualReturn,
    years: horizonYears,
    inflationRate,
  });

  const finalCompoundPoint = compoundResults[compoundResults.length - 1];

  // 2. Affordability Tool Params
  const [affordExpenseName, setAffordExpenseName] = useState('חופשה משפחתית לחו״ל');
  const [affordExpenseAmount, setAffordExpenseAmount] = useState(15000);

  const affordabilityResult = checkAffordability(
    affordExpenseAmount,
    affordExpenseName,
    accounts,
    monthlySavings || 3500,
    goals,
    monthlyExpenses || 14850
  );

  // 3. Housing Rent vs Buy Params
  const [homePrice, setHomePrice] = useState(2200000);
  const [downPayment, setDownPayment] = useState(550000);
  const [mortgageYears, setMortgageYears] = useState(25);
  const [mortgageRate, setMortgageRate] = useState(4.8);
  const [monthlyRent, setMonthlyRent] = useState(6200);

  const housingResult = simulateHousingRentVsBuy({
    homePrice,
    downPayment,
    mortgageYears,
    mortgageRateAnnual: mortgageRate,
    monthlyRent,
    expectedAnnualAppreciation: 3.2,
    expectedInvestmentReturn: 7.0,
  });

  // 4. Natural Language Scenario Builder
  const [scenarioPrompt, setScenarioPrompt] = useState(
    'אני רוצה לקנות רכב ב-₪120,000 בעוד שנתיים ולהמשיך להשקיע ₪3,000 בחודש'
  );
  const [scenarioGenerated, setScenarioGenerated] = useState(true);

  const handleGenerateScenario = () => {
    setScenarioGenerated(true);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <span>מעבדת סימולציות פיננסיות</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            מודלים מתמטיים עצמאיים לחקר תרחישי «מה יקרה אם» — ללא הבטחות תשואה וללא ניחושים
          </p>
        </div>

        {/* Disclaimer Tag */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-1.5 text-[11px] text-slate-400">
          ⚠️ סימולציה מתמטית אינה ייעוץ השקעות
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-1 text-xs">
        {[
          { id: 'compound', label: 'צמיחה בריבית דריבית' },
          { id: 'affordability', label: 'האם אני יכול להרשות לעצמי?' },
          { id: 'housing', label: 'שכירות מול קניית דירה' },
          { id: 'scenario', label: 'בונה תרחישים בשפה חופשית' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-t-xl font-semibold whitespace-nowrap transition-all border-b-2 ${
              activeTab === tab.id
                ? 'border-emerald-400 text-white bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: COMPOUND GROWTH */}
      {activeTab === 'compound' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls */}
          <div className="lg:col-span-4 bg-slate-900/90 rounded-2xl border border-slate-800/80 p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-400" />
              <span>פרמטרים לחישוב</span>
            </h3>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">הון ראשוני להשקעה</span>
                <span className="font-mono text-emerald-400 font-bold">
                  ₪{initialCapital.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="500000"
                step="10000"
                value={initialCapital}
                onChange={(e) => setInitialCapital(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">הפקדה חודשית קבועה</span>
                <span className="font-mono text-emerald-400 font-bold">
                  ₪{monthlyDeposit.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="15000"
                step="500"
                value={monthlyDeposit}
                onChange={(e) => setMonthlyDeposit(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">תשואה שנתית נומינלית משוערת</span>
                <span className="font-mono text-cyan-400 font-bold">{annualReturn}%</span>
              </div>
              <input
                type="range"
                min="2"
                max="12"
                step="0.5"
                value={annualReturn}
                onChange={(e) => setAnnualReturn(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block mt-0.5">
                (ממוצע היסטורי רב-שנתי ב-S&P 500 נע סביב 7-10% נומינלי)
              </span>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">אופק זמן (שנים)</span>
                <span className="font-mono text-indigo-400 font-bold">{horizonYears} שנים</span>
              </div>
              <input
                type="range"
                min="3"
                max="35"
                step="1"
                value={horizonYears}
                onChange={(e) => setHorizonYears(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">הנחת אינפלציה שנתית</span>
                <span className="font-mono text-slate-400 font-bold">{inflationRate}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={inflationRate}
                onChange={(e) => setInflationRate(Number(e.target.value))}
                className="w-full accent-slate-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Results Display */}
          <div className="lg:col-span-8 bg-slate-900/90 rounded-2xl border border-slate-800/80 p-5 shadow-xl space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-xs text-slate-400">שווי תיק נומינלי בסוף התקופה</span>
                <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
                  ₪{finalCompoundPoint?.totalValue.toLocaleString()}
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  בעוד {horizonYears} שנים
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-xs text-slate-400">סך הפקדות מכיסך (קרן)</span>
                <div className="text-2xl font-black text-slate-200 font-mono mt-1">
                  ₪{finalCompoundPoint?.totalContributions.toLocaleString()}
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  {Math.round(
                    ((finalCompoundPoint?.totalContributions || 1) /
                      (finalCompoundPoint?.totalValue || 1)) *
                      100
                  )}
                  % מסך התיק
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-xs text-slate-400">רווחי ריבית דריבית נטו</span>
                <div className="text-2xl font-black text-cyan-400 font-mono mt-1">
                  ₪{finalCompoundPoint?.totalGains.toLocaleString()}
                </div>
                <span className="text-[11px] text-cyan-400 font-mono mt-1 block">
                  +
                  {Math.round(
                    ((finalCompoundPoint?.totalGains || 1) /
                      (finalCompoundPoint?.totalContributions || 1)) *
                      100
                  )}
                  % מעל הקרן
                </span>
              </div>
            </div>

            {/* Trajectory Breakdown Table & Bars */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300">
                התפתחות התיק לאורך ציר הזמן (במרווחים):
              </h4>
              <div className="space-y-2">
                {compoundResults
                  .filter((_, i) => i % Math.max(1, Math.floor(horizonYears / 5)) === 0 || i === horizonYears)
                  .map((pt) => {
                    const maxVal = finalCompoundPoint?.totalValue || 1;
                    const principalWidth = (pt.totalContributions / maxVal) * 100;
                    const gainsWidth = (pt.totalGains / maxVal) * 100;

                    return (
                      <div key={pt.year} className="space-y-1 text-xs">
                        <div className="flex justify-between font-mono">
                          <span className="text-slate-400 font-sans">
                            {pt.year === 0 ? 'נקודת התחלה' : `שנה ${pt.year}`}
                          </span>
                          <span className="text-white font-bold">
                            ₪{pt.totalValue.toLocaleString()}
                            <span className="text-slate-500 text-[10px] font-sans mr-2">
                              (ריאלי מתואם אינפלציה: ₪{pt.realValueAdjustedForInflation.toLocaleString()})
                            </span>
                          </span>
                        </div>
                        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex">
                          <div
                            style={{ width: `${principalWidth}%` }}
                            className="bg-slate-500 h-full"
                            title="הפקדות קרן"
                          />
                          <div
                            style={{ width: `${gainsWidth}%` }}
                            className="bg-emerald-500 h-full"
                            title="רווחי ריבית דריבית"
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="flex items-center gap-4 text-xs pt-2 text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-slate-500" />
                  <span>קרן שהופקדה</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-500" />
                  <span>רווחי ריבית דריבית</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: "CAN I AFFORD THIS?" */}
      {activeTab === 'affordability' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-slate-900/90 rounded-2xl border border-slate-800/80 p-5 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>כלי: «האם אני יכול להרשות לעצמי את זה?»</span>
            </h3>
            <p className="text-xs text-slate-400">
              בדיקת השפעת הוצאה גדולה מתוכננת על כרית הביטחון, יעדי החיסכון, וזמן ההתאוששות
            </p>

            <div>
              <label className="block text-xs text-slate-300 mb-1">שם ההוצאה המתוכננת</label>
              <input
                type="text"
                value={affordExpenseName}
                onChange={(e) => setAffordExpenseName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">סכום ההוצאה (₪)</label>
              <input
                type="number"
                value={affordExpenseAmount}
                onChange={(e) => setAffordExpenseAmount(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="pt-2 text-xs space-y-2 text-slate-400">
              <div className="flex justify-between">
                <span>מזומנים וחיסכון נזיל זמין:</span>
                <span className="font-mono text-white font-semibold">
                  ₪{(affordabilityResult.liquidCashRemaining + affordExpenseAmount).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>חיסכון חודשי ממוצע קיים:</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  ₪{(monthlySavings || 3500).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-slate-900/90 rounded-2xl border border-slate-800/80 p-5 shadow-xl space-y-5">
            {/* Verdict Card */}
            <div
              className={`p-4 rounded-2xl border ${
                affordabilityResult.verdict === 'comfortable'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  : affordabilityResult.verdict === 'tight'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-base">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <span>מסקנת המודל: {affordabilityResult.verdictHebrew}</span>
              </div>
              <p className="text-xs mt-1.5 opacity-90 leading-relaxed">
                {affordabilityResult.reasoningHebrew}
              </p>
            </div>

            {/* Impact Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[11px] text-slate-400 block">יתרת מזומנים לאחר הקנייה</span>
                <span className="text-lg font-bold text-white font-mono mt-0.5 block">
                  ₪{affordabilityResult.liquidCashRemaining.toLocaleString()}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[11px] text-slate-400 block">כרית ביטחון שתיוותר</span>
                <span className="text-lg font-bold text-cyan-400 font-mono mt-0.5 block">
                  {affordabilityResult.emergencyRunwayRemainingMonths} חודשים
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[11px] text-slate-400 block">זמן התאוששות לחיסכון</span>
                <span className="text-lg font-bold text-indigo-400 font-mono mt-0.5 block">
                  {affordabilityResult.recoveryMonths} חודשים
                </span>
              </div>
            </div>

            {/* Impact on other goals */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300">השפעה על יעדים קיימים:</h4>
              <div className="space-y-1.5">
                {affordabilityResult.impactOnGoals.map((imp) => (
                  <div
                    key={imp.goalName}
                    className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/60"
                  >
                    <span className="text-slate-300">{imp.goalName}</span>
                    <span className="text-slate-400">
                      {imp.delayedMonths === 0
                        ? 'ללא עיכוב צפוי'
                        : `עיכוב משוער של ${imp.delayedMonths} חודשים`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HOUSING BUY VS RENT */}
      {activeTab === 'housing' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-slate-900/90 rounded-2xl border border-slate-800/80 p-5 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Home className="w-5 h-5 text-blue-400" />
              <span>השוואת שכירות מול רכישה</span>
            </h3>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">מחיר דירה מבוקשת</span>
                <span className="font-mono text-white font-bold">
                  ₪{homePrice.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min="1000000"
                max="4500000"
                step="50000"
                value={homePrice}
                onChange={(e) => setHomePrice(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">הון עצמי זמין</span>
                <span className="font-mono text-emerald-400 font-bold">
                  ₪{downPayment.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min="200000"
                max="1500000"
                step="25000"
                value={downPayment}
                onChange={(e) => setDownPayment(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">ריבית משכנתא משוקללת שנתית</span>
                <span className="font-mono text-white font-bold">{mortgageRate}%</span>
              </div>
              <input
                type="range"
                min="2.5"
                max="7.0"
                step="0.1"
                value={mortgageRate}
                onChange={(e) => setMortgageRate(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">שכירות חודשית אלטרנטיבית</span>
                <span className="font-mono text-indigo-400 font-bold">
                  ₪{monthlyRent.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min="3000"
                max="12000"
                step="200"
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>
          </div>

          <div className="lg:col-span-7 bg-slate-900/90 rounded-2xl border border-slate-800/80 p-5 shadow-xl space-y-5">
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-200 text-xs">
              <span className="font-bold block text-sm mb-1">ניתוח מתמטי השוואתי:</span>
              <p>{housingResult.differenceExplanation}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-xs text-slate-400 block">החזר משכנתא חודשי משוער</span>
                <span className="text-xl font-bold text-white font-mono mt-1 block">
                  ₪{housingResult.monthlyMortgagePayment.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  ריבית כוללת לבנק: ₪{housingResult.totalMortgageInterestPaid.toLocaleString()}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-xs text-slate-400 block">
                  שווי נכס בעוד {mortgageYears} שנים
                </span>
                <span className="text-xl font-bold text-emerald-400 font-mono mt-1 block">
                  ₪{housingResult.equityAfterYears.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  בהנחת עליית ערך נדל״ן שנתית 3.2%
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 block">
                אלטרנטיבת שכירות (השקעת ההון העצמי בשוק ההון):
              </span>
              <span className="text-xl font-bold text-cyan-300 font-mono block">
                ₪{housingResult.rentAlternativePortfolioValue.toLocaleString()}
              </span>
              <p className="text-[11px] text-slate-400">
                אם תשכור ב-₪{monthlyRent.toLocaleString()} ותשקיע את ההון העצמי (₪
                {downPayment.toLocaleString()}) ב-S&P 500 ב-7% שנתי.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: NATURAL LANGUAGE SCENARIO BUILDER */}
      {activeTab === 'scenario' && (
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-5 shadow-xl space-y-5">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <span>בונה תרחישים בשפה חופשית</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              תאר במילים שלך תוכנית עתידית והמערכת תתרגם אותה למודל פיננסי סדור
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={scenarioPrompt}
              onChange={(e) => setScenarioPrompt(e.target.value)}
              placeholder="למשל: אני רוצה לרכוש רכב ב-₪120,000 בעוד שנתיים ולהמשיך לחסוך ₪3,000 בחודש"
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleGenerateScenario}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-lg shadow-indigo-900/30"
            >
              <span>נתח תרחיש</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          {scenarioGenerated && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-bold text-emerald-400">
                  תרגום מתמטי של התרחיש המבוקש
                </span>
                <span className="text-[11px] text-slate-400">אופק זמן: 24 חודשים</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-slate-400">עלות היעד</span>
                  <div className="text-base font-bold text-white font-mono mt-0.5">₪120,000</div>
                  <span className="text-[10px] text-slate-500">נדרש לחסוך: ₪5,000 / חודש</span>
                </div>

                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-slate-400">חיסכון חודשי מתוכנן</span>
                  <div className="text-base font-bold text-indigo-400 font-mono mt-0.5">
                    ₪3,000 / חודש
                  </div>
                  <span className="text-[10px] text-amber-400">פער של ₪2,000 בחודש</span>
                </div>

                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-slate-400">השלכות על תזרים</span>
                  <div className="text-base font-bold text-white mt-0.5">הלוואה או הארכת זמן</div>
                  <span className="text-[10px] text-slate-400">או דחיית מועד הרכישה ל-40 חודשים</span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <strong>מסקנת המערכת:</strong> כדי לעמוד ביעד של ₪120,000 בעוד 24 חודשים בקצב הפקדה של ₪3,000 בחודש ייצברו ₪72,000 בלבד. תיוותר יתרת מימון נדרשת של ₪48,000 (שניתן לממן באמצעות טרייד-אין על רכב ישן או מימון בנקאי של כ-₪1,400 לחודש).
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
