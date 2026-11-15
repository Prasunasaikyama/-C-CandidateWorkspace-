-- ==============================================================================
-- Schema: Enterprise Multi-Touch Attribution & Marketing ROI Data Platform
-- Target RDBMS: SQLite 3 / node:sqlite
-- Nomenclature: CMP-2026-000001, TOUCH-CON-2026-000001-000001, SES-2026-000001,
--               LEAD-2026-000001, OPP-2026-000001, ORD-2026-000001, CST-2026-000001
-- ==============================================================================

PRAGMA foreign_keys = OFF;

-- Drop existing tables in safe order
DROP TABLE IF EXISTS ground_truth_anomalies;
DROP TABLE IF EXISTS identity_bridge;
DROP TABLE IF EXISTS attribution_results;
DROP TABLE IF EXISTS cost_records;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS opportunities;
DROP TABLE IF EXISTS leads;
DROP TABLE IF EXISTS touchpoints;
DROP TABLE IF EXISTS web_sessions;
DROP TABLE IF EXISTS contacts;
DROP TABLE IF EXISTS campaigns;
DROP TABLE IF EXISTS creatives;
DROP TABLE IF EXISTS audiences;
DROP TABLE IF EXISTS channels;

PRAGMA foreign_keys = ON;
CREATE TABLE channels (
    channel_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('Paid Search', 'Paid Social', 'Organic Search', 'Email Marketing', 'Display Ads', 'Events & Field', 'Direct / Referral')),
    is_paid INTEGER NOT NULL CHECK(is_paid IN (0, 1)),
    cost_model TEXT NOT NULL CHECK(cost_model IN ('CPC', 'CPM', 'CPA', 'Fixed', 'None'))
);

