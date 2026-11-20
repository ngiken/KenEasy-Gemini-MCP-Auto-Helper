'use strict';

const assert = require('assert');
const D = require('../defaults.js');

function runTests(test) {
  test('mergeSettings fills defaults and clamps out-of-range numbers safely', () => {
    const def = D.mergeSettings(null);
    assert.strictEqual(def.enabled, true);
    assert.strictEqual(def.autoAllow, true);
    assert.strictEqual(def.preferAlwaysAllow, true);
    assert.strictEqual(def.autoContinue, true);
    assert.strictEqual(def.maxContinuesPerTask, 5);
    assert.strictEqual(def.dailyContinueLimit, 30);
    assert.strictEqual(def.continueCooldownMs, 4000);
    assert.strictEqual(def.idleSettleMs, 1800);

    const clamped = D.mergeSettings({
      maxContinuesPerTask: 9999,
      dailyContinueLimit: -5,
      continueCooldownMs: 100,
      allowCooldownMs: 999999,
      idleSettleMs: 'not-a-number',
      enabled: false,
      hudMinimized: true
    });
    assert.strictEqual(clamped.maxContinuesPerTask, 100);
    assert.strictEqual(clamped.dailyContinueLimit, 1);
    assert.strictEqual(clamped.continueCooldownMs, 1000);
    assert.strictEqual(clamped.allowCooldownMs, 30000);
    assert.strictEqual(clamped.idleSettleMs, 1800);
    assert.strictEqual(clamped.enabled, false);
    assert.strictEqual(clamped.hudMinimized, true);
  });

  test('parseKeywordInput splits by newline, commas, semicolons and deduplicates case-insensitively', () => {
    const list = D.parseKeywordInput('始终同意, Always Allow\n继续下一步；always allow；  接着写 ,');
    assert.deepStrictEqual(list, ['始终同意', 'Always Allow', '继续下一步', '接着写']);
    assert.deepStrictEqual(D.parseKeywordInput(''), []);
    assert.deepStrictEqual(D.parseKeywordInput(null), []);
  });

  test('normalizeText and stripEdgePunctuation strip zero-width chars and edge punctuation', () => {
    assert.strictEqual(D.normalizeText('  始终\u200B允许 \n  此工具  '), '始终允许 此工具');
    assert.strictEqual(D.stripEdgePunctuation('» 「继续生成」！'), '继续生成');
    assert.strictEqual(D.stripEdgePunctuation('  [Always Allow]  '), 'always allow');
  });

  test('containsKeyword enforces ASCII word boundaries so substrings never false-trigger', () => {
    // "allow" must NOT match "disallow" or "hallow"
    assert.strictEqual(D.containsKeyword('Disallow this tool', ['allow']), null);
    assert.strictEqual(D.containsKeyword('hallowed ground', ['allow']), null);
    assert.strictEqual(D.containsKeyword('Please allow this tool', ['allow']), 'allow');

    // "stop" must NOT match "Desktop Commander"
    assert.strictEqual(D.containsKeyword('Allow Desktop Commander', ['stop']), null);
    assert.strictEqual(D.containsKeyword('Stop generating', ['stop']), 'stop');

    // Chinese substring matching works cleanly
    assert.strictEqual(D.containsKeyword('请点击始终允许继续操作', ['始终允许']), '始终允许');
    assert.strictEqual(D.containsKeyword('您的额度已用完，请明天再试', D.DEFAULT_SETTINGS.quotaErrorKeywords), '额度已用完');
  });

  test('matchButtonLabel enforces exact, prefix, contains modes and maxLen guard', () => {
    const contKws = D.DEFAULT_SETTINGS.continueKeywords;

    // Exact mode matches real continue buttons
    assert.ok(D.matchButtonLabel('继续', contKws, { maxLen: 36, mode: 'exact' }));
    assert.ok(D.matchButtonLabel('继续生成', contKws, { maxLen: 36, mode: 'exact' }));
    assert.ok(D.matchButtonLabel('Continue', contKws, { maxLen: 36, mode: 'exact' }));
    assert.ok(D.matchButtonLabel('  Keep going! ', contKws, { maxLen: 36, mode: 'exact' }));

    // Exact mode MUST REJECT normal follow-up suggestion chips!
    assert.strictEqual(D.matchButtonLabel('继续优化这段代码的性能', contKws, { maxLen: 36, mode: 'exact' }), null);
    assert.strictEqual(D.matchButtonLabel('Continue exploring alternative architectures', contKws, { maxLen: 36, mode: 'exact' }), null);

    // Prefix mode matches "始终允许 Desktop Commander" and "Always allow this MCP server"
    const alwaysKws = D.DEFAULT_SETTINGS.alwaysAllowKeywords;
    const m1 = D.matchButtonLabel('始终允许 Desktop Commander', alwaysKws, { maxLen: 48, mode: 'exact_or_prefix' });
    assert.ok(m1 && m1.exact === false);
    const m2 = D.matchButtonLabel('Always allow', alwaysKws, { maxLen: 48, mode: 'exact_or_prefix' });
    assert.ok(m2 && m2.exact === true);

    // Exact match later in keyword list must beat an earlier shorter prefix match
    const singleKws = D.DEFAULT_SETTINGS.singleAllowKeywords;
    const mExactLater = D.matchButtonLabel('允许一次', singleKws, { maxLen: 28, mode: 'exact_or_prefix' });
    assert.ok(mExactLater && mExactLater.exact === true && mExactLater.keyword === '允许一次');

    // Rejects long prose paragraphs even if they start with a keyword
    const longText = '继续' + '这是一段非常长非常长非常长非常长非常长非常长的说明文字不应该被当作按钮点击';
    assert.strictEqual(D.matchButtonLabel(longText, contKws, { maxLen: 36, mode: 'exact_or_contains' }), null);
  });

  test('normalizeStats preserves same-day counts and auto-resets on a new calendar day', () => {
    const today = D.getTodayKey(new Date('2026-11-20T10:00:00'));
    assert.strictEqual(today, '2026-11-20');

    const kept = D.normalizeStats({ date: '2026-11-20', allowCount: 7, continueCount: 4 }, today);
    assert.deepStrictEqual(kept, { date: '2026-11-20', allowCount: 7, continueCount: 4 });

    const rolled = D.normalizeStats({ date: '2026-11-19', allowCount: 99, continueCount: 30 }, today);
    assert.deepStrictEqual(rolled, { date: '2026-11-20', allowCount: 0, continueCount: 0 });
  });
}

module.exports = { runTests };
