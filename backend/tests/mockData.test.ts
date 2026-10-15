import { describe, expect, it } from 'vitest';
import { Rng, generateMockSnapshot, generateMockStations, jitterSnapshot } from '../src/adapters/drweb/mockData.js';

describe('mockData', () => {
  it('Rng детерминирован для одного seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('snapshot консистентен: stations summary сходится с threats', () => {
    const s = generateMockSnapshot(1);
    expect(s.stations.total).toBe(148);
    expect(s.stations.online + s.stations.offline).toBe(s.stations.total);
    expect(s.threats).toHaveLength(30);
    for (const p of s.threats) {
      expect(p.detected).toBeGreaterThanOrEqual(p.cured + p.quarantined + p.deleted - 1);
    }
  });

  it('jitter не мутирует исходный снапшот', () => {
    const s = generateMockSnapshot(7);
    const before = s.stations.online;
    const j = jitterSnapshot(s, 999);
    expect(s.stations.online).toBe(before);
    expect(j).not.toBe(s);
  });

  it('станции детерминированы и уникальны по uid', () => {
    const a = generateMockStations(5);
    const b = generateMockStations(5);
    expect(a.map((x) => x.uid)).toEqual(b.map((x) => x.uid));
    expect(new Set(a.map((x) => x.uid)).size).toBe(a.length);
  });
});
