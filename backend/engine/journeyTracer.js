/**
 * Journey Tracer & Audit Trail Engine
 * Stitches multi-touch chronology from campaign touches, web events, leads,
 * opportunities, orders, and attribution weights into an auditable graph.
 */

class JourneyTracer {
  constructor(db) {
    this.db = db;
  }

  /**
   * Reconstruct full end-to-end journey for a Contact or Opportunity
   * @param {string} id - Either a contact_id or opportunity_id
   */
  traceJourney(id) {
    let contactId = id;
    let opportunityId = null;

    if (id.startsWith('OPP-')) {
      opportunityId = id;
      const opp = this.db.get('SELECT contact_id FROM opportunities WHERE opportunity_id = ?', [id]);
      if (!opp) return null;
      contactId = opp.contact_id;
    }

    // 1. Fetch Contact Details
    const contact = this.db.get('SELECT * FROM contacts WHERE contact_id = ?', [contactId]);
    if (!contact) return null;

    // 2. Fetch Opportunities
    const opportunities = this.db.all(`
      SELECT o.*, l.lead_source, l.lead_score, l.lead_status 
      FROM opportunities o
      LEFT JOIN leads l ON o.lead_id = l.lead_id
      WHERE o.contact_id = ?
      ORDER BY o.created_at ASC
    `, [contactId]);

    // 3. Fetch Orders
    const orders = this.db.all(`
      SELECT * FROM orders WHERE contact_id = ? ORDER BY order_date ASC
    `, [contactId]);

    // 4. Fetch Web Sessions
    const sessions = this.db.all(`
      SELECT * FROM web_sessions WHERE contact_id = ? ORDER BY session_start ASC
    `, [contactId]);

    // 5. Fetch Touchpoints with Campaign and Channel details
    const touchpoints = this.db.all(`
      SELECT 
        t.*,
        c.name AS campaign_name,
        c.budget AS campaign_budget,
        ch.name AS channel_name,
        ch.category AS channel_category
      FROM touchpoints t
      JOIN campaigns c ON t.campaign_id = c.campaign_id
      JOIN channels ch ON t.channel_id = ch.channel_id
      WHERE t.contact_id = ?
      ORDER BY t.timestamp ASC
    `, [contactId]);

    // 6. Fetch Attribution Results for these opportunities
    const oppIds = opportunities.map(o => o.opportunity_id);
    let attributionRows = [];
    if (oppIds.length > 0) {
      const placeholders = oppIds.map(() => '?').join(',');
      attributionRows = this.db.all(`
        SELECT * FROM attribution_results 
        WHERE opportunity_id IN (${placeholders})
        ORDER BY calculation_timestamp ASC
      `, oppIds);
    }

    // Map attribution weights by touchpoint_id and model_name
    const attributionMap = {};
    attributionRows.forEach(a => {
      const key = `${a.touchpoint_id}::${a.model_name}`;
      attributionMap[key] = {
        weight: a.attribution_weight,
        revenue: a.attributed_revenue,
        is_quarantined: a.is_quarantined
      };
    });

    // 7. Assemble Unified Timeline Events
    const timeline = [];

    // Contact created event
    timeline.push({
      event_type: 'ContactCreated',
      timestamp: contact.created_at,
      title: 'Contact Profile Initialized',
      description: `${contact.first_name} ${contact.last_name} (${contact.company})`,
      metadata: { contact_id: contact.contact_id, lifecycle: contact.lifecycle_stage }
    });

    // Web Session events
    sessions.forEach(s => {
      timeline.push({
        event_type: 'WebSession',
        timestamp: s.session_start,
        title: `Web Session (${s.device_type})`,
        description: `Page: ${s.landing_page} via ${s.utm_source || 'direct'}`,
        metadata: s
      });
    });

    // Touchpoint events
    touchpoints.forEach((tp, idx) => {
      timeline.push({
        event_type: 'Touchpoint',
        timestamp: tp.timestamp,
        title: `${tp.touchpoint_type}`,
        description: `Campaign: ${tp.campaign_name} [${tp.channel_name}]`,
        touchpoint_id: tp.touchpoint_id,
        is_offline: tp.is_offline === 1,
        issue_flag: tp.issue_flag,
        models: {
          'First-Touch': attributionMap[`${tp.touchpoint_id}::First-Touch`] || null,
          'Last-Touch': attributionMap[`${tp.touchpoint_id}::Last-Touch`] || null,
          'Linear': attributionMap[`${tp.touchpoint_id}::Linear`] || null,
          'Time-Decay': attributionMap[`${tp.touchpoint_id}::Time-Decay`] || null,
          'U-Shaped': attributionMap[`${tp.touchpoint_id}::U-Shaped`] || null
        },
        metadata: tp
      });
    });

    // Opportunity events
    opportunities.forEach(o => {
      timeline.push({
        event_type: 'OpportunityCreated',
        timestamp: o.created_at,
        title: `Opportunity Opened: ${o.name}`,
        description: `Stage: ${o.stage} | Pipeline: $${o.pipeline_amount}`,
        metadata: o
      });

      if (o.closed_at) {
        timeline.push({
          event_type: o.stage === 'Closed-Won' ? 'OpportunityWon' : 'OpportunityLost',
          timestamp: o.closed_at,
          title: `Opportunity ${o.stage}: $${o.closed_amount}`,
          description: o.win_loss_reason || 'Standard close',
          metadata: o
        });
      }
    });

    // Order events
    orders.forEach(ord => {
      timeline.push({
        event_type: 'OrderPlaced',
        timestamp: ord.order_date,
        title: `Order #${ord.order_number}`,
        description: `Amount: $${ord.order_amount} (${ord.status})`,
        metadata: ord
      });
    });

    // Sort timeline chronologically
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      contact,
      opportunities,
      orders,
      sessions_count: sessions.length,
      touchpoints_count: touchpoints.length,
      timeline
    };
  }
}

module.exports = { JourneyTracer };
