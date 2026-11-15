/**
 * Enterprise Multi-Touch Attribution SPA Client Application
 * Connects frontend views with backend REST API endpoints.
 */

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

const App = {
  activeTab: 'overview',
  state: {
    summary: null,
    attribution: null,
    anomalies: null,
    campaigns: null,
    schema: null
  },

  init() {
    this.bindEvents();
    this.loadOverview();
    this.loadAnomalies();
  },

  bindEvents() {
    // Navigation tabs
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // Quarantine buttons
    const btnQuarantine = document.getElementById('btn-quarantine-toggle');
    if (btnQuarantine) {
      btnQuarantine.addEventListener('click', () => this.triggerQuarantine());
    }
    const btnTriggerQuarantine = document.getElementById('btn-trigger-quarantine');
    if (btnTriggerQuarantine) {
      btnTriggerQuarantine.addEventListener('click', () => this.triggerQuarantine());
    }

    // Export button
    const btnExport = document.getElementById('btn-export-data');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        window.open('/api/export/ground_truth_anomalies?format=csv', '_blank');
      });
    }

    // Journey search
    const btnJourney = document.getElementById('btn-journey-search');
    if (btnJourney) {
      btnJourney.addEventListener('click', () => this.searchJourney());
    }
    const inputJourney = document.getElementById('journey-search-input');
    if (inputJourney) {
      inputJourney.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.searchJourney();
      });
    }

    // Campaign period filter
    const selectPeriod = document.getElementById('campaign-period-filter');
    if (selectPeriod) {
      selectPeriod.addEventListener('change', () => this.loadCampaigns());
    }
  },

  switchTab(tabId) {
    this.activeTab = tabId;

    // Update active nav button
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // Update active pane
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    const targetPane = document.getElementById(`tab-${tabId}`);
    if (targetPane) targetPane.classList.add('active');

    // Lazy load data for tab
    if (tabId === 'overview') this.loadOverview();
    else if (tabId === 'attribution') this.loadAttributionComparison();
    else if (tabId === 'campaigns') this.loadCampaigns();
    else if (tabId === 'anomalies') this.loadAnomalies();
    else if (tabId === 'dictionary') this.loadDictionary();
  },

  async loadOverview() {
    try {
      const [sumRes, attrRes] = await Promise.all([
        fetch('/api/summary').then(r => r.json()),
        fetch('/api/attribution/compare').then(r => r.json())
      ]);

      this.state.summary = sumRes.kpis;
      this.state.attribution = attrRes;

      // Update KPI Cards
      document.getElementById('kpi-revenue').textContent = `$${(this.state.summary.total_closed_won_revenue).toLocaleString()}`;
      document.getElementById('kpi-opps-won').textContent = `${this.state.summary.opportunities_won} Opportunities Won`;
      document.getElementById('kpi-spend').textContent = `$${(this.state.summary.total_spend).toLocaleString()}`;
      document.getElementById('kpi-roi').textContent = `${this.state.summary.overall_roi_pct}%`;
      document.getElementById('kpi-roas').textContent = `ROAS: ${this.state.summary.overall_roas}x`;
      document.getElementById('kpi-touches').textContent = this.state.summary.total_touchpoints.toLocaleString();
      document.getElementById('kpi-contacts-count').textContent = `Across ${this.state.summary.total_contacts.toLocaleString()} Contacts`;

      // Render Charts
      Charts.renderModelBars('chart-models-bar', attrRes.models);
      Charts.renderChannelBars('chart-channel-roi', attrRes.channel_summary);

      // Render Comparison Matrix Table
      this.renderModelComparisonTable(attrRes.models);

    } catch (err) {
      console.error('Error loading overview:', err);
    }
  },

  renderModelComparisonTable(models) {
    const tbody = document.querySelector('#table-model-comparison tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const descriptions = {
      'First-Touch': '100% credit to the earliest touchpoint in the journey',
      'Last-Touch': '100% credit to the final touchpoint prior to deal conversion',
      'Linear': 'Equal credit divided evenly across all N touchpoints',
      'Time-Decay': 'Exponential decay with 7-day half-life favoring touches closer to close',
      'U-Shaped': 'Position-based: 40% First Touch, 40% Lead/Last Touch, 20% Middle touches'
    };

    models.forEach(m => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 600; color: #f0f4fc;">${m.model_name}</td>
        <td style="color: #8c9cb8; font-family: sans-serif; font-size: 0.8rem;">${descriptions[m.model_name] || ''}</td>
        <td>$${m.total_attributed_revenue.toLocaleString()}</td>
        <td>$${m.total_spend.toLocaleString()}</td>
        <td style="color: ${m.net_profit >= 0 ? '#10b981' : '#f43f5e'};">$${m.net_profit.toLocaleString()}</td>
        <td style="font-weight: 600; color: #06b6d4;">${m.overall_roi_percentage}%</td>
        <td>${m.overall_roas}x</td>
      `;
      tbody.appendChild(tr);
    });
  },

  async loadAttributionComparison() {
    try {
      const res = await fetch('/api/attribution/compare').then(r => r.json());
      const tbody = document.querySelector('#table-channel-matrix tbody');
      if (!tbody) return;
      tbody.innerHTML = '';

      res.channel_summary.forEach(ch => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-weight: 600; color: #f0f4fc;">${ch.channel_name}</td>
          <td><span class="badge ${ch.is_paid ? 'badge-info' : ''}">${ch.category}</span></td>
          <td>$${ch.spend.toLocaleString()}</td>
          <td>$${(ch.models['First-Touch'] || 0).toLocaleString()}</td>
          <td>$${(ch.models['Last-Touch'] || 0).toLocaleString()}</td>
          <td>$${(ch.models['Linear'] || 0).toLocaleString()}</td>
          <td>$${(ch.models['Time-Decay'] || 0).toLocaleString()}</td>
          <td style="font-weight: 600; color: #06b6d4;">$${(ch.models['U-Shaped'] || 0).toLocaleString()}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error('Error loading channel comparison:', err);
    }
  },

  async loadCampaigns() {
    try {
      const period = document.getElementById('campaign-period-filter')?.value || '';
      const url = `/api/campaigns?limit=50${period ? '&period=' + period : ''}`;
      const res = await fetch(url).then(r => r.json());

      const tbody = document.querySelector('#table-campaigns tbody');
      if (!tbody) return;
      tbody.innerHTML = '';

      res.campaigns.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="badge" style="font-family: monospace;">${c.campaign_id}</span></td>
          <td style="font-weight: 500; color: #f0f4fc;">${c.name}</td>
          <td><span class="badge">${c.channel_name.split(' ')[0]}</span></td>
          <td>${c.evaluation_period}</td>
          <td>$${c.budget.toLocaleString()}</td>
          <td>$${c.total_spend.toLocaleString()}</td>
          <td>${c.touch_count}</td>
          <td>$${(c.attributed_revenue['Linear'] || 0).toLocaleString()}</td>
          <td style="color: #06b6d4; font-weight: 600;">$${(c.attributed_revenue['U-Shaped'] || 0).toLocaleString()}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error('Error loading campaigns:', err);
    }
  },

  async loadAnomalies() {
    try {
      const res = await fetch('/api/anomalies').then(r => r.json());
      this.state.anomalies = res;

      // Update counters
      const counterPill = document.getElementById('badge-anomaly-count');
      if (counterPill) counterPill.textContent = res.detected_total;

      document.getElementById('kpi-gt-anomalies').textContent = res.ground_truth_total;
      document.getElementById('kpi-precision').textContent = `${(res.precision * 100).toFixed(1)}%`;
      document.getElementById('kpi-tp-fp').textContent = `True Positives: ${res.true_positives} • False Positives: ${res.false_positives}`;
      document.getElementById('kpi-recall').textContent = `${(res.recall * 100).toFixed(1)}%`;
      document.getElementById('kpi-fn').textContent = `False Negatives: ${res.false_negatives}`;
      document.getElementById('kpi-f1').textContent = res.f1_score.toFixed(3);

      // Render table
      const tbody = document.querySelector('#table-anomalies tbody');
      if (!tbody) return;
      tbody.innerHTML = '';

      res.detected_anomalies.forEach(a => {
        const tr = document.createElement('tr');
        const badgeClass = a.severity === 'Critical' ? 'badge-critical' : (a.severity === 'High' ? 'badge-high' : 'badge-info');
        
        tr.innerHTML = `
          <td style="font-weight: 600;">${a.issue_type}</td>
          <td><span class="badge ${badgeClass}">${a.severity}</span></td>
          <td>${a.entity_type}</td>
          <td><span class="badge" style="font-family: monospace;">${a.entity_id}</span></td>
          <td style="color: #8c9cb8; font-family: sans-serif; font-size: 0.85rem;">${a.description}</td>
          <td>$${a.impact_amount.toLocaleString()}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error('Error loading anomalies:', err);
    }
  },

  async triggerQuarantine() {
    if (!confirm('Execute Quarantine on all detected anomalies? This will isolate duplicate revenue, prune post-conversion touches, and normalize currency mismatches.')) {
      return;
    }

    try {
      const res = await fetch('/api/anomalies/quarantine', { method: 'POST' }).then(r => r.json());
      alert(`Success! ${res.quarantined_records} anomalous records have been quarantined and reconciled.`);
      
      // Refresh current views
      this.loadOverview();
      this.loadAnomalies();
    } catch (err) {
      alert('Error triggering quarantine: ' + err.message);
    }
  },

  async searchJourney() {
    const query = document.getElementById('journey-search-input')?.value.trim();
    const container = document.getElementById('journey-results-container');
    if (!container) return;

    if (!query) {
      // Load top won contact by default for quick demo
      const searchRes = await fetch('/api/journeys?limit=1').then(r => r.json());
      if (searchRes.contacts && searchRes.contacts.length > 0) {
        return this.renderJourneyDetail(searchRes.contacts[0].contact_id);
      }
      return;
    }

    try {
      if (query.startsWith('CON-') || query.startsWith('OPP-')) {
        return this.renderJourneyDetail(query);
      }

      // Search contacts
      const res = await fetch(`/api/journeys?q=${encodeURIComponent(query)}`).then(r => r.json());
      if (!res.contacts || res.contacts.length === 0) {
        container.innerHTML = '<div class="empty-state">No contacts found matching query.</div>';
        return;
      }

      let html = '<div class="card"><div class="card-header"><h3>Select Contact to Inspect</h3></div><div class="table-responsive"><table class="data-table"><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Company</th><th>Touches</th><th>Won Revenue</th><th>Action</th></tr></thead><tbody>';
      res.contacts.forEach(c => {
        html += `
          <tr>
            <td><span class="badge" style="font-family: monospace;">${c.contact_id}</span></td>
            <td style="font-weight: 600; color: #f0f4fc;">${c.full_name}</td>
            <td>${c.email}</td>
            <td>${c.company}</td>
            <td>${c.touches}</td>
            <td style="color: #10b981;">$${(c.revenue || 0).toLocaleString()}</td>
            <td><button class="btn btn-primary" onclick="App.renderJourneyDetail('${c.contact_id}')" style="padding: 4px 10px; font-size: 0.75rem;">View Journey</button></td>
          </tr>
        `;
      });
      html += '</tbody></table></div></div>';
      container.innerHTML = html;

    } catch (err) {
      container.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    }
  },

  async renderJourneyDetail(id) {
    const container = document.getElementById('journey-results-container');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">Loading journey timeline...</div>';

    try {
      const journey = await fetch(`/api/journeys/${id}`).then(r => r.json());
      if (!journey || !journey.contact) {
        container.innerHTML = '<div class="empty-state">Journey record not found.</div>';
        return;
      }

      const c = journey.contact;
      let html = `
        <div class="card">
          <div class="card-header flex-between">
            <div>
              <h3>${c.first_name} ${c.last_name} (${c.company})</h3>
              <p class="text-muted">${c.email} • ${c.job_title} • Lifecycle: <span class="badge badge-info">${c.lifecycle_stage}</span></p>
            </div>
            <div>
              <span class="badge" style="font-family: monospace;">${c.contact_id}</span>
            </div>
          </div>
          <div class="card-body">
            <div style="display: flex; gap: 24px; margin-bottom: 20px;">
              <div><strong>Web Sessions:</strong> ${journey.sessions_count}</div>
              <div><strong>Touchpoints:</strong> ${journey.touchpoints_count}</div>
              <div><strong>Opportunities:</strong> ${journey.opportunities.length}</div>
              <div><strong>Orders:</strong> ${journey.orders.length}</div>
            </div>

            <h4 style="margin-top: 16px; margin-bottom: 8px;">Chronological Multi-Touch Timeline & Attribution Weights</h4>
            <div class="timeline-container">
      `;

      journey.timeline.forEach(event => {
        const isAnomaly = event.issue_flag ? 'anomaly' : '';
        html += `
          <div class="timeline-item ${isAnomaly}">
            <div class="timeline-header">
              <span class="timeline-title">${event.title}</span>
              <span class="timeline-time">${new Date(event.timestamp).toLocaleString()}</span>
            </div>
            <div class="timeline-desc">${event.description}</div>
        `;

        if (event.models) {
          html += '<div class="timeline-weights">';
          Object.keys(event.models).forEach(m => {
            const attr = event.models[m];
            if (attr) {
              html += `<span><strong>${m}:</strong> ${(attr.weight * 100).toFixed(0)}% ($${attr.revenue})</span>`;
            }
          });
          html += '</div>';
        }

        if (event.issue_flag) {
          html += `<div style="margin-top: 8px;"><span class="badge badge-critical">FLAGGED: ${event.issue_flag}</span></div>`;
        }

        html += '</div>';
      });

      html += '</div></div></div>';
      container.innerHTML = html;

    } catch (err) {
      container.innerHTML = `<div class="empty-state">Error loading journey: ${err.message}</div>`;
    }
  },

  async loadDictionary() {
    try {
      const res = await fetch('/api/dictionary').then(r => r.json());
      const container = document.getElementById('dictionary-content');
      if (!container) return;

      let html = '<div style="display: flex; flex-direction: column; gap: 24px;">';
      Object.keys(res.schema).forEach(tableName => {
        const info = res.schema[tableName];
        html += `
          <div style="border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
            <div style="background-color: var(--bg-tertiary); padding: 12px 16px; font-weight: 600; display: flex; justify-content: space-between;">
              <span style="font-family: monospace; color: #06b6d4;">${tableName}</span>
              <span class="badge">${info.row_count} rows</span>
            </div>
            <div class="table-responsive">
              <table class="data-table">
                <thead><tr><th>Column</th><th>Type</th><th>PK</th><th>Nullable</th><th>Default</th></tr></thead>
                <tbody>
        `;
        info.columns.forEach(col => {
          html += `
            <tr>
              <td style="font-weight: 600;">${col.name}</td>
              <td style="color: #8c9cb8;">${col.type}</td>
              <td>${col.pk ? '<span class="badge badge-info">PK</span>' : '—'}</td>
              <td>${col.notnull ? 'No' : 'Yes'}</td>
              <td>${col.dflt_value || '—'}</td>
            </tr>
          `;
        });
        html += '</tbody></table></div></div>';
      });
      html += '</div>';
      container.innerHTML = html;
    } catch (err) {
      console.error('Error loading data dictionary:', err);
    }
  }
};
