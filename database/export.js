/**
 * Seed Data and Manifest Exporter
 * Exports all database tables to CSV and JSON formats and generates source manifest.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getDb } = require('./db');

function exportAll() {
  const db = getDb();
  const csvDir = path.join(__dirname, '..', 'data', 'csv');
  const jsonDir = path.join(__dirname, '..', 'data', 'json');

  if (!fs.existsSync(csvDir)) fs.mkdirSync(csvDir, { recursive: true });
  if (!fs.existsSync(jsonDir)) fs.mkdirSync(jsonDir, { recursive: true });

  const tables = [
    'channels',
    'audiences',
    'creatives',
    'campaigns',
    'contacts',
    'web_sessions',
    'touchpoints',
    'leads',
    'opportunities',
    'orders',
    'cost_records',
    'attribution_results',
    'identity_bridge',
    'ground_truth_anomalies'
  ];

  console.log(`[Export] Starting export of ${tables.length} tables...`);
  const manifest = {
    generated_at: new Date().toISOString(),
    environment: 'Windows CandidateWorkspace',
    tables: {}
  };

  tables.forEach(tableName => {
    const rows = db.all(`SELECT * FROM ${tableName}`);
    
    // JSON export
    const jsonPath = path.join(jsonDir, `${tableName}.json`);
    const jsonContent = JSON.stringify(rows, null, 2);
    fs.writeFileSync(jsonPath, jsonContent, 'utf8');

    // CSV export
    const csvPath = path.join(csvDir, `${tableName}.csv`);
    let csvContent = '';
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      csvContent += headers.join(',') + '\n';
      rows.forEach(r => {
        const line = headers.map(h => {
          const val = (r[h] !== null && r[h] !== undefined) ? `${r[h]}` : '';
          return `"${val.replace(/"/g, '""')}"`;
        }).join(',');
        csvContent += line + '\n';
      });
    }
    fs.writeFileSync(csvPath, csvContent, 'utf8');

    // Calculate SHA256 checksums
    const jsonHash = crypto.createHash('sha256').update(jsonContent).digest('hex');
    const csvHash = crypto.createHash('sha256').update(csvContent).digest('hex');

    manifest.tables[tableName] = {
      row_count: rows.length,
      json_file: `${tableName}.json`,
      json_sha256: jsonHash,
      csv_file: `${tableName}.csv`,
      csv_sha256: csvHash
    };

    console.log(`  Exported ${tableName.padEnd(24)}: ${rows.length.toString().padStart(6)} rows [SHA256: ${csvHash.slice(0, 10)}...]`);
  });

  const manifestPath = path.join(__dirname, '..', 'data', 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`[Export] Manifest generated at ${manifestPath}`);
  return manifest;
}

if (require.main === module) {
  exportAll();
}

module.exports = { exportAll };
