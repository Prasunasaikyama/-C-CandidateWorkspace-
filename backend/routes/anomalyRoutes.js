/**
 * Anomaly Routes: Edge-Case Detection, Ground Truth Precision/Recall, and Quarantine
 */

class AnomalyRoutes {
  constructor(context) {
    this.anomalyDetector = context.anomalyDetector;
  }

  handleList(req, res, sendJson) {
    const evaluation = this.anomalyDetector.evaluateAgainstGroundTruth();
    sendJson(res, 200, evaluation);
  }

  handleQuarantine(req, res, sendJson) {
    const detected = this.anomalyDetector.runAllDetections();
    const result = this.anomalyDetector.quarantineAnomalies(detected);
    sendJson(res, 200, {
      message: 'Anomalies successfully quarantined.',
      quarantined_records: result.quarantinedCount,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = { AnomalyRoutes };
