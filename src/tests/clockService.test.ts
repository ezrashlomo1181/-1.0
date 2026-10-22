import assert from 'node:assert';
import {
  getIsraelLocalDateTime,
  getCurrentAppDate,
  getCurrentAppMonthKey,
  setClockOverride,
} from '../services/clockService.js';

let passedCount = 0;
let failedCount = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    failedCount++;
  }
}

console.log('\n=== TEST SUITE: Israel Local Clock & Date Boundaries (Stage 2a) ===');

// -----------------------------------------------------------------------------
// Test 1: Month Boundary Transition in Israel Timezone
// -----------------------------------------------------------------------------
runTest('Month Boundary: 2026-10-31 23:59 vs 2026-11-01 00:01 in Asia/Jerusalem', () => {
  // 2026-10-31T21:59:00Z in UTC (winter time UTC+2) corresponds to 23:59:00 on Oct 31 in Israel
  const endOfOct = new Date('2026-10-31T21:59:00Z');
  const endRes = getIsraelLocalDateTime(endOfOct);
  assert.strictEqual(endRes.dateStr, '2026-10-31', 'Date before midnight is 2026-10-31');
  assert.strictEqual(endRes.monthKey, '2026-10', 'Month before midnight is 2026-10');

  // 2026-10-31T22:01:00Z in UTC corresponds to 00:01:00 on Nov 01 in Israel
  const startOfNov = new Date('2026-10-31T22:01:00Z');
  const startRes = getIsraelLocalDateTime(startOfNov);
  assert.strictEqual(startRes.dateStr, '2026-11-01', 'Date after midnight is 2026-11-01');
  assert.strictEqual(startRes.monthKey, '2026-11', 'Month after midnight is 2026-11');
});

// -----------------------------------------------------------------------------
// Test 2: Year Boundary Transition in Israel Timezone
// -----------------------------------------------------------------------------
runTest('Year Boundary: 2026-12-31 23:59 vs 2027-01-01 00:01 in Asia/Jerusalem', () => {
  // 2026-12-31T21:59:00Z in UTC corresponds to 23:59:00 on Dec 31 in Israel
  const endOfYear = new Date('2026-12-31T21:59:00Z');
  const decRes = getIsraelLocalDateTime(endOfYear);
  assert.strictEqual(decRes.dateStr, '2026-12-31', 'Date before New Year is 2026-12-31');
  assert.strictEqual(decRes.monthKey, '2026-12', 'Month before New Year is 2026-12');

  // 2026-12-31T22:01:00Z in UTC corresponds to 00:01:00 on Jan 01 in Israel
  const startOfNextYear = new Date('2026-12-31T22:01:00Z');
  const janRes = getIsraelLocalDateTime(startOfNextYear);
  assert.strictEqual(janRes.dateStr, '2027-01-01', 'Date after New Year is 2027-01-01');
  assert.strictEqual(janRes.monthKey, '2027-01', 'Month after New Year is 2027-01');
});

// -----------------------------------------------------------------------------
// Test 3: Israel Daylight Saving Time (DST) Switch on October 25, 2026
// -----------------------------------------------------------------------------
runTest('DST Transition: Moments before and after fallback on October 25, 2026 preserve date and month', () => {
  // In Israel on Sunday 2026-10-25 at 02:00 IDT (UTC+3), clock turns back 1h to 01:00 IST (UTC+2)
  // Moment 1: 2026-10-24T22:50:00Z is 01:50:00 IDT (UTC+3)
  const beforeFallback = new Date('2026-10-24T22:50:00Z');
  const beforeRes = getIsraelLocalDateTime(beforeFallback);
  assert.strictEqual(beforeRes.dateStr, '2026-10-25', 'Date 10 min before DST fallback is 2026-10-25');
  assert.strictEqual(beforeRes.monthKey, '2026-10', 'Month before DST fallback is 2026-10');

  // Moment 2: 2026-10-24T23:10:00Z is 01:10:00 IST (UTC+2) (clock moved back by 1 hour)
  const afterFallback = new Date('2026-10-24T23:10:00Z');
  const afterRes = getIsraelLocalDateTime(afterFallback);
  assert.strictEqual(afterRes.dateStr, '2026-10-25', 'Date 10 min after DST fallback is 2026-10-25');
  assert.strictEqual(afterRes.monthKey, '2026-10', 'Month after DST fallback is 2026-10');

  // Verify that the local hour indeed fell back from 01:50 to 01:10
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  assert.strictEqual(formatter.format(beforeFallback), '01:50', 'Local time before fallback was 01:50');
  assert.strictEqual(formatter.format(afterFallback), '01:10', 'Local time after fallback returned to 01:10');
});

// -----------------------------------------------------------------------------
// Test 4: Clock Override Validation & Strict Error Handling
// -----------------------------------------------------------------------------
runTest('Clock Override: Strict validation rejects invalid dates and formats', () => {
  // Ensure starting with clean state
  setClockOverride(null);

  // 4.1 Nonexistent calendar dates must throw
  assert.throws(
    () => setClockOverride('2026-02-30'),
    /Invalid date for clock override/,
    'Rejects February 30'
  );
  assert.throws(
    () => setClockOverride('2026-04-31'),
    /Invalid date for clock override/,
    'Rejects April 31'
  );
  assert.throws(
    () => setClockOverride('2026-13-01'),
    /Invalid date for clock override/,
    'Rejects month 13'
  );

  // 4.2 Malformed strings must throw
  assert.throws(
    () => setClockOverride('2026/10/15' as any),
    /Invalid date for clock override/,
    'Rejects slash format'
  );
  assert.throws(
    () => setClockOverride('not-a-date' as any),
    /Invalid date for clock override/,
    'Rejects arbitrary string'
  );

  // 4.3 State was preserved and not corrupted by rejected attempts
  assert.ok(getCurrentAppDate().startsWith('20'), 'Current app date remains valid');
});

// -----------------------------------------------------------------------------
// Test 5: Clock Override Injection & finally Cleanup Guarantee
// -----------------------------------------------------------------------------
runTest('Clock Override: Injection overrides values and setClockOverride(null) reliably restores', () => {
  const originalMonth = getCurrentAppMonthKey();
  const originalDate = getCurrentAppDate();

  try {
    setClockOverride('2026-05-18');
    assert.strictEqual(getCurrentAppDate(), '2026-05-18', 'Injected date is 2026-05-18');
    assert.strictEqual(getCurrentAppMonthKey(), '2026-05', 'Injected monthKey is 2026-05');
  } finally {
    setClockOverride(null);
  }

  // Verify restoration
  assert.strictEqual(getCurrentAppDate(), originalDate, 'Original date restored after cleanup');
  assert.strictEqual(getCurrentAppMonthKey(), originalMonth, 'Original month restored after cleanup');
});

console.log(`\nClock Service Test Summary: ${passedCount} passed, ${failedCount} failed.`);
if (failedCount > 0) {
  process.exit(1);
}
