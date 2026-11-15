# Enterprise Multi-Touch Attribution — System Architecture & Technical Specification

## 1. Executive Summary & Objective

The objective of **AttributionOS** is to join campaign touches, web events, leads, opportunities, orders, and revenue to provide a transparent, mathematically rigorous, auditable comparison of marketing attribution models and true channel ROI.

Built specifically for high-stakes enterprise marketing and sales operations, this platform exposes key decisions, isolates data anomalies, preserves chronological traceability, and produces deterministic, verifiable outputs.

---

## 2. 3-Tier Enterprise Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           PRESENTATION TIER (Frontend)                          │
│  - Executive Attribution Dashboard (HTML5 / Modern Dark CSS / SVG Charts)       │
│  - Multi-Model Comparison Matrix (First-Touch, Last-Touch, Linear, Decay, U)   │
│  - End-to-End Customer Journey & Touchpoint Tracer                              │
│  - Anomaly & Quarantine Control Center (Dirty vs Clean Isolation)               │
│  - Relational Schema & Data Dictionary Explorer                                 │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ REST API / JSON (HTTP 3000)
┌────────────────────────────────────────▼────────────────────────────────────────┐
│                            LOGIC TIER (Backend API Server)                      │
│  - Node.js Native HTTP & SQLite Engine (Zero External Dependencies)             │
│  - Attribution Computation Engine (5 Models + Lookback Windows)                 │
│  - Spend Normalization & Multi-Currency Engine (USD base, EUR, GBP, JPY)        │
│  - Financial ROI, ROAS, and CAC Reconciler                                      │
│  - Anomaly Detector & Quarantine Manager (Precision, Recall, F1 Evaluation)    │
│  - Audit Trail & Graph Journey Tracer                                           │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ DatabaseSync / WAL Transactions
┌────────────────────────────────────────▼────────────────────────────────────────┐
│                            DATA TIER (Storage & Models)                         │
│  - SQLite 3 Relational Database (`database/attribution.db`)                     │
│  - 12 Core Entities + Bridge Tables + Ground Truth Anomaly Ledger               │
│  - Deterministic PRNG Synthetic Generator (`database/generator.js` - Seed 20261022)│
│  - Strict 8-Rule Validation Suite (`database/validator.js`)                    │
│  - Seed CSV/JSON Exports & SHA256 Manifest (`data/csv/`, `data/manifest.json`)  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Primary Actors & Systems

| Actor | Role & Interaction with System |
| :--- | :--- |
| **Customer / Prospect** | Interacts across digital ads, search engines, webinars, email, and tradeshows, generating web sessions, clickstreams, and touchpoints. |
| **Marketing / Sales Ops** | Configures campaign budgets, tracks channels, monitors conversion stages, sets lookback windows, and triggers anomaly quarantines. |
| **Support Agent** | Inspects post-conversion customer journeys, service touches, and order resolution records. |
| **Analyst** | Compares attribution models (Top-of-Funnel vs Bottom-of-Funnel credit shifts), analyzes ROAS/CAC, and reconciles pipeline revenue. |
| **System Administrator** | Manages data ingestion pipelines, verifies database integrity, runs seed regeneration, and audits ground truth anomalies. |

---

## 4. Attribution Mathematics & Formulations

Given an opportunity $O$ with closed-won revenue $R$, occurring at conversion time $T_{conv}$, and an ordered sequence of $N$ valid historical touchpoints $\{t_1, t_2, \dots, t_N\}$ within lookback window $W$:

### 1. First-Touch Attribution (FTA)
Assigns 100% of the deal credit to the initial brand discovery interaction:
$$w_1 = 1.0, \quad w_i = 0.0 \; (\forall i > 1)$$
$$R_1 = R, \quad R_i = 0.0$$

### 2. Last-Touch Attribution (LTA)
Assigns 100% of the credit to the final touchpoint immediately preceding conversion:
$$w_N = 1.0, \quad w_i = 0.0 \; (\forall i < N)$$
$$R_N = R, \quad R_i = 0.0$$

### 3. Linear Attribution
Distributes deal value equally across all recognized customer touchpoints:
$$w_i = \frac{1}{N} \quad (\forall i \in \{1, \dots, N\})$$
$$R_i = R \times \frac{1}{N}$$