-- 2. Audiences (Master Dimension)
DROP TABLE IF EXISTS audiences;
CREATE TABLE audiences (
    audience_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    segment TEXT NOT NULL,
    target_industry TEXT NOT NULL,
    estimated_size INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

-- 3. Creatives (Master Dimension)
DROP TABLE IF EXISTS creatives;
CREATE TABLE creatives (
    creative_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    format TEXT NOT NULL CHECK(format IN ('Banner', 'Video', 'Search Ad', 'Whitepaper', 'Case Study', 'Webinar Deck')),
    message_theme TEXT NOT NULL,
    destination_url TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- 4. Campaigns (Master Dimension & Cost Anchor)
DROP TABLE IF EXISTS campaigns;
CREATE TABLE campaigns (
    campaign_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    channel_id TEXT NOT NULL REFERENCES channels(channel_id),
    creative_id TEXT REFERENCES creatives(creative_id),
    audience_id TEXT REFERENCES audiences(audience_id),
    budget REAL NOT NULL CHECK(budget >= 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('Planning', 'Active', 'Paused', 'Completed')),
    evaluation_period TEXT NOT NULL CHECK(evaluation_period IN ('Q1-2026', 'Q2-2026', 'Q3-2026', 'Q4-2026'))
);

-- 5. Contacts (Master Dimension - Prospective & Existing Customers)
DROP TABLE IF EXISTS contacts;
CREATE TABLE contacts (
    contact_id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    company TEXT NOT NULL,
    job_title TEXT NOT NULL,
    lifecycle_stage TEXT NOT NULL CHECK(lifecycle_stage IN ('Prospect', 'Lead', 'MQL', 'SQL', 'Customer', 'Churned')),
    created_at TEXT NOT NULL
);

-- 6. Web Sessions (Event Dimension - Digital Footprints)
DROP TABLE IF EXISTS web_sessions;
CREATE TABLE web_sessions (
    session_id TEXT PRIMARY KEY,
    anonymous_id TEXT NOT NULL,
    contact_id TEXT REFERENCES contacts(contact_id),
    landing_page TEXT NOT NULL,
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    session_start TEXT NOT NULL,
    session_end TEXT NOT NULL,
    page_views INTEGER NOT NULL DEFAULT 1 CHECK(page_views >= 1),
    device_type TEXT NOT NULL CHECK(device_type IN ('Desktop', 'Mobile', 'Tablet'))
);

-- 7. Touchpoints (Transaction/Event - Multi-Touch History)
DROP TABLE IF EXISTS touchpoints;
CREATE TABLE touchpoints (
    touchpoint_id TEXT PRIMARY KEY,
    contact_id TEXT NOT NULL REFERENCES contacts(contact_id),
    campaign_id TEXT NOT NULL REFERENCES campaigns(campaign_id),
    session_id TEXT REFERENCES web_sessions(session_id),
    channel_id TEXT NOT NULL REFERENCES channels(channel_id),
    touchpoint_type TEXT NOT NULL CHECK(touchpoint_type IN ('Paid Search Click', 'Social Ad Click', 'Organic Visit', 'Marketing Email Open', 'Webinar Attendance', 'Demo Request', 'Whitepaper Download', 'Tradeshow Booth Visit', 'Executive Dinner')),
    timestamp TEXT NOT NULL,
    cost_allocated REAL NOT NULL DEFAULT 0.0 CHECK(cost_allocated >= 0),
    is_offline INTEGER NOT NULL DEFAULT 0 CHECK(is_offline IN (0, 1)),
    issue_flag TEXT DEFAULT NULL
);

-- 8. Leads (Lifecycle State Event)
DROP TABLE IF EXISTS leads;
CREATE TABLE leads (
    lead_id TEXT PRIMARY KEY,
    contact_id TEXT NOT NULL REFERENCES contacts(contact_id),
    campaign_id TEXT NOT NULL REFERENCES campaigns(campaign_id),
    lead_source TEXT NOT NULL,
    lead_score INTEGER NOT NULL CHECK(lead_score BETWEEN 0 AND 100),
    lead_status TEXT NOT NULL CHECK(lead_status IN ('New', 'Working', 'Qualified', 'Unqualified')),
    converted_date TEXT,
    created_at TEXT NOT NULL
);

-- 9. Opportunities (Pipeline & Revenue Anchor)
DROP TABLE IF EXISTS opportunities;
CREATE TABLE opportunities (
    opportunity_id TEXT PRIMARY KEY,
    contact_id TEXT NOT NULL REFERENCES contacts(contact_id),
    lead_id TEXT REFERENCES leads(lead_id),
    name TEXT NOT NULL,
    stage TEXT NOT NULL CHECK(stage IN ('Discovery', 'Evaluation', 'Proposal', 'Negotiation', 'Closed-Won', 'Closed-Lost')),
    pipeline_amount REAL NOT NULL CHECK(pipeline_amount >= 0),
    probability REAL NOT NULL CHECK(probability BETWEEN 0.0 AND 1.0),
    closed_amount REAL NOT NULL DEFAULT 0.0 CHECK(closed_amount >= 0),
    win_loss_reason TEXT,
    created_at TEXT NOT NULL,
    closed_at TEXT
);

-- 10. Orders (Financial Transaction Reconciliation)
DROP TABLE IF EXISTS orders;
CREATE TABLE orders (
    order_id TEXT PRIMARY KEY,
    opportunity_id TEXT NOT NULL REFERENCES opportunities(opportunity_id),
    contact_id TEXT NOT NULL REFERENCES contacts(contact_id),
    order_number TEXT NOT NULL,
    order_amount REAL NOT NULL CHECK(order_amount >= 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    order_date TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('Pending', 'Completed', 'Cancelled', 'Refunded'))
);

-- 11. Cost Records (Spend Ledger)
DROP TABLE IF EXISTS cost_records;
CREATE TABLE cost_records (
    cost_id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(campaign_id),
    channel_id TEXT NOT NULL REFERENCES channels(channel_id),
    cost_date TEXT NOT NULL,
    amount REAL NOT NULL CHECK(amount >= 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    amount_usd REAL NOT NULL CHECK(amount_usd >= 0),
    spend_type TEXT NOT NULL CHECK(spend_type IN ('Fixed Budget', 'CPC Variable', 'Agency Retainer', 'Sponsorship'))
);

-- 12. Attribution Results (Derived Analytics - Multi-Model)
DROP TABLE IF EXISTS attribution_results;
CREATE TABLE attribution_results (
    attribution_id TEXT PRIMARY KEY,
    opportunity_id TEXT NOT NULL REFERENCES opportunities(opportunity_id),
    touchpoint_id TEXT NOT NULL REFERENCES touchpoints(touchpoint_id),
    campaign_id TEXT NOT NULL REFERENCES campaigns(campaign_id),
    channel_id TEXT NOT NULL REFERENCES channels(channel_id),
    model_name TEXT NOT NULL CHECK(model_name IN ('First-Touch', 'Last-Touch', 'Linear', 'Time-Decay', 'U-Shaped')),
    attribution_weight REAL NOT NULL CHECK(attribution_weight BETWEEN 0.0 AND 1.0),
    attributed_revenue REAL NOT NULL CHECK(attributed_revenue >= 0),
    calculation_timestamp TEXT NOT NULL,
    evaluation_period TEXT NOT NULL,
    is_quarantined INTEGER NOT NULL DEFAULT 0 CHECK(is_quarantined IN (0, 1))
);

-- 13. Identity Bridge (Anonymous to Known Resolution Bridge)
DROP TABLE IF EXISTS identity_bridge;
CREATE TABLE identity_bridge (
    bridge_id TEXT PRIMARY KEY,
    anonymous_id TEXT NOT NULL,
    contact_id TEXT NOT NULL REFERENCES contacts(contact_id),
    resolved_at TEXT NOT NULL,
    confidence_score REAL NOT NULL CHECK(confidence_score BETWEEN 0.0 AND 1.0),
    resolution_method TEXT NOT NULL CHECK(resolution_method IN ('Form Submission', 'Email Link Click', 'Single Sign-On', 'Account Match'))
);

-- 14. Ground Truth Anomalies (Verification / Evaluation Ledger)
DROP TABLE IF EXISTS ground_truth_anomalies;
CREATE TABLE ground_truth_anomalies (
    anomaly_id TEXT PRIMARY KEY,
    issue_type TEXT NOT NULL CHECK(issue_type IN ('DuplicateRevenue', 'PostConversionTouch', 'CurrencyMismatch', 'OmittedCost', 'GhostAnonymousSession')),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    description TEXT NOT NULL,
    injected_rule TEXT NOT NULL,
    expected_detection TEXT NOT NULL,
    impact_amount REAL DEFAULT 0.0,
    severity TEXT NOT NULL CHECK(severity IN ('Critical', 'High', 'Medium', 'Low')),
    quarantine_status TEXT NOT NULL DEFAULT 'Active' CHECK(quarantine_status IN ('Active', 'Quarantined', 'Resolved'))
);

-- ==============================================================================
-- Performance & Integrity Indexes
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_campaigns_channel ON campaigns(channel_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_period ON campaigns(evaluation_period);
CREATE INDEX IF NOT EXISTS idx_touchpoints_contact ON touchpoints(contact_id);
CREATE INDEX IF NOT EXISTS idx_touchpoints_campaign ON touchpoints(campaign_id);
CREATE INDEX IF NOT EXISTS idx_touchpoints_ts ON touchpoints(timestamp);
CREATE INDEX IF NOT EXISTS idx_web_sessions_contact ON web_sessions(contact_id);
CREATE INDEX IF NOT EXISTS idx_web_sessions_anon ON web_sessions(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_contact ON opportunities(contact_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_orders_opp ON orders(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_cost_records_camp ON cost_records(campaign_id);
CREATE INDEX IF NOT EXISTS idx_attribution_opp ON attribution_results(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_attribution_camp ON attribution_results(campaign_id);
CREATE INDEX IF NOT EXISTS idx_attribution_model ON attribution_results(model_name);
CREATE INDEX IF NOT EXISTS idx_anomalies_type ON ground_truth_anomalies(issue_type);
