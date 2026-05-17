import {
  deepMergeStoredSettings,
  DEFAULT_STORED_SETTINGS,
  normalizeRawSettings,
} from './settings-merge.util';

describe('settings-merge.util', () => {
  it('normalizeRawSettings returns {} for null and arrays', () => {
    expect(normalizeRawSettings(null)).toEqual({});
    expect(normalizeRawSettings([])).toEqual({});
  });

  it('normalizeRawSettings parses JSON string', () => {
    expect(
      normalizeRawSettings(
        JSON.stringify({ editorPreferences: { compactToolbar: true } }),
      ),
    ).toEqual({ editorPreferences: { compactToolbar: true } });
  });

  it('deepMergeStoredSettings fills missing categories from defaults', () => {
    const merged = deepMergeStoredSettings(DEFAULT_STORED_SETTINGS, {
      editorPreferences: { compactToolbar: true },
    });

    expect(merged.editorPreferences?.compactToolbar).toBe(true);
    expect(merged.collaborationPreferences?.showPresence).toBe(true);
  });
});
