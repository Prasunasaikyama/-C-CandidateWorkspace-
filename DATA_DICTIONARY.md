# Enterprise Multi-Touch Attribution — Comprehensive Data Dictionary

This data dictionary formally specifies the schema, constraints, domain semantics, and validation rules for the 12 core entities, bridge tables, and anomaly ledgers in accordance with **Step 1** of the problem specification.

---

## Entity-Relationship Cardinality Overview

```
[Channel]  1 ──< N  [Campaign]  1 ──< N  [CostRecord]
[Audience] 1 ──< N  [Campaign]
[Creative] 1 ──< N  [Campaign]

[Contact]  1 ──< N  [WebSession] (via IdentityBridge resolution)
[Contact]  1 ──< N  [Touchpoint] >── N ── 1 [Campaign]
[Contact]  1 ──< N  [Lead]       >── N ── 1 [Campaign]
[Contact]  1 ──< N  [Opportunity]>── 0..1 [Lead]
[Opportunity] 1 ──< N  [Order]
[Opportunity] 1 ──< N  [AttributionResult] >── N ── 1 [Touchpoint]
```

---

## 1. Channel (`channels`)
Master dimension defining marketing and sales distribution channels.

| Field Name | Type | Required / Optional | Allowed Values / Enums | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `channel_id` | TEXT | Required | `CHN-001` .. `CHN-999` | Code | Primary Key | Format: `^CHN-[0-9]{3}$` |
| `name` | TEXT | Required | String (e.g., 'Google Paid Search') | Text | Unique | Non-empty string <= 100 chars |
| `category` | TEXT | Required | `Paid Search`, `Paid Social`, `Organic Search`, `Email Marketing`, `Display Ads`, `Events & Field`, `Direct / Referral` | Category | Non-unique | Must belong to closed enum set |
| `is_paid` | INTEGER | Required | `0` (Organic/Free), `1` (Paid) | Flag | Non-unique | `CHECK(is_paid IN (0, 1))` |
| `cost_model` | TEXT | Required | `CPC`, `CPM`, `CPA`, `Fixed`, `None` | Model | Non-unique | If `is_paid = 0`, cost_model must be `None` |

---

## 2. Audience (`audiences`)
Target demographic, firmographic, and behavioral customer segments.

| Field Name | Type | Required / Optional | Allowed Values / Enums | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `audience_id` | TEXT | Required | `AUD-2026-0001` .. `AUD-2026-9999` | Code | Primary Key | Format: `^AUD-2026-[0-9]{4}$` |
| `name` | TEXT | Required | Descriptive name (e.g. 'Enterprise IT Leaders') | Text | Unique | Non-empty string <= 120 chars |
| `segment` | TEXT | Required | Enterprise (1000+), Mid-Market (250-999), SMB | Tier | Non-unique | Categorical string |
| `target_industry` | TEXT | Required | IT, SaaS, Healthcare, Financial Services, Retail | Industry | Non-unique | Must be valid industry taxonomy |
| `estimated_size` | INTEGER | Required | `1` to `1000000` | Accounts | Non-unique | Must be integer >= 1 |
| `created_at` | TEXT | Required | ISO 8601 Timestamp | Timestamp | Non-unique | Valid UTC ISO 8601 string |

---

## 3. Creative (`creatives`)
Ad assets, content marketing collateral, and promotional creatives.

| Field Name | Type | Required / Optional | Allowed Values / Enums | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `creative_id` | TEXT | Required | `CRT-2026-0001` .. `CRT-2026-9999` | Code | Primary Key | Format: `^CRT-2026-[0-9]{4}$` |
| `name` | TEXT | Required | Descriptive title | Text | Non-unique | Non-empty <= 150 chars |
| `format` | TEXT | Required | `Banner`, `Video`, `Search Ad`, `Whitepaper`, `Case Study`, `Webinar Deck` | Asset Type | Non-unique | Must belong to closed enum set |
| `message_theme` | TEXT | Required | Cost Savings, Security, Innovation, Customer Proof | Theme | Non-unique | Non-empty string |
| `destination_url`| TEXT | Required | Relative or absolute URL | URI | Non-unique | Starts with `/` or `https://` |
| `created_at` | TEXT | Required | ISO 8601 Timestamp | Timestamp | Non-unique | Valid UTC ISO 8601 |

---

## 4. Campaign (`campaigns`)
Marketing campaign initiatives tying channels, budgets, and evaluation windows.

