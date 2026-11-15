/**
 * Anomaly Detection & Data Quarantine Engine
 * Detects 5 enterprise edge cases / negative scenarios:
 * 1. Duplicate Revenue
 * 2. Post-Conversion Touchpoint Attribution
 * 3. Spend Currency Mismatch
 * 4. Omitted Campaign Costs
 * 5. Ghost Anonymous Sessions (Unlinked without evidence)
 * Evaluates detection precision and recall against ground_truth_anomalies.
 */

class AnomalyDetector {
  constructor(db) {
    this.db = db;
  }

  /**
   * Run full detection pipeline across all 5 anomaly categories
   */
  runAllDetections() {
    const detections = [];

    // 1. Duplicate Revenue Detection
    const dupOrders = this.detectDuplicateRevenue();
    detections.push(...dupOrders);

    // 2. Post-Conversion Touchpoints
    const postTouches = this.detectPostConversionTouches();
    detections.push(...postTouches);

    // 3. Spend Currency Mismatch
    const currMismatches = this.detectCurrencyMismatches();
    detections.push(...currMismatches);

    // 4. Omitted Campaign Costs
    const omittedCosts = this.detectOmittedCosts();
    detections.push(...omittedCosts);

    // 5. Ghost Anonymous Sessions
    const ghostSessions = this.detectGhostAnonymousSessions();
    detections.push(...ghostSessions);

    return detections;
  }

  /**
   * 1. Detect Duplicate Revenue
   * Finds opportunities with multiple orders or duplicate order amounts
   */
  detectDuplicateRevenue() {
    const query = `
      SELECT 
        o.opportunity_id,
        o.name AS opportunity_name,
        o.closed_amount,
        COUNT(ord.order_id) AS order_count,
        SUM(ord.order_amount) AS total_order_amount,
        GROUP_CONCAT(ord.order_id) AS order_ids
      FROM opportunities o
      JOIN orders ord ON o.opportunity_id = ord.opportunity_id
      WHERE o.stage = 'Closed-Won'
      GROUP BY o.opportunity_id
      HAVING COUNT(ord.order_id) > 1 AND SUM(ord.order_amount) > o.closed_amount
    `;

    const rows = this.db.all(query);
    return rows.map(r => ({
      issue_type: 'DuplicateRevenue',
      entity_type: 'Opportunity',
      entity_id: r.opportunity_id,
      severity: 'Critical',
      description: `Opportunity has ${r.order_count} orders totaling $${r.total_order_amount}, exceeding closed amount of $${r.closed_amount}`,
      impact_amount: Number((r.total_order_amount - r.closed_amount).toFixed(2)),
      metadata: {
        opportunity_name: r.opportunity_name,
        order_ids: r.order_ids.split(',')
      }
    }));
  }

  /**
   * 2. Detect Post-Conversion Touchpoints
   * Touchpoints occurring after the opportunity closed date
   */
  detectPostConversionTouches() {
    const query = `
      SELECT 
        t.touchpoint_id,
        t.contact_id,
        t.campaign_id,
        t.timestamp AS touchpoint_time,
        o.opportunity_id,
        o.closed_at AS conversion_time,
        o.closed_amount
      FROM touchpoints t
      JOIN opportunities o ON t.contact_id = o.contact_id
      WHERE o.stage = 'Closed-Won' 
        AND o.closed_at IS NOT NULL
        AND datetime(t.timestamp) > datetime(o.closed_at)
    `;

    const rows = this.db.all(query);
    return rows.map(r => ({
      issue_type: 'PostConversionTouch',
      entity_type: 'Touchpoint',
      entity_id: r.touchpoint_id,
      severity: 'High',
      description: `Touchpoint occurred at ${r.touchpoint_time}, which is strictly after opportunity ${r.opportunity_id} closed at ${r.conversion_time}`,
      impact_amount: 0.0,
      metadata: {
        contact_id: r.contact_id,
        opportunity_id: r.opportunity_id,
        campaign_id: r.campaign_id
      }
    }));
  }

  /**
   * 3. Detect Spend Currency Mismatches
   * Cost records where foreign currency was recorded without correct USD normalization
   */
  detectCurrencyMismatches() {
    const query = `
      SELECT 
        c.cost_id,
        c.campaign_id,
        c.cost_date,
        c.amount,
        c.currency,
        c.amount_usd
      FROM cost_records c
      WHERE c.currency != 'USD' AND ABS(c.amount - c.amount_usd) < 0.01
    `;

    const rows = this.db.all(query);
    return rows.map(r => ({
      issue_type: 'CurrencyMismatch',
      entity_type: 'CostRecord',
      entity_id: r.cost_id,
      severity: 'Medium',
      description: `Spend of ${r.amount} ${r.currency} was recorded with un-normalized amount_usd $${r.amount_usd} (1:1 parity bug)`,
      impact_amount: Number(Math.abs(r.amount * 1.08 - r.amount_usd).toFixed(2)),
      metadata: {
        campaign_id: r.campaign_id,
        currency: r.currency,
        raw_amount: r.amount
      }
    }));
  }

