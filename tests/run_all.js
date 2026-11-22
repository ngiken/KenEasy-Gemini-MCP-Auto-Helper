'use strict';

const suites = [
  { name: 'Manifest & Assets', mod: require('./test_manifest_and_assets.js') },
  { name: 'Defaults & Keyword Matching', mod: require('./test_defaults.js') },
  { name: 'Engine, Breakers, Background Mode, HUD & Popup', mod: require('./test_engine_and_background.js') },
  { name: 'v0.3 Background Persistence, Click Retries, E2E Sandbox & UI Reliability', mod: require('./test_v03_background_and_reliability.js') },
  { name: 'v0.3 Stress Marathon, Adversarial Safety, i18n Parity & Multi-Tab Audit', mod: require('./test_v03_stress_and_adversarial.js') }
];

let passed = 0;
let failed = 0;

for (const suite of suites) {
  console.log(`\n=== ${suite.name} ===`);
  suite.mod.runTests((name, fn) => {
    try {
      fn();
      passed += 1;
      console.log(`  [PASS] ${name}`);
    } catch (err) {
      failed += 1;
      console.error(`  [FAIL] ${name}`);
      console.error(`         ${err && err.stack ? err.stack : err}`);
    }
  });
}

console.log(`\nSummary: ${passed} passed, ${failed} failed (total ${passed + failed})`);
process.exit(failed > 0 ? 1 : 0);
