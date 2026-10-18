# AI Banker Sentinel — Transaction Sentinel module

This source update adds a demo-only transaction review screen to the existing dashboard.

## Included
- Synthetic sample transaction dataset
- Transparent rule-based risk scores (0–100) with visible contributing factors
- Risk-level filters and transaction search
- CSV import validation (2 MB / 1,000 transaction limit, required headers, numeric amounts, valid timestamps, duplicate transaction IDs)
- CSV export of scored results
- Dashboard navigation integration
- Health endpoint service name updated to `ai-banker-sentinel`
- Firebase authentication middleware tightened to require a correctly signed Firebase ID token with the configured project issuer and audience; unsigned/unverified development fallback removed

## CSV format
Required headers: `transactionId,customerId,amount,currency,country,timestamp,status,device`
Optional header: `isNewDevice` (`true` / `false`)

## Important limitations
- This is a synthetic-data prototype, not a production fraud detection system.
- Risk weights are illustrative heuristics, not statistically calibrated.
- Cross-border and unusual-hour flags are broad demo rules and can generate false positives.
- The app is advisory only. Scores must not be treated as proof of fraud or used for automatic account blocking or adverse decisions.
- Run `npm.cmd install`, `npm.cmd run lint`, and `npm.cmd run build` in the project folder before using or deploying this version.

---

## Phase 2: Investigation Case Management Module

Phase 2 adds a comprehensive Human-in-the-Loop Investigation Case Management workflow connected to Transaction Sentinel:

### Capabilities Added
1. **Case Creation from Flagged Transactions**:
   - "Create Investigation Case" action in Transaction Sentinel selected transaction view.
   - Sequential, deterministic case IDs (`CASE-2026-0001`, `CASE-2026-0002`, ...).
   - Captures linked transaction ID, synthetic customer reference, risk score, severity, creation timestamp, creating analyst, priority, assignee, and factual case summary.
   - Duplicate prevention blocks active duplicate cases for the same transaction while surfacing existing case links.

2. **Investigation Case Management View (`src/components/CaseManagement.tsx`)**:
   - Navigation item in sidebar: "Investigation Cases".
   - Search across Case ID, Transaction ID, and synthetic Customer Reference.
   - Filters for Status, Severity, and Priority.
   - Metrics bar showing Total Cases, Active Cases, Escalated Cases, and Closed Cases.
   - Detailed inspection view with full immutable snapshot of the original transaction facts and contributing indicators.

3. **Status Transitions & Human Authority Safeguards**:
   - Clear principle: A risk score is a triage alert for human review, not proof of fraud. Only an authorized human analyst can confirm a fraud outcome.
   - Valid transition state machine: `Open`, `Under Investigation`, `Escalated`, `Closed — No Fraud`, `Closed — Confirmed Fraud`.
   - Mandatory closure validation: requires human analyst closure confirmation checkbox and detailed rationale (≥ 5 characters).
   - Reopening mechanism: closed cases can be reopened back to `Under Investigation` with clear rationale.

4. **Analyst Notes & Evidence Timeline**:
   - Categories: `Observation`, `Evidence`, `Action`, `Decision`.
   - Author attribution, ISO timestamp, length limit (up to 2,000 characters), and optional next step (up to 500 characters).
   - Immutability: notes cannot be silently edited or deleted.

5. **Append-Only Audit Trail**:
   - Structured audit events for `CASE_CREATED`, `ASSIGNMENT_CHANGED`, `STATUS_CHANGED`, `PRIORITY_CHANGED`, `NOTE_ADDED`, `CASE_CLOSED`.
   - Captures actor, timestamp, description, and before/after values.
   - Explicit disclaimer that client-side demonstration logs require server-side enforcement and persistent write controls in production.

---

## Phase 3: Evidence-Grounded Gemini Investigation Assistant

Phase 3 introduces an authenticated, evidence-grounded Gemini assistant that provides transparent explanations of flagged transactions and investigation cases without hallucination.

### Key Capabilities & Safeguards
1. **Authenticated Server Endpoint (`/api/ai/explain-transaction`)**:
   - Protected by `authenticateFirebaseToken` middleware verifying RS256 signatures against Google JWKS with project issuer and audience constraints.
   - Never accepts unverified or decoded-only tokens.
   - Reads `GEMINI_API_KEY` from the server environment only. Secrets are never exposed to browser bundles or network payloads.

2. **Strict Evidence-Grounding System Instructions**:
   - Explanation draws exclusively upon supplied transaction attributes, actual risk scores, and contributing heuristics.
   - Explicit prohibition against speculating on customer intent, unprovided account history, or fictitious policy citations.
   - When evidence is missing, it is explicitly labeled as "unavailable" rather than fabricated.

3. **Structured Explanation Sections**:
   - **Transaction Summary**: Concise executive synthesis.
   - **Observed Facts**: Bulleted verified facts (amount, location, device, status, timestamp).
   - **Risk Factor Contributions**: Exact points breakdown (+35 high amount, +25 cross border, etc.).
   - **Missing Evidence & Limitations**: Transparent list of absent data dimensions.
   - **Recommended Investigation Checks**: Actionable checks labeled as either fact-tied or general baseline checks.
   - **Cautious Risk Assessment**: Human authority notice emphasizing that a score is an alert, not proof of fraud.

4. **Human Analyst Governance & AI Note Integration**:
   - Explaining a transaction **never** automatically changes case status, priority, risk score, or fraud outcome.
   - Analysts can explicitly save the explanation report as an AI-generated note on the case timeline.
   - AI notes are marked with `isAIGenerated: true`, the requesting analyst's name, and the model used.
   - Adding an AI note logs a dedicated event in the immutable audit trail.

