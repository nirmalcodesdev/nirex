import { describe, it, expect } from 'vitest';

describe('Config Loader', () => {
  it('loads config with default values', async () => {
    const { loadConfig, invalidateConfigCache } = await import('../utils/config.js');
    invalidateConfigCache();

    const config = loadConfig();
    expect(config.backend?.baseUrl).toBeDefined();
    expect(config.agent?.model).toBeDefined();
    expect(config.agent?.maxTurns).toBe(25);
    expect(typeof config.ui?.color).toBe('boolean');
    expect(config.permissions?.defaultAction).toBe('ask');
  });

  it('getConfigPaths returns expected paths', async () => {
    const { getConfigPaths } = await import('../utils/config.js');
    const paths = getConfigPaths();
    expect(paths.global).toContain('.nirex');
    expect(paths.project).toBe('.nirexrc.json');
  });
});