| Field Name | Type | Required / Optional | Allowed Values / Enums | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `campaign_id` | TEXT | Required | `CMP-2026-000001` .. `CMP-2026-999999` | Code | Primary Key | Format: `^CMP-2026-[0-9]{6}$` |
| `name` | TEXT | Required | Campaign initiative name | Text | Unique | Non-empty string <= 180 chars |
| `channel_id` | TEXT | Required | Foreign Key referencing `channels.channel_id` | Code | Non-unique | Must exist in `channels` table |
| `creative_id` | TEXT | Optional | Foreign Key referencing `creatives.creative_id` | Code | Non-unique | Nullable or exists in `creatives` |
| `audience_id` | TEXT | Optional | Foreign Key referencing `audiences.audience_id` | Code | Non-unique | Nullable or exists in `audiences` |
| `budget` | REAL | Required | `0.00` to `500000.00` | USD | Non-unique | `CHECK(budget >= 0)` |
| `currency` | TEXT | Required | `USD` (default), `EUR`, `GBP` | ISO 4217 | Non-unique | Must be 3-letter currency code |
| `start_date` | TEXT | Required | `YYYY-MM-DD` | Date | Non-unique | Must be valid date |
| `end_date` | TEXT | Required | `YYYY-MM-DD` | Date | Non-unique | `CHECK(date(start_date) <= date(end_date))` |
| `status` | TEXT | Required | `Planning`, `Active`, `Paused`, `Completed` | Status | Non-unique | Enum constraint |
| `evaluation_period`| TEXT | Required | `Q1-2026`, `Q2-2026`, `Q3-2026`, `Q4-2026` | Period | Non-unique | Chronological quarterly partition |

---

## 5. Contact (`contacts`)
Individual buyers, evaluators, and stakeholders within prospect and customer accounts.

| Field Name | Type | Required / Optional | Allowed Values / Enums | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `contact_id` | TEXT | Required | `CON-2026-000001` .. `CON-2026-999999` | Code | Primary Key | Format: `^CON-2026-[0-9]{6}$` |
| `first_name` | TEXT | Required | Alpha characters | Text | Non-unique | Non-empty string |
| `last_name` | TEXT | Required | Alpha characters | Text | Non-unique | Non-empty string |
| `email` | TEXT | Required | RFC 5322 Email | Email | Unique | Case-insensitive unique email |
| `company` | TEXT | Required | Target organization name | Text | Non-unique | Non-empty string |
| `job_title` | TEXT | Required | Professional title | Text | Non-unique | Non-empty string |
| `lifecycle_stage`| TEXT | Required | `Prospect`, `Lead`, `MQL`, `SQL`, `Customer`, `Churned` | State | Non-unique | Valid lifecycle state |
| `created_at` | TEXT | Required | ISO 8601 Timestamp | Timestamp | Non-unique | Valid UTC ISO 8601 |

---

## 6. Web Session (`web_sessions`)
Website visit and clickstream sessions recorded from digital properties.

| Field Name | Type | Required / Optional | Allowed Values / Enums | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `session_id` | TEXT | Required | `SES-2026-000001` .. `SES-2026-999999` | Code | Primary Key | Format: `^SES-2026-[0-9]{6}$` |
| `anonymous_id` | TEXT | Required | UUID or synthetic cookie ID (e.g. `anon_...`) | Token | Non-unique | Non-empty string |
| `contact_id` | TEXT | Optional | Foreign Key referencing `contacts.contact_id` | Code | Non-unique | Null before identity resolution |
| `landing_page` | TEXT | Required | URI path (e.g., `/pricing`) | URI | Non-unique | Starts with `/` |
| `referrer` | TEXT | Optional | External referrer URL | URI | Non-unique | URL or null |
| `utm_source` | TEXT | Optional | Campaign tracking parameter | Text | Non-unique | Lowercase alphanumeric |
| `utm_medium` | TEXT | Optional | Campaign tracking parameter | Text | Non-unique | Lowercase alphanumeric |
| `utm_campaign`| TEXT | Optional | Campaign tracking parameter | Text | Non-unique | Lowercase alphanumeric |
| `session_start`| TEXT | Required | ISO 8601 Timestamp | Timestamp | Non-unique | Monotonic timestamp |
| `session_end` | TEXT | Required | ISO 8601 Timestamp | Timestamp | Non-unique | `session_start <= session_end` |
| `page_views` | INTEGER | Required | `1` to `100` | Count | Non-unique | `CHECK(page_views >= 1)` |
| `device_type` | TEXT | Required | `Desktop`, `Mobile`, `Tablet` | Device | Non-unique | Enum constraint |

---

## 7. Touchpoint (`touchpoints`)
Marketing and sales interactions recorded along the buyer journey.

