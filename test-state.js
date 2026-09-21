const assert = require('node:assert/strict');
const { validState } = require('./api/state.js');

const state = { program: { A: [], B: [], C: [] }, sessions: [], theme: null, activeWorkout: null };
assert.equal(validState(state), true);
assert.equal(validState({ ...state, sessions: {} }), false);
assert.equal(validState({ ...state, program: { A: [], B: [] } }), true);
assert.equal(validState({ ...state, nextDay: 'D' }), false);
assert.equal(validState({ ...state, nextDay: 'A' }), true);
assert.equal(validState({ ...state, theme: 'other' }), false);
assert.equal(validState({ ...state, activeWorkout: {} }), false);
assert.equal(validState({ ...state, weights: [{ id: 1, date: '2026-01-05', weight: 180.5 }] }), true);
assert.equal(validState({ ...state, weights: [{ id: 1, date: '2026-02-30', weight: 180 }] }), false);
assert.equal(validState({ ...state, weights: [{ id: 1, date: '2026-01-05', weight: 0 }] }), false);
