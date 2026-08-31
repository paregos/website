import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getEligibleActivities,
  pickActivity,
} from '../src/currently-activities.js';

const baseContext = {
  month: 7,
  weekday: 'Wed',
  hour: 14,
  weather: { kind: 'clear', temperature: 23 },
};

test('seasonal and Friday activities only appear in their contexts', () => {
  const ordinary = getEligibleActivities(baseContext).map(({ text }) => text);
  assert.equal(ordinary.includes('Skiing in Japan'), false);
  assert.equal(ordinary.includes('Eating dinner at Canva'), false);
  assert.equal(ordinary.includes('Looking at flights to Japan'), true);
  assert.equal(ordinary.includes('Watering my passionfruit plant'), true);
  assert.equal(ordinary.includes('Running to catch the T8'), true);
  assert.equal(ordinary.includes('Drinking an expensive mocha'), true);

  const winterFriday = getEligibleActivities({
    ...baseContext,
    month: 1,
    weekday: 'Fri',
    hour: 19,
  }).map(({ text }) => text);
  assert.equal(winterFriday.includes('Skiing in Japan'), true);
  assert.equal(winterFriday.includes('Eating dinner at Canva'), true);
});

test('everyday activities remain available outside their usual times', () => {
  const lateWeekend = getEligibleActivities({
    ...baseContext,
    weekday: 'Sat',
    hour: 23,
  }).map(({ text }) => text);

  assert.equal(lateWeekend.includes('Running to catch the T8'), true);
  assert.equal(lateWeekend.includes('Waiting for the T8'), true);
  assert.equal(lateWeekend.includes('Drinking an expensive mocha'), true);
});

test('selection avoids recent activities when alternatives exist', () => {
  const first = pickActivity(baseContext, [], () => 0);
  const second = pickActivity(baseContext, [first], () => 0);
  assert.notEqual(second, first);
});
