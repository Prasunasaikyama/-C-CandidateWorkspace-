/**
 * Step 10: Deterministic Reproducibility Verification
 * Regenerates the synthetic dataset twice using the identical fixed seed (20261022)
 * and asserts 100% bit-for-bit parity across all entity row counts and SHA256 checksums.
 */

const assert = require('assert');
const crypto = require('crypto');
const { DataGenerator } = require('../database/generator');

console.log('================================================================');
console.log('STEP 10: DETERMINISTIC REPRODUCIBILITY VERIFICATION');
console.log('Fixed Seed: 20261022 | Testing 2 Independent Generations');
console.log('================================================================');

const SEED = 20261022;

function hashDataset(data) {
  const hashes = {};
  const counts = {};

  Object.keys(data).forEach(key => {
    const serialized = JSON.stringify(data[key]);
    hashes[key] = crypto.createHash('sha256').update(serialized).digest('hex');
    counts[key] = data[key].length;
  });

  return { hashes, counts };
}

// Run 1
console.log('\n[Run 1] Generating baseline dataset with seed ' + SEED + '...');
const gen1 = new DataGenerator({ seed: SEED, scale: 'starter' });
const data1 = gen1.generate();
const res1 = hashDataset(data1);

// Run 2
console.log('\n[Run 2] Generating second independent dataset with seed ' + SEED + '...');
const gen2 = new DataGenerator({ seed: SEED, scale: 'starter' });
const data2 = gen2.generate();
const res2 = hashDataset(data2);

console.log('\nComparison Matrix:');
console.log('-----------------------------------------------------------------------------------------------');
console.log('Entity Table             | Run 1 Rows | Run 2 Rows | Run 1 SHA256 | Run 2 SHA256 | Match');
console.log('-----------------------------------------------------------------------------------------------');

let allMatch = true;

Object.keys(res1.counts).forEach(table => {
  const c1 = res1.counts[table];
  const c2 = res2.counts[table];
  const h1 = res1.hashes[table].slice(0, 8);
  const h2 = res2.hashes[table].slice(0, 8);
  const match = (c1 === c2 && res1.hashes[table] === res2.hashes[table]);

  if (!match) allMatch = false;

  console.log(
    `${table.padEnd(24)} | ${c1.toString().padStart(10)} | ${c2.toString().padStart(10)} | ${h1.padEnd(12)} | ${h2.padEnd(12)} | ${match ? '✔ PASS' : '✖ FAIL'}`
  );

  assert.strictEqual(c1, c2, `Row counts must match for table ${table}`);
  assert.strictEqual(res1.hashes[table], res2.hashes[table], `SHA256 must match for table ${table}`);
});

console.log('-----------------------------------------------------------------------------------------------');
if (allMatch) {
  console.log('RESULT: 100% BIT-FOR-BIT DETERMINISTIC REPRODUCIBILITY CONFIRMED! ✔');
} else {
  console.log('RESULT: REPRODUCIBILITY FAILED! ✖');
  process.exit(1);
}
console.log('================================================================\n');
