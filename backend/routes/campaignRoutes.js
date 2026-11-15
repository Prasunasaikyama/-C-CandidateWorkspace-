/**
 * Campaign Routes: Campaign Performance, Spend Ledger, and Cost Analytics
 */

class CampaignRoutes {
  constructor(context) {
    this.db = context.db;
  }

  handleList(req, res, query, sendJson) {
    const limit = parseInt(query.limit, 10) || 50;
    const offset = parseInt(query.offset, 10) || 0;
    const search = query.search ? `%${query.search.trim()}%` : null;
    const period = query.period || null;

    let sql = `
      SELECT 
        c.*,
        ch.name as channel_name,
        ch.category as channel_category,
        COALESCE(SUM(cr.amount_usd), 0) as total_spend,
        (SELECT COUNT(*) FROM touchpoints WHERE campaign_id = c.campaign_id) as touch_count
      FROM campaigns c
      JOIN channels ch ON c.channel_id = ch.channel_id
      LEFT JOIN cost_records cr ON c.campaign_id = cr.campaign_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (c.name LIKE ? OR c.campaign_id LIKE ?)`;
      params.push(search, search);
    }
    if (period) {
      sql += ` AND c.evaluation_period = ?`;
      params.push(period);
    }

    sql += ` GROUP BY c.campaign_id ORDER BY c.campaign_id ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const campaigns = this.db.all(sql, params);

    // Attach model revenue for each campaign
    const enriched = campaigns.map(cmp => {
      const modelsRev = {};
      ['First-Touch', 'Last-Touch', 'Linear', 'Time-Decay', 'U-Shaped'].forEach(m => {
        const row = this.db.get(`
          SELECT SUM(attributed_revenue) as r 
          FROM attribution_results 
          WHERE campaign_id = ? AND model_name = ? AND is_quarantined = 0
        `, [cmp.campaign_id, m]);
        modelsRev[m] = Number((row ? row.r || 0 : 0).toFixed(2));
      });

      return Object.assign({}, cmp, {
        total_spend: Number(cmp.total_spend.toFixed(2)),
        attributed_revenue: modelsRev
      });
    });

    const totalCount = this.db.get('SELECT COUNT(*) as c FROM campaigns').c;

    sendJson(res, 200, {
      total: totalCount,
      limit,
      offset,
      campaigns: enriched
    });
  }

  handleDetail(req, res, campaignId, sendJson, sendError) {
    const cmp = this.db.get(`
      SELECT c.*, ch.name as channel_name, a.name as audience_name, cr.name as creative_name
      FROM campaigns c
      JOIN channels ch ON c.channel_id = ch.channel_id
      LEFT JOIN audiences a ON c.audience_id = a.audience_id
      LEFT JOIN creatives cr ON c.creative_id = cr.creative_id
      WHERE c.campaign_id = ?
    `, [campaignId]);

    if (!cmp) return sendError(res, 404, 'Campaign not found');

    const costs = this.db.all('SELECT * FROM cost_records WHERE campaign_id = ? ORDER BY cost_date ASC', [campaignId]);
    const touchpoints = this.db.all('SELECT * FROM touchpoints WHERE campaign_id = ? ORDER BY timestamp DESC LIMIT 100', [campaignId]);
    
    const modelRevs = {};
    ['First-Touch', 'Last-Touch', 'Linear', 'Time-Decay', 'U-Shaped'].forEach(m => {
      const row = this.db.get('SELECT SUM(attributed_revenue) as r FROM attribution_results WHERE campaign_id = ? AND model_name = ?', [campaignId, m]);
      modelRevs[m] = Number((row ? row.r || 0 : 0).toFixed(2));
    });

    sendJson(res, 200, {
      campaign: cmp,
      costs,
      recent_touchpoints: touchpoints,
      attributed_revenue: modelRevs
    });
  }
}

module.exports = { CampaignRoutes };
