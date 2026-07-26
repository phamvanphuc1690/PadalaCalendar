// @vitest-environment node
import { describe, expect, it } from 'vitest';
import manifest from '@/app/manifest';

describe('app/manifest.ts', () => {
  it('returns a valid Web App Manifest shape', () => {
    const m = manifest();
    expect(m.name).toMatch(/PayHub/);
    expect(m.short_name).toBe('PayHub');
    expect(m.start_url).toBe('/');
    expect(m.scope).toBe('/');
    expect(m.display).toBe('standalone');
    expect(m.theme_color).toBe('#1e40af');
    expect(m.background_color).toBe('#ffffff');
  });

  it('declares 192 and 512 icons plus a maskable variant', () => {
    const m = manifest();
    const sizes = m.icons.map((i) => i.sizes).sort();
    expect(sizes).toEqual(['192x192', '512x512', '512x512']);
    const maskable = m.icons.find((i) => i.purpose === 'maskable');
    expect(maskable?.sizes).toBe('512x512');
    expect(maskable?.src).toBe('/icons/icon-maskable-512.png');
  });

  it('points every icon to a /icons/ path', () => {
    const m = manifest();
    for (const icon of m.icons) {
      expect(icon.src.startsWith('/icons/')).toBe(true);
    }
  });
});
