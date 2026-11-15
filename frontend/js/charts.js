/**
 * Lightweight SVG Charting Engine for Enterprise Attribution Platform
 * Zero external libraries needed. Pure native SVG.
 */

const Charts = {
  // Render Model Comparison Bar Chart
  renderModelBars(containerId, models) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const width = container.clientWidth || 450;
    const height = container.clientHeight || 260;
    const margin = { top: 20, right: 20, bottom: 40, left: 70 };
    const chartW = width - margin.left - margin.right;
    const chartH = height - margin.top - margin.bottom;

    if (!models || models.length === 0) {
      container.innerHTML = '<div class="empty-state">No model data available</div>';
      return;
    }

    const maxVal = Math.max(...models.map(m => m.total_attributed_revenue || 0), 1000);
    const barWidth = Math.min(48, Math.floor(chartW / models.length - 16));

    let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
    
    // Grid lines
    for (let i = 0; i <= 4; i++) {
      const y = margin.top + (chartH / 4) * i;
      const val = Math.round(maxVal * (1 - i / 4));
      svg += `
        <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3"/>
        <text x="${margin.left - 8}" y="${y + 4}" fill="#8c9cb8" font-size="10" font-family="monospace" text-anchor="end">$${(val / 1000).toFixed(0)}k</text>
      `;
    }

    // Bars
    models.forEach((m, idx) => {
      const x = margin.left + idx * (chartW / models.length) + (chartW / models.length - barWidth) / 2;
      const barH = (m.total_attributed_revenue / maxVal) * chartH;
      const y = margin.top + chartH - barH;

      const colors = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6'];
      const color = colors[idx % colors.length];

      svg += `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4" fill="${color}" opacity="0.85">
          <title>${m.model_name}: $${m.total_attributed_revenue.toLocaleString()} (ROI: ${m.overall_roi_percentage}%)</title>
        </rect>
        <text x="${x + barWidth / 2}" y="${height - margin.bottom + 16}" fill="#8c9cb8" font-size="11" font-family="sans-serif" text-anchor="middle">${m.model_name.replace('-Touch', '')}</text>
      `;
    });

    svg += '</svg>';
    container.innerHTML = svg;
  },

  // Render Channel Spend vs Attributed Revenue
  renderChannelBars(containerId, channels) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const width = container.clientWidth || 450;
    const height = container.clientHeight || 260;
    const margin = { top: 20, right: 20, bottom: 40, left: 70 };
    const chartW = width - margin.left - margin.right;
    const chartH = height - margin.top - margin.bottom;

    if (!channels || channels.length === 0) {
      container.innerHTML = '<div class="empty-state">No channel data available</div>';
      return;
    }

    const filtered = channels.slice(0, 5); // Top 5 channels
    const maxVal = Math.max(
      ...filtered.map(c => Math.max(c.spend || 0, c.models['Linear'] || 0)),
      1000
    );

    const groupW = chartW / filtered.length;
    const barW = Math.min(18, groupW / 2 - 4);

    let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

    // Grid lines
    for (let i = 0; i <= 4; i++) {
      const y = margin.top + (chartH / 4) * i;
      const val = Math.round(maxVal * (1 - i / 4));
      svg += `
        <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3"/>
        <text x="${margin.left - 8}" y="${y + 4}" fill="#8c9cb8" font-size="10" font-family="monospace" text-anchor="end">$${(val / 1000).toFixed(0)}k</text>
      `;
    }

    filtered.forEach((ch, idx) => {
      const groupX = margin.left + idx * groupW + (groupW - barW * 2 - 4) / 2;
      
      // Spend bar (Red/Orange)
      const spendH = ((ch.spend || 0) / maxVal) * chartH;
      const spendY = margin.top + chartH - spendH;
      svg += `
        <rect x="${groupX}" y="${spendY}" width="${barW}" height="${spendH}" rx="3" fill="#f43f5e" opacity="0.8">
          <title>${ch.channel_name} Spend: $${(ch.spend || 0).toLocaleString()}</title>
        </rect>
      `;

      // Linear Revenue bar (Green)
      const rev = ch.models['Linear'] || 0;
      const revH = (rev / maxVal) * chartH;
      const revY = margin.top + chartH - revH;
      svg += `
        <rect x="${groupX + barW + 4}" y="${revY}" width="${barW}" height="${revH}" rx="3" fill="#10b981" opacity="0.85">
          <title>${ch.channel_name} Revenue (Linear): $${rev.toLocaleString()}</title>
        </rect>
      `;

      // Channel label
      const shortName = ch.channel_name.split(' ')[0];
      svg += `
        <text x="${groupX + barW + 2}" y="${height - margin.bottom + 16}" fill="#8c9cb8" font-size="10" font-family="sans-serif" text-anchor="middle">${shortName}</text>
      `;
    });

    // Legend
    svg += `
      <g transform="translate(${width - 150}, 10)">
        <rect x="0" y="0" width="8" height="8" rx="2" fill="#f43f5e"/>
        <text x="12" y="8" fill="#8c9cb8" font-size="10">Spend</text>
        <rect x="60" y="0" width="8" height="8" rx="2" fill="#10b981"/>
        <text x="72" y="8" fill="#8c9cb8" font-size="10">Revenue</text>
      </g>
    `;

    svg += '</svg>';
    container.innerHTML = svg;
  }
};
