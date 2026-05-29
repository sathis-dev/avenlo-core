import {
  THERMAL_LAMBDA,
  HEAT_MAX,
  HEAT_LOCKDOWN_THRESHOLD,
  HEAT_JITTER_THRESHOLD,
  decayHeat,
  applyHeat,
  heatForThreat,
  isLockdown,
  isJitter,
} from './thermalDecay';

const MS_PER_MIN = 60 * 1000;

describe('thermalDecay', () => {
  describe('decayHeat', () => {
    it('returns the same heat when no time has elapsed', () => {
      expect(decayHeat(100, 0)).toBe(100);
    });

    it('decays to ~half after one half-life (ln2/λ minutes)', () => {
      const halfLifeMinutes = Math.log(2) / THERMAL_LAMBDA; // ~13.86 min
      const decayed = decayHeat(100, halfLifeMinutes * MS_PER_MIN);
      expect(decayed).toBeCloseTo(50, 1);
    });

    it('approaches zero over long silence', () => {
      expect(decayHeat(100, 1000 * MS_PER_MIN)).toBe(0);
    });

    it('never returns negative and ignores negative elapsed time', () => {
      expect(decayHeat(0, MS_PER_MIN)).toBe(0);
      expect(decayHeat(40, -5000)).toBe(40);
    });
  });

  describe('applyHeat', () => {
    it('decays then adds the delta', () => {
      const now = 1_000_000;
      const tenMinAgo = now - 10 * MS_PER_MIN;
      const next = applyHeat({ heat: 60, updatedAt: tenMinAgo }, 20, now);
      // 60 * e^(-0.05*10) ≈ 36.39, + 20 ≈ 56.39
      expect(next.heat).toBeCloseTo(56.39, 1);
      expect(next.updatedAt).toBe(now);
    });

    it('clamps to HEAT_MAX', () => {
      const now = 1_000;
      const next = applyHeat({ heat: 95, updatedAt: now }, 50, now);
      expect(next.heat).toBe(HEAT_MAX);
    });

    it('clamps to zero on large negative delta', () => {
      const now = 1_000;
      const next = applyHeat({ heat: 30, updatedAt: now }, -100, now);
      expect(next.heat).toBe(0);
    });
  });

  describe('heatForThreat', () => {
    it('scales by severity and confidence', () => {
      expect(heatForThreat('critical', 1)).toBe(80);
      expect(heatForThreat('low', 0.5)).toBe(6);
      expect(heatForThreat('high', 0)).toBe(0);
    });

    it('clamps confidence to [0,1]', () => {
      expect(heatForThreat('medium', 5)).toBe(28);
      expect(heatForThreat('medium', -1)).toBe(0);
    });
  });

  describe('thresholds', () => {
    it('flags lockdown at/above 90', () => {
      expect(isLockdown(HEAT_LOCKDOWN_THRESHOLD)).toBe(true);
      expect(isLockdown(89.99)).toBe(false);
    });

    it('flags jitter at/above 75', () => {
      expect(isJitter(HEAT_JITTER_THRESHOLD)).toBe(true);
      expect(isJitter(74.99)).toBe(false);
    });
  });
});
