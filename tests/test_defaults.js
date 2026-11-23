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
    assert.strictEqual(def.maxContinuesPerTask, 10);
    assert.strictEqual(def.dailyContinueLimit, 0);
    assert.strictEqual(def.continueCooldownMs, 4000);
    assert.strictEqual(def.idleSettleMs, 1800);
    assert.strictEqual(def.stallAlertEnabled, true);
    assert.strictEqual(def.stallAlertMinutes, 5);

    const clamped = D.mergeSettings({
      maxContinuesPerTask: 9999,
      dailyContinueLimit: -5,
      continueCooldownMs: 100,
      allowCooldownMs: 999999,
      idleSettleMs: 'not-a-number',
      stallAlertEnabled: false,
      stallAlertMinutes: 999,
      enabled: false,
      hudMinimized: true
    });
    assert.strictEqual(clamped.maxContinuesPerTask, 100);
    assert.strictEqual(clamped.dailyContinueLimit, 0);
    assert.strictEqual(clamped.continueCooldownMs, 1000);
    assert.strictEqual(clamped.allowCooldownMs, 30000);
    assert.strictEqual(clamped.idleSettleMs, 1800);
    assert.strictEqual(clamped.stallAlertEnabled, false);
    assert.strictEqual(clamped.stallAlertMinutes, 60);
    assert.strictEqual(D.mergeSettings({ stallAlertMinutes: 0 }).stallAlertMinutes, 1);
    assert.strictEqual(clamped.enabled, false);
    assert.strictEqual(clamped.hudMinimized, true);
  });

  test('migrateStoredSettings upgrades v1 stored config to 10/0 and unions new built-in keywords once', () => {
    const v1Stored = {
      enabled: true,
      maxContinuesPerTask: 5,
      dailyContinueLimit: 30,
      alwaysAllowKeywords: ['始终允许'],
      continueKeywords: ['继续'],
      customContinueKeywords: ['自定义词']
    };
    const r1 = D.migrateStoredSettings(v1Stored);
    assert.strictEqual(r1.migrated, true);
    assert.strictEqual(r1.settings.settingsVersion, D.SETTINGS_VERSION);
    assert.strictEqual(r1.settings.maxContinuesPerTask, 10);
    assert.strictEqual(r1.settings.dailyContinueLimit, 0);
    assert.ok(r1.settings.continueKeywords.includes('yes'));
    assert.ok(r1.settings.alwaysAllowKeywords.includes('always allow for this conversation'));
    assert.deepStrictEqual(r1.settings.customContinueKeywords, ['自定义词']);

    // Already v3 config with user custom limits must NOT be overwritten
    const v3Custom = Object.assign({}, r1.settings, {
      maxContinuesPerTask: 25,
      dailyContinueLimit: 50
    });
    const r2 = D.migrateStoredSettings(v3Custom);
    assert.strictEqual(r2.migrated, false);
    assert.strictEqual(r2.settings.maxContinuesPerTask, 25);
    assert.strictEqual(r2.settings.dailyContinueLimit, 50);

    // v2 -> v3 migration preserves user limits and strips stale broad '开始'/'開始' defaults
    const v2Stored = {
      settingsVersion: 2,
      maxContinuesPerTask: 15,
      dailyContinueLimit: 20,
      continueKeywords: ['继续', '开始', '開始']
    };
    const r3 = D.migrateStoredSettings(v2Stored);
    assert.strictEqual(r3.migrated, true);
    assert.strictEqual(r3.settings.settingsVersion, D.SETTINGS_VERSION);
    assert.strictEqual(r3.settings.maxContinuesPerTask, 15);
    assert.strictEqual(r3.settings.dailyContinueLimit, 20);
    assert.ok(!r3.settings.continueKeywords.includes('开始'));
    assert.ok(!r3.settings.continueKeywords.includes('開始'));
    assert.ok(r3.settings.continueKeywords.includes('続ける'));
  });

  test('parseKeywordInput splits by newline, commas, semicolons and deduplicates case-insensitively', () => {
    const list = D.parseKeywordInput('始终同意, Always Allow\n继续下一步；always allow；  接着写 ,');
    assert.deepStrictEqual(list, ['始终同意', 'Always Allow', '继续下一步', '接着写']);
    assert.deepStrictEqual(D.parseKeywordInput(''), []);
    assert.deepStrictEqual(D.parseKeywordInput(null), []);
  });

  test('normalizeText and stripEdgePunctuation strip zero-width chars, arrows, and edge punctuation', () => {
    assert.strictEqual(D.normalizeText('  始终\u200B允许 \n  此工具  '), '始终允许 此工具');
    assert.strictEqual(D.stripEdgePunctuation('» 「继续生成」！'), '继续生成');
    assert.strictEqual(D.stripEdgePunctuation('  [Always Allow]  '), 'always allow');
    assert.strictEqual(D.stripEdgePunctuation('  ↪ Yes  '), 'yes');
    assert.strictEqual(D.stripEdgePunctuation('↳ 确认！'), '确认');
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

  test('stall alert notification settings are validated and clamped in mergeSettings', () => {
    assert.strictEqual(D.DEFAULT_SETTINGS.stallAlertEnabled, true);
    assert.strictEqual(D.DEFAULT_SETTINGS.stallAlertMinutes, 5);

    // Explicit false and custom minutes
    const s1 = D.mergeSettings({ stallAlertEnabled: false, stallAlertMinutes: 15 });
    assert.strictEqual(s1.stallAlertEnabled, false);
    assert.strictEqual(s1.stallAlertMinutes, 15);

    // Non-boolean falls back to default, invalid number falls back to default
    const s2 = D.mergeSettings({ stallAlertEnabled: 'invalid', stallAlertMinutes: 'not-a-number' });
    assert.strictEqual(s2.stallAlertEnabled, true);
    assert.strictEqual(s2.stallAlertMinutes, 5);

    // Clamping boundaries (min 1, max 60)
    assert.strictEqual(D.mergeSettings({ stallAlertMinutes: -10 }).stallAlertMinutes, 1);
    assert.strictEqual(D.mergeSettings({ stallAlertMinutes: 0 }).stallAlertMinutes, 1);
    assert.strictEqual(D.mergeSettings({ stallAlertMinutes: 61 }).stallAlertMinutes, 60);
    assert.strictEqual(D.mergeSettings({ stallAlertMinutes: 100 }).stallAlertMinutes, 60);
  });

  test('stall auto-recovery settings are validated, clamped, sanitized, and migrated cleanly in mergeSettings', () => {
    assert.strictEqual(D.DEFAULT_SETTINGS.stallAutoRecoverEnabled, true);
    assert.strictEqual(D.DEFAULT_SETTINGS.stallAutoRecoverMinutes, 5);
    assert.strictEqual(D.DEFAULT_SETTINGS.stallAutoRecoverPrompt, '继续，刚才mcp连接断开了');
    assert.strictEqual(D.DEFAULT_SETTINGS.maxStallRecoveriesPerTask, 3);
    assert.strictEqual(D.DEFAULT_SETTINGS.humanPacingEnabled, true);

    const custom = D.mergeSettings({
      stallAutoRecoverEnabled: false,
      stallAutoRecoverMinutes: 8,
      stallAutoRecoverPrompt: '  continue please\nnow  ',
      maxStallRecoveriesPerTask: 5,
      humanPacingEnabled: false
    });
    assert.strictEqual(custom.stallAutoRecoverEnabled, false);
    assert.strictEqual(custom.stallAutoRecoverMinutes, 8);
    assert.strictEqual(custom.stallAutoRecoverPrompt, 'continue please now');
    assert.strictEqual(custom.maxStallRecoveriesPerTask, 5);
    assert.strictEqual(custom.humanPacingEnabled, false);

    // Clamping & empty fallback & 200-char limit
    assert.strictEqual(D.mergeSettings({ stallAutoRecoverMinutes: 0 }).stallAutoRecoverMinutes, 1);
    assert.strictEqual(D.mergeSettings({ stallAutoRecoverMinutes: 999 }).stallAutoRecoverMinutes, 60);
    assert.strictEqual(D.mergeSettings({ maxStallRecoveriesPerTask: 0 }).maxStallRecoveriesPerTask, 1);
    assert.strictEqual(D.mergeSettings({ maxStallRecoveriesPerTask: 99 }).maxStallRecoveriesPerTask, 20);
    assert.strictEqual(D.mergeSettings({ stallAutoRecoverPrompt: '   ' }).stallAutoRecoverPrompt, '继续，刚才mcp连接断开了');
    assert.strictEqual(D.mergeSettings({ stallAutoRecoverPrompt: 'a'.repeat(260) }).stallAutoRecoverPrompt.length, 200);

    // v4 -> v5 migration updates old default '继续' to '继续，刚才mcp连接断开了', while preserving custom prompts
    const migOldDefault = D.migrateStoredSettings({ settingsVersion: 4, stallAutoRecoverPrompt: '继续' });
    assert.strictEqual(migOldDefault.migrated, true);
    assert.strictEqual(migOldDefault.settings.settingsVersion, D.SETTINGS_VERSION);
    assert.strictEqual(migOldDefault.settings.stallAutoRecoverPrompt, '继续，刚才mcp连接断开了');

    const migCustom = D.migrateStoredSettings({ settingsVersion: 4, stallAutoRecoverPrompt: '请继续刚才的构建' });
    assert.strictEqual(migCustom.migrated, true);
    assert.strictEqual(migCustom.settings.stallAutoRecoverPrompt, '请继续刚才的构建');
  });

  test('multi-language i18n, theme validation, and Japanese/Cantonese keywords work properly', () => {
    const def = D.mergeSettings(null);
    assert.strictEqual(def.language, 'zh-CN');
    assert.strictEqual(def.theme, 'dark');
    assert.ok(!def.continueKeywords.includes('开始'));
    assert.ok(!def.continueKeywords.includes('開始'));
    assert.ok(def.alwaysAllowKeywords.includes('常に許可'));
    assert.ok(def.continueKeywords.includes('続ける'));

    assert.strictEqual(D.mergeSettings({ language: 'en', theme: 'light' }).language, 'en');
    assert.strictEqual(D.mergeSettings({ language: 'en', theme: 'light' }).theme, 'light');
    assert.strictEqual(D.mergeSettings({ language: 'invalid', theme: 'purple' }).language, 'zh-CN');
    assert.strictEqual(D.mergeSettings({ language: 'invalid', theme: 'purple' }).theme, 'dark');

    const baseKeys = Object.keys(D.UI_I18N['zh-CN']);
    for (const lang of D.SUPPORTED_LANGUAGES) {
      assert.ok(D.UI_I18N[lang], `Missing UI_I18N locale: ${lang}`);
      for (const k of baseKeys) {
        assert.ok(
          typeof D.UI_I18N[lang][k] === 'string' && D.UI_I18N[lang][k].length > 0,
          `Missing UI_I18N.${lang}.${k}`
        );
      }
    }
    assert.strictEqual(D.t('en', 'hudTitle'), 'MCP Helper');
    assert.strictEqual(D.t('ja', 'hudTitle'), 'MCP ヘルパー');
    assert.strictEqual(D.t('zh-TW', 'btnEmergency'), '緊急停止');
    assert.ok(D.t('en', 'bgNotifStallTitle', { mins: 7 }).includes('7'));

    assert.strictEqual(D.formatWaitDuration(45000, 'zh-CN'), '45秒');
    assert.strictEqual(D.formatWaitDuration(135000, 'zh-CN'), '2分15秒');
    assert.strictEqual(D.formatWaitDuration(305000, 'en'), '5m 05s');
    assert.strictEqual(D.formatWaitDuration(42000, 'en'), '42s');
    assert.strictEqual(D.formatWaitDuration(125000, 'ja'), '2分05秒');
  });
}

module.exports = { runTests };
