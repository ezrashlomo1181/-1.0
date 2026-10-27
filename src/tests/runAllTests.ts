/**
 * Dynamic Regression Test Suite Runner
 * 
 * Intercepts and dynamically aggregates test execution results across all test suites.
 * Exits with a non-zero exit code if any test fails.
 */

interface SuiteSpec {
  file: string;
  name: string;
}

const SUITES: SuiteSpec[] = [
  { file: './columnIdentification.test.js', name: 'Column Identification & Date/Billing Prioritization' },
  { file: './descriptionCleaning.test.js', name: 'Description Cleaning & Technical Artifact Removal' },
  { file: './candidateIdentification.test.js', name: 'Cross-Document Candidate Identification (Stage B.1)' },
  { file: './reversibleLinking.test.js', name: 'Reversible Mutual Linking & Safe Unlinking (Stage B.2)' },
  { file: './backupRestore.test.js', name: 'Local Backup, Validation & Reversible Restore (Stage C.2)' },
  { file: './incomeClassification.test.js', name: 'Income, Salary & Inflow Classification (Phase B.2.5)' },
  { file: './flowDirection.test.js', name: 'Flow Direction & Safe UI Presentation (Stage 1)' },
  { file: './cashFlowStage1.test.js', name: 'Base Calculations & Independent Cash Flow (Stage 1)' },
  { file: './clockService.test.js', name: 'Israel Local Clock & Date Boundaries (Stage 2a)' },
  { file: './categoriesService.test.js', name: 'Central Categories Service & Fixed/Custom Categories (Stage 1)' },
  { file: './transactionsViewPresentation.test.js', name: 'Transactions View Presentation & Deduplication' },
  { file: './brandAndMerchantRecognition.test.js', name: 'Brand & Merchant Recognition and Expense Classification' },
  { file: './creditCardReconciliation.test.js', name: 'Credit Card Statement Reconciliation & Accounting Protection' },
];

interface SuiteResult {
  name: string;
  passed: number;
  failed: number;
}

async function runAllSuites() {
  const origLog = console.log;
  const origError = console.error;
  const origExit = process.exit;

  const results: SuiteResult[] = [];

  for (const suite of SUITES) {
    let suitePassed = 0;
    let suiteFailed = 0;
    let exitCodeIntercepted: number | null = null;

    console.log = (...args: any[]) => {
      const line = args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ');
      if (line.includes('✓ PASS:')) {
        suitePassed++;
      }
      origLog.apply(console, args);
    };

    console.error = (...args: any[]) => {
      const line = args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ');
      if (line.includes('✗ FAIL:')) {
        suiteFailed++;
      }
      origError.apply(console, args);
    };

    // Temporarily intercept process.exit during individual suite execution
    process.exit = ((code?: number) => {
      if (code && code !== 0) {
        exitCodeIntercepted = code;
      }
    }) as any;

    try {
      await import(suite.file);
    } catch (err) {
      origError(`[Runner] Uncaught exception in suite "${suite.name}":`, err);
      suiteFailed++;
    }

    if (exitCodeIntercepted !== null && suiteFailed === 0) {
      suiteFailed = 1;
    }

    results.push({
      name: suite.name,
      passed: suitePassed,
      failed: suiteFailed,
    });
  }

  // Restore originals
  console.log = origLog;
  console.error = origError;
  process.exit = origExit;

  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  const totalTests = totalPassed + totalFailed;

  console.log('\n========================================================================');
  console.log('             FULL REGRESSION SUITE EXECUTION COMPLETE                   ');
  console.log('========================================================================');
  results.forEach((r, idx) => {
    const status = r.failed === 0 ? 'PASS' : 'FAIL';
    const failDetail = r.failed > 0 ? `, ${r.failed} failed` : '';
    console.log(`  [Suite ${idx + 1}] ${r.name.padEnd(52)}: ${status} (${r.passed} tests${failDetail})`);
  });
  console.log('------------------------------------------------------------------------');
  console.log(`  TOTAL: ${totalPassed} / ${totalTests} tests passed across all ${results.length} suites (${totalFailed} failures).`);
  console.log('========================================================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllSuites().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
