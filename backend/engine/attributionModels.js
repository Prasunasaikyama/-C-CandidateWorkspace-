/**
 * Attribution Engine - Multi-Model Implementation
 * Supports: First-Touch, Last-Touch, Linear, Time-Decay, U-Shaped (Position-Based)
 * Enforces temporal validity, lookback window pruning, and exact revenue reconciliation.
 */

class AttributionEngine {
  constructor(config = {}) {
    this.defaultLookbackDays = config.defaultLookbackDays || 90;
    this.halfLifeDays = config.timeDecayHalfLifeDays || 7;
    this.uShapedWeights = config.uShaped || {
      firstTouchWeight: 0.40,
      lastTouchWeight: 0.40,
      middleTouchWeight: 0.20
    };
  }

  /**
   * Filter touchpoints by temporal validity and lookback window
   * @param {Array} touchpoints - All chronological touchpoints for a contact/opp
   * @param {string|Date} conversionDate - The opportunity close or conversion date
   * @param {number} lookbackDays - Maximum allowable days before conversion
   * @param {boolean} quarantineAnomalies - If true, drop post-conversion or flagged touches
   */
  filterValidTouchpoints(touchpoints, conversionDate, lookbackDays = this.defaultLookbackDays, quarantineAnomalies = false) {
    if (!touchpoints || touchpoints.length === 0) return [];

    const convTime = new Date(conversionDate).getTime();
    const lookbackMs = lookbackDays * 24 * 60 * 60 * 1000;
    const minTime = convTime - lookbackMs;

    return touchpoints.filter(tp => {
      const tpTime = new Date(tp.timestamp).getTime();
      
      // Anomaly quarantine check
      if (quarantineAnomalies && tp.issue_flag === 'PostConversionTouch') {
        return false;
      }
      
      // Strict temporal check: Touchpoint must happen before or at conversion
      if (tpTime > convTime) {
        return false;
      }

      // Lookback window check
      if (tpTime < minTime) {
        return false;
      }

      return true;
    }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  /**
   * Calculate First-Touch Attribution
   * 100% credit to the earliest touchpoint
   */
  calculateFirstTouch(touchpoints, revenue) {
    if (!touchpoints || touchpoints.length === 0) return [];
    
    return touchpoints.map((tp, idx) => {
      const weight = idx === 0 ? 1.0 : 0.0;
      return {
        touchpoint_id: tp.touchpoint_id,
        campaign_id: tp.campaign_id,
        channel_id: tp.channel_id,
        model_name: 'First-Touch',
        attribution_weight: weight,
        attributed_revenue: Number((revenue * weight).toFixed(2))
      };
    });
  }

  /**
   * Calculate Last-Touch Attribution
   * 100% credit to the latest touchpoint prior to conversion
   */
  calculateLastTouch(touchpoints, revenue) {
    if (!touchpoints || touchpoints.length === 0) return [];
    
    const lastIdx = touchpoints.length - 1;
    return touchpoints.map((tp, idx) => {
      const weight = idx === lastIdx ? 1.0 : 0.0;
      return {
        touchpoint_id: tp.touchpoint_id,
        campaign_id: tp.campaign_id,
        channel_id: tp.channel_id,
        model_name: 'Last-Touch',
        attribution_weight: weight,
        attributed_revenue: Number((revenue * weight).toFixed(2))
      };
    });
  }

  /**
   * Calculate Linear Attribution
   * Equal credit across all N touchpoints
   */
  calculateLinear(touchpoints, revenue) {
    if (!touchpoints || touchpoints.length === 0) return [];
    
    const n = touchpoints.length;
    const baseWeight = 1.0 / n;
    
    let allocated = 0;
    const results = touchpoints.map((tp, idx) => {
      // Reconcile rounding pennies on final touchpoint
      let rev = Number((revenue * baseWeight).toFixed(2));
      if (idx === n - 1) {
        rev = Number((revenue - allocated).toFixed(2));
      } else {
        allocated += rev;
      }

      return {
        touchpoint_id: tp.touchpoint_id,
        campaign_id: tp.campaign_id,
        channel_id: tp.channel_id,
        model_name: 'Linear',
        attribution_weight: Number(baseWeight.toFixed(4)),
        attributed_revenue: rev
      };
    });

    return results;
  }

  /**
   * Calculate Time-Decay Attribution
   * Exponential decay: weight = 2 ^ (- (convTime - tpTime) / halfLife)
   */
  calculateTimeDecay(touchpoints, revenue, conversionDate) {
    if (!touchpoints || touchpoints.length === 0) return [];

    const convTime = new Date(conversionDate).getTime();
    const halfLifeMs = this.halfLifeDays * 24 * 60 * 60 * 1000;

    const rawWeights = touchpoints.map(tp => {
      const diffMs = Math.max(0, convTime - new Date(tp.timestamp).getTime());
      return Math.pow(2, -diffMs / halfLifeMs);
    });

    const totalRaw = rawWeights.reduce((sum, w) => sum + w, 0);

    let allocated = 0;
    const n = touchpoints.length;

    return touchpoints.map((tp, idx) => {
      const normalizedWeight = rawWeights[idx] / totalRaw;
      let rev = Number((revenue * normalizedWeight).toFixed(2));
      
      if (idx === n - 1) {
        rev = Number((revenue - allocated).toFixed(2));
      } else {
        allocated += rev;
      }

      return {
        touchpoint_id: tp.touchpoint_id,
        campaign_id: tp.campaign_id,
        channel_id: tp.channel_id,
        model_name: 'Time-Decay',
        attribution_weight: Number(normalizedWeight.toFixed(4)),
        attributed_revenue: rev
      };
    });
  }

  /**
   * Calculate U-Shaped (Position-Based) Attribution
   * 40% First Touch, 40% Last Touch, 20% distributed equally to middle touches
   */
  calculateUShaped(touchpoints, revenue) {
    if (!touchpoints || touchpoints.length === 0) return [];
    
    const n = touchpoints.length;
    let weights = [];

    if (n === 1) {
      weights = [1.0];
    } else if (n === 2) {
      weights = [0.5, 0.5];
    } else {
      const firstW = this.uShapedWeights.firstTouchWeight; // 0.40
      const lastW = this.uShapedWeights.lastTouchWeight;   // 0.40
      const middleShare = this.uShapedWeights.middleTouchWeight / (n - 2); // 0.20 / (n - 2)
      
      weights = touchpoints.map((_, idx) => {
        if (idx === 0) return firstW;
        if (idx === n - 1) return lastW;
        return middleShare;
      });
    }

    let allocated = 0;
    return touchpoints.map((tp, idx) => {
      const weight = weights[idx];
      let rev = Number((revenue * weight).toFixed(2));
      
      if (idx === n - 1) {
        rev = Number((revenue - allocated).toFixed(2));
      } else {
        allocated += rev;
      }

      return {
        touchpoint_id: tp.touchpoint_id,
        campaign_id: tp.campaign_id,
        channel_id: tp.channel_id,
        model_name: 'U-Shaped',
        attribution_weight: Number(weight.toFixed(4)),
        attributed_revenue: rev
      };
    });
  }

  /**
   * Compute all 5 attribution models for an opportunity's journey
   */
  computeAllModels(opportunity, touchpoints, quarantineAnomalies = false) {
    const revenue = opportunity.closed_amount || opportunity.pipeline_amount || 0;
    const conversionDate = opportunity.closed_at || opportunity.created_at;

    const validTouches = this.filterValidTouchpoints(touchpoints, conversionDate, this.defaultLookbackDays, quarantineAnomalies);
    
    if (validTouches.length === 0) {
      return {
        opportunity_id: opportunity.opportunity_id,
        validTouchCount: 0,
        models: {}
      };
    }

    return {
      opportunity_id: opportunity.opportunity_id,
      revenue,
      validTouchCount: validTouches.length,
      models: {
        'First-Touch': this.calculateFirstTouch(validTouches, revenue),
        'Last-Touch': this.calculateLastTouch(validTouches, revenue),
        'Linear': this.calculateLinear(validTouches, revenue),
        'Time-Decay': this.calculateTimeDecay(validTouches, revenue, conversionDate),
        'U-Shaped': this.calculateUShaped(validTouches, revenue)
      }
    };
  }
}

module.exports = { AttributionEngine };
