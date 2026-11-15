/**
 * Enterprise Multi-Touch Attribution & Synthetic Data Generator
 * Granular, fully deterministic, seedable PRNG (Mulberry32).
 * Conforms strictly to Step 1 - Step 7 of the problem statement.
 */

const fs = require('fs');
const path = require('path');
const { PRNG } = require('../backend/engine/prng');
const { AttributionEngine } = require('../backend/engine/attributionModels');

class DataGenerator {
  constructor(config = {}) {
    this.seed = config.seed || 20261022;
    this.scale = config.scale || 'starter';
    this.prng = new PRNG(this.seed);
    this.attributionEngine = new AttributionEngine();

    // Scale targets
    const scales = {
      starter: {
        campaigns: 50,
        contacts: 5000,
        touchpoints: 20000,
        opportunities: 1000,
        anomaliesTarget: 25
      },
      full: {
        campaigns: 500,
        contacts: 50000,
        touchpoints: 200000,
        opportunities: 10000,
        anomaliesTarget: 250
      }
    };

    this.targets = scales[this.scale] || scales.starter;

    // Entity stores
    this.channels = [];
    this.audiences = [];
    this.creatives = [];
    this.campaigns = [];
    this.contacts = [];
    this.webSessions = [];
    this.touchpoints = [];
    this.leads = [];
    this.opportunities = [];
    this.orders = [];
    this.costRecords = [];
    this.attributionResults = [];
    this.identityBridges = [];
    this.groundTruthAnomalies = [];
  }

  generate() {
    this.prng.reset();
    console.log(`[Generator] Initializing synthetic generation (Seed: ${this.seed}, Scale: ${this.scale})...`);

    // Step 1 & 2: Generate Master/Parent Entities First
    this.generateChannels();
    this.generateAudiences();
    this.generateCreatives();
    this.generateCampaigns();
    this.generateContacts();

    // Generate Dependent Transaction/Event Entities
    this.generateWebSessionsAndTouches();
    this.generateLeadsAndOpportunities();
    this.generateOrders();
    this.generateCostRecords();

    // Step 5: Inject Labelled Edge Cases & Anomalies
    this.injectAnomalies();

    // Compute Derived Attribution Results for all Won Opportunities
    this.generateAttributionResults();

    console.log(`[Generator] Generation complete.`);
    console.log(`  Campaigns:       ${this.campaigns.length}`);
    console.log(`  Contacts:        ${this.contacts.length}`);
    console.log(`  Web Sessions:    ${this.webSessions.length}`);
    console.log(`  Touchpoints:     ${this.touchpoints.length}`);
    console.log(`  Leads:           ${this.leads.length}`);
    console.log(`  Opportunities:   ${this.opportunities.length}`);
    console.log(`  Orders:          ${this.orders.length}`);
    console.log(`  Cost Records:    ${this.costRecords.length}`);
    console.log(`  Attribution Rows:${this.attributionResults.length}`);
    console.log(`  Anomalies:       ${this.groundTruthAnomalies.length}`);

    return {
      channels: this.channels,
      audiences: this.audiences,
      creatives: this.creatives,
      campaigns: this.campaigns,
      contacts: this.contacts,
      web_sessions: this.webSessions,
      touchpoints: this.touchpoints,
      leads: this.leads,
      opportunities: this.opportunities,
      orders: this.orders,
      cost_records: this.costRecords,
      attribution_results: this.attributionResults,
      identity_bridge: this.identityBridges,
      ground_truth_anomalies: this.groundTruthAnomalies
    };
  }

  generateChannels() {
    this.channels = [
      { channel_id: 'CHN-001', name: 'Google Paid Search', category: 'Paid Search', is_paid: 1, cost_model: 'CPC' },
      { channel_id: 'CHN-002', name: 'LinkedIn Sponsored Content', category: 'Paid Social', is_paid: 1, cost_model: 'CPC' },
      { channel_id: 'CHN-003', name: 'Organic Search (SEO)', category: 'Organic Search', is_paid: 0, cost_model: 'None' },
      { channel_id: 'CHN-004', name: 'Nurture & Outbound Email', category: 'Email Marketing', is_paid: 0, cost_model: 'None' },
      { channel_id: 'CHN-005', name: 'Programmatic Display & ABM', category: 'Display Ads', is_paid: 1, cost_model: 'CPM' },
      { channel_id: 'CHN-006', name: 'Industry Summits & Field Events', category: 'Events & Field', is_paid: 1, cost_model: 'Fixed' },
      { channel_id: 'CHN-007', name: 'Direct Traffic & Referral', category: 'Direct / Referral', is_paid: 0, cost_model: 'None' }
    ];
  }