| Field Name | Type | Required / Optional | Allowed Values / Enums | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `touchpoint_id`| TEXT | Required | `TOUCH-<contact_id>-000001` | Code | Primary Key | Deterministic compound format |
| `contact_id` | TEXT | Required | Foreign Key referencing `contacts.contact_id` | Code | Non-unique | Must exist in `contacts` |
| `campaign_id` | TEXT | Required | Foreign Key referencing `campaigns.campaign_id`| Code | Non-unique | Must exist in `campaigns` |
| `session_id` | TEXT | Optional | Foreign Key referencing `web_sessions.session_id`| Code | Non-unique | Nullable for offline touches |
| `channel_id` | TEXT | Required | Foreign Key referencing `channels.channel_id` | Code | Non-unique | Must exist in `channels` |
| `touchpoint_type`| TEXT| Required | `Paid Search Click`, `Social Ad Click`, `Organic Visit`, `Marketing Email Open`, `Webinar Attendance`, `Demo Request`, `Whitepaper Download`, `Tradeshow Booth Visit`, `Executive Dinner` | Event | Non-unique | Enum constraint |
| `timestamp` | TEXT | Required | ISO 8601 Timestamp | Timestamp | Non-unique | Monotonic interaction timestamp |
| `cost_allocated`| REAL | Required | `0.00` to `2000.00` | USD | Non-unique | `CHECK(cost_allocated >= 0)` |
| `is_offline` | INTEGER | Required | `0` (Online), `1` (Offline) | Flag | Non-unique | `CHECK(is_offline IN (0, 1))` |
| `issue_flag` | TEXT | Optional | `PostConversionTouch`, or `NULL` | Flag | Non-unique | Tracks injected edge cases |

---

## 8. Lead (`leads`)
Marketing-qualified inquiries converted into sales pipeline.

| Field Name | Type | Required / Optional | Allowed Values / Enums | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `lead_id` | TEXT | Required | `LEAD-2026-000001` .. `LEAD-2026-999999` | Code | Primary Key | Format: `^LEAD-2026-[0-9]{6}$` |
| `contact_id` | TEXT | Required | Foreign Key referencing `contacts.contact_id` | Code | Non-unique | Must exist in `contacts` |
| `campaign_id` | TEXT | Required | Foreign Key referencing `campaigns.campaign_id`| Code | Non-unique | Campaign attribution anchor |
| `lead_source` | TEXT | Required | Inbound Search, Content Download, Webinar, Sales Outreach, Field Event, Referral | Source | Non-unique | Categorical string |
| `lead_score` | INTEGER | Required | `0` to `100` | Score | Non-unique | `CHECK(lead_score BETWEEN 0 AND 100)`|
| `lead_status` | TEXT | Required | `New`, `Working`, `Qualified`, `Unqualified` | Status | Non-unique | Enum constraint |
| `converted_date`| TEXT | Optional | ISO 8601 Timestamp | Timestamp | Non-unique | Date lead reached Qualified |
| `created_at` | TEXT | Required | ISO 8601 Timestamp | Timestamp | Non-unique | Inception date |

---

## 9. Opportunity (`opportunities`)
Qualified sales deals tracking pipeline, stages, and closed revenue.

| Field Name | Type | Required / Optional | Allowed Values / Enums | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `opportunity_id`| TEXT | Required | `OPP-2026-000001` .. `OPP-2026-999999` | Code | Primary Key | Format: `^OPP-2026-[0-9]{6}$` |
| `contact_id` | TEXT | Required | Foreign Key referencing `contacts.contact_id` | Code | Non-unique | Primary deal contact |
| `lead_id` | TEXT | Optional | Foreign Key referencing `leads.lead_id` | Code | Non-unique | Nullable or valid lead |
| `name` | TEXT | Required | Deal name | Text | Non-unique | Non-empty string |
| `stage` | TEXT | Required | `Discovery`, `Evaluation`, `Proposal`, `Negotiation`, `Closed-Won`, `Closed-Lost` | Stage | Non-unique | Strict lifecycle enum |
| `pipeline_amount`| REAL | Required | `0.00` to `2000000.00` | USD | Non-unique | `CHECK(pipeline_amount >= 0)` |
| `probability` | REAL | Required | `0.0` to `1.0` | Probability | Non-unique | `CHECK(probability BETWEEN 0.0 AND 1.0)`|
| `closed_amount`| REAL | Required | `0.00` to `2000000.00` | USD | Non-unique | If Closed-Won, closed_amount > 0 |
| `win_loss_reason`| TEXT| Optional | Reason deal won or lost | Text | Non-unique | Populated upon deal close |
| `created_at` | TEXT | Required | ISO 8601 Timestamp | Timestamp | Non-unique | Opportunity creation date |
| `closed_at` | TEXT | Optional | ISO 8601 Timestamp | Timestamp | Non-unique | Must be >= `created_at` |

