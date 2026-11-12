// Test harness: runs fake missions with simple "player" policies to check the balance.
// Usage: node simulate.js
const Sim = require('./engine.js');

// A player who never changes anything.
function naive(state) {
  return Sim.defaultOrders();
}

// A player who is paying attention.
function careful(state) {
  const st = Sim.getStatus(state);
  const o = Sim.defaultOrders();
  const nightSoon = st.sunlit && st.daysToNight <= 3;
  const night = !st.sunlit;
  // keep the crops alive but dim during the night
  o.greenhouseLevel = night || nightSoon ? 0.5 : 1;
  // power priority: life first, crops last
  o.priority = ['thermal', 'base', 'oxygen', 'scrubber', 'recycler', 'greenhouse'];
  const hours = { maintenance: 4, greenhouse: 5, shielding: 0, cleaning: 0, repair: 0 };
  if (state.dust.active) hours.cleaning = 4;
  if (state.recycler.broken) hours.repair = 8;
  else if (state.leak.active) hours.repair = 6;
  if (!state.dust.active && !state.recycler.broken && !state.leak.active && state.shieldCm < 120) hours.shielding = 12;
  o.hours = hours;
  o.shelter = state.today.spe > 0;
  return o;
}

// Careful, but forgets the lunar night plan: crops stay at full power.
function noNightPlan(state) {
  const o = careful(state);
  o.greenhouseLevel = 1;
  return o;
}

// Careful, but never builds radiation shielding (still shelters in storms).
function noShielding(state) {
  const o = careful(state);
  o.hours.shielding = 0;
  return o;
}

// Careful, but ignores solar-storm alerts.
function noShelter(state) {
  const o = careful(state);
  o.shelter = false;
  return o;
}

// Careful, but works overtime every day to get more done.
function overworker(state) {
  const o = careful(state);
  o.hours.maintenance = 8; o.hours.greenhouse = 8; o.hours.shielding = 24;
  return o;
}

// Careful, but no shielding AND ignores storm alerts.
function complacent(state) {
  const o = careful(state);
  o.hours.shielding = 0; o.shelter = false;
  return o;
}

// Careful, but never cleans dust or repairs anything.
function noUpkeep(state) {
  const o = careful(state);
  o.hours.cleaning = 0; o.hours.repair = 0;
  return o;
}

function run(scenario, seed, policy) {
  const s = Sim.createMission(scenario, seed);
  while (!s.ended) {
    Sim.startDay(s);
    Sim.resolveDay(s, policy(s));
  }
  return s;
}

const verbose = process.argv.includes('-v');
const scenarios = Object.keys(Sim.SCENARIOS);
const policies = { naive, careful, noNightPlan, noShielding, noShelter, overworker, complacent, noUpkeep };
for (const [pname, policy] of Object.entries(policies)) {
  console.log('\n=== policy: ' + pname + ' ===');
  for (const sc of scenarios) {
    const results = [];
    for (let seed = 1; seed <= 20; seed++) {
      const s = run(sc, seed, policy);
      results.push({ seed, outcome: s.outcome, day: Math.min(s.day, s.length), cause: s.cause, health: Math.round(s.health), dose: Math.round(s.dose) });
    }
    const wins = results.filter((r) => r.outcome === 'success').length;
    const fails = results.filter((r) => r.outcome === 'failed');
    const causes = {};
    fails.forEach((r) => { causes[r.cause] = (causes[r.cause] || 0) + 1; });
    const avgFailDay = fails.length ? (fails.reduce((a, r) => a + r.day, 0) / fails.length).toFixed(1) : '-';
    console.log(sc.padEnd(15), 'survived ' + wins + '/20', ' avg fail day:', avgFailDay, ' causes:', JSON.stringify(causes));
    if (verbose) results.slice(0, 3).forEach((r) => console.log('   ', JSON.stringify(r)));
  }
}
