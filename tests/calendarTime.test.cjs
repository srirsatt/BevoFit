const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const filename = path.join(__dirname, '../src/lib/calendarTime.ts');
const compiled = new Module(filename, module);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { getCalendarClock, getCalendarWeek, formatCalendarDate, sortClassesFromCurrentTime } = compiled.exports;
const clockAt = instant => getCalendarClock(new Date(instant));

test('Austin today and minutes are independent of the device timezone', () => {
  const original = process.env.TZ;
  try {
    for (const zone of ['America/Los_Angeles', 'Asia/Tokyo', 'Europe/London', 'Pacific/Honolulu']) {
      process.env.TZ = zone;
      const clock = clockAt('2026-09-14T04:30:00Z');
      assert.equal(clock.dateKey, '2026-09-13');
      assert.equal(clock.weekday, 0);
      assert.equal(clock.minutes, 23 * 60 + 30);
      assert.equal(formatCalendarDate(clock.date, { weekday: 'long', month: 'long', day: 'numeric' }), 'Sunday, September 13');
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test('Austin midnight advances today and resets the clock to zero', () => {
  assert.equal(clockAt('2026-09-14T04:59:59Z').dateKey, '2026-09-13');
  const midnight = clockAt('2026-09-14T05:00:00Z');
  assert.equal(midnight.dateKey, '2026-09-14');
  assert.equal(midnight.weekday, 1);
  assert.equal(midnight.minutes, 0);
});

test('Austin daylight saving transitions use the correct wall clock', () => {
  for (const [instant, minutes] of [
    ['2026-03-08T07:59:00Z', 119],
    ['2026-03-08T08:00:00Z', 180],
    ['2026-11-01T06:59:00Z', 119],
    ['2026-11-01T07:00:00Z', 60],
    ['2026-12-15T18:00:00Z', 720],
  ]) assert.equal(clockAt(instant).minutes, minutes, instant);
});

test('weeks remain Sunday through Saturday across year, leap-day and DST boundaries', () => {
  for (const [instant, start, end] of [
    ['2026-01-01T18:00:00Z', '2025-12-28', '2026-01-03'],
    ['2028-02-29T18:00:00Z', '2028-02-27', '2028-03-04'],
    ['2026-03-08T18:00:00Z', '2026-03-08', '2026-03-14'],
    ['2026-11-01T18:00:00Z', '2026-11-01', '2026-11-07'],
  ]) {
    const days = getCalendarWeek(clockAt(instant).date);
    assert.equal(days.length, 7);
    assert.equal(days[0].toISOString().slice(0, 10), start);
    assert.equal(days[6].toISOString().slice(0, 10), end);
    days.forEach((day, index) => assert.equal(day.getUTCDay(), index));
  }
});

test('week rolls over at Sunday midnight in Austin', () => {
  const before = getCalendarWeek(clockAt('2026-09-13T04:59:59Z').date);
  const after = getCalendarWeek(clockAt('2026-09-13T05:00:00Z').date);
  assert.equal(before[0].toISOString().slice(0, 10), '2026-09-06');
  assert.equal(after[0].toISOString().slice(0, 10), '2026-09-13');
});

test('ongoing and upcoming classes precede ended classes, including the exact end minute', () => {
  const classes = [
    { id: 'later', startMinutes: 800, endMinutes: 860 },
    { id: 'ended', startMinutes: 600, endMinutes: 660 },
    { id: 'ongoing', startMinutes: 640, endMinutes: 700 },
  ];
  const ids = minute => sortClassesFromCurrentTime(classes, minute).map(item => item.id);
  assert.deepEqual(ids(659), ['ended', 'ongoing', 'later']);
  assert.deepEqual(ids(660), ['ongoing', 'later', 'ended']);
  assert.deepEqual(ids(700), ['later', 'ended', 'ongoing']);
  assert.deepEqual(ids(900), ['ended', 'ongoing', 'later']);
  assert.deepEqual(classes.map(item => item.id), ['later', 'ended', 'ongoing']);
  assert.deepEqual(sortClassesFromCurrentTime([], 0), []);
});
