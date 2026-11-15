/**
 * Database Seeder CLI
 * Executes schema creation, synthetic data generation, database insertion,
 * and exports ground truth and seed files.
 */

const fs = require('fs');
const path = require('path');
const { getDb } = require('./db');
const { DataGenerator } = require('./generator');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    scale: 'starter',
    seed: 20261022,
    dbPath: path.join(__dirname, 'attribution.db')
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--scale' && args[i + 1]) {
      options.scale = args[i + 1];
      i++;
    } else if (args[i] === '--seed' && args[i + 1]) {
      options.seed = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--db' && args[i + 1]) {
      options.dbPath = args[i + 1];
      i++;
    }
  }

  return options;
}

function runSeed() {
  const options = parseArgs();
  console.log(`================================================================`);
  console.log(`Enterprise Attribution Platform - Database Seeder`);
  console.log(`Scale: ${options.scale} | Seed: ${options.seed} | Target DB: ${options.dbPath}`);
  console.log(`================================================================`);

  const db = getDb(options.dbPath);

  // 1. Initialize Schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  console.log(`[Seed] Applying schema DDL from ${schemaPath}...`);
  db.exec(schemaSql);
  console.log(`[Seed] Schema tables and indices created successfully.`);

  // 2. Generate Synthetic Data
  const generator = new DataGenerator({
    scale: options.scale,
    seed: options.seed
  });
  const data = generator.generate();

  // 3. Batch Insert into Database
  console.log(`[Seed] Beginning database transaction for bulk insertion...`);
  const t0 = Date.now();

  db.transaction(conn => {
    // 1. Channels
    const stmtCh = conn.prepare(`INSERT INTO channels VALUES (?, ?, ?, ?, ?)`);
    data.channels.forEach(c => stmtCh.run(c.channel_id, c.name, c.category, c.is_paid, c.cost_model));

    // 2. Audiences
    const stmtAud = conn.prepare(`INSERT INTO audiences VALUES (?, ?, ?, ?, ?, ?)`);
    data.audiences.forEach(a => stmtAud.run(a.audience_id, a.name, a.segment, a.target_industry, a.estimated_size, a.created_at));

    // 3. Creatives
    const stmtCrt = conn.prepare(`INSERT INTO creatives VALUES (?, ?, ?, ?, ?, ?)`);
    data.creatives.forEach(c => stmtCrt.run(c.creative_id, c.name, c.format, c.message_theme, c.destination_url, c.created_at));

    // 4. Campaigns
    const stmtCmp = conn.prepare(`INSERT INTO campaigns VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    data.campaigns.forEach(c => stmtCmp.run(c.campaign_id, c.name, c.channel_id, c.creative_id, c.audience_id, c.budget, c.currency, c.start_date, c.end_date, c.status, c.evaluation_period));

    // 5. Contacts
    const stmtCon = conn.prepare(`INSERT INTO contacts VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    data.contacts.forEach(c => stmtCon.run(c.contact_id, c.first_name, c.last_name, c.email, c.company, c.job_title, c.lifecycle_stage, c.created_at));

    // 6. Web Sessions
    const stmtSes = conn.prepare(`INSERT INTO web_sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    data.web_sessions.forEach(s => stmtSes.run(s.session_id, s.anonymous_id, s.contact_id, s.landing_page, s.referrer, s.utm_source, s.utm_medium, s.utm_campaign, s.session_start, s.session_end, s.page_views, s.device_type));

    // 7. Touchpoints
    const stmtTp = conn.prepare(`INSERT INTO touchpoints VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    data.touchpoints.forEach(t => stmtTp.run(t.touchpoint_id, t.contact_id, t.campaign_id, t.session_id, t.channel_id, t.touchpoint_type, t.timestamp, t.cost_allocated, t.is_offline, t.issue_flag));

    // 8. Leads
    const stmtLead = conn.prepare(`INSERT INTO leads VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    data.leads.forEach(l => stmtLead.run(l.lead_id, l.contact_id, l.campaign_id, l.lead_source, l.lead_score, l.lead_status, l.converted_date, l.created_at));

    // 9. Opportunities
    const stmtOpp = conn.prepare(`INSERT INTO opportunities VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    data.opportunities.forEach(o => stmtOpp.run(o.opportunity_id, o.contact_id, o.lead_id, o.name, o.stage, o.pipeline_amount, o.probability, o.closed_amount, o.win_loss_reason, o.created_at, o.closed_at));

    // 10. Orders
    const stmtOrd = conn.prepare(`INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    data.orders.forEach(o => stmtOrd.run(o.order_id, o.opportunity_id, o.contact_id, o.order_number, o.order_amount, o.currency, o.order_date, o.status));

    // 11. Cost Records
    const stmtCst = conn.prepare(`INSERT INTO cost_records VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    data.cost_records.forEach(c => stmtCst.run(c.cost_id, c.campaign_id, c.channel_id, c.cost_date, c.amount, c.currency, c.amount_usd, c.spend_type));

    // 12. Attribution Results
    const stmtAtt = conn.prepare(`INSERT INTO attribution_results VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    data.attribution_results.forEach(a => stmtAtt.run(a.attribution_id, a.opportunity_id, a.touchpoint_id, a.campaign_id, a.channel_id, a.model_name, a.attribution_weight, a.attributed_revenue, a.calculation_timestamp, a.evaluation_period, a.is_quarantined));

    // 13. Identity Bridge
    const stmtIdb = conn.prepare(`INSERT INTO identity_bridge VALUES (?, ?, ?, ?, ?, ?)`);
    data.identity_bridge.forEach(b => stmtIdb.run(b.bridge_id, b.anonymous_id, b.contact_id, b.resolved_at, b.confidence_score, b.resolution_method));

    // 14. Ground Truth Anomalies
    const stmtAno = conn.prepare(`INSERT INTO ground_truth_anomalies VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    data.ground_truth_anomalies.forEach(g => stmtAno.run(g.anomaly_id, g.issue_type, g.entity_type, g.entity_id, g.description, g.injected_rule, g.expected_detection, g.impact_amount, g.severity, g.quarantine_status));
  });

  const durationSec = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`[Seed] Successfully inserted all records in ${durationSec}s.`);

  // 4. Export ground truth files
  exportGroundTruth(data.ground_truth_anomalies);

  console.log(`[Seed] Seed process completed cleanly.`);
  return data;
}

function exportGroundTruth(anomalies) {
  const csvDir = path.join(__dirname, '..', 'data', 'csv');
  const jsonDir = path.join(__dirname, '..', 'data', 'json');

  if (!fs.existsSync(csvDir)) fs.mkdirSync(csvDir, { recursive: true });
  if (!fs.existsSync(jsonDir)) fs.mkdirSync(jsonDir, { recursive: true });

  // JSON export
  const jsonPath = path.join(jsonDir, 'ground_truth.json');
  fs.writeFileSync(jsonPath, JSON.stringify(anomalies, null, 2), 'utf8');

  // CSV export
  const csvPath = path.join(csvDir, 'ground_truth.csv');
  const headers = ['anomaly_id', 'issue_type', 'entity_type', 'entity_id', 'description', 'injected_rule', 'expected_detection', 'impact_amount', 'severity', 'quarantine_status'];
  const csvRows = [headers.join(',')];

  anomalies.forEach(a => {
    const row = headers.map(h => {
      const val = (a[h] !== null && a[h] !== undefined) ? `${a[h]}` : '';
      return `"${val.replace(/"/g, '""')}"`;
    });
    csvRows.push(row.join(','));
  });

  fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf8');
  console.log(`[Export] Ground truth exported to:`);
  console.log(`  - ${jsonPath}`);
  console.log(`  - ${csvPath}`);
}

if (require.main === module) {
  runSeed();
}

module.exports = { runSeed };