### 4. Time-Decay Attribution
Decays touchpoint value exponentially as distance from conversion time increases, parameterized by half-life $\lambda = 7$ days (168 hours):
$$\Delta t_i = \max(0, T_{conv} - T_i)$$
$$\tilde{w}_i = 2^{-\frac{\Delta t_i}{\lambda}}$$
$$w_i = \frac{\tilde{w}_i}{\sum_{k=1}^N \tilde{w}_k}, \quad R_i = R \times w_i$$

### 5. Position-Based / U-Shaped Attribution
Weights discovery (first touch) and lead conversion (last touch) at 40% each, distributing the remaining 20% evenly across middle nurture interactions:
- If $N = 1$: $w_1 = 1.0$
- If $N = 2$: $w_1 = 0.50, \; w_2 = 0.50$
- If $N \ge 3$:
  $$w_1 = 0.40, \quad w_N = 0.40, \quad w_i = \frac{0.20}{N - 2} \; (\forall i \in \{2, \dots, N-1\})$$

### Invariant Constraint
For every closed-won opportunity under all 5 models:
$$\sum_{i=1}^N w_i = 1.0000 \quad \text{and} \quad \sum_{i=1}^N R_i = R \quad (\pm \$0.01 \text{ penny reconciliation})$$

---

## 5. Marketing Financial ROI Formulations

For a given marketing entity (Campaign or Channel) with Total Cost $C$ and Attributed Revenue $R_{attr}$:

1. **Net Profit / Contribution**:
   $$\text{Net Profit} = R_{attr} - C$$
2. **Return on Investment (ROI)**:
   $$\text{ROI} = \left( \frac{R_{attr} - C}{C} \right) \times 100\%$$
3. **Return on Ad Spend (ROAS)**:
   $$\text{ROAS} = \frac{R_{attr}}{C} \quad (\text{e.g., } 3.4\text{x})$$
4. **Customer Acquisition Cost (CAC)**:
   $$\text{CAC} = \frac{C}{\text{Unique Won Customers}}$$

---

## 6. Required Edge Cases & Data Quarantine Architecture

In high-volume marketing analytics, dirty data silently corrupts business decisions. AttributionOS injects and evaluates 5 critical enterprise anomalies:

1. **Duplicate Revenue (`DuplicateRevenue`)**:
   - *Anomaly*: Duplicate completed orders recorded against a single closed-won opportunity.
   - *Impact*: Artificially doubles revenue and produces fabricated ROI.
   - *Remediation*: Quarantine retains only the canonical initial invoice and cancels duplicates.
2. **Post-Conversion Touchpoint (`PostConversionTouch`)**:
   - *Anomaly*: Touchpoints occurring strictly after the opportunity closed-won date.
   - *Impact*: Naive models falsely award credit to post-sale customer support or retention touches.
   - *Remediation*: Strictly prune touchpoints where $T_{touch} > T_{close}$.
3. **Spend Currency Mismatch (`CurrencyMismatch`)**:
   - *Anomaly*: European (EUR) or British (GBP) invoices logged with 1:1 parity bug against USD.
   - *Impact*: Distorts spend and understates cost by the foreign exchange premium.
   - *Remediation*: Rate-normalization engine converts currency to USD base using daily rates ($1 \text{ EUR} = \$1.08 \text{ USD}$).
4. **Campaign Costs Omitted (`OmittedCost`)**:
   - *Anomaly*: Active campaigns generating touchpoints and won pipeline, but with 0 cost records.
   - *Impact*: Produces infinite / +9999% ROI, misleading CMOs into over-investing in untracked initiatives.
   - *Remediation*: Detects active campaigns lacking cost records and flags them for cost reconciliation.
5. **Ghost Anonymous Session (`GhostAnonymousSession`)**:
   - *Anomaly*: Web session flagged with a `contact_id` without matching identity bridge resolution.
   - *Impact*: Violates privacy traceability and fabricates attribution links.
   - *Remediation*: Flags and unlinks fabricated sessions lacking deterministic proof.

---

## 7. Deterministic Reproducibility

To satisfy **Step 10**, all random generation flows through a deterministic **Mulberry32 PRNG** initialized with a fixed master seed (`20261022`).
- Generating the dataset repeatedly with the same seed yields identical row counts, identical synthetic IDs, and identical SHA256 checksums across all tables.
- Scale parameterization allows running `--scale starter` (for instant local test execution and demo) or `--scale full` (500 campaigns, 50k contacts, 200k touches, 10k opps) using the identical generator logic.