  /**
   * 4. Detect Omitted Campaign Costs
   * Paid campaigns with active touchpoints and budget but ZERO cost records
   */
  detectOmittedCosts() {
    const query = `
      SELECT 
        cmp.campaign_id,
        cmp.name,
        cmp.budget,
        COUNT(DISTINCT t.touchpoint_id) AS touch_count
      FROM campaigns cmp
      JOIN channels ch ON cmp.channel_id = ch.channel_id
      JOIN touchpoints t ON cmp.campaign_id = t.campaign_id
      LEFT JOIN cost_records c ON cmp.campaign_id = c.campaign_id
      WHERE ch.is_paid = 1 AND c.cost_id IS NULL
      GROUP BY cmp.campaign_id
      HAVING COUNT(DISTINCT t.touchpoint_id) > 0
    `;

    const rows = this.db.all(query);
    return rows.map(r => ({
      issue_type: 'OmittedCost',
      entity_type: 'Campaign',
      entity_id: r.campaign_id,
      severity: 'Critical',
      description: `Campaign '${r.name}' has ${r.touch_count} active touchpoints and a budget of $${r.budget}, but 0 cost records logged`,
      impact_amount: r.budget,
      metadata: {
        campaign_name: r.name,
        budget: r.budget,
        touch_count: r.touch_count
      }
    }));
  }

  /**
   * 5. Detect Ghost Anonymous Sessions
   * Web sessions linked to a contact without any identity bridge resolution proof
   */
  detectGhostAnonymousSessions() {
    const query = `
      SELECT 
        s.session_id,
        s.anonymous_id,
        s.contact_id,
        s.session_start,
        s.landing_page
      FROM web_sessions s
      WHERE s.contact_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM identity_bridge b 
          WHERE b.anonymous_id = s.anonymous_id AND b.contact_id = s.contact_id
        )
    `;

    const rows = this.db.all(query);
    return rows.map(r => ({
      issue_type: 'GhostAnonymousSession',
      entity_type: 'WebSession',
      entity_id: r.session_id,
      severity: 'High',
      description: `Session ${r.session_id} is linked to contact ${r.contact_id} without any verification proof in identity_bridge`,
      impact_amount: 0.0,
      metadata: {
        anonymous_id: r.anonymous_id,
        contact_id: r.contact_id,
        landing_page: r.landing_page
      }
    }));
  }

  /**
   * Compare detected anomalies against ground_truth_anomalies
   * Calculates precision, recall, and F1 score
   */
  evaluateAgainstGroundTruth() {
    const groundTruth = this.db.all('SELECT * FROM ground_truth_anomalies');
    const detected = this.runAllDetections();

    const gtMap = new Map();
    groundTruth.forEach(gt => {
      gtMap.set(`${gt.issue_type}::${gt.entity_id}`, gt);
    });

    let truePositives = 0;
    let falsePositives = 0;
    const detectedKeys = new Set();

    detected.forEach(d => {
      const key = `${d.issue_type}::${d.entity_id}`;
      detectedKeys.add(key);
      if (gtMap.has(key)) {
        truePositives += 1;
      } else {
        falsePositives += 1;
      }
    });

    let falseNegatives = 0;
    gtMap.forEach((gt, key) => {
      if (!detectedKeys.has(key)) {
        falseNegatives += 1;
      }
    });

    const precision = (truePositives + falsePositives) > 0 
      ? truePositives / (truePositives + falsePositives) 
      : 1.0;
    const recall = (truePositives + falseNegatives) > 0 
      ? truePositives / (truePositives + falseNegatives) 
      : 1.0;
    const f1 = (precision + recall) > 0 
      ? (2 * precision * recall) / (precision + recall) 
      : 0.0;

    return {
      ground_truth_total: groundTruth.length,
      detected_total: detected.length,
      true_positives: truePositives,
      false_positives: falsePositives,
      false_negatives: falseNegatives,
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1_score: Number(f1.toFixed(4)),
      detected_anomalies: detected
    };
  }

  /**
   * Apply Quarantine: Updates database records so dirty data is isolated from clean calculations
   */
  quarantineAnomalies(detectedList) {
    let quarantinedCount = 0;

    this.db.transaction(db => {
      detectedList.forEach(a => {
        if (a.issue_type === 'PostConversionTouch') {
          db.run(`UPDATE touchpoints SET issue_flag = 'PostConversionTouch' WHERE touchpoint_id = ?`, [a.entity_id]);
          db.run(`UPDATE attribution_results SET is_quarantined = 1 WHERE touchpoint_id = ?`, [a.entity_id]);
          quarantinedCount++;
        } else if (a.issue_type === 'DuplicateRevenue') {
          // Keep only the first order, mark others as cancelled
          db.run(`
            UPDATE orders 
            SET status = 'Cancelled' 
            WHERE opportunity_id = ? AND order_id NOT IN (
              SELECT order_id FROM orders WHERE opportunity_id = ? ORDER BY order_id LIMIT 1
            )
          `, [a.entity_id, a.entity_id]);
          quarantinedCount++;
        } else if (a.issue_type === 'CurrencyMismatch') {
          // Correct amount_usd to normalized rate (e.g. EUR * 1.08)
          db.run(`UPDATE cost_records SET amount_usd = ROUND(amount * 1.08, 2) WHERE cost_id = ?`, [a.entity_id]);
          quarantinedCount++;
        }
      });
    });

    return { quarantinedCount };
  }
}

module.exports = { AnomalyDetector };