  generateAudiences() {
    const segments = [
      { name: 'Enterprise IT Leaders', segment: 'Enterprise (1000+)', ind: 'Information Technology', size: 45000 },
      { name: 'Mid-Market Marketing VPs', segment: 'Mid-Market (250-999)', ind: 'Software & SaaS', size: 32000 },
      { name: 'Fintech Security Officers', segment: 'Financial Services', ind: 'Banking & Fintech', size: 18000 },
      { name: 'Healthcare Operations Execs', segment: 'Healthcare Systems', ind: 'Healthcare', size: 28000 },
      { name: 'Retail Omnichannel Directors', segment: 'Retail & eCommerce', ind: 'Consumer Goods', size: 24000 }
    ];

    this.audiences = segments.map((s, idx) => ({
      audience_id: `AUD-2026-${this.prng.pad(idx + 1, 4)}`,
      name: s.name,
      segment: s.segment,
      target_industry: s.ind,
      estimated_size: s.size,
      created_at: '2026-01-01T00:00:00Z'
    }));
  }

  generateCreatives() {
    const themes = [
      { name: 'Cloud Migration ROI Calculator', format: 'Banner', theme: 'Cost Savings', url: '/tools/cloud-roi' },
      { name: 'Automated Compliance Whitepaper', format: 'Whitepaper', theme: 'Risk & Governance', url: '/resources/compliance-guide' },
      { name: 'Zero Trust Demo Video', format: 'Video', theme: 'Cybersecurity', url: '/demo/zero-trust' },
      { name: 'Fintech Scale Case Study', format: 'Case Study', theme: 'Customer Proof', url: '/customers/fintech-scale' },
      { name: 'Next-Gen Analytics Webinar Deck', format: 'Webinar Deck', theme: 'Product Innovation', url: '/events/analytics-future' },
      { name: 'High-Intent Search Ad Headline', format: 'Search Ad', theme: 'Feature Comparison', url: '/compare/enterprise-hub' }
    ];

    this.creatives = themes.map((t, idx) => ({
      creative_id: `CRT-2026-${this.prng.pad(idx + 1, 4)}`,
      name: t.name,
      format: t.format,
      message_theme: t.theme,
      destination_url: t.url,
      created_at: '2026-01-01T00:00:00Z'
    }));
  }

  generateCampaigns() {
    const periods = ['Q1-2026', 'Q2-2026', 'Q3-2026', 'Q4-2026'];
    const periodDates = {
      'Q1-2026': { start: '2026-01-01', end: '2026-03-31' },
      'Q2-2026': { start: '2026-04-01', end: '2026-06-30' },
      'Q3-2026': { start: '2026-07-01', end: '2026-09-30' },
      'Q4-2026': { start: '2026-10-01', end: '2026-12-31' }
    };

    const campaignTypes = [
      'Demand Gen Acceleration', 'Brand Authority Drive', 'Executive Roundtable', 
      'Competitor Conquesting', 'Mid-Funnel Product Walkthrough', 'Retargeting Blitz',
      'Q4 Pipeline Accelerator', 'Strategic Key Account Push'
    ];

    this.campaigns = [];
    for (let i = 1; i <= this.targets.campaigns; i++) {
      const channel = this.prng.pick(this.channels);
      const creative = this.prng.pick(this.creatives);
      const audience = this.prng.pick(this.audiences);
      const period = periods[(i - 1) % 4];
      const dates = periodDates[period];
      
      const budget = channel.is_paid 
        ? this.prng.nextInt(5, 50) * 1000 
        : this.prng.nextInt(1, 5) * 1000;

      const campaignName = `${channel.name.split(' ')[0]} - ${this.prng.pick(campaignTypes)} - #${i}`;

      this.campaigns.push({
        campaign_id: `CMP-2026-${this.prng.pad(i, 6)}`,
        name: campaignName,
        channel_id: channel.channel_id,
        creative_id: creative.creative_id,
        audience_id: audience.audience_id,
        budget: budget,
        currency: 'USD',
        start_date: dates.start,
        end_date: dates.end,
        status: period === 'Q4-2026' ? 'Active' : 'Completed',
        evaluation_period: period
      });
    }
  }

