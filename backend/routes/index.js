/**
 * Central Router Registry & Dispatcher
 * Aggregates all modular route controllers:
 * - SystemRoutes (/api/health, /api/summary, /api/dictionary)
 * - AttributionRoutes (/api/attribution/compare, /api/attribution/recompute)
 * - CampaignRoutes (/api/campaigns, /api/campaigns/:id)
 * - JourneyRoutes (/api/journeys, /api/journeys/:id)
 * - AnomalyRoutes (/api/anomalies, /api/anomalies/quarantine)
 * - ExportRoutes (/api/export/:table)
 */

const { SystemRoutes } = require('./systemRoutes');
const { AttributionRoutes } = require('./attributionRoutes');
const { CampaignRoutes } = require('./campaignRoutes');
const { JourneyRoutes } = require('./journeyRoutes');
const { AnomalyRoutes } = require('./anomalyRoutes');
const { ExportRoutes } = require('./exportRoutes');

class AppRouter {
  constructor(context) {
    this.systemRoutes = new SystemRoutes(context);
    this.attributionRoutes = new AttributionRoutes(context);
    this.campaignRoutes = new CampaignRoutes(context);
    this.journeyRoutes = new JourneyRoutes(context);
    this.anomalyRoutes = new AnomalyRoutes(context);
    this.exportRoutes = new ExportRoutes(context);
  }

  async dispatch(req, res, parsedUrl, helpers) {
    const pathname = parsedUrl.pathname;
    const method = req.method;
    const query = parsedUrl.query;
    const { sendJson, sendError, parseBody } = helpers;

    // 1. System Routes
    if (pathname === '/api/health' && method === 'GET') {
      this.systemRoutes.handleHealth(req, res, sendJson);
      return true;
    }
    if (pathname === '/api/summary' && method === 'GET') {
      this.systemRoutes.handleSummary(req, res, sendJson);
      return true;
    }
    if (pathname === '/api/dictionary' && method === 'GET') {
      this.systemRoutes.handleDictionary(req, res, sendJson);
      return true;
    }

    // 2. Attribution Routes
    if (pathname === '/api/attribution/compare' && method === 'GET') {
      this.attributionRoutes.handleCompare(req, res, sendJson);
      return true;
    }
    if (pathname === '/api/attribution/recompute' && method === 'POST') {
      await this.attributionRoutes.handleRecompute(req, res, parseBody, sendJson);
      return true;
    }

    // 3. Campaign Routes
    if (pathname === '/api/campaigns' && method === 'GET') {
      this.campaignRoutes.handleList(req, res, query, sendJson);
      return true;
    }
    if (pathname.startsWith('/api/campaigns/') && method === 'GET') {
      const id = pathname.split('/')[3];
      this.campaignRoutes.handleDetail(req, res, id, sendJson, sendError);
      return true;
    }

    // 4. Journey Routes
    if (pathname === '/api/journeys' && method === 'GET') {
      this.journeyRoutes.handleSearch(req, res, query, sendJson);
      return true;
    }
    if (pathname.startsWith('/api/journeys/') && method === 'GET') {
      const id = pathname.split('/')[3];
      this.journeyRoutes.handleDetail(req, res, id, sendJson, sendError);
      return true;
    }

    // 5. Anomaly Routes
    if (pathname === '/api/anomalies' && method === 'GET') {
      this.anomalyRoutes.handleList(req, res, sendJson);
      return true;
    }
    if (pathname === '/api/anomalies/quarantine' && method === 'POST') {
      this.anomalyRoutes.handleQuarantine(req, res, sendJson);
      return true;
    }

    // 6. Export Routes
    if (pathname.startsWith('/api/export/') && method === 'GET') {
      const table = pathname.split('/')[3];
      this.exportRoutes.handleExport(req, res, table, query.format || 'json', sendError);
      return true;
    }

    // Route not handled by API router
    return false;
  }
}

module.exports = { AppRouter };
