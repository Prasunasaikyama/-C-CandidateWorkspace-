/**
 * Enterprise Multi-Touch Attribution REST API Server
 * Built with native Node.js HTTP & SQLite (zero external dependencies).
 * Uses modular routes in backend/routes/ and serves embedded Frontend dashboard.
 */

const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');

const { getDb } = require('../database/db');
const { AttributionEngine } = require('./engine/attributionModels');
const { ROICalculator } = require('./engine/roiCalculator');
const { AnomalyDetector } = require('./engine/anomalyDetector');
const { JourneyTracer } = require('./engine/journeyTracer');
const { AppRouter } = require('./routes');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

class Server {
  constructor() {
    this.db = getDb();
    this.attributionEngine = new AttributionEngine();
    this.roiCalculator = new ROICalculator();
    this.anomalyDetector = new AnomalyDetector(this.db);
    this.journeyTracer = new JourneyTracer(this.db);

    // Initialize modular router with injected services context
    this.router = new AppRouter({
      db: this.db,
      attributionEngine: this.attributionEngine,
      roiCalculator: this.roiCalculator,
      anomalyDetector: this.anomalyDetector,
      journeyTracer: this.journeyTracer
    });
  }

  start() {
    const server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    server.listen(PORT, HOST, () => {
      console.log(`================================================================`);
      console.log(`Enterprise Attribution Platform Backend is LIVE`);
      console.log(`URL: http://localhost:${PORT}`);
      console.log(`API Health: http://localhost:${PORT}/api/health`);
      console.log(`Routes: Modular routes active in backend/routes/`);
      console.log(`================================================================`);
    });

    return server;
  }

  sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(data));
  }

  sendError(res, statusCode, message) {
    this.sendJson(res, statusCode, { error: message, timestamp: new Date().toISOString() });
  }

  parseBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (e) {
          reject(e);
        }
      });
      req.on('error', reject);
    });
  }

  async handleRequest(req, res) {
    const parsedUrl = new URL(req.url, 'http://' + (req.headers.host || 'localhost:3000'));
    parsedUrl.query = Object.fromEntries(parsedUrl.searchParams.entries());
    const pathname = parsedUrl.pathname;
    const method = req.method;

    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    try {
      // 1. Dispatch through modular routes in backend/routes/
      const handled = await this.router.dispatch(req, res, parsedUrl, {
        sendJson: this.sendJson.bind(this),
        sendError: this.sendError.bind(this),
        parseBody: this.parseBody.bind(this)
      });

      if (handled) return;

      // 2. Fallback to serving static frontend
      this.serveStatic(req, res, pathname);

    } catch (err) {
      console.error(`[Server Error] ${pathname}:`, err);
      this.sendError(res, 500, err.message);
    }
  }

  // --- Static Frontend Serving ---
  serveStatic(req, res, pathname) {
    let filePath = pathname === '/' ? '/index.html' : pathname;
    const frontendDir = path.join(__dirname, '..', 'frontend');
    const fullPath = path.join(frontendDir, filePath);

    // Path traversal security check
    if (!fullPath.startsWith(frontendDir)) {
      return this.sendError(res, 403, 'Forbidden');
    }

    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
      // Fallback to index.html for Single Page App routing
      const indexPath = path.join(frontendDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        fs.createReadStream(indexPath).pipe(res);
        return;
      }
      return this.sendError(res, 404, 'File not found');
    }

    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png'
    };

    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(fullPath).pipe(res);
  }
}

const serverInstance = new Server();

if (require.main === module) {
  serverInstance.start();
}

module.exports = { Server, serverInstance };
