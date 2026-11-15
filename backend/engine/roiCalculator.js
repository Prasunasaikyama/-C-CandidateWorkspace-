/**
 * Marketing ROI & Financial Reconciliation Engine
 * Calculates Cost, Revenue, ROAS, ROI, and CAC across all 5 attribution models.
 * Exposes differences between unquarantined (dirty) and quarantined (clean) states.
 */

class ROICalculator {
  constructor(currencyRates = {}) {
    this.rates = Object.assign({
      USD: 1.0,
      EUR: 1.08,
      GBP: 1.28,
      JPY: 0.0065
    }, currencyRates);
  }

  /**
   * Normalize an amount to USD based on currency
   */
  toUSD(amount, currency = 'USD') {
    const rate = this.rates[currency.toUpperCase()] || 1.0;
    return Number((amount * rate).toFixed(2));
  }

  /**
   * Reconcile campaign costs from cost_records
   * @param {Array} costRecords
   * @param {boolean} normalizeCurrency - If false, treats raw foreign amounts as USD (simulates currency mismatch)
   */
  aggregateCostsByCampaign(costRecords, normalizeCurrency = true) {
    const campaignCosts = {};

    costRecords.forEach(c => {
      if (!campaignCosts[c.campaign_id]) {
        campaignCosts[c.campaign_id] = {
          campaign_id: c.campaign_id,
          raw_cost: 0,
          cost_usd: 0,
          currency: c.currency,
          records_count: 0
        };
      }

      campaignCosts[c.campaign_id].raw_cost += c.amount;
      campaignCosts[c.campaign_id].records_count += 1;

      if (normalizeCurrency) {
        campaignCosts[c.campaign_id].cost_usd += this.toUSD(c.amount, c.currency);
      } else {
        campaignCosts[c.campaign_id].cost_usd += c.amount; // Un-normalized currency distortion
      }
    });

    Object.keys(campaignCosts).forEach(id => {
      campaignCosts[id].raw_cost = Number(campaignCosts[id].raw_cost.toFixed(2));
      campaignCosts[id].cost_usd = Number(campaignCosts[id].cost_usd.toFixed(2));
    });

    return campaignCosts;
  }

  /**
   * Calculate ROI metrics for a given model
   */
  calculateModelROI(campaignCosts, attributionResults, modelName) {
    const modelResults = attributionResults.filter(r => r.model_name === modelName);
    
    // Group revenue by campaign
    const campaignRevenue = {};
    const channelRevenue = {};
    let totalAttributedRevenue = 0;

    modelResults.forEach(r => {
      // Campaign roll-up
      if (!campaignRevenue[r.campaign_id]) {
        campaignRevenue[r.campaign_id] = {
          campaign_id: r.campaign_id,
          attributed_revenue: 0,
          touches_credited: 0,
          unique_opps: new Set()
        };
      }
      campaignRevenue[r.campaign_id].attributed_revenue += r.attributed_revenue;
      campaignRevenue[r.campaign_id].touches_credited += 1;
      campaignRevenue[r.campaign_id].unique_opps.add(r.opportunity_id);

      // Channel roll-up
      if (!channelRevenue[r.channel_id]) {
        channelRevenue[r.channel_id] = {
          channel_id: r.channel_id,
          attributed_revenue: 0
        };
      }
      channelRevenue[r.channel_id].attributed_revenue += r.attributed_revenue;

      totalAttributedRevenue += r.attributed_revenue;
    });

    // Merge costs and compute ROI per campaign
    const campaignsROI = [];
    let totalSpend = 0;

    // Collect all campaign IDs from either costs or revenue
    const allCampaignIds = new Set([
      ...Object.keys(campaignCosts),
      ...Object.keys(campaignRevenue)
    ]);

    allCampaignIds.forEach(campId => {
      const costInfo = campaignCosts[campId] || { cost_usd: 0, raw_cost: 0 };
      const revInfo = campaignRevenue[campId] || { attributed_revenue: 0, touches_credited: 0, unique_opps: new Set() };
      
      const cost = costInfo.cost_usd;
      const revenue = Number(revInfo.attributed_revenue.toFixed(2));
      totalSpend += cost;

      let roiPct = 0;
      let roas = 0;
      let cac = 0;

      if (cost > 0) {
        roiPct = Number((((revenue - cost) / cost) * 100).toFixed(2));
        roas = Number((revenue / cost).toFixed(2));
        const customerCount = revInfo.unique_opps.size;
        cac = customerCount > 0 ? Number((cost / customerCount).toFixed(2)) : cost;
      } else if (revenue > 0) {
        // Zero cost anomaly scenario: infinite ROI
        roiPct = 9999.99;
        roas = 999.99;
        cac = 0.0;
      }

      campaignsROI.push({
        campaign_id: campId,
        cost_usd: cost,
        attributed_revenue: revenue,
        net_profit: Number((revenue - cost).toFixed(2)),
        roi_percentage: roiPct,
        roas: roas,
        conversions: revInfo.unique_opps.size,
        cac: cac
      });
    });

    totalSpend = Number(totalSpend.toFixed(2));
    totalAttributedRevenue = Number(totalAttributedRevenue.toFixed(2));

    const overallRoi = totalSpend > 0 ? Number((((totalAttributedRevenue - totalSpend) / totalSpend) * 100).toFixed(2)) : 0;
    const overallRoas = totalSpend > 0 ? Number((totalAttributedRevenue / totalSpend).toFixed(2)) : 0;

    return {
      model_name: modelName,
      total_spend: totalSpend,
      total_attributed_revenue: totalAttributedRevenue,
      net_profit: Number((totalAttributedRevenue - totalSpend).toFixed(2)),
      overall_roi_percentage: overallRoi,
      overall_roas: overallRoas,
      campaigns_analyzed: campaignsROI.length,
      channel_breakdown: channelRevenue,
      campaign_metrics: campaignsROI
    };
  }
}

module.exports = { ROICalculator };
