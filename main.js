// CLosed LOOp - Junior Astronaut Mission Trainer: dashboard (UI only).
// All game rules live in engine.js and config.js. This file only shows the state and sends orders.
(function () {
  'use strict';

  const Sim = window.Sim;
  const K = window.SimConfig && window.SimConfig.CONFIG;
  if (!Sim || !K) {
    document.body.innerHTML = '<p style="padding:2rem;font-family:sans-serif;color:#fff">Could not load config.js and engine.js. Keep them in the same folder as index.html.</p>';
    return;
  }

  // ------------------------------------------------------------------ helpers
  const SAVE_KEY = 'closedloop.mission.v1';
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const r1 = (x) => Math.round(x * 10) / 10;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const RANK = { ok: 0, warn: 1, crit: 2 };
  const LVL = { ok: { icon: '●', text: 'OK' }, warn: { icon: '▲', text: 'Watch' }, crit: { icon: '✖', text: 'Critical' } };
  const ALERT_ICON = { crit: '✖', warn: '▲', info: 'ℹ' };

  let s = null;          // the mission state (owned by the engine)
  let orders = null;     // today's orders (what the player is setting)
  let details = false;   // "Details" switch

  // ------------------------------------------------------------------ text
  const SCEN_DESC = {
    first_week: 'Learn the controls in a short, forgiving week. One dust event will test your attention.',
    survive_night: 'The lunar night is almost here: two weeks without sunlight. Can your power last?',
    solar_storm: 'Two bursts of solar radiation are on the way. Shielding and shelter decide who survives.',
    thirty_day: 'The full mission. Many things can go wrong. Stay ready for surprises.',
  };

  const TASKS = [
    { id: 'maintenance', name: 'Maintenance', hint: 'Stops equipment wear. About 4 hours a day keeps wear from growing.' },
    { id: 'greenhouse', name: 'Tend the greenhouse', hint: 'Crops need at least 4 hours of tending to grow.' },
    { id: 'shielding', name: 'Build radiation shielding', hint: 'Piling moon soil over the habitat. Outdoor work.' },
    { id: 'cleaning', name: 'Clean the solar panels', hint: 'Only useful while dust covers them. Outdoor work.' },
    { id: 'repair', name: 'Repairs', hint: 'Fixes the water recycler or a hull leak.' },
  ];

  const SYSTEM_INFO = {
    thermal: { name: 'Heating & cooling', desc: 'Keeps the habitat livable' },
    base: { name: 'Computers, comms & lights', desc: 'The base load' },
    oxygen: { name: 'Oxygen generator', desc: 'Splits water into oxygen' },
    scrubber: { name: 'CO\u2082 scrubber', desc: 'Cleans the cabin air' },
    recycler: { name: 'Water recycler', desc: 'Recovers used water' },
    greenhouse: { name: 'Greenhouse lights', desc: 'Grows food and oxygen' },
  };

  const METER = {
    power: { max: K.power.batteryCapacityKWh, trend: true,
      info: 'Stored electricity. Solar panels charge it by day and it carries the base through the lunar night.' },
    oxygen: { max: 100, trend: true,
      info: 'Backup oxygen supply. The generator and the crops top it up. Each astronaut breathes about ' + K.crew.o2PerPerson + ' kg a day.' },
    water: { max: 700, trend: true,
      info: 'Drinking and hygiene water. The recycler recovers used water, but it needs power and repairs.' },
    food: { max: 500, trend: true,
      info: 'Stored food. Mature crops add to it. The crew eats about ' + (K.crewSize * K.crew.kcalPerPerson).toLocaleString('en-US') + ' kcal a day.' },
    co2: { max: 10, info: 'Carbon dioxide in the cabin air. The scrubber removes it and plants absorb it. Too much harms the crew.' },
    temp: { max: 25, info: 'Without power for heating the habitat cools quickly. Below about 10 \u00B0C the crew is hurt.' },
    dose: { max: 400, info: 'Total radiation received so far. It only goes up. Shielding and shelter reduce it.' },
    fatigue: { max: 100, info: 'Tiredness from overtime. High fatigue hurts the crew. Rest days let it recover.' },
    health: { max: 100, info: 'Average crew health. If it reaches 0 the mission fails.' },
  };

  const EVENT_TEXT = {
    dust: 'Dust settled on the solar panels.',
    spe: 'A solar storm is arriving today.',
    recycler_fail: 'The water recycler failed.',
    micromet: 'A micrometeorite punctured a module.',
    supply: 'A supply lander arrived.',
  };

  const DMG_TEXT = {
    oxygen: 'not enough oxygen', co2: 'too much CO\u2082 in the cabin', water: 'not enough water',
    food: 'not enough food', cold: 'a cabin that is too cold', radiation: 'radiation', fatigue: 'exhaustion',
  };

  const CAUSES = {
    oxygen: { title: 'The crew ran out of oxygen.', lesson: 'Keep the oxygen generator high in the power priority list, and watch the "days left" figure on the oxygen meter. Power shortages at night are the usual trap.' },
    co2: { title: 'CO\u2082 built up in the cabin.', lesson: 'The scrubber needs power every day. If it sits low in the priority list, it is the first thing to lose power when energy runs short.' },
    water: { title: 'The crew ran out of drinking water.', lesson: 'Keep the water recycler powered and repaired. The oxygen generator also uses water, so water, power and oxygen are linked.' },
    food: { title: 'The crew ran out of food.', lesson: 'Stored food does not last forever. Keep the crops alive and growing, especially through the lunar night, and do not let the greenhouse go dark for days.' },
    cold: { title: 'The habitat froze.', lesson: 'Heating and cooling is the biggest steady power user. Keep it at the top of the priority list, especially at night.' },
    radiation: { title: 'Radiation harmed the crew.', lesson: 'Build up shielding early, and shelter the crew whenever a solar storm is announced. Outdoor work cannot happen while the crew shelters.' },
    fatigue: { title: 'The crew collapsed from exhaustion.', lesson: 'Overtime builds fatigue. Plan the work, and give the crew easy days so they can recover.' },
    unknown: { title: 'The crew did not survive.', lesson: 'Review the early warnings below to see where things started to go wrong.' },
  };

  // ------------------------------------------------------------------ saving
  function save() {
    if (!s || s.ended) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, s: s, orders: orders, details: details })); } catch (e) { /* storage blocked: fine */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || !d.s || d.s.ended || !Sim.SCENARIOS[d.s.scenarioId] || !d.orders) return null;
      return d;
    } catch (e) { return null; }
  }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }

  // ------------------------------------------------------------------ screens & modal
  function showScreen(name) {
    ['start', 'game', 'end'].forEach((n) => { $('screen-' + n).hidden = n !== name; });
    window.scrollTo(0, 0);
  }

  let modalButtons = [];
  function openModal(opts) {
    modalButtons = opts.buttons || [];
    $('modal-card').innerHTML =
      '<h2 id="modal-title">' + opts.title + '</h2>' +
      '<div class="modal-body">' + opts.html + '</div>' +
      '<div class="modal-actions">' +
      modalButtons.map((b, i) => '<button type="button" class="btn ' + (b.cls || '') + '" data-mbtn="' + i + '">' + esc(b.label) + '</button>').join('') +
      '</div>';
    $('modal').hidden = false;
    const focusBtn = $('modal-card').querySelector('.primary, .danger') || $('modal-card').querySelector('[data-mbtn]');
    if (focusBtn) focusBtn.focus();
  }
  function closeModal() { $('modal').hidden = true; modalButtons = []; }

  // ------------------------------------------------------------------ start screen
  function renderStart() {
    const saved = load();
    const cards = Object.keys(Sim.SCENARIOS).map((id) => {
      const sc = Sim.SCENARIOS[id];
      return '<article class="card"><h3>' + esc(sc.name) + '</h3>' +
        '<p class="meta">' + sc.length + ' days' + (sc.training ? ' \u00B7 Training' : '') + '</p>' +
        '<p>' + esc(SCEN_DESC[id] || '') + '</p>' +
        '<button type="button" class="btn primary" data-start="' + esc(id) + '">Start mission</button></article>';
    }).join('');
    $('screen-start').innerHTML =
      '<div class="hero"><div class="brand">CLosed LOOp</div><h1>Junior Astronaut Mission Trainer</h1>' +
      '<p>You command a four-person lunar outpost. Balance power, oxygen, water, food, radiation shielding and crew workload. Plan each day, then end it. One bad decision can cost the mission.</p></div>' +
      (saved ? '<div class="resume"><div><b>Mission in progress</b><br><span class="meta">' + esc(saved.s.name) + ' \u00B7 Day ' + saved.s.day + ' of ' + saved.s.length + '</span></div>' +
        '<button type="button" class="btn primary" data-act="continue">Continue mission</button></div>' : '') +
      '<h2>Choose a mission</h2><div class="cards">' + cards + '</div>' +
      '<div class="howto"><h2>How a day works</h2><ul>' +
      '<li>Read the morning alerts and the status meters.</li>' +
      '<li>Set your orders: power priority, greenhouse lights, crew hours, and shelter during storms.</li>' +
      '<li>Press <b>End Day</b>. The whole day plays out instantly and you get a report.</li>' +
      '<li>On quiet days use <b>Skip ahead</b>. It stops by itself when something needs your attention.</li></ul></div>';
  }

  function newSeed() { return 1 + Math.floor(Math.random() * 1e9); }

  function startMission(id) {
    s = Sim.createMission(id, newSeed());
    orders = Sim.defaultOrders();
    Sim.startDay(s);
    save();
    enterDay();
  }

  // ------------------------------------------------------------------ game screen
  function enterDay() {
    buildControls();
    renderGame();
    showScreen('game');
  }

  function renderGame() {
    const st = Sim.getStatus(s);
    renderTop(st);
    renderAlerts();
    renderMeters(st);
    renderChips(st);
    renderLog();
    renderActions();
  }

  function renderTop(st) {
    $('mission-name').textContent = s.name;
    $('day-label').textContent = 'Day ' + s.day + ' / ' + s.length;
    $('sun-chip').textContent = st.sunlit
      ? '\u2600 Sunlit \u00B7 night in about ' + Math.ceil(st.daysToNight) + ' day(s)'
      : '\u263E Lunar night \u00B7 about ' + Math.ceil(st.nightLeft) + ' day(s) left';
    const pct = Math.round(((s.day - 1) / s.length) * 100);
    $('day-bar').setAttribute('aria-valuenow', pct);
    $('day-bar').firstElementChild.style.width = pct + '%';
    $('details-toggle').checked = details;
  }

  function renderAlerts() {
    const order = { crit: 0, warn: 1, info: 2 };
    const list = (s.today.alerts || []).slice().sort((a, b) => order[a.sev] - order[b.sev]);
    $('alerts').innerHTML = list.length
      ? list.map((a) => '<div class="alert ' + a.sev + '" role="alert"><span class="alert-icon">' + (ALERT_ICON[a.sev] || '') + '</span><span>' + esc(a.msg) + '</span></div>').join('')
      : '<div class="alert quiet">All quiet. No alerts today.</div>';
  }

  function lastChange(id) {
    if (!s.history.length) return null;
    const map = { power: [s.last.battery, 'kWh'], oxygen: [s.last.o2, 'kg'], water: [s.last.water, 'L'], food: [s.last.food / 1000, 'k kcal'] };
    const v = map[id];
    if (!v) return null;
    return (v[0] >= 0 ? '+' : '\u2212') + r1(Math.abs(v[0])) + ' ' + v[1];
  }

  function renderMeters(st) {
    $('meters').innerHTML = st.rows.map((r) => {
      const m = METER[r.id] || { max: 100 };
      const pct = Math.round(clamp(r.value / m.max, 0, 1) * 100);
      const lv = LVL[r.level];
      const unit = r.unit === 'C' ? '\u00B0C' : r.unit;
      let det = '';
      if (details) {
        det = '<div class="m-detail">';
        if (m.trend) det += '<div>Days left at this rate: <b>' + (r.daysLeft === null ? '\u2014' : r1(r.daysLeft)) + '</b></div>';
        const lc = lastChange(r.id);
        if (lc) det += '<div>Change over the last day: <b>' + lc + '</b></div>';
        if (m.info) det += '<div>' + esc(m.info) + '</div>';
        det += '</div>';
      }
      return '<div class="meter ' + r.level + '">' +
        '<div class="m-head"><span>' + esc(r.label) + '</span><span class="m-badge ' + r.level + '">' + lv.icon + ' ' + lv.text + '</span></div>' +
        '<div class="m-val"><b>' + r.value + '</b> <span class="unit">' + esc(unit) + '</span></div>' +
        '<div class="bar" role="progressbar" aria-label="' + esc(r.label) + '" aria-valuemin="0" aria-valuemax="' + m.max + '" aria-valuenow="' + r.value + '"><i style="width:' + pct + '%"></i></div>' +
        '<div class="m-note">' + esc(r.note || '') + '</div>' + det + '</div>';
    }).join('');
  }

  function renderChips(st) {
    const chip = (name, val, cls) => '<div class="chip ' + (cls || 'ok') + '"><span>' + name + '</span><b>' + val + '</b></div>';
    const ghPct = Math.round(st.greenhouse * 100);
    let h = chip('Greenhouse', ghPct + '% grown', ghPct < 20 ? 'warn' : 'ok');
    h += chip('Shielding', st.shieldCm + ' / ' + K.radiation.maxShieldCm + ' cm', 'ok');
    h += chip('Solar panels', st.dust ? 'Dusty' : 'Clean', st.dust ? 'warn' : 'ok');
    h += chip('Water recycler', st.recyclerBroken ? 'BROKEN' : 'Working', st.recyclerBroken ? 'crit' : 'ok');
    h += chip('Hull', st.leak ? 'LEAKING' : 'Sealed', st.leak ? 'crit' : 'ok');
    if (details) h += chip('Equipment wear', r1(s.wear) + ' / 10', s.wear > 6 ? 'warn' : 'ok');
    $('chips').innerHTML = h;
  }

  function renderLog() {
    const items = s.log.slice(-15).reverse();
    $('log').innerHTML = items.length
      ? items.map((e) => '<li class="' + esc(e.sev) + '"><span class="d">Day ' + e.day + '</span>' + esc(e.msg) + '</li>').join('')
      : '<li class="info">Nothing logged yet.</li>';
  }

  function canSkip() {
    if (s.ended) return { ok: false, why: '' };
    if (s.today.spe > 0) return { ok: false, why: 'A solar storm arrives today. Decide on shelter, then end the day.' };
    if ((s.today.alerts || []).some((a) => a.sev === 'crit')) return { ok: false, why: 'There is a critical alert. Deal with it before skipping ahead.' };
    const bad = Sim.getStatus(s).rows.find((r) => r.level === 'crit');
    if (bad) return { ok: false, why: bad.label + ' is critical. Skipping is turned off.' };
    return { ok: true, why: '' };
  }

  function renderActions() {
    $('end-btn').textContent = 'End Day ' + s.day + ' \u2192';
    const c = canSkip();
    $('skip-btn').disabled = !c.ok;
    $('skip-n').disabled = !c.ok;
    $('skip-why').textContent = c.why;
  }

  // ------------------------------------------------------------------ orders panel
  function loadText(id) {
    const sunlit = Sim.getStatus(s).sunlit;
    switch (id) {
      case 'thermal': return (sunlit ? K.loads.thermalDayKWh : K.loads.thermalNightKWh) + ' kWh/day';
      case 'base': return K.loads.baseKWh + ' kWh/day';
      case 'oxygen': return 'up to ' + Math.round(K.loads.ogaMaxKgPerDay * K.loads.ogaKWhPerKg) + ' kWh/day';
      case 'scrubber': return 'up to ' + Math.round(K.loads.scrubberMaxKgPerDay * K.loads.scrubberKWhPerKg) + ' kWh/day';
      case 'recycler': return K.loads.recyclerKWh + ' kWh/day';
      case 'greenhouse': return Math.round(orders.greenhouseLevel * K.loads.greenhouseKWh) + ' kWh/day';
      default: return '';
    }
  }

  function taskHint(id) {
    const base = TASKS.find((t) => t.id === id).hint;
    if (id === 'cleaning') {
      return s.dust.active
        ? 'Dust is on the panels: ' + r1(s.dust.cleaned) + ' of ' + K.repair.dustCleanHours + ' hours done.'
        : 'No dust on the panels right now. ' + base;
    }
    if (id === 'repair') {
      const parts = [];
      if (s.recycler.broken) parts.push('Water recycler: ' + r1(s.recycler.progress) + ' of ' + K.repair.recyclerHours + ' hours done');
      if (s.leak.active) parts.push('Hull leak: ' + r1(s.leak.progress) + ' of ' + K.repair.leakHours + ' hours done');
      return parts.length ? parts.join('. ') + '.' : 'Nothing needs repair right now.';
    }
    return base;
  }

  function buildControls() {
    const st = Sim.getStatus(s);
    const solar = st.sunlit ? K.power.solarKW * 24 * K.power.solarCapacityFactor * (s.dust.active ? K.power.dustFactor : 1) : 0;
    const supply = K.power.baselineKWhPerDay + solar;
    const storm = s.today.spe > 0;

    $('controls').innerHTML =
      '<h2>Orders for Day ' + s.day + '</h2>' +

      '<div class="ctl-block"><h3>Power priority</h3>' +
      '<p class="hint">When power runs short, systems at the bottom lose power first.</p>' +
      '<p class="hint" id="power-line">Power available today: about ' + Math.round(supply) + ' kWh (' +
      (st.sunlit ? 'sun ' + Math.round(solar) + ' + ' : 'no sun + ') + 'steady source ' + K.power.baselineKWhPerDay + '), plus ' + Math.round(s.battery) + ' kWh in the battery.</p>' +
      '<ol id="prio"></ol></div>' +

      '<div class="ctl-block"><h3><label for="gh">Greenhouse lights</label><span id="gh-val"></span></h3>' +
      '<input type="range" id="gh" min="0" max="100" step="5" value="' + Math.round(orders.greenhouseLevel * 100) + '">' +
      '<p class="hint">Brighter lights grow more food and oxygen but use more power. Crops die after ' + K.greenhouse.darkDaysToDie + ' days in the dark.</p></div>' +

      '<div class="ctl-block"><h3>Crew hours <span id="hours-total"></span></h3>' +
      '<div class="hours-bar" id="hours-bar"><div class="bar"><i></i></div><div class="mark" id="hours-mark"></div></div>' +
      '<p class="hint" id="hours-warn"></p><div id="hours">' +
      TASKS.map((t) =>
        '<div class="hrow" id="row-' + t.id + '"><label for="h-' + t.id + '"><span>' + esc(t.name) + '</span><output id="o-' + t.id + '"></output></label>' +
        '<input type="range" id="h-' + t.id + '" data-task="' + t.id + '" min="0" max="24" step="1" value="' + (+orders.hours[t.id] || 0) + '">' +
        '<div class="hhint">' + esc(taskHint(t.id)) + '</div></div>').join('') +
      '</div></div>' +

      '<div class="ctl-block"><label class="switch"><input type="checkbox" id="shelter"' + (orders.shelter ? ' checked' : '') + '> <b>Shelter the crew in the storm shelter</b></label>' +
      '<div class="callout ' + (storm ? 'crit' : '') + '" id="shelter-hint" style="margin-top:8px"></div></div>';

    renderPrio();
    refreshControls();
  }

  function renderPrio() {
    const list = orders.priority;
    $('prio').innerHTML = list.map((id, i) => {
      const info = SYSTEM_INFO[id] || { name: id, desc: '' };
      return '<li><span class="rank">' + (i + 1) + '</span>' +
        '<span class="pname">' + info.name + '<small>' + info.desc + '</small></span>' +
        '<span class="load" id="load-' + id + '">' + loadText(id) + '</span>' +
        '<span class="mv">' +
        '<button type="button" data-i="' + i + '" data-dir="-1" aria-label="Move ' + esc(info.name) + ' up"' + (i === 0 ? ' disabled' : '') + '>\u25B2</button>' +
        '<button type="button" data-i="' + i + '" data-dir="1" aria-label="Move ' + esc(info.name) + ' down"' + (i === list.length - 1 ? ' disabled' : '') + '>\u25BC</button>' +
        '</span></li>';
    }).join('');
  }

  function effectiveHours() {
    let t = 0;
    TASKS.forEach((k) => {
      if (orders.shelter && (k.id === 'shielding' || k.id === 'cleaning')) return;
      t += +orders.hours[k.id] || 0;
    });
    return t;
  }

  function refreshControls() {
    $('gh-val').textContent = Math.round(orders.greenhouseLevel * 100) + '%';
    const gl = $('load-greenhouse');
    if (gl) gl.textContent = loadText('greenhouse');

    TASKS.forEach((k) => {
      const off = orders.shelter && (k.id === 'shielding' || k.id === 'cleaning');
      $('h-' + k.id).disabled = off;
      $('row-' + k.id).classList.toggle('off', off);
      $('o-' + k.id).textContent = off ? '0 h (sheltering)' : (+orders.hours[k.id] || 0) + ' h';
    });

    const normal = K.crew.normalHours * K.crewSize;
    const max = K.crew.maxHours;
    const t = effectiveHours();
    $('hours-total').textContent = t + ' h of ' + max + ' h';
    const bar = $('hours-bar');
    bar.firstElementChild.firstElementChild.style.width = Math.min(100, (t / max) * 100) + '%';
    $('hours-mark').style.left = (normal / max) * 100 + '%';
    bar.classList.toggle('ot', t > normal && t <= max);
    bar.classList.toggle('over', t > max);
    let warn;
    if (t <= normal) warn = 'A normal workday is ' + normal + ' hours. Below that, the crew rests and recovers.';
    else if (t <= max) warn = 'Overtime. Hours above ' + normal + ' build fatigue, and tired crews get hurt.';
    else warn = 'Over the ' + max + '-hour limit. The hours will be scaled down.';
    $('hours-warn').textContent = warn;

    const sh = $('shelter-hint');
    if (s.today.spe > 0) {
      let txt = 'A solar storm is arriving today. Sheltering cuts the dose a lot, but outdoor work (shielding, cleaning) cannot happen.';
      if (details) {
        const open = s.today.spe * Math.exp(-s.shieldCm / K.radiation.speShieldScaleCm);
        txt += ' Estimated storm dose: ' + r1(open) + ' mSv in the open, ' + r1(open * K.radiation.shelterFactor) + ' mSv sheltered.';
      }
      sh.textContent = txt;
    } else {
      sh.textContent = 'No storm is announced today. Sheltering now would only waste outdoor work time.';
    }
  }

  // ------------------------------------------------------------------ taking a day
  function carryOverOrders() {
    // yesterday's orders stay, except one-off things that no longer apply
    orders.shelter = false;
    if (!s.dust.active) orders.hours.cleaning = 0;
    if (!s.recycler.broken && !s.leak.active) orders.hours.repair = 0;
  }

  function endDay() {
    const rep = Sim.resolveDay(s, orders);
    if (!s.ended) { carryOverOrders(); Sim.startDay(s); save(); } else { clearSave(); }
    showReport(rep);
  }

  function showReport(rep) {
    let html = '';
    html += '<h3>What happened</h3>' + (rep.notes.length
      ? '<ul>' + rep.notes.map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul>'
      : '<p>Nothing unusual happened.</p>');

    if (rep.power) {
      html += '<h3>Power</h3><p>Solar made ' + rep.power.solar + ' kWh. With the steady source, ' + rep.power.supply + ' kWh were available and ' +
        rep.power.used + ' kWh were used. The battery now holds ' + rep.power.battery + ' kWh.</p>';
    }
    html += '<h3>Radiation</h3><p>Dose today: ' + rep.dose + ' mSv. Total so far: ' + r1(s.dose) + ' mSv.</p>';

    const dk = Object.keys(rep.damage || {});
    html += '<h3>Crew</h3>' + (dk.length
      ? '<ul>' + dk.map((k) => '<li>Health lost ' + r1(rep.damage[k]) + ' points from ' + (DMG_TEXT[k] || k) + '.</li>').join('') + '</ul>'
      : '<p>No damage today.</p>');
    html += '<p>Crew health: <b>' + r1(s.health) + '%</b></p>';

    html += '<h3>End-of-day status</h3><table class="mini"><tbody>' +
      rep.status.rows.map((r) => '<tr><td>' + esc(r.label) + '</td><td>' + r.value + ' ' + esc(r.unit === 'C' ? '\u00B0C' : r.unit) +
        '</td><td class="lvl-' + r.level + '">' + LVL[r.level].icon + ' ' + LVL[r.level].text + '</td></tr>').join('') +
      '</tbody></table>';

    openModal({
      title: 'Day ' + rep.day + ' report',
      html: html,
      buttons: [s.ended
        ? { label: 'See mission debrief', cls: 'primary', onClick: showEnd }
        : { label: 'Start Day ' + s.day, cls: 'primary', onClick: enterDay }],
    });
  }

  // ------------------------------------------------------------------ skip ahead
  function stopReason(st, base, startSunlit, nearNight0) {
    const ev = s.schedule.filter((e) => e.day === s.day);
    if (ev.length) return EVENT_TEXT[ev[0].type] || 'Something happened today.';
    const crit = st.rows.find((r) => r.level === 'crit');
    if (crit) return crit.label + ' is critical.';
    const worse = st.rows.find((r) => RANK[r.level] > (base[r.id] || 0));
    if (worse) return worse.label + ' needs attention.';
    if (st.sunlit !== startSunlit) return st.sunlit ? 'The sun is back up.' : 'Lunar night has begun.';
    if (st.sunlit && st.daysToNight <= 3.01 && !nearNight0) return 'Lunar night is about to begin.';
    return null;
  }

  function skipAhead() {
    const c = canSkip();
    if (!c.ok) return;
    const n = +$('skip-n').value || 1;
    const st0 = Sim.getStatus(s);

    const open = [];
    if (st0.dust) open.push('dust on the solar panels');
    if (st0.recyclerBroken) open.push('a broken water recycler');
    if (st0.leak) open.push('a hull leak');
    if ((s.today.alerts || []).some((a) => a.sev === 'warn')) open.push('active warnings');
    if (open.length && !window.confirm('Still open: ' + open.join(', ') + '.\n\nSkip ahead anyway?')) return;

    const base = {};
    st0.rows.forEach((r) => { base[r.id] = RANK[r.level]; });
    const startSunlit = st0.sunlit;
    const nearNight0 = st0.sunlit && st0.daysToNight <= 3.01;

    const reps = [];
    let reason = null;
    for (let i = 0; i < n; i++) {
      const rep = Sim.resolveDay(s, orders);
      reps.push(rep);
      if (s.ended) break;
      carryOverOrders();
      Sim.startDay(s);
      reason = stopReason(Sim.getStatus(s), base, startSunlit, nearNight0);
      if (reason) break;
    }
    if (s.ended) clearSave(); else save();

    const hist = s.history.slice(-reps.length);
    const notes = [];
    reps.forEach((r) => r.notes.forEach((t) => notes.push('Day ' + r.day + ': ' + t)));
    const last = reps[reps.length - 1];

    let html = '';
    if (s.ended) html += '<p><b>The mission ended during the skip.</b></p>';
    else if (reason) html += '<div class="callout warn"><b>Skip stopped early.</b> ' + esc(reason) + '</div>';
    else html += '<p>All ' + reps.length + ' day(s) passed without anything needing your attention.</p>';

    html += '<h3>Day by day</h3><table class="mini"><thead><tr><th>Day</th><th>Battery</th><th>Crew health</th><th>Total dose</th></tr></thead><tbody>' +
      hist.map((h) => '<tr><td>Day ' + h.day + '</td><td>' + h.power.battery + ' kWh</td><td>' + h.health + '%</td><td>' + h.dose + ' mSv</td></tr>').join('') +
      '</tbody></table>';
    if (notes.length) html += '<h3>Notes</h3><ul>' + notes.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul>';

    openModal({
      title: 'Skipped ' + reps.length + ' day' + (reps.length === 1 ? '' : 's') + ' (Day ' + reps[0].day + ' to Day ' + last.day + ')',
      html: html,
      buttons: [s.ended
        ? { label: 'See mission debrief', cls: 'primary', onClick: showEnd }
        : { label: 'Continue to Day ' + s.day, cls: 'primary', onClick: enterDay }],
    });
  }

  // ------------------------------------------------------------------ end screen
  function showEnd() {
    clearSave();
    const d = Sim.debrief(s);
    const ok = d.outcome === 'success';
    const cause = CAUSES[d.cause] || CAUSES.unknown;
    let html = '<div class="end-card ' + (ok ? 'success' : 'failed') + '">';
    html += ok
      ? '<h1>Mission complete</h1><p>The crew of ' + K.crewSize + ' survived all ' + s.length + ' days of "' + esc(s.name) + '". Well done, commander.</p>'
      : '<h1>Mission lost on day ' + d.days + '</h1><p><b>' + cause.title + '</b></p><p>' + cause.lesson + '</p>';
    html += '<div class="stats">' +
      '<div class="stat"><b>' + d.days + ' / ' + s.length + '</b><span>days</span></div>' +
      '<div class="stat"><b>' + d.finalHealth + '%</b><span>final crew health</span></div>' +
      '<div class="stat"><b>' + d.totalDoseMSv + ' mSv</b><span>total radiation</span></div></div>';
    if (d.firstWarnings.length) {
      html += '<h2>Early warning signs</h2><ul class="log">' +
        d.firstWarnings.map((w) => '<li class="' + esc(w.sev) + '"><span class="d">Day ' + w.day + '</span>' + esc(w.msg) + '</li>').join('') + '</ul>';
    }
    html += '<div class="end-actions"><button type="button" class="btn primary" data-act="again">Try again</button>' +
      '<button type="button" class="btn" data-act="menu">Back to menu</button></div></div>';
    $('screen-end').innerHTML = html;
    showScreen('end');
  }

  // ------------------------------------------------------------------ menu
  function openMenu() {
    openModal({
      title: 'Mission menu',
      html: '<p>Your mission is saved automatically at the start of each day.</p>',
      buttons: [
        { label: 'Cancel', onClick: function () {} },
        { label: 'Back to menu', onClick: function () { save(); renderStart(); showScreen('start'); } },
        { label: 'Restart mission', cls: 'danger', onClick: function () {
          if (window.confirm('Restart from scratch? Your current progress will be lost.')) startMission(s.scenarioId);
        } },
      ],
    });
  }

  // ------------------------------------------------------------------ events
  document.addEventListener('click', function (e) {
    const t = e.target;
    const startBtn = t.closest('[data-start]');
    if (startBtn) { startMission(startBtn.getAttribute('data-start')); return; }

    const act = t.closest('[data-act]');
    if (act) {
      const a = act.getAttribute('data-act');
      if (a === 'continue') {
        const d = load();
        if (d) { s = d.s; orders = d.orders; details = !!d.details; enterDay(); }
      } else if (a === 'again') {
        startMission(s.scenarioId);
      } else if (a === 'menu') {
        renderStart(); showScreen('start');
      }
      return;
    }

    const mb = t.closest('[data-mbtn]');
    if (mb) {
      const b = modalButtons[+mb.getAttribute('data-mbtn')];
      closeModal();
      if (b && b.onClick) b.onClick();
      return;
    }

    const mv = t.closest('#prio button[data-i]');
    if (mv && !mv.disabled) {
      const i = +mv.getAttribute('data-i');
      const dir = +mv.getAttribute('data-dir');
      const j = i + dir;
      if (j >= 0 && j < orders.priority.length) {
        const p = orders.priority;
        const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
        renderPrio();
        const again = $('prio').querySelector('button[data-i="' + j + '"][data-dir="' + dir + '"]');
        if (again && !again.disabled) again.focus();
        save();
      }
    }
  });

  document.addEventListener('input', function (e) {
    const t = e.target;
    if (t.id === 'gh') {
      orders.greenhouseLevel = (+t.value) / 100;
      refreshControls(); save();
    } else if (t.dataset && t.dataset.task) {
      orders.hours[t.dataset.task] = +t.value;
      refreshControls(); save();
    }
  });

  document.addEventListener('change', function (e) {
    const t = e.target;
    if (t.id === 'shelter') {
      orders.shelter = t.checked;
      refreshControls(); save();
    } else if (t.id === 'details-toggle') {
      details = t.checked;
      renderGame(); refreshControls(); save();
    }
  });

  $('end-btn').addEventListener('click', endDay);
  $('skip-btn').addEventListener('click', skipAhead);
  $('menu-btn').addEventListener('click', openMenu);

  // ------------------------------------------------------------------ go
  renderStart();
  showScreen('start');
})();
