// ====================================
// AVENLO CORE - THERMAL DECAY
// Pure implementation of the Kinetic Engine "Heat" model (SYSTEM_MANIFESTO.md)
// ====================================
//
// Users accumulate "Heat" for negative intent. Heat decays exponentially over
// time toward zero, so a user who falls silent or turns positive naturally
// cools off. Dependency-free so the math is fully unit testable.

import type { ThreatSeverity } from '@avenlo/shared';

/** Thermal decay constant (λ) from the manifesto Kinetic Engine table. */
export const THERMAL_LAMBDA = 0.05;

/** Heat ceiling. */
export const HEAT_MAX = 100;

/** Heat % at which moderation jitter (elevated sensitivity) kicks in. */
export const HEAT_JITTER_THRESHOLD = 75;

/** Heat % at which the user is automatically locked down. */
export const HEAT_LOCKDOWN_THRESHOLD = 90;

const MS_PER_MINUTE = 60 * 1000;

export interface ThermalState {
  /** Current heat in range [0, HEAT_MAX]. */
  heat: number;
  /** Epoch millis of the last update. */
  updatedAt: number;
}

/**
 * Apply exponential decay to a heat value over an elapsed period.
 *
 *   heat(t) = heat0 * e^(-λ * minutes)
 *
 * λ = 0.05 per minute gives a half-life of ~13.9 minutes.
 */
export function decayHeat(heat: number, elapsedMs: number): number {
  if (heat <= 0 || elapsedMs <= 0) {
    return Math.max(0, heat);
  }
  const minutes = elapsedMs / MS_PER_MINUTE;
  const decayed = heat * Math.exp(-THERMAL_LAMBDA * minutes);
  return decayed < 0.01 ? 0 : decayed;
}

/**
 * Decay an existing state to `now`, then apply a heat delta (positive for
 * hostile intent, negative for cooling/positive behavior). Returns a new state.
 */
export function applyHeat(
  state: ThermalState,
  delta: number,
  now: number
): ThermalState {
  const decayed = decayHeat(state.heat, now - state.updatedAt);
  const next = Math.max(0, Math.min(HEAT_MAX, decayed + delta));
  return { heat: next, updatedAt: now };
}

/**
 * Map a detected threat to the amount of Heat it contributes, scaled by the
 * model's confidence.
 */
export function heatForThreat(severity: ThreatSeverity, confidence: number): number {
  const base: Record<ThreatSeverity, number> = {
    low: 12,
    medium: 28,
    high: 50,
    critical: 80,
  };
  const c = Math.max(0, Math.min(1, confidence));
  return base[severity] * c;
}

export function isLockdown(heat: number): boolean {
  return heat >= HEAT_LOCKDOWN_THRESHOLD;
}

export function isJitter(heat: number): boolean {
  return heat >= HEAT_JITTER_THRESHOLD;
}
