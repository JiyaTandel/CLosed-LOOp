// CLosed LOOp - Junior Astronaut Mission Trainer
// Tuning file for the simulation. ALL numbers are PLACEHOLDERS until sourced from NASA.
// Anything tagged (verify) must be checked and given a source link before the demo.
(function (root) {
  const CONFIG = {
    crewSize: 4,
    lunarCycleDays: 29.5,      // one full lunar day + night, in Earth days (verify)
    sunlitDays: 14.75,         // roughly half of it is sunlight (verify)

    crew: {
      o2PerPerson: 0.84,       // kg O2 per astronaut per day (verify)
      co2PerPerson: 1.0,       // kg CO2 produced per astronaut per day (verify)
      waterUsePerPerson: 8,    // L/day drinking + hygiene + food (verify)
      waterMinPerPerson: 2.5,  // L/day absolute minimum to drink (verify)
      kcalPerPerson: 2800,     // kcal/day (verify)
      normalHours: 8,          // normal work hours per person per day
      maxHours: 40,            // total crew-hours per day, including overtime
    },

    power: {
      solarKW: 16,             // peak panel output, kW (placeholder)
      solarCapacityFactor: 0.8,// average output while sun is up (placeholder)
      dustFactor: 0.6,         // output left when panels are dusty (verify)
      baselineKWhPerDay: 72,   // small continuous source, e.g. nuclear/RTG-type (placeholder, verify)
      batteryCapacityKWh: 1500,
      chargeEfficiency: 0.9,   // round-trip losses (verify)
    },

    loads: {
      thermalDayKWh: 40,       // keeping the habitat at a livable temperature
      thermalNightKWh: 60,
      baseKWh: 10,             // computers, comms, lights
      ogaKWhPerKg: 14.4,       // electrolysis: power per kg of O2 (verify)
      ogaMaxKgPerDay: 5,       // oxygen generator capacity (verify)
      scrubberKWhPerKg: 4,     // CO2 removal: power per kg (verify)
      scrubberMaxKgPerDay: 6,
      recyclerKWh: 20,         // water recycler running all day
      recyclerMaxLPerDay: 40,
      recyclerBaseEfficiency: 0.90, // fraction of wastewater recovered (ISS is higher, verify)
      greenhouseKWh: 120,      // grow lights at 100%
      electrolysisWaterPerKgO2: 1.125, // litres of water split per kg of O2 (chemistry: 2H2O -> 2H2 + O2)
    },

    greenhouse: {
      kcalPerDayFull: 3000,    // food from a fully mature greenhouse
      co2AbsorbFull: 1.2,      // kg CO2 per day taken up at full output
      o2ReleaseFull: 0.87,     // kg O2 per day released (44 g CO2 -> 32 g O2 = 0.727 kg per kg)
      waterPerDayFull: 6,      // L/day
      growthPerDay: 0.05,      // maturity gained per good day (about 20 days to maturity)
      declinePerBadDay: 0.1,
      darkDaysToDie: 2,        // crops die after this many days with no light
    },

    radiation: {
      gcrBaseMSvPerDay: 1.4,   // background dose on the lunar surface (verify)
      gcrShieldScaleCm: 150,   // GCR reduction: 1/(1+t/scale) (placeholder)
      speShieldScaleCm: 60,    // solar storm reduction: exp(-t/scale) (placeholder)
      shelterFactor: 0.15,     // dose left if crew sits in the storm shelter
      shieldCmPerCrewHour: 1.0,// regolith cover added per crew-hour (placeholder)
      maxShieldCm: 300,
    },

    thermal: {
      comfortC: 21,
      dropPerDayDay: 12,       // degrees lost per unpowered day, sunlit
      dropPerDayNight: 20,
      regainPerDay: 8,
    },

    repair: { recyclerHours: 8, leakHours: 6, dustCleanHours: 4 },
    wear: { gainPerDay: 0.5, maintenanceHoursForZero: 4 }, // hours of upkeep needed to stop wear growing
    recyclerWearPenalty: 0.02, // efficiency lost per wear point

    start: {
      o2Reserve: 80,           // kg
      o2Target: 60,
      cleanWater: 600,         // L
      greyWater: 0,
      foodKcal: 11200 * 40,    // 40 days of food for 4 people
      battery: 1200,           // kWh
      greenhouseMaturity: 0.4,
      health: 100,
    },

    damage: { // health points lost per day (placeholders)
      o2Shortfall: 70,
      co2PerKgOver5: 4,
      co2Lethal: 60,
      waterShortfall: 30,
      starvationAtFullDeficit: 6,
      coldPerDegreeUnder10: 1.5,
      dosePerMSvOver50: 0.6,
      cumulativeDoseOver300: 1.5,
      fatiguePerPointOver70: 0.3,
    },
  };

  // Scenarios (levels). Event days are nominal; the engine adds a small seeded jitter,
  // so a restart feels familiar but never identical.
  const SCENARIOS = {
    first_week: {
      name: 'First Week', length: 7, startPhase: 1, training: true,
      events: [{ type: 'dust', day: 4, jitter: 1 }],
    },
    survive_night: {
      name: 'Survive the Night', length: 20, startPhase: 10,
      events: [{ type: 'dust', day: 3, jitter: 1 }],
    },
    solar_storm: {
      name: 'Solar Storm', length: 14, startPhase: 2,
      events: [
        { type: 'spe', day: 6, jitter: 2, dose: 250 },
        { type: 'spe', day: 11, jitter: 1, dose: 100 },
      ],
    },
    thirty_day: {
      name: '30-Day Mission', length: 30, startPhase: 5,
      events: [
        { type: 'dust', day: 6, jitter: 2 },
        { type: 'recycler_fail', day: 12, jitter: 2 },
        { type: 'supply', day: 20, jitter: 2 },
        { type: 'spe', day: 17, jitter: 2, dose: 230 },
        { type: 'micromet', day: 26, jitter: 2 },
      ],
    },
  };

  const out = { CONFIG, SCENARIOS };
  if (typeof module !== 'undefined' && module.exports) module.exports = out;
  else root.SimConfig = out;
})(typeof self !== 'undefined' ? self : this);
