const assert = require('node:assert/strict');
const source = require('node:fs').readFileSync('index.html', 'utf8');
const match = source.match(/function setComplete\(set\)\{.*\}\n  function sessionSets\(x\)\{.*\}/);
assert.ok(match, 'shared set completion counter exists');
const sessionSets = new Function(match[0] + '; return sessionSets;')();

assert.equal(sessionSets({ exercises: [{ sets: [{}, {}] }, { sets: [{}] }] }), 0);
assert.equal(sessionSets({ exercises: [{ sets: [{ w: '135' }, { r: '8' }, { done: true }] }] }), 2);
assert.equal(sessionSets({}), 0);

const weekChange = source.match(/function changeWeek\(amount\)\{[\s\S]*?\n  \}/);
assert.ok(weekChange, 'week change handler exists');
const week = new Function(`var weekOffset=0, volumeRenders=0, dayRenders=0;
  function renderVolume(){ volumeRenders++; }
  function renderDay(){ dayRenders++; }
  ${weekChange[0]}
  return { changeWeek: changeWeek, state: function(){ return {weekOffset:weekOffset,volumeRenders:volumeRenders,dayRenders:dayRenders}; } };`)();
week.changeWeek(1);
assert.deepEqual(week.state(), { weekOffset: 1, volumeRenders: 1, dayRenders: 1 });

assert.match(source, /function startWorkout\(\)/, 'workouts can be explicitly started');
assert.match(source, /function finishWorkout\(\)/, 'active workouts can be finished');
assert.match(source, /id:Date\.now\(\)/, 'each started workout gets a unique session id');
assert.match(source, /session\.id===activeWorkout\.id/, 'logging updates the active session instead of a weekly slot');
assert.match(source, /ACTIVE_KEY/, 'active workouts persist for resume after reload');

