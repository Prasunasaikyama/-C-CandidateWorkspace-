/**
 * Unit & Integration Test Suite for Attribution Engine & ROI Calculator
 */

const assert = require('assert');
const { AttributionEngine } = require('../backend/engine/attributionModels');
const { ROICalculator } = require('../backend/engine/roiCalculator');
const { PRNG } = require('../backend/engine/prng');

console.log('================================================================');
console.log('Running AttributionOS Engine Tests...');
console.log('================================================================');

// 1. Test PRNG Determinism
{
  const p1 = new PRNG(20261022);
  const p2 = new PRNG(20261022);
  const seq1 = [p1.next(), p1.nextInt(1, 100), p1.nextFloat(10, 50)];
  const seq2 = [p2.next(), p2.nextInt(1, 100), p2.nextFloat(10, 50)];
  assert.deepStrictEqual(seq1, seq2, 'PRNG must produce identical sequence for same seed');
  console.log('✔ PRNG determinism test passed.');
}

// 2. Test Attribution Models & Arithmetic Reconciliation
{
  const engine = new AttributionEngine();
  const conversionDate = '2026-05-15T12:00:00Z';
  const revenue = 100000;

  const mockTouches = [
    { touchpoint_id: 'T1', campaign_id: 'C1', channel_id: 'CH1', timestamp: '2026-03-01T10:00:00Z' },
    { touchpoint_id: 'T2', campaign_id: 'C2', channel_id: 'CH2', timestamp: '2026-04-01T10:00:00Z' },
    { touchpoint_id: 'T3', campaign_id: 'C3', channel_id: 'CH3', timestamp: '2026-05-01T10:00:00Z' },
    { touchpoint_id: 'T4', campaign_id: 'C4', channel_id: 'CH4', timestamp: '2026-05-10T10:00:00Z' }
  ];

  // First-Touch Test
  const ft = engine.calculateFirstTouch(mockTouches, revenue);
  assert.strictEqual(ft[0].attribution_weight, 1.0);
  assert.strictEqual(ft[0].attributed_revenue, revenue);
  assert.strictEqual(ft[1].attributed_revenue, 0);
  console.log('✔ First-Touch Attribution logic verified.');

  // Last-Touch Test
  const lt = engine.calculateLastTouch(mockTouches, revenue);
  assert.strictEqual(lt[3].attribution_weight, 1.0);
  assert.strictEqual(lt[3].attributed_revenue, revenue);
  assert.strictEqual(lt[0].attributed_revenue, 0);
  console.log('✔ Last-Touch Attribution logic verified.');

  // Linear Test (Reconciliation check)
  const lin = engine.calculateLinear(mockTouches, revenue);
  const sumLin = lin.reduce((s, r) => s + r.attributed_revenue, 0);
  assert.strictEqual(sumLin, revenue, 'Linear sum must equal total revenue');
  assert.strictEqual(lin[0].attributed_revenue, 25000);
  console.log('✔ Linear Attribution exact penny reconciliation verified.');

  // U-Shaped Test (40% first, 40% last, 20% middle)
  const u = engine.calculateUShaped(mockTouches, revenue);
  assert.strictEqual(u[0].attribution_weight, 0.40);
  assert.strictEqual(u[0].attributed_revenue, 40000);
  assert.strictEqual(u[3].attribution_weight, 0.40);
  assert.strictEqual(u[3].attributed_revenue, 40000);
  assert.strictEqual(u[1].attribution_weight, 0.10);
  assert.strictEqual(u[2].attribution_weight, 0.10);
  const sumU = u.reduce((s, r) => s + r.attributed_revenue, 0);
  assert.strictEqual(sumU, revenue, 'U-Shaped sum must equal total revenue');
  console.log('✔ U-Shaped (40-20-40) position-based attribution verified.');

  // Time-Decay Test
  const td = engine.calculateTimeDecay(mockTouches, revenue, conversionDate);
  const sumTd = td.reduce((s, r) => s + r.attributed_revenue, 0);
  assert.strictEqual(sumTd, revenue, 'Time-Decay sum must equal total revenue');
  assert(td[3].attribution_weight > td[0].attribution_weight, 'Touches closer to conversion must receive higher weight');
  console.log('✔ Time-Decay half-life weighting verified.');
}

// 3. Test Temporal Validity & Lookback Pruning
{
  const engine = new AttributionEngine({ defaultLookbackDays: 90 });
  const conversionDate = '2026-06-01T00:00:00Z';

  const mixedTouches = [
    { touchpoint_id: 'OLD', timestamp: '2025-12-01T00:00:00Z' }, // >90 days old
    { touchpoint_id: 'VALID', timestamp: '2026-05-15T00:00:00Z' }, // Valid
    { touchpoint_id: 'POST', timestamp: '2026-06-10T00:00:00Z' }  // After conversion
  ];

  const filtered = engine.filterValidTouchpoints(mixedTouches, conversionDate, 90, false);
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].touchpoint_id, 'VALID');
  console.log('✔ Temporal boundaries and lookback window pruning verified.');
}

// 4. Test ROI & Currency Normalization
{
  const roi = new ROICalculator();
  const rawEuro = 50000;
  const usd = roi.toUSD(rawEuro, 'EUR');
  assert.strictEqual(usd, 54000); // 50,000 * 1.08 = 54,000

  const costRecords = [
    { campaign_id: 'C1', amount: 10000, currency: 'USD' },
    { campaign_id: 'C1', amount: 5000, currency: 'EUR' }
  ];
  const agg = roi.aggregateCostsByCampaign(costRecords, true);
  assert.strictEqual(agg['C1'].cost_usd, 15400); // 10000 + 5400
  console.log('✔ Currency normalization and spend aggregation verified.');
}

console.log('================================================================');
console.log('ALL ENGINE UNIT TESTS PASSED SUCCESSFULLY! (4/4)');
console.log('================================================================');
