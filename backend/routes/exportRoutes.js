/**
 * Export Routes: Table Data Export in CSV and JSON Formats
 */

class ExportRoutes {
  constructor(context) {
    this.db = context.db;
  }

  handleExport(req, res, table, format, sendError) {
    const validTables = [
      'channels', 'audiences', 'creatives', 'campaigns', 'contacts', 
      'web_sessions', 'touchpoints', 'leads', 'opportunities', 'orders', 
      'cost_records', 'attribution_results', 'identity_bridge', 'ground_truth_anomalies'
    ];

    if (!validTables.includes(table)) {
      return sendError(res, 400, `Invalid table name. Allowed: ${validTables.join(', ')}`);
    }

    const rows = this.db.all(`SELECT * FROM ${table}`);

    if (format === 'csv') {
      res.writeHead(200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${table}.csv"`
      });
      if (rows.length === 0) return res.end('');
      const headers = Object.keys(rows[0]);
      let csv = headers.join(',') + '\n';
      rows.forEach(r => {
        csv += headers.map(h => `"${(`${r[h] || ''}`).replace(/"/g, '""')}"`).join(',') + '\n';
      });
      return res.end(csv);
    }

    // Default JSON
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${table}.json"`
    });
    res.end(JSON.stringify(rows, null, 2));
  }
}

module.exports = { ExportRoutes };