const mergeSessions = new Function(source.match(/function mergeSessions\(local, remote\)\{[\s\S]*?\n  \}/)[0] + '; return mergeSessions;')();
assert.deepEqual(mergeSessions([{id:1, value:'remote'}], [{id:1, value:'local'}, {id:2}]), [{id:1, value:'remote'}, {id:2}], 'cloud snapshots retain local-only history without replacing newer remote entries');
assert.match(source, /fetch\('\/api\/state'/, 'the browser syncs through the Vercel state API');
assert.match(source, /response\.status===409/, 'stale shared-state writes retry after a conflict');

assert.doesNotMatch(source, /RIR/, 'RIR is not shown anywhere in the app');
assert.match(source, /id="addExercise"/, 'editor can add exercises');
assert.match(source, /data-a="del"/, 'editor can delete exercises');
assert.match(source, /data-a="name"/, 'editor can edit exercise names');
assert.match(source, /data-a="reps"/, 'editor can edit rep ranges');
assert.match(source, /id="defaultRestMinutes"/, 'editor can set rest minutes');
assert.match(source, /id="defaultRestSeconds"/, 'editor can set rest seconds');
assert.match(source, /DAY_KEYS\.forEach\(function\(day\)\{ program\[day\]\.forEach\(function\(ex\)\{ ex\.rest=rest; \}\); \}\);/, 'default rest is applied to every exercise');
assert.match(source, /data-a="muscle"/, 'editor can select target muscles');

const progressBlock = source.match(/\/\* ---------- progress data ---------- \*\/([\s\S]*?)\/\* ---------- progress ui ---------- \*\//);
assert.ok(progressBlock, 'progress data helpers exist');
const progress = new Function(`${progressBlock[1]}; return { progressGroups, exerciseProgress, overallProgress };`)();

const sessions = [
  { date: '2026-01-12T12:00:00Z', day: 'A', exercises: [{ name: 'Bench Press', sets: [{ w: '80', r: '6' }, { w: '80', r: '5' }, { w: '80', r: '5' }] }] },
  { date: '2026-01-05T12:00:00Z', day: 'A', exercises: [{ name: 'Bench Press', sets: [{ w: '75', r: '8' }, { w: '75', r: '7' }, { w: '75', r: '7' }] }] },
  { date: '2026-01-19T12:00:00Z', day: 'A', exercises: [{ name: 'Bench Press', sets: [{ w: '85', r: '5' }, { w: '', r: '' }, { w: '85', r: '4' }] }] }
];
const bench = progress.exerciseProgress(progress.progressGroups(sessions)[0]);
assert.deepEqual(bench.points.slice(0, 2).map(point => point.average), [75, 80], 'weight, not tonnage or estimated strength, drives the line');
assert.deepEqual(bench.points[0].sets.map(set => set.r), [8, 7, 7], 'reps remain available for point details');
assert.equal(bench.points[2].sets[1].value, 80, 'a missing set carries its prior value');
assert.equal(bench.points[2].sets[1].carried, true, 'carried values are marked');
assert.equal(Math.round(bench.points[2].average * 100) / 100, 83.33, 'carried values count in the average');

const repsOnly = progress.exerciseProgress(progress.progressGroups([
  { date: '2026-01-05T12:00:00Z', exercises: [{ name: 'Pull-ups', sets: [{ w: '', r: '8' }, { r: '7' }] }] },
  { date: '2026-01-12T12:00:00Z', exercises: [{ name: 'pull-ups', sets: [{ r: '9' }, { r: '8' }] }] }
])[0]);
assert.equal(repsOnly.mode, 'reps', 'reps-only exercises fall back to reps');
assert.deepEqual(repsOnly.points.map(point => point.average), [7.5, 8.5]);

const overallGroups = progress.progressGroups([
  { date: '2026-01-05T12:00:00Z', exercises: [{ name: 'Bench', sets: [{ w: 75, r: 8 }] }, { name: 'Row', sets: [{ w: 100, r: 8 }] }, { name: 'Pull-ups', sets: [{ r: 8 }] }] },
  { date: '2026-01-12T12:00:00Z', exercises: [{ name: 'bench', sets: [{ w: 80, r: 5 }] }, { name: 'Row', sets: [{ w: 110, r: 5 }] }, { name: 'Pull-ups', sets: [{ r: 9 }] }] }
]);
assert.equal(overallGroups.length, 3, 'same exercise names combine across days and casing');
const overall = progress.overallProgress(overallGroups);
assert.equal(overall.exercises, 2, 'reps-only exercises are excluded from the overall weight index');
assert.equal(overall.points[0].value, 100, 'overall index begins at 100');
assert.equal(Math.round(overall.points[1].value * 100) / 100, 108.33, 'overall index averages normalized exercise weight changes');

const edgeGroups = progress.progressGroups([
  { date: 'bad date', exercises: [{ name: 'Ignored', sets: [{ w: 50, r: 5 }] }] },
  { date: '2026-01-05T12:00:00Z', exercises: [{ name: 'Legacy', sets: [{ w: '50', r: '8' }, { w: 'nope', r: '7' }] }, { name: 'Renamed', sets: [] }] },
  { date: '2026-01-12T12:00:00Z', exercises: [{ name: 'Legacy', sets: [{ w: '', r: '' }, { w: '', r: '' }] }, { name: 'Different name', sets: [{ w: 60, r: 6 }] }] }
]);
const legacy = progress.exerciseProgress(edgeGroups.find(group => group.key === 'legacy'));
assert.equal(legacy.points.length, 1, 'fully blank and invalid sessions do not fabricate progress points');
assert.equal(legacy.points[0].sets.length, 2, 'legacy compact arrays remain readable as contiguous set positions');
assert.notEqual(edgeGroups.find(group => group.key === 'renamed'), edgeGroups.find(group => group.key === 'different name'), 'renamed exercises remain separate trends');

assert.match(source, /sets:d\[i\]\.map\(/, 'future sessions preserve blank set positions');
assert.match(source, /\(e\.sets\|\|\[\]\)\.some\(setComplete\)/, 'blank preserved rows do not replace the last completed workout');
assert.match(source, /id="progressPreviewChart"/, 'home page includes a progress preview');
assert.match(source, /id="progressPage"/, 'app includes a full-screen progress view');

assert.match(source, /id="mainNav"/, 'top-level navigation exists');
['home', 'workouts', 'history', 'settings'].forEach(view => assert.match(source, new RegExp('data-view="' + view + '"'), view + ' tab exists'));
assert.match(source, /function showView\(view\)/, 'top-level navigation switches views');
assert.match(source, /function showWithMotion\(el\)/, 'views and modules share cancel-safe opening motion');
assert.match(source, /function hideWithMotion\(el, done\)/, 'views and modules share closing motion');
assert.match(source, /prefers-reduced-motion: reduce\)\{ \.motion-in,\.motion-out/, 'reduced-motion disables page and module transitions');
assert.match(source, /class="workout-overview-row"/, 'planned workouts show compact exercise rows before starting');
assert.match(source, /ex\.sets\+' × '\+esc\(ex\.repRange\)/, 'overview rows include sets and rep ranges');
assert.match(source, /var all=loadSessions\(\), el=document\.getElementById\('historyList'\)/, 'history renders every saved session');

const updateSession = new Function(source.match(/function updateSession\(sessions, id, change\)\{[\s\S]*?\n  \}/)[0] + '; return updateSession;')();
const savedLogs = [{ id: 1, day: 'A', date: '2026-01-01T12:00:00Z', exercises: [{ name: 'Bench', sets: [{ w: '100', r: '5' }] }] }];
const editedLogs = updateSession(savedLogs, 1, session => { session.exercises[0].name = 'Paused Bench'; session.exercises[0].sets[0].r = '6'; });
assert.equal(editedLogs[0].exercises[0].name, 'Paused Bench', 'historical exercise names persist');
assert.equal(editedLogs[0].exercises[0].sets[0].r, '6', 'historical set values persist');
assert.equal(editedLogs[0].day, 'A', 'historical day remains unchanged');
assert.equal(editedLogs[0].date, '2026-01-01T12:00:00Z', 'historical date remains unchanged');
assert.match(source, /id="logEditor"/, 'history opens an editor for saved logs');
assert.match(source, /refreshChestSets\(session\)/, 'historical edits refresh the visible chest-set total');
