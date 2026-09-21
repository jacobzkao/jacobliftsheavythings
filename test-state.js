const assert = require('node:assert/strict');
const { validState } = require('./api/state.js');

const state = { program: { A: [], B: [], C: [] }, sessions: [], theme: null, activeWorkout: null };
assert.equal(validState(state), true);
assert.equal(validState({ ...state, sessions: {} }), false);
assert.equal(validState({ ...state, program: { A: [], B: [] } }), false);
assert.equal(validState({ ...state, theme: 'other' }), false);
assert.equal(validState({ ...state, activeWorkout: {} }), false);
