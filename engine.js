// CLosed LOOp - lunar outpost simulation engine (numbers only, no graphics).
// Flow per day:  startDay(state) -> player reads alerts -> resolveDay(state, orders)
(function (root) {
  const { CONFIG: K, SCENARIOS } = (typeof module !== 'undefined' && module.exports)
    ? require('./config.js') : root.SimConfig;

  const SYSTEMS = ['thermal', 'base', 'oxygen', 'scrubber', 'recycler', 'greenhouse'];
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const r1 = (x) => Math.round(x * 10) / 10;

  function makeRng(seed) { // small seeded random generator
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createMission(scenarioId, seed) {
    const sc = SCENARIOS[scenarioId];
    if (!sc) throw new Error('Unknown scenario ' + scenarioId);
    const rng = makeRng(seed || 1);
    const schedule = sc.events.map((e) => Object.assign({}, e, {
      day: Math.max(1, e.day + Math.round((rng() * 2 - 1) * (e.jitter || 0))),
    }));
    return {
      scenarioId, seed: seed || 1, name: sc.name, length: sc.length, startPhase: sc.startPhase,
      day: 1, todayDay: 0, ended: false, outcome: null, cause: null,
      schedule,
      o2: K.start.o2Reserve, co2: 0, water: K.start.cleanWater, grey: K.start.greyWater,
      food: K.start.foodKcal, battery: K.start.battery,
      health: K.start.health, fatigue: 0, dose: 0, temp: K.thermal.comfortC,
      shieldCm: 0, wear: 0,
      greenhouse: { maturity: K.start.greenhouseMaturity, darkDays: 0 },
      dust: { active: false, cleaned: 0 },
      recycler: { broken: false, progress: 0 },
      leak: { active: false, progress: 0 },
      o2ShortDays: 0,
      last: { o2: 0, water: 0, food: 0, battery: 0 },
      today: { alerts: [], spe: 0 },
      log: [], history: [],
    };
  }

  const phaseOf = (s, day) => (s.startPhase + (day - 1)) % K.lunarCycleDays;
  const isSunlit = (s, day) => phaseOf(s, day) < K.sunlitDays;
  function nightInfo(s) {
    const phase = phaseOf(s, s.day);
    if (phase < K.sunlitDays) return { sunlit: true, daysToNight: K.sunlitDays - phase, nightLeft: 0 };
    return { sunlit: false, daysToNight: 0, nightLeft: K.lunarCycleDays - phase };
  }
  function pushLog(s, sev, tag, msg) { s.log.push({ day: s.day, sev, tag, msg }); }

  function startDay(s) {
    if (s.ended || s.todayDay === s.day) return { alerts: s.today.alerts, status: getStatus(s) };
    s.todayDay = s.day;
    const alerts = [];
    s.today = { alerts, spe: 0 };
    for (const e of s.schedule.filter((x) => x.day === s.day)) {
      if (e.type === 'dust') {
        s.dust = { active: true, cleaned: 0 };
        alerts.push({ sev: 'warn', msg: 'Dust has settled on the solar panels. Output is reduced until they are cleaned.' });
      } else if (e.type === 'spe') {
        s.today.spe = e.dose;
        alerts.push({ sev: 'crit', msg: 'SOLAR STORM: a burst of high-energy particles is arriving today. Shelter the crew or accept the dose.' });
      } else if (e.type === 'recycler_fail') {
        s.recycler = { broken: true, progress: 0 };
        alerts.push({ sev: 'crit', msg: 'The water recycler has failed. It needs repair hours before it works again.' });
      } else if (e.type === 'micromet') {
        s.leak = { active: true, progress: 0 };
        s.o2 = Math.max(0, s.o2 - 8);
        alerts.push({ sev: 'crit', msg: 'A micrometeorite punctured a module. Air is leaking until it is repaired.' });
      } else if (e.type === 'supply') {
        s.food += 50000; s.o2 += 20; s.water += 100;
        alerts.push({ sev: 'info', msg: 'A supply lander arrived with food, oxygen and water.' });
      }
    }
    const n = nightInfo(s);
    if (n.sunlit && n.daysToNight <= 3.01) {
      alerts.push({ sev: 'warn', msg: 'Lunar night begins in about ' + Math.ceil(n.daysToNight) + ' day(s). Solar power drops to zero for about two weeks.' });
    } else if (!n.sunlit && (s.day === 1 || isSunlit(s, s.day - 1))) {
      alerts.push({ sev: 'warn', msg: 'Lunar night has begun. Panels produce nothing for about two weeks.' });
    }
    for (const row of getStatus(s).rows) {
      if (row.level === 'crit') alerts.push({ sev: 'crit', msg: row.label + ' is critical' + (row.daysLeft !== null ? ' (about ' + r1(row.daysLeft) + ' days left)' : '') + '.' });
      else if (row.level === 'warn') alerts.push({ sev: 'warn', msg: row.label + ' is getting low' + (row.daysLeft !== null ? ' (about ' + r1(row.daysLeft) + ' days left)' : '') + '.' });
    }
    alerts.forEach((a) => { if (a.sev !== 'info') pushLog(s, a.sev, 'alert', a.msg); });
    return { alerts, status: getStatus(s) };
  }

  function getStatus(s) {
    const n = nightInfo(s);
    const lvlDays = (d) => (d === null ? 'ok' : d < 3 ? 'crit' : d < 7 ? 'warn' : 'ok');
    const left = (stock, delta) => (delta < -0.001 ? stock / -delta : null);
    const rows = [];
    const add = (id, label, value, unit, daysLeft, levelOverride, note) => rows.push({
      id, label, value: r1(value), unit, daysLeft, level: levelOverride || lvlDays(daysLeft), note: note || '',
    });
    add('power', 'Battery', s.battery, 'kWh', left(s.battery, s.last.battery),
      !n.sunlit && s.battery / Math.max(1, -s.last.battery || 1) < n.nightLeft ? 'warn' : null,
      n.sunlit ? 'Sun up' : 'Night: ' + r1(n.nightLeft) + ' days left');
    add('oxygen', 'Oxygen reserve', s.o2, 'kg', left(s.o2, s.last.o2));
    add('water', 'Clean water', s.water, 'L', left(s.water, s.last.water));
    add('food', 'Food', s.food / 1000, 'k kcal', left(s.food, s.last.food));
    add('co2', 'CO2 in cabin', s.co2, 'kg', null, s.co2 > 6 ? 'crit' : s.co2 > 3 ? 'warn' : 'ok');
    add('temp', 'Cabin temperature', s.temp, 'C', null, s.temp < 5 ? 'crit' : s.temp < 15 ? 'warn' : 'ok');
    add('dose', 'Radiation dose (total)', s.dose, 'mSv', null, s.dose > 300 ? 'crit' : s.dose > 150 ? 'warn' : 'ok');
    add('fatigue', 'Crew fatigue', s.fatigue, '%', null, s.fatigue > 70 ? 'crit' : s.fatigue > 50 ? 'warn' : 'ok');
    add('health', 'Crew health', s.health, '%', null, s.health < 40 ? 'crit' : s.health < 70 ? 'warn' : 'ok');
    return { rows, day: s.day, length: s.length, sunlit: n.sunlit, daysToNight: n.daysToNight, nightLeft: n.nightLeft,
      greenhouse: r1(s.greenhouse.maturity), shieldCm: r1(s.shieldCm), dust: s.dust.active,
      recyclerBroken: s.recycler.broken, leak: s.leak.active };
  }

  function defaultOrders() {
    return {
      priority: SYSTEMS.slice(),
      greenhouseLevel: 1,
      hours: { maintenance: 4, greenhouse: 8, shielding: 0, cleaning: 0, repair: 0 },
      shelter: false,
    };
  }

  function normalizeOrders(o) {
    const d = defaultOrders();
    o = o || {};
    const pr = (o.priority || d.priority).filter((x) => SYSTEMS.includes(x));
    SYSTEMS.forEach((x) => { if (!pr.includes(x)) pr.push(x); });
    const hours = Object.assign({}, d.hours, o.hours || {});
    Object.keys(hours).forEach((k) => { hours[k] = Math.max(0, +hours[k] || 0); });
    const total = sum(hours);
    if (total > K.crew.maxHours) Object.keys(hours).forEach((k) => { hours[k] = hours[k] * K.crew.maxHours / total; });
    const level = o.greenhouseLevel === undefined ? d.greenhouseLevel : o.greenhouseLevel;
    return { priority: pr, greenhouseLevel: clamp(level, 0, 1), hours, shelter: !!o.shelter };
  }

  function resolveDay(s, ordersIn) {
    if (s.ended) return { ended: true, outcome: s.outcome };
    if (s.todayDay !== s.day) startDay(s);
    const o = normalizeOrders(ordersIn);
    const crew = K.crewSize;
    const h = Object.assign({}, o.hours);
    const rep = { day: s.day, notes: [], damage: {} };
    const note = (m) => rep.notes.push(m);
    const n = nightInfo(s);
    const sunlit = n.sunlit;

    if (o.shelter) {
      if (h.shielding || h.cleaning) note('Crew stayed in the shelter, so outdoor work (shielding, cleaning) did not happen.');
      h.shielding = 0; h.cleaning = 0;
    }
    const totalHours = sum(h);
    const normalTotal = K.crew.normalHours * crew;
    if (totalHours > normalTotal) s.fatigue = clamp(s.fatigue + (totalHours - normalTotal) * 3, 0, 100);
    else s.fatigue = clamp(s.fatigue - (4 + (normalTotal - totalHours) * 0.4), 0, 100);

    // crew tasks
    if (s.dust.active) {
      s.dust.cleaned += h.cleaning;
      if (s.dust.cleaned >= K.repair.dustCleanHours) { s.dust.active = false; note('Solar panels cleaned.'); }
    }
    let rp = h.repair;
    if (s.recycler.broken && rp > 0) {
      const use = Math.min(rp, K.repair.recyclerHours - s.recycler.progress);
      s.recycler.progress += use; rp -= use;
      if (s.recycler.progress >= K.repair.recyclerHours) { s.recycler.broken = false; note('Water recycler repaired.'); }
    }
    if (s.leak.active && rp > 0) {
      s.leak.progress += rp;
      if (s.leak.progress >= K.repair.leakHours) { s.leak.active = false; note('Leak sealed.'); }
    }
    s.wear = clamp(s.wear + K.wear.gainPerDay - h.maintenance * (K.wear.gainPerDay / K.wear.maintenanceHoursForZero), 0, 10);
    s.shieldCm = Math.min(K.radiation.maxShieldCm, s.shieldCm + h.shielding * K.radiation.shieldCmPerCrewHour);

    // power
    const solar = sunlit ? K.power.solarKW * 24 * K.power.solarCapacityFactor * (s.dust.active ? K.power.dustFactor : 1) : 0;
    const supply = K.power.baselineKWhPerDay + solar;
    const crewO2 = crew * K.crew.o2PerPerson, crewCO2 = crew * K.crew.co2PerPerson;
    const ghPot = s.greenhouse.maturity * o.greenhouseLevel;
    const ogaTarget = clamp(crewO2 + (s.leak.active ? 1 : 0) - K.greenhouse.o2ReleaseFull * ghPot
      + 0.1 * Math.max(0, K.start.o2Target - s.o2), 0, K.loads.ogaMaxKgPerDay);
    const scrubTarget = clamp(s.co2 + crewCO2 - K.greenhouse.co2AbsorbFull * ghPot, 0, K.loads.scrubberMaxKgPerDay);
    const demand = {
      thermal: sunlit ? K.loads.thermalDayKWh : K.loads.thermalNightKWh,
      base: K.loads.baseKWh,
      oxygen: ogaTarget * K.loads.ogaKWhPerKg,
      scrubber: scrubTarget * K.loads.scrubberKWhPerKg,
      recycler: (s.recycler.broken || s.grey <= 0) ? 0 : K.loads.recyclerKWh,
      greenhouse: o.greenhouseLevel * K.loads.greenhouseKWh,
    };
    let avail = supply + s.battery, used = 0;
    const f = {};
    for (const id of o.priority) {
      const d = demand[id];
      const give = Math.min(d, avail);
      f[id] = d > 0 ? give / d : 1;
      avail -= give; used += give;
    }
    const net = supply - used;
    const batteryBefore = s.battery;
    if (net >= 0) s.battery = Math.min(K.power.batteryCapacityKWh, s.battery + net * K.power.chargeEfficiency);
    else s.battery = Math.max(0, s.battery + net);
    rep.power = { solar: r1(solar), supply: r1(supply), used: r1(used), battery: r1(s.battery) };
    const shed = SYSTEMS.filter((id) => demand[id] > 0 && f[id] < 0.999);
    if (shed.length) {
      note('Not enough power. Underpowered today: ' + shed.map((id) => id + ' (' + Math.round(f[id] * 100) + '%)').join(', ') + '.');
      pushLog(s, 'warn', 'power_deficit', 'Power ran short. Underpowered: ' + shed.join(', ') + '.');
    }

    // greenhouse
    const hoursFactor = Math.min(1, h.greenhouse / 4);
    const ghActive = o.greenhouseLevel * f.greenhouse * hoursFactor;
    const ghEff = s.greenhouse.maturity * ghActive;
    if (ghActive >= 0.5) { s.greenhouse.maturity = Math.min(1, s.greenhouse.maturity + K.greenhouse.growthPerDay); }
    else { s.greenhouse.maturity = Math.max(0, s.greenhouse.maturity - K.greenhouse.declinePerBadDay); }
    if (o.greenhouseLevel * f.greenhouse < 0.01) s.greenhouse.darkDays += 1; else s.greenhouse.darkDays = 0;
    if (s.greenhouse.darkDays >= K.greenhouse.darkDaysToDie && s.greenhouse.maturity > 0) {
      s.greenhouse.maturity = 0; note('The crops died after days without light.');
      pushLog(s, 'warn', 'crops', 'Crops died after days without light.');
    }

    // water
    const waterUse = Math.min(crew * K.crew.waterUsePerPerson, s.water);
    const waterShort = waterUse < crew * K.crew.waterMinPerPerson;
    s.water -= waterUse; s.grey += waterUse;
    const ghWater = Math.min(s.water, K.greenhouse.waterPerDayFull * o.greenhouseLevel * f.greenhouse);
    s.water -= ghWater;
    const ogaOut = Math.min(ogaTarget * f.oxygen, s.water / K.loads.electrolysisWaterPerKgO2);
    s.water -= ogaOut * K.loads.electrolysisWaterPerKgO2;
    const eff = Math.max(0.5, K.loads.recyclerBaseEfficiency - K.recyclerWearPenalty * s.wear);
    const proc = s.recycler.broken ? 0 : Math.min(s.grey, K.loads.recyclerMaxLPerDay) * f.recycler;
    s.water += proc * eff; s.grey -= proc;

    // oxygen and CO2
    const o2Before = s.o2, co2Before = s.co2;
    s.o2 += ogaOut + K.greenhouse.o2ReleaseFull * ghEff - crewO2 - (s.leak.active ? 1 : 0);
    let o2Short = false;
    if (s.o2 < 0) { s.o2 = 0; o2Short = true; }
    const scrubOut = Math.min(scrubTarget * f.scrubber, s.co2 + crewCO2);
    s.co2 = Math.max(0, s.co2 + crewCO2 - scrubOut - K.greenhouse.co2AbsorbFull * ghEff);

    // food
    const foodBefore = s.food;
    s.food += K.greenhouse.kcalPerDayFull * ghEff;
    const need = crew * K.crew.kcalPerPerson, eat = Math.min(s.food, need);
    s.food -= eat;
    const deficit = (need - eat) / need;

    // radiation
    const gcr = K.radiation.gcrBaseMSvPerDay / (1 + s.shieldCm / K.radiation.gcrShieldScaleCm);
    const spe = s.today.spe * Math.exp(-s.shieldCm / K.radiation.speShieldScaleCm) * (o.shelter ? K.radiation.shelterFactor : 1);
    const doseToday = gcr + spe;
    s.dose += doseToday;
    rep.dose = r1(doseToday);
    if (s.today.spe) note('Solar storm dose today: ' + r1(spe) + ' mSv' + (o.shelter ? ' (crew sheltered).' : ' (crew not sheltered).'));

    // temperature
    if (f.thermal >= 0.999) s.temp = Math.min(K.thermal.comfortC, s.temp + K.thermal.regainPerDay);
    else s.temp -= (1 - f.thermal) * (sunlit ? K.thermal.dropPerDayDay : K.thermal.dropPerDayNight);

    // crew health
    const D = K.damage, dmg = rep.damage;
    if (o2Short) dmg.oxygen = D.o2Shortfall;
    if (s.co2 > 12) dmg.co2 = D.co2Lethal; else if (s.co2 > 5) dmg.co2 = (s.co2 - 5) * D.co2PerKgOver5;
    if (waterShort) dmg.water = D.waterShortfall;
    if (deficit > 0.001) dmg.food = deficit * D.starvationAtFullDeficit;
    if (s.temp < 10) dmg.cold = (10 - s.temp) * D.coldPerDegreeUnder10;
    if (doseToday > 50) dmg.radiation = (doseToday - 50) * D.dosePerMSvOver50;
    if (s.dose > 300) dmg.radiation = (dmg.radiation || 0) + D.cumulativeDoseOver300;
    if (s.fatigue > 70) dmg.fatigue = (s.fatigue - 70) * D.fatiguePerPointOver70;
    const totalDmg = sum(dmg);
    if (totalDmg > 0) {
      s.health = clamp(s.health - totalDmg, 0, 100);
      Object.keys(dmg).forEach((k) => pushLog(s, 'crit', k, 'Crew health took ' + r1(dmg[k]) + ' damage from ' + k + '.'));
    } else if (s.fatigue < 50) s.health = clamp(s.health + 2, 0, 100);

    s.last = { o2: s.o2 - o2Before, water: proc * eff - waterUse - ghWater - ogaOut * K.loads.electrolysisWaterPerKgO2,
      food: s.food - foodBefore, battery: s.battery - batteryBefore };
    rep.status = getStatus(s);
    s.history.push({ day: s.day, orders: o, power: rep.power, health: r1(s.health), dose: r1(s.dose) });

    if (s.health <= 0) {
      s.ended = true; s.outcome = 'failed';
      s.cause = Object.keys(dmg).sort((a, b) => dmg[b] - dmg[a])[0] || 'unknown';
      pushLog(s, 'fail', 'end', 'Mission lost on day ' + s.day + '. Main cause: ' + s.cause + '.');
    } else if (s.day >= s.length) {
      s.ended = true; s.outcome = 'success';
      pushLog(s, 'info', 'end', 'Mission completed. The crew is alive.');
    } else s.day += 1;
    rep.ended = s.ended; rep.outcome = s.outcome; rep.cause = s.cause;
    return rep;
  }

  // Debrief: the earliest warning signs leading up to the end, in plain order.
  function debrief(s) {
    const important = s.log.filter((e) => e.sev !== 'info' && e.tag !== 'end');
    const firstByTag = {};
    important.forEach((e) => { if (!firstByTag[e.tag]) firstByTag[e.tag] = e; });
    return {
      outcome: s.outcome, days: Math.min(s.day, s.length), cause: s.cause,
      totalDoseMSv: r1(s.dose), finalHealth: r1(s.health),
      firstWarnings: Object.values(firstByTag).sort((a, b) => a.day - b.day).slice(0, 8),
    };
  }

  const Sim = { SYSTEMS, createMission, startDay, resolveDay, getStatus, defaultOrders, debrief, SCENARIOS };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sim;
  else root.Sim = Sim;
})(typeof self !== 'undefined' ? self : this);
