/**
 * System Routes: Health, Executive Summary KPIs, and Data Dictionary
 */

class SystemRoutes {
  constructor(context) {
    this.db = context.db;
  }

  handleHealth(req, res, sendJson) {
    const counts = {
      campaigns: this.db.get('SELECT COUNT(*) as c FROM campaigns').c,
      contacts: this.db.get('SELECT COUNT(*) as c FROM contacts').c,
      touchpoints: this.db.get('SELECT COUNT(*) as c FROM touchpoints').c,
      opportunities: this.db.get('SELECT COUNT(*) as c FROM opportunities').c,
      cost_records: this.db.get('SELECT COUNT(*) as c FROM cost_records').c,
      attribution_results: this.db.get('SELECT COUNT(*) as c FROM attribution_results').c,
      ground_truth_anomalies: this.db.get('SELECT COUNT(*) as c FROM ground_truth_anomalies').c
    };

    sendJson(res, 200, {
      status: 'ONLINE',
      node_version: process.version,
      database: 'SQLite (node:sqlite native)',
      database_tables: counts,
      timestamp: new Date().toISOString()
    });
  }

  handleSummary(req, res, sendJson) {
    const totalPipeline = this.db.get('SELECT SUM(pipeline_amount) as s FROM opportunities').s || 0;
    const totalClosedWon = this.db.get("SELECT SUM(closed_amount) as s FROM opportunities WHERE stage = 'Closed-Won'").s || 0;
    const totalSpend = this.db.get('SELECT SUM(amount_usd) as s FROM cost_records').s || 0;
    const oppWonCount = this.db.get("SELECT COUNT(*) as c FROM opportunities WHERE stage = 'Closed-Won'").c;
    const totalContacts = this.db.get('SELECT COUNT(*) as c FROM contacts').c;
    const totalCampaigns = this.db.get('SELECT COUNT(*) as c FROM campaigns').c;
    const totalTouches = this.db.get('SELECT COUNT(*) as c FROM touchpoints').c;

    const overallRoi = totalSpend > 0 ? Number((((totalClosedWon - totalSpend) / totalSpend) * 100).toFixed(2)) : 0;
    const overallRoas = totalSpend > 0 ? Number((totalClosedWon / totalSpend).toFixed(2)) : 0;

    sendJson(res, 200, {
      kpis: {
        total_pipeline: Number(totalPipeline.toFixed(2)),
        total_closed_won_revenue: Number(totalClosedWon.toFixed(2)),
        total_spend: Number(totalSpend.toFixed(2)),
        net_profit: Number((totalClosedWon - totalSpend).toFixed(2)),
        overall_roi_pct: overallRoi,
        overall_roas: overallRoas,
        opportunities_won: oppWonCount,
        total_contacts: totalContacts,
        total_campaigns: totalCampaigns,
        total_touchpoints: totalTouches
      }
    });
  }

  handleDictionary(req, res, sendJson) {
    const tables = this.db.all(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name
    `);

    const schemaDetails = {};
    tables.forEach(t => {
      const cols = this.db.all(`PRAGMA table_info(${t.name})`);
      const count = this.db.get(`SELECT COUNT(*) as c FROM ${t.name}`).c;
      schemaDetails[t.name] = {
        row_count: count,
        columns: cols.map(c => ({
          cid: c.cid,
          name: c.name,
          type: c.type,
          notnull: c.notnull === 1,
          dflt_value: c.dflt_value,
          pk: c.pk === 1
        }))
      };
    });

    sendJson(res, 200, { schema: schemaDetails });
  }
}

module.exports = { SystemRoutes };
