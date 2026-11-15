/**
 * Journey Routes: Customer Journey Search and End-to-End Chronological Graph
 */

class JourneyRoutes {
  constructor(context) {
    this.db = context.db;
    this.journeyTracer = context.journeyTracer;
  }

  handleSearch(req, res, query, sendJson) {
    const q = query.q ? `%${query.q.trim()}%` : '%';
    const limit = parseInt(query.limit, 10) || 20;

    const contacts = this.db.all(`
      SELECT 
        c.contact_id,
        c.first_name || ' ' || c.last_name as full_name,
        c.email,
        c.company,
        c.lifecycle_stage,
        (SELECT COUNT(*) FROM touchpoints WHERE contact_id = c.contact_id) as touches,
        (SELECT COUNT(*) FROM opportunities WHERE contact_id = c.contact_id) as opps,
        (SELECT SUM(closed_amount) FROM opportunities WHERE contact_id = c.contact_id AND stage = 'Closed-Won') as revenue
      FROM contacts c
      WHERE c.contact_id LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ? OR c.company LIKE ?
      ORDER BY revenue DESC, touches DESC
      LIMIT ?
    `, [q, q, q, q, q, limit]);

    sendJson(res, 200, { contacts });
  }

  handleDetail(req, res, id, sendJson, sendError) {
    const journey = this.journeyTracer.traceJourney(id);
    if (!journey) return sendError(res, 404, 'Journey entity not found');
    sendJson(res, 200, journey);
  }
}

module.exports = { JourneyRoutes };
