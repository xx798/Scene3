import test from 'node:test';
import assert from 'node:assert/strict';
import { isCronDueInWindow } from '../src/lib/cron-due';
import { shanghaiDayRange, shanghaiDate } from '../src/lib/time';

test('cron windows include missed occurrences, exclude completed runs', () => {
  const now = new Date('2026-09-07T08:02:30+08:00');
  assert.equal(isCronDueInWindow('* * * * *', null, 5, now), true);
  assert.equal(isCronDueInWindow('*/10 * * * *', null, 5, now), true);
  assert.equal(isCronDueInWindow('0 8 * * *', null, 5, now), true);
  assert.equal(isCronDueInWindow('0 8 * * *', '2026-09-07T07:59:00+08:00', 5, now), true);
  assert.equal(isCronDueInWindow('0 8 * * *', '2026-09-07T08:00:00+08:00', 5, now), false);
  assert.equal(isCronDueInWindow('0 9 * * *', null, 5, now), false);
  assert.equal(isCronDueInWindow('invalid', null, 5, now), false);
  assert.equal(isCronDueInWindow('* * * * *', null, NaN, now), false);
});
test('Shanghai day boundaries include last second and reject invalid dates', () => {
  assert.equal(shanghaiDate(new Date('2026-09-06T16:00:00Z')), '2026-09-07');
  assert.deepEqual(shanghaiDayRange('2026-09-07'), { start: '2026-09-06T16:00:00.000Z', end: '2026-09-07T16:00:00.000Z' });
  assert.throws(() => shanghaiDayRange('2026-02-30'));
});