  generateContacts() {
    const firstNames = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'];
    const companies = ['Apex Global', 'Vanguard Dynamics', 'Summit Cloud', 'Horizon FinServ', 'Beacon Health', 'NovaTech Systems', 'Starlight Capital', 'Meridian Logistics', 'Pinnacle Retail', 'Aegis Security', 'CyberCore Inc', 'Krypton Labs', 'OmniCorp Global', 'Crestview Media', 'Nexus Enterprise'];
    const titles = ['VP of Engineering', 'Chief Information Officer', 'Director of Infrastructure', 'Head of Marketing', 'Security Architect', 'Lead DevOps Engineer', 'Procurement Director', 'VP of Sales Operations', 'VP Product Management'];

    this.contacts = [];
    for (let i = 1; i <= this.targets.contacts; i++) {
      const fn = this.prng.pick(firstNames);
      const ln = this.prng.pick(lastNames);
      const comp = this.prng.pick(companies);
      const title = this.prng.pick(titles);
      const cleanComp = comp.toLowerCase().replace(/[^a-z]/g, '');
      const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@${cleanComp}.com`;
      
      // Distributed registration across 2026
      const month = this.prng.nextInt(1, 10);
      const day = this.prng.nextInt(1, 28);
      const hour = this.prng.nextInt(8, 18);
      const minute = this.prng.nextInt(0, 59);
      const createdAt = `2026-${this.prng.pad(month, 2)}-${this.prng.pad(day, 2)}T${this.prng.pad(hour, 2)}:${this.prng.pad(minute, 2)}:00Z`;

      this.contacts.push({
        contact_id: `CON-2026-${this.prng.pad(i, 6)}`,
        first_name: fn,
        last_name: ln,
        email: email,
        company: comp,
        job_title: title,
        lifecycle_stage: 'Prospect',
        created_at: createdAt
      });
    }
  }

  generateWebSessionsAndTouches() {
    this.webSessions = [];
    this.touchpoints = [];
    this.identityBridges = [];
    this.touchesByContact = new Map();

    const touchTypes = [
      'Paid Search Click', 'Social Ad Click', 'Organic Visit', 
      'Marketing Email Open', 'Webinar Attendance', 'Demo Request', 
      'Whitepaper Download', 'Tradeshow Booth Visit', 'Executive Dinner'
    ];
    const devices = ['Desktop', 'Mobile', 'Tablet'];
    const landingPages = ['/home', '/pricing', '/product/cloud-platform', '/features/security', '/resources/whitepaper', '/demo-request'];

    let sessionCounter = 1;
    let touchCounter = 1;
    let bridgeCounter = 1;

    // We distribute touchpoints across contacts.
    // Converted contacts get multi-touch journeys (2 to 7 touches).
    const avgTouchesPerContact = Math.max(1, Math.floor(this.targets.touchpoints / this.targets.contacts));

    this.contacts.forEach((contact, cIdx) => {
      // Determine touch count for this contact
      const isOpportunityCandidate = cIdx < this.targets.opportunities;
      const numTouches = isOpportunityCandidate 
        ? this.prng.nextInt(4, 8) // Multi-campaign multi-touch journey
        : this.prng.nextInt(3, 4);

      const contactStart = new Date(contact.created_at).getTime();
      let lastTouchTime = contactStart;

      for (let t = 0; t < numTouches; t++) {
        // Forward time increments: conversion windows (1 to 30 days per step)
        const daysGap = this.prng.nextInt(1, 25);
        const hoursGap = this.prng.nextInt(1, 23);
        lastTouchTime += (daysGap * 24 + hoursGap) * 3600 * 1000;
        const touchIso = new Date(lastTouchTime).toISOString();

        // Match with a campaign active during that period
        const campaign = this.prng.pick(this.campaigns);
        const channel = this.channels.find(ch => ch.channel_id === campaign.channel_id) || this.channels[0];
        const isOffline = channel.category === 'Events & Field' || this.prng.chance(0.08);

        let sessionId = null;
        const anonymousId = `anon_${contact.contact_id.slice(-6)}_${this.prng.pad(t + 1, 3)}`;

        if (!isOffline) {
          sessionId = `SES-2026-${this.prng.pad(sessionCounter++, 6)}`;
          const sessionEnd = new Date(lastTouchTime + this.prng.nextInt(3, 45) * 60 * 1000).toISOString();
          
          this.webSessions.push({
            session_id: sessionId,
            anonymous_id: anonymousId,
            contact_id: contact.contact_id,
            landing_page: this.prng.pick(landingPages),
            referrer: channel.category === 'Paid Search' ? 'https://google.com' : (channel.category === 'Paid Social' ? 'https://linkedin.com' : 'https://direct'),
            utm_source: channel.name.toLowerCase().replace(/\s+/g, '_'),
            utm_medium: channel.cost_model.toLowerCase(),
            utm_campaign: campaign.name.toLowerCase().replace(/\s+/g, '_'),
            session_start: touchIso,
            session_end: sessionEnd,
            page_views: this.prng.nextInt(1, 8),
            device_type: this.prng.pick(devices)
          });

          // Identity bridge linkage
          this.identityBridges.push({
            bridge_id: `IDB-2026-${this.prng.pad(bridgeCounter++, 6)}`,
            anonymous_id: anonymousId,
            contact_id: contact.contact_id,
            resolved_at: touchIso,
            confidence_score: Number(this.prng.nextFloat(0.85, 1.0, 2)),
            resolution_method: t === 0 ? 'Form Submission' : 'Email Link Click'
          });
        }

        const touchpointType = isOffline 
          ? (this.prng.chance(0.5) ? 'Tradeshow Booth Visit' : 'Executive Dinner')
          : this.prng.pick(touchTypes);

        const costAllocated = channel.is_paid ? Number(this.prng.nextFloat(5.0, 150.0, 2)) : 0.0;

        // Structured ID: TOUCH-<contact-id>-000001
        const touchId = `TOUCH-${contact.contact_id}-${this.prng.pad(t + 1, 6)}`;

        const touchObj = {
          touchpoint_id: touchId,
          contact_id: contact.contact_id,
          campaign_id: campaign.campaign_id,
          session_id: sessionId,
          channel_id: channel.channel_id,
          touchpoint_type: touchpointType,
          timestamp: touchIso,
          cost_allocated: costAllocated,
          is_offline: isOffline ? 1 : 0,
          issue_flag: null
        };

        this.touchpoints.push(touchObj);
        if (!this.touchesByContact.has(contact.contact_id)) {
          this.touchesByContact.set(contact.contact_id, []);
        }
        this.touchesByContact.get(contact.contact_id).push(touchObj);
      }
    });
  }

  generateLeadsAndOpportunities() {
    this.leads = [];
    this.opportunities = [];

    const leadSources = ['Inbound Search', 'Content Download', 'Webinar', 'Sales Outreach', 'Field Event', 'Referral'];
    const oppStages = ['Closed-Won', 'Closed-Lost', 'Proposal', 'Negotiation', 'Discovery'];

    let leadCounter = 1;
    let oppCounter = 1;

    for (let i = 0; i < this.targets.opportunities; i++) {
      const contact = this.contacts[i];
      // Get all touches for this contact via O(1) indexed Map
      const contactTouches = this.touchesByContact.get(contact.contact_id) || [];
      const firstTouch = contactTouches[0] || { timestamp: contact.created_at, campaign_id: this.campaigns[0].campaign_id };
      const lastTouch = contactTouches[contactTouches.length - 1] || firstTouch;

      // 1. Lead Generation
      const leadTime = new Date(new Date(firstTouch.timestamp).getTime() + 3600 * 1000 * this.prng.nextInt(1, 48)).toISOString();
      const leadId = `LEAD-2026-${this.prng.pad(leadCounter++, 6)}`;

      this.leads.push({
        lead_id: leadId,
        contact_id: contact.contact_id,
        campaign_id: firstTouch.campaign_id,
        lead_source: this.prng.pick(leadSources),
        lead_score: this.prng.nextInt(50, 98),
        lead_status: 'Qualified',
        converted_date: leadTime,
        created_at: leadTime
      });

      // 2. Opportunity Generation
      // 40% Closed-Won, 25% Closed-Lost, 35% In-Flight (Negotiation/Proposal)
      const stageRoll = this.prng.next();
      let stage = 'Discovery';
      let prob = 0.2;
      if (stageRoll < 0.40) {
        stage = 'Closed-Won';
        prob = 1.0;
      } else if (stageRoll < 0.65) {
        stage = 'Closed-Lost';
        prob = 0.0;
      } else if (stageRoll < 0.85) {
        stage = 'Negotiation';
        prob = 0.75;
      } else {
        stage = 'Proposal';
        prob = 0.50;
      }

      const oppCreateTime = new Date(new Date(leadTime).getTime() + 3600 * 1000 * this.prng.nextInt(12, 120)).toISOString();
      const pipelineAmount = this.prng.nextInt(10, 150) * 1000;
      
      let closedAt = null;
      let closedAmount = 0.0;
      let reason = null;

      if (stage === 'Closed-Won' || stage === 'Closed-Lost') {
        // Closed date is strictly after last touchpoint
        const lastTouchTime = new Date(lastTouch.timestamp).getTime();
        const winGapDays = this.prng.nextInt(3, 30);
        closedAt = new Date(lastTouchTime + winGapDays * 86400 * 1000).toISOString();
        
        if (stage === 'Closed-Won') {
          closedAmount = pipelineAmount;
          reason = 'Selected for superior feature set and enterprise support';
          contact.lifecycle_stage = 'Customer';
        } else {
          closedAmount = 0.0;
          reason = this.prng.pick(['Budget frozen', 'Chose incumbent provider', 'Project postponed to 2027']);
        }
      }

      const oppId = `OPP-2026-${this.prng.pad(oppCounter++, 6)}`;

      this.opportunities.push({
        opportunity_id: oppId,
        contact_id: contact.contact_id,
        lead_id: leadId,
        name: `${contact.company} - Enterprise Expansion`,
        stage: stage,
        pipeline_amount: pipelineAmount,
        probability: prob,
        closed_amount: closedAmount,
        win_loss_reason: reason,
        created_at: oppCreateTime,
        closed_at: closedAt
      });
    }
  }

  generateOrders() {
    this.orders = [];
    let orderCounter = 1;

    const wonOpps = this.opportunities.filter(o => o.stage === 'Closed-Won');
    wonOpps.forEach(opp => {
      const orderId = `ORD-2026-${this.prng.pad(orderCounter++, 6)}`;
      this.orders.push({
        order_id: orderId,
        opportunity_id: opp.opportunity_id,
        contact_id: opp.contact_id,
        order_number: `INV-2026-${this.prng.pad(orderCounter, 6)}`,
        order_amount: opp.closed_amount,
        currency: 'USD',
        order_date: opp.closed_at,
        status: 'Completed'
      });
    });
  }

  generateCostRecords() {
    this.costRecords = [];
    let costCounter = 1;

    // Generate monthly cost records for each campaign throughout its active quarter
    this.campaigns.forEach(cmp => {
      const channel = this.channels.find(c => c.channel_id === cmp.channel_id);
      if (!channel || !channel.is_paid) return;

      const startDate = new Date(cmp.start_date);
      const monthlyBudget = Number((cmp.budget / 3).toFixed(2));

      for (let m = 0; m < 3; m++) {
        const costDate = new Date(startDate.getFullYear(), startDate.getMonth() + m, 15).toISOString().slice(0, 10);
        const costId = `CST-2026-${this.prng.pad(costCounter++, 6)}`;
        
        // Variance +/- 10%
        const variance = this.prng.nextFloat(0.9, 1.1, 2);
        const amount = Number((monthlyBudget * variance).toFixed(2));

        this.costRecords.push({
          cost_id: costId,
          campaign_id: cmp.campaign_id,
          channel_id: cmp.channel_id,
          cost_date: costDate,
          amount: amount,
          currency: 'USD',
          amount_usd: amount,
          spend_type: channel.cost_model === 'CPC' ? 'CPC Variable' : (channel.cost_model === 'Fixed' ? 'Fixed Budget' : 'Agency Retainer')
        });
      }
    });
  }

  /**
   * Step 5: Inject Labelled Edge Cases / Negative Scenarios
   */
  injectAnomalies() {
    this.groundTruthAnomalies = [];
    let anomalyCounter = 1;
    const targetCount = this.targets.anomaliesTarget;
    const perCategory = Math.max(2, Math.floor(targetCount / 5));

    console.log(`[Generator] Injecting ${targetCount} labelled edge cases (${perCategory} per category)...`);

    // 1. Edge Case: Revenue counted more than once (Duplicate order for closed-won opp)
    const wonOpps = this.opportunities.filter(o => o.stage === 'Closed-Won');
    for (let i = 0; i < perCategory && i < wonOpps.length; i++) {
      const opp = wonOpps[i];
      const dupOrderId = `ORD-2026-${this.prng.pad(900000 + i, 6)}`;
      
      // Inject duplicate order
      this.orders.push({
        order_id: dupOrderId,
        opportunity_id: opp.opportunity_id,
        contact_id: opp.contact_id,
        order_number: `INV-2026-DUP-${i + 1}`,
        order_amount: opp.closed_amount,
        currency: 'USD',
        order_date: opp.closed_at,
        status: 'Completed'
      });

      this.groundTruthAnomalies.push({
        anomaly_id: `ANO-2026-${this.prng.pad(anomalyCounter++, 6)}`,
        issue_type: 'DuplicateRevenue',
        entity_type: 'Opportunity',
        entity_id: opp.opportunity_id,
        description: `Duplicate order ${dupOrderId} created for opportunity ${opp.opportunity_id}, double-counting revenue of $${opp.closed_amount}`,
        injected_rule: 'Duplicate completed order injected for same opportunity_id',
        expected_detection: 'Flag opportunities where sum(order_amount) > closed_amount',
        impact_amount: opp.closed_amount,
        severity: 'Critical',
        quarantine_status: 'Active'
      });
    }

    // 2. Edge Case: Touchpoint after conversion attributed
    for (let i = 0; i < perCategory && i < wonOpps.length; i++) {
      const opp = wonOpps[i];
      const postTouchTime = new Date(new Date(opp.closed_at).getTime() + 86400 * 1000 * (i + 10)).toISOString();
      const touchId = `TOUCH-${opp.contact_id}-${this.prng.pad(990000 + i, 6)}`;
      
      // Injected post-conversion touchpoint
      this.touchpoints.push({
        touchpoint_id: touchId,
        contact_id: opp.contact_id,
        campaign_id: this.campaigns[i % this.campaigns.length].campaign_id,
        session_id: null,
        channel_id: 'CHN-004', // Email
        touchpoint_type: 'Marketing Email Open',
        timestamp: postTouchTime,
        cost_allocated: 0.0,
        is_offline: 0,
        issue_flag: 'PostConversionTouch'
      });

      this.groundTruthAnomalies.push({
        anomaly_id: `ANO-2026-${this.prng.pad(anomalyCounter++, 6)}`,
        issue_type: 'PostConversionTouch',
        entity_type: 'Touchpoint',
        entity_id: touchId,
        description: `Touchpoint ${touchId} timestamp ${postTouchTime} occurs after opportunity ${opp.opportunity_id} closed at ${opp.closed_at}`,
        injected_rule: 'Touchpoint created with timestamp > opportunity.closed_at',
        expected_detection: 'Flag touchpoints occurring after opportunity closed_at',
        impact_amount: 0.0,
        severity: 'High',
        quarantine_status: 'Active'
      });
    }

    // 3. Edge Case: Spend currency mismatch (Foreign currency without rate conversion)
    for (let i = 0; i < perCategory && i < this.costRecords.length; i++) {
      const cost = this.costRecords[i];
      cost.currency = 'EUR';
      // Deliberately fail to multiply by 1.08 exchange rate:
      cost.amount_usd = cost.amount; // 1:1 bug!

      this.groundTruthAnomalies.push({
        anomaly_id: `ANO-2026-${this.prng.pad(anomalyCounter++, 6)}`,
        issue_type: 'CurrencyMismatch',
        entity_type: 'CostRecord',
        entity_id: cost.cost_id,
        description: `Spend of €${cost.amount} EUR was entered with 1:1 parity ($${cost.amount_usd} USD) instead of €${cost.amount} * 1.08 = $${(cost.amount * 1.08).toFixed(2)}`,
        injected_rule: 'Non-USD currency recorded without applying exchange rate to amount_usd',
        expected_detection: 'Flag cost records where currency != USD and amount == amount_usd',
        impact_amount: Number(Math.abs(cost.amount * 1.08 - cost.amount_usd).toFixed(2)),
        severity: 'Medium',
        quarantine_status: 'Active'
      });
    }

    // 4. Edge Case: Campaign costs omitted
    // Pick paid campaigns with won opportunities and active cost records, then delete their cost records
    const wonCampaignIds = [...new Set(wonOpps.map(o => {
      const touches = this.touchesByContact.get(o.contact_id) || [];
      return touches[0] ? touches[0].campaign_id : null;
    }))].filter(campId => {
      if (!campId) return false;
      const camp = this.campaigns.find(c => c.campaign_id === campId);
      if (!camp) return false;
      const channel = this.channels.find(ch => ch.channel_id === camp.channel_id);
      return channel && channel.is_paid === 1;
    });

    for (let i = 0; i < perCategory && i < wonCampaignIds.length; i++) {
      const targetCampId = wonCampaignIds[i];
      const camp = this.campaigns.find(c => c.campaign_id === targetCampId);
      if (!camp) continue;

      // Remove all cost records for this campaign
      this.costRecords = this.costRecords.filter(c => c.campaign_id !== targetCampId);

      this.groundTruthAnomalies.push({
        anomaly_id: `ANO-2026-${this.prng.pad(anomalyCounter++, 6)}`,
        issue_type: 'OmittedCost',
        entity_type: 'Campaign',
        entity_id: targetCampId,
        description: `Campaign ${targetCampId} ('${camp.name}') has active touchpoints and converted revenue, but 0 cost records logged`,
        injected_rule: 'Cost records deleted for an active revenue-generating campaign',
        expected_detection: 'Identify active campaigns with touchpoints but no cost_records',
        impact_amount: camp.budget,
        severity: 'Critical',
        quarantine_status: 'Active'
      });
    }

    // 5. Edge Case: Anonymous session linked without evidence
    const removedAnonIds = new Set();
    for (let i = 0; i < perCategory && i < this.webSessions.length; i++) {
      const session = this.webSessions[i];
      removedAnonIds.add(session.anonymous_id);

      this.groundTruthAnomalies.push({
        anomaly_id: `ANO-2026-${this.prng.pad(anomalyCounter++, 6)}`,
        issue_type: 'GhostAnonymousSession',
        entity_type: 'WebSession',
        entity_id: session.session_id,
        description: `Session ${session.session_id} is linked to contact ${session.contact_id} without any verification proof in identity_bridge`,
        injected_rule: 'Identity bridge entry removed while contact_id remains on web_session',
        expected_detection: 'Identify web_sessions where contact_id is set but missing from identity_bridge',
        impact_amount: 0.0,
        severity: 'High',
        quarantine_status: 'Active'
      });
    }
    this.identityBridges = this.identityBridges.filter(b => !removedAnonIds.has(b.anonymous_id));
  }

  /**
   * Compute and persist initial Attribution Results for all Won Opportunities
   */
  generateAttributionResults() {
    this.attributionResults = [];
    let attCounter = 1;

    const wonOpps = this.opportunities.filter(o => o.stage === 'Closed-Won');
    
    wonOpps.forEach(opp => {
      const touches = this.touchesByContact.get(opp.contact_id) || [];
      const computed = this.attributionEngine.computeAllModels(opp, touches, false);
      
      const period = 'Q1-2026'; // Default period partition

      Object.keys(computed.models).forEach(modelName => {
        const modelResults = computed.models[modelName];
        modelResults.forEach(res => {
          this.attributionResults.push({
            attribution_id: `ATT-2026-${this.prng.pad(attCounter++, 6)}`,
            opportunity_id: opp.opportunity_id,
            touchpoint_id: res.touchpoint_id,
            campaign_id: res.campaign_id,
            channel_id: res.channel_id,
            model_name: modelName,
            attribution_weight: res.attribution_weight,
            attributed_revenue: res.attributed_revenue,
            calculation_timestamp: '2026-11-01T00:00:00Z',
            evaluation_period: period,
            is_quarantined: 0
          });
        });
      });
    });
  }
}

module.exports = { DataGenerator };
