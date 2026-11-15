/**
 * Deterministic Pseudo-Random Number Generator (Mulberry32)
 * Ensures 100% reproducible synthetic data generation.
 */

class PRNG {
  constructor(seed = 20261022) {
    this.initialSeed = seed;
    this.state = seed >>> 0;
  }

  reset() {
    this.state = this.initialSeed >>> 0;
  }

  // Returns float [0, 1)
  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Returns integer [min, max] inclusive
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  // Returns float [min, max]
  nextFloat(min, max, decimals = 2) {
    const val = this.next() * (max - min) + min;
    return Number(val.toFixed(decimals));
  }

  // Pick one random item from array
  pick(array) {
    return array[this.nextInt(0, array.length - 1)];
  }

  // Returns true with probability p (0 <= p <= 1)
  chance(p) {
    return this.next() < p;
  }

  // Format zero-padded number
  pad(num, size) {
    let s = num + '';
    while (s.length < size) s = '0' + s;
    return s;
  }
}

module.exports = { PRNG };
