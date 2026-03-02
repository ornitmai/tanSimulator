/* ===== physics.js — Tangent Galvanometer Physics & Error Models ===== */

const Physics = (() => {
  const MU_0 = 4 * Math.PI * 1e-7; // T·m/A

  // Preset planetary B_H values (Tesla)
  const PLANETS = {
    israel:   2.5e-5,
    global:   4.4e-5,
    mars:     5e-7,
    vacuum:   0
  };

  /* ---------- Core formulas ---------- */

  /** Magnetic field at centre of a coil with N turns, radius R, current I */
  function bLoop(I, N, R) {
    return (MU_0 * N * I) / (2 * R);
  }

  /** Deflection angle (degrees) given B_loop and B_H */
  function deflectionAngle(B_loop, B_H) {
    if (B_H === 0) return B_loop !== 0 ? 90 * Math.sign(B_loop) : 0;
    return Math.atan(B_loop / B_H) * (180 / Math.PI);
  }

  /** Linear regression through origin: y = slope * x */
  function slopeThruOrigin(points) {
    let sumXY = 0, sumXX = 0;
    points.forEach(p => { sumXY += p.x * p.y; sumXX += p.x * p.x; });
    return sumXX === 0 ? 0 : sumXY / sumXX;
  }

  /** B_H from slope of tan(θ) vs B_loop graph */
  function bhFromSlope(slope) {
    return slope === 0 ? Infinity : 1 / slope;
  }

  /* ---------- Error models ---------- */

  /** Gaussian random (Box-Muller) */
  function gaussRandom(mean, std) {
    if (std === 0) return mean;
    const u1 = Math.random();
    const u2 = Math.random();
    return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /**
   * Apply all enabled error models to the ideal angle.
   * @param {number} idealAngle   - degrees (from deflectionAngle)
   * @param {object} errors       - { calibration, noise, placement }
   * @param {object} params       - { I, N, R, B_H } for placement recalc
   * @returns {{ measured: number, ideal: number }}
   */
  function applyErrors(idealAngle, errors, params) {
    let measured = idealAngle;

    // 1. Calibration offset — compass not aligned to north
    if (errors.calibration && errors.calibration.enabled) {
      measured += errors.calibration.offset; // degrees
    }

    // 2. Measurement noise — needle jitter (Gaussian)
    if (errors.noise && errors.noise.enabled) {
      measured = gaussRandom(measured, errors.noise.stdDev);
    }

    // 3. Placement offset — compass not at centre of coil
    //    We model this as a multiplicative correction to B_loop:
    //    B(x) = B_0 * R² / (R² + x²)^(3/2)  (on-axis field)
    if (errors.placement && errors.placement.enabled && params) {
      const x = errors.placement.offset / 100; // cm → m
      const R = params.R;
      // B(x)/B(0) = R³ / (R²+x²)^(3/2) — on-axis field falloff
      const correction = Math.pow(R, 3) / Math.pow(R * R + x * x, 1.5);
      const B_loop_actual = bLoop(params.I, params.N, R) * correction;
      measured = deflectionAngle(B_loop_actual, params.B_H);
      // Re-apply calibration and noise on top
      if (errors.calibration && errors.calibration.enabled) {
        measured += errors.calibration.offset;
      }
      if (errors.noise && errors.noise.enabled) {
        measured = gaussRandom(measured, errors.noise.stdDev);
      }
    }

    return { measured, ideal: idealAngle };
  }

  /* ---------- Public API ---------- */
  return {
    MU_0,
    PLANETS,
    bLoop,
    deflectionAngle,
    slopeThruOrigin,
    bhFromSlope,
    gaussRandom,
    applyErrors
  };
})();