---

## 10. Order (`orders`)
Financial billing and revenue fulfillment transactions.

| Field Name | Type | Required / Optional | Allowed Values / Enums | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `order_id` | TEXT | Required | `ORD-2026-000001` .. `ORD-2026-999999` | Code | Primary Key | Format: `^ORD-2026-[0-9]{6}$` |
| `opportunity_id`| TEXT | Required | Foreign Key referencing `opportunities.opportunity_id` | Code | Non-unique | Deal billing anchor |
| `contact_id` | TEXT | Required | Foreign Key referencing `contacts.contact_id` | Code | Non-unique | Customer billed |
| `order_number` | TEXT | Required | Invoice code (e.g., `INV-2026-000001`) | Code | Non-unique | Non-empty string |
| `order_amount` | REAL | Required | `0.00` to `2000000.00` | USD | Non-unique | `CHECK(order_amount >= 0)` |
| `currency` | TEXT | Required | `USD` (default) | ISO 4217 | Non-unique | Default USD |
| `order_date` | TEXT | Required | ISO 8601 Timestamp | Timestamp | Non-unique | Order placement date |
| `status` | TEXT | Required | `Pending`, `Completed`, `Cancelled`, `Refunded` | Status | Non-unique | Enum constraint |

---

## 11. Cost Record (`cost_records`)
Marketing expenditure and vendor cost ledger items.

| Field Name | Type | Required / Optional | Allowed Values / Enums | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `cost_id` | TEXT | Required | `CST-2026-000001` .. `CST-2026-999999` | Code | Primary Key | Format: `^CST-2026-[0-9]{6}$` |
| `campaign_id` | TEXT | Required | Foreign Key referencing `campaigns.campaign_id`| Code | Non-unique | Cost allocation target |
| `channel_id` | TEXT | Required | Foreign Key referencing `channels.channel_id` | Code | Non-unique | Cost channel |
| `cost_date` | TEXT | Required | `YYYY-MM-DD` | Date | Non-unique | Valid date |
| `amount` | REAL | Required | `0.00` to `100000.00` | Currency | Non-unique | `CHECK(amount >= 0)` |
| `currency` | TEXT | Required | `USD`, `EUR`, `GBP` | ISO 4217 | Non-unique | Currency code |
| `amount_usd` | REAL | Required | `0.00` to `150000.00` | USD | Non-unique | Normalized derived exchange value |
| `spend_type` | TEXT | Required | `Fixed Budget`, `CPC Variable`, `Agency Retainer`, `Sponsorship` | Spend Type | Non-unique | Enum constraint |

---

## 12. Attribution Result (`attribution_results`)
Derived multi-model revenue allocation and credit weights.

| Field Name | Type | Required / Optional | Allowed Values / Enums | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `attribution_id`| TEXT | Required | `ATT-2026-000001` .. `ATT-2026-999999` | Code | Primary Key | Format: `^ATT-2026-[0-9]{6}$` |
| `opportunity_id`| TEXT | Required | Foreign Key referencing `opportunities.opportunity_id` | Code | Non-unique | Deal attributed |
| `touchpoint_id` | TEXT | Required | Foreign Key referencing `touchpoints.touchpoint_id` | Code | Non-unique | Touchpoint credited |
| `campaign_id` | TEXT | Required | Foreign Key referencing `campaigns.campaign_id`| Code | Non-unique | Campaign credited |
| `channel_id` | TEXT | Required | Foreign Key referencing `channels.channel_id` | Code | Non-unique | Channel credited |
| `model_name` | TEXT | Required | `First-Touch`, `Last-Touch`, `Linear`, `Time-Decay`, `U-Shaped` | Model | Non-unique | Valid attribution model |
| `attribution_weight`| REAL | Required | `0.0` to `1.0` | Weight | Non-unique | `CHECK(attribution_weight BETWEEN 0.0 AND 1.0)` |
| `attributed_revenue`| REAL | Required | `0.00` to `2000000.00` | USD | Non-unique | `closed_amount * attribution_weight` |
| `calculation_timestamp`| TEXT | Required | ISO 8601 Timestamp | Timestamp | Non-unique | Execution timestamp |
| `evaluation_period` | TEXT | Required | `Q1-2026` .. `Q4-2026` | Period | Non-unique | Evaluation partition |
| `is_quarantined` | INTEGER | Required | `0` (Active/Clean), `1` (Quarantined) | Flag | Non-unique | `CHECK(is_quarantined IN (0, 1))` |
