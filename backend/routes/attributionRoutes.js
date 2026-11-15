/**
 * Attribution Routes: Model Comparison & Dynamic Recomputation
 */

class AttributionRoutes {
  constructor(context) {
    this.db = context.db;
    this.roiCalculator = context.roiCalculator;
    this.attributionEngine = context.attributionEngine;
  }

  handleCompare(req, res, sendJson) {
    const costRecords = this.db.all('SELECT * FROM cost_records');
    const campaignCosts = this.roiCalculator.aggregateCostsByCampaign(costRecords, true);

    const attributionResults = this.db.all('SELECT * FROM attribution_results WHERE is_quarantined = 0');
    const models = ['First-Touch', 'Last-Touch', 'Linear', 'Time-Decay', 'U-Shaped'];

    const comparison = models.map(m => {
      return this.roiCalculator.calculateModelROI(campaignCosts, attributionResults, m);
    });

    // Channel-level breakdown
    const channels = this.db.all('SELECT * FROM channels');
    const channelSummary = channels.map(ch => {
      const item = {
        channel_id: ch.channel_id,
        channel_name: ch.name,
        category: ch.category,
        is_paid: ch.is_paid === 1,
        models: {}
      };

      models.forEach(m => {
        const revRow = this.db.get(`
          SELECT SUM(attributed_revenue) as rev 
          FROM attribution_results 
          WHERE channel_id = ? AND model_name = ? AND is_quarantined = 0
        `, [ch.channel_id, m]);
        item.models[m] = Number((revRow ? revRow.rev || 0 : 0).toFixed(2));
      });

      const spendRow = this.db.get('SELECT SUM(amount_usd) as sp FROM cost_records WHERE channel_id = ?', [ch.channel_id]);
      item.spend = Number((spendRow ? spendRow.sp || 0 : 0).toFixed(2));

      return item;
    });

    sendJson(res, 200, {
      models: comparison,
      channel_summary: channelSummary
    });
  }

  async handleRecompute(req, res, parseBody, sendJson) {
    const body = await parseBody(req);
    const lookbackDays = body.lookbackDays || 90;
    const halfLifeDays = body.halfLifeDays || 7;

    // Custom attribution recompute logic
    const engine = new (require('../engine/attributionModels').AttributionEngine)({
      defaultLookbackDays: lookbackDays,
      timeDecayHalfLifeDays: halfLifeDays
    });

    const wonOpps = this.db.all("SELECT * FROM opportunities WHERE stage = 'Closed-Won'");
    let totalUpdated = 0;

    this.db.transaction(conn => {
      conn.run("DELETE FROM attribution_results WHERE is_quarantined = 0");
      const stmtAtt = conn.prepare(`INSERT INTO attribution_results VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

      wonOpps.forEach((opp, oppIdx) => {
        const touches = conn.all("SELECT * FROM touchpoints WHERE contact_id = ? ORDER BY timestamp ASC", [opp.contact_id]);
        const computed = engine.computeAllModels(opp, touches, true);

        Object.keys(computed.models).forEach(modelName => {
          computed.models[modelName].forEach((resItem, resIdx) => {
            const attId = `ATT-REC-${oppIdx + 1}-${modelName.slice(0, 2)}-${resIdx + 1}`;
            stmtAtt.run(
              attId,
              opp.opportunity_id,
              resItem.touchpoint_id,
              resItem.campaign_id,
              resItem.channel_id,
              modelName,
              resItem.attribution_weight,
              resItem.attributed_revenue,
              new Date().toISOString(),
              'Q1-2026',
              0
            );
            totalUpdated++;
          });
        });
      });
    });

    sendJson(res, 200, {
      message: 'Attribution models successfully recomputed with updated parameters.',
      lookback_days: lookbackDays,
      half_life_days: halfLifeDays,
      records_generated: totalUpdated
    });
  }
}

module.exports = { AttributionRoutes };
