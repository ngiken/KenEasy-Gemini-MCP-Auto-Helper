'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');

function readPngSize(filePath) {
  const buf = fs.readFileSync(filePath);
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  assert.strictEqual(buf.slice(0, 8).toString('hex'), '89504e470d0a1a0a', `${filePath} must be valid PNG`);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height, bytes: buf.length };
}

function runTests(test) {
  test('manifest.json is valid MV3 with required permissions & service worker', () => {
    const manifestPath = path.join(ROOT, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.strictEqual(manifest.manifest_version, 3);
    assert.ok(manifest.permissions.includes('storage'));
    assert.ok(manifest.permissions.includes('tabs'));
    assert.ok(manifest.permissions.includes('alarms'));
    assert.ok(manifest.host_permissions.includes('https://gemini.google.com/*'));
    assert.strictEqual(manifest.background.service_worker, 'background.js');
    assert.strictEqual(manifest.action.default_popup, 'popup.html');
    assert.deepStrictEqual(manifest.content_scripts[0].js, ['defaults.js', 'hud.js', 'content.js']);
    assert.deepStrictEqual(manifest.content_scripts[0].css, ['hud.css']);
  });

  test('every file referenced by manifest.json exists and icons have exact PNG dimensions', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
    const referenced = [
      manifest.background.service_worker,
      manifest.action.default_popup,
      ...Object.values(manifest.icons),
      ...Object.values(manifest.action.default_icon),
      ...manifest.content_scripts[0].js,
      ...manifest.content_scripts[0].css
    ];
    for (const rel of referenced) {
      const abs = path.join(ROOT, rel);
      assert.ok(fs.existsSync(abs), `Missing referenced asset: ${rel}`);
      assert.ok(fs.statSync(abs).size > 0, `Empty asset: ${rel}`);
    }

    for (const [dimStr, rel] of Object.entries(manifest.icons)) {
      const dim = Number(dimStr);
      const info = readPngSize(path.join(ROOT, rel));
      assert.strictEqual(info.width, dim, `${rel} width should be ${dim}`);
      assert.strictEqual(info.height, dim, `${rel} height should be ${dim}`);
    }
  });

  test('all extension JS files parse cleanly with zero syntax errors', () => {
    const jsFiles = ['defaults.js', 'hud.js', 'content.js', 'background.js', 'popup.js'];
    for (const f of jsFiles) {
      const code = fs.readFileSync(path.join(ROOT, f), 'utf8');
      assert.doesNotThrow(() => new vm.Script(code, { filename: f }), `Syntax error in ${f}`);
    }
  });

  test('popup.html contains every element ID referenced by popup.js', () => {
    const html = fs.readFileSync(path.join(ROOT, 'popup.html'), 'utf8');
    const expectedIds = [
      'enabled',
      'autoAllow',
      'preferAlwaysAllow',
      'fallbackSingleAllow',
      'autoContinue',
      'backgroundMode',
      'preventTabDiscard',
      'showHud',
      'maxContinuesPerTask',
      'dailyContinueLimit',
      'continueCooldownSec',
      'idleSettleSec',
      'stopOnCompletionCues',
      'stopOnStagnantOutput',
      'stopOnQuotaOrError',
      'customAlwaysAllowKeywords',
      'customContinueKeywords',
      'statAllow',
      'statContinue',
      'statLive',
      'btnEmergency',
      'btnResetBreaker',
      'btnResetStats',
      'btnDefaults',
      'btnSave',
      'toast'
    ];
    for (const id of expectedIds) {
      assert.ok(html.includes(`id="${id}"`), `popup.html missing id="${id}"`);
    }
  });
}

module.exports = { runTests };
