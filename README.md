<<<<<<< HEAD
﻿# AI Banker Sentinel ðŸ¦âœ¨
> **Google Cloud Run AI Challenge Submission**  
> *Detect suspicious banking activity with secure, evidence-led AI. Investigate transactions, assess risk, and support accountable human decisions.*

---

## 1. Project Overview

The **AI Banker Sentinel** is a production-grade enterprise assistant built specifically for commercial, retail, and private banking professionals. Modern banking workflows face a critical tension: frontline professionals require rapid, contextual guidance to navigate intricate standard operating procedures (SOPs), customer interactions, and operational tasks, yet strict regulatory frameworks prohibit hallucinations, data leakage, and ungrounded AI decision-making.

The **AI Banker Sentinel** solves this by pairing Google's **Gemini models** with **Project Compass**â€”a deterministic, retrieval-augmented governance and policy intelligence engine designed with strict human-in-the-loop validation, policy version isolation, and zero-trust security controls.

---

## 2. Core Capabilities & Architecture

```
                                  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                                  â”‚   Frontline Banker     â”‚
                                  â”‚  (Web Browser / SPA)   â”‚
                                  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                              â”‚ Google Sign-In (Firebase ID Token)
                                              â–¼
                        â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                        â”‚              Google Cloud Run                â”‚
                        â”‚       (Node.js / Express Server)             â”‚
                        â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
                        â”‚ â€¢ Firebase Auth Middleware (Token Verify)    â”‚
                        â”‚ â€¢ Sensitive PII Filter & Payload Sanity      â”‚
                        â”‚ â€¢ Rate Limiting & 1MB Body Constraint        â”‚
                        â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”˜
                               â”‚                â”‚               â”‚
      â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”              â”‚               â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
      â”‚                          â”‚              â”‚                                          â”‚
      â–¼                          â–¼              â–¼                                          â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Cloud        â”‚   â”‚  Project Compass RAG   â”‚ â”‚    Google Gemini     â”‚  â”‚ Cloud Firestore (Isolated)      â”‚
â”‚ Secret Mgr   â”‚   â”‚  Vector Engine         â”‚ â”‚    API Service       â”‚  â”‚ â€¢ /users/{uid}/interactions     â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤   â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤ â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤  â”‚ â€¢ /users/{uid}/transformation   â”‚
â”‚ GEMINI_      â”‚   â”‚ â€¢ 3,072-dim embeddings â”‚ â”‚ â€¢ gemini-3.7-flash   â”‚  â”‚ â€¢ /users/{uid}/sops             â”‚
â”‚ API_KEY      â”‚   â”‚ â€¢ Similarity Threshold â”‚ â”‚ â€¢ Grounded answers   â”‚  â”‚ Security: Auth UID Owner Only   â”‚
â”‚              â”‚   â”‚ â€¢ Version Safety Gate  â”‚ â”‚ â€¢ Fallback model     â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚ â€¢ Citation Validation  â”‚ â”‚   resilience         â”‚
                   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### High-Level Components
1. **AI Banker Copilot**: Multi-turn contextual assistant for banking communications, meeting preparation, process optimization, and AI upskilling.
2. **Project Compass Policy Engine**: A production RAG system serving standard operating procedures (SOPs) with exact section-level citations, version currency checks, and deterministic risk gating.
3. **Customer Meeting Prep Generator**: Structured briefing generator that produces agendas, risk disclosures, objection management strategies, and follow-up checklists from synthetic customer context.
4. **Governance & Human-in-the-Loop Hub**: Real-time evaluation of high-operational-risk procedures (wires, power-of-attorney, fee waivers) requiring mandatory frontline banker verification before execution.
5. **Session History & Owner-Bound Persistence**: Complete session lifecycle management (view, search, restore, continue, delete) isolated strictly by verified Firebase UID.

---

## 3. Project Compass â€” RAG & Governance Architecture

Project Compass is engineered to eliminate hallucination risks in regulated banking operations:

- **Vector Embeddings (`gemini-embedding-2`)**: Standardized 3,072-dimensional vector index generated across synthetic banking SOP chunks.
- **Deterministic Similarity Threshold (0.7000)**: Any query falling below 0.70 similarity automatically triggers the `policy_not_found` negative gate. **Gemini is never invoked** for out-of-scope queries (e.g. mortgage approvals, live account balances, market rates, general world queries), returning structured refusal guidance immediately.
- **Strict Version Control & Active Version Isolation**: 
  - The vector index indexes historical revisions for auditing (`PC-WIRE-001 v4.1`, `PC-FEE-001 v2.0`, `PC-DIGITAL-001 v1.3`), but normal operational retrieval **strictly filters `status === 'ACTIVE'`**.
  - Superseded versions (`v4.1`, `v2.0`, `v1.3`) are blocked from entering grounding context.
  - Active versions (`v4.2`, `v2.1`, `v1.4`) are safely retrieved.
- **Policy Version Conflict Gate (`detectPolicyVersionConflicts`)**: If candidate chunks ever exhibit conflicting active versions or mixed superseded states, the system blocks generation and returns a controlled `policy_conflict` response.
- **Scheduled Review & Effective Date Safety (`evaluateReviewDate`)**: Evaluates policy review dates against operational cycles, issuing `APPROACHING_REVIEW` notices (within 90-day window) and `PAST_REVIEW` warnings.
- **Citation Alignment & Sanitization (`validateAndAlignCitations`)**: Cross-checks model outputs against exact retrieved chunk anchors. Fabricated or ungrounded citations are stripped and replaced with genuine retrieved anchors.
- **Server-Authoritative High-Risk Classification**: Evaluates sensitive operational procedures (`PC-WIRE-001`, `PC-POA-001`, `PC-FEE-001`, `PC-ACCOUNT-001`, `PC-SANCTION-001`) and enforces mandatory `requiresHumanVerification: true`. The client cannot override or bypass this classification.
- **Zero-Secret Audit Logging**: Immutable in-memory audit logs capturing authenticated UID, query ID, chunk IDs, policy IDs, versions, similarity scores, and risk flags without exposing tokens or credentials.

---

## 4. Synthetic Standard Operating Procedures Catalog

The application includes 10 synthetic Standard Operating Procedures covering critical commercial and retail banking workflows:

| Policy ID | Version | Title | Owner | Status | Effective Date | Next Review |
|---|---|---|---|---|---|---|
| `PC-WIRE-001` | `v4.2` | International Wire Transfer SOP | Wire Operations | ACTIVE | 2026-08-01 | 2027-08-01 |
| `PC-POA-001` | `v2.0` | Power of Attorney Handling SOP | Legal & Compliance | ACTIVE | 2026-06-01 | 2027-06-01 |
| `PC-FEE-001` | `v2.1` | Fee Waiver Approval SOP | Retail Banking Operations | ACTIVE | 2026-07-15 | 2027-07-15 |
| `PC-ACCOUNT-001` | `v1.0` | Deposit Account Opening SOP | Branch Operations | ACTIVE | 2026-05-01 | 2027-05-01 |
| `PC-DORMANT-001` | `v2.0` | Dormant Account Reactivation SOP | Account Services | ACTIVE | 2026-04-01 | 2027-04-01 |
| `PC-DIGITAL-001` | `v1.4` | Digital Banking Enrollment SOP | Digital Channels | ACTIVE | 2026-07-01 | 2027-07-01 |
| `PC-SANCTION-001` | `v3.0` | OFAC & Sanctions Screening SOP | AML/BSA Compliance | ACTIVE | 2026-06-15 | 2027-06-15 |
| `PC-SAFE-001` | `v1.0` | Safe Deposit Box Access SOP | Branch Operations | ACTIVE | 2026-03-01 | 2027-03-01 |
| `PC-CARD-001` | `v3.0` | Debit Card Replacement SOP | Card Operations | ACTIVE | 2026-05-15 | 2027-05-15 |
| `PC-DISPUTE-001` | `v2.0` | Transaction Dispute Intake SOP | Fraud & Claims | ACTIVE | 2026-06-01 | 2027-06-01 |

> **DEMO DATA NOTICE**: All SOPs, thresholds, guidelines, and scenarios in Project Compass are synthetic demo assets created specifically for the Cloud Run AI Challenge. They do not constitute actual legal or banking policy.

---

## 5. Technology Stack

- **Runtime & Deployment**: Google Cloud Run (Node.js 22 LTS, Linux Container)
- **AI Models & SDK**: Google Gemini API via `@google/genai` TypeScript SDK (`gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-embedding-2`)
- **Backend**: Express 4 with TypeScript, JOSE token verification, and ESBuild CJS bundler
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide React icons, and Motion
- **Authentication**: Firebase Authentication (Google Sign-In with server-side ID token verification)
- **Database**: Cloud Firestore with owner-bound security rules (`/users/{uid}/*`)
- **Secret Management**: Google Cloud Secret Manager (`GEMINI_API_KEY`)

---

## 6. Environment Variables

| Variable Name | Required? | Location | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | **Yes** | Server / Secret Manager | API key for Google Gemini model generation and vector embeddings. |
| `PORT` | Optional (Default: 3000) | Container / Cloud Run | Port on which the Express server listens. |
| `NODE_ENV` | Optional (Default: `development`) | Environment | `production` enables static SPA serving; `development` mounts Vite middleware. |
| `GEMINI_MODEL` | Optional (Default: auto-selected) | Server | Primary model override (defaults to stable Gemini 2.5/3.x flash models). |
| `APP_URL` | Optional | Client / Server | Base hosting URL for self-referential links. |

---

## 7. Security Architecture

1. **Server-Side API Key Isolation**: The Gemini API key is never bundled, passed, or exposed to the client browser. All AI generation happens via protected server routes (`/api/ai/*`, `/api/project-compass/*`).
2. **Verified Identity (Zero Client Trust)**: Backend routes verify the Firebase JWT token via `jose` and derive the user identity from `decoded.sub`. Client-supplied UIDs in request bodies are ignored.
3. **Owner-Bound Firestore Rules**: Security rules in `firestore.rules` restrict read, write, and delete permissions to `request.auth.uid == userId`.
4. **Sensitive Banking PII Guardrails**: Pre-generation validation inspects input text for credit card numbers, Social Security numbers, ABA routing strings, and banking credentials, rejecting requests containing live PII.
5. **No Blind Trust / Human-in-the-Loop**: Responses for high-operational-risk procedures display warning banners and require independent banker verification before transaction execution.

---

## 8. Local Development & Testing

### Prerequisites
- Node.js 20+ or 22+
- npm 10+
- Google Gemini API Key

### Setup
```bash
# 1. Clone the repository and install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Add your GEMINI_API_KEY to .env

# 3. Start local development server (Port 3000)
npm run dev
```

### Running Test Suites
```bash
# Type check & linting
npm run lint

# Production compilation
npm run build

# Phase 3A: SOP Catalog & Metadata Verification
npx tsx scripts/verify-phase3a.ts

# Phase 3B: RAG Vector Engine & Negative Gate Tests
npx tsx scripts/test-phase3b-rag.ts
npx tsx scripts/test-phase3b-hardening.ts

# Phase 3C: Governance, Version Safety & Citation Alignment
npx tsx scripts/test-phase3c-governance.ts

# API Health & Catalog Endpoint Verification
npx tsx scripts/test-api-health.ts
```

---

## 9. Google Cloud Run Deployment

### Docker Container Build & Run
```bash
# Build production Docker container
docker build -t ai-banker-copilot:latest .

# Run locally
docker run -p 3000:3000 -e GEMINI_API_KEY="your-api-key" ai-banker-copilot:latest
```

### Cloud Run Deployment Command
```bash
gcloud run deploy ai-banker-transformation-copilot \
  --source . \
  --region asia-southeast1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --labels dev-tutorial=cloud-run-ai-challenge
```

---

## 10. Cloud Run AI Challenge Compliance

- **Challenge Label**: `dev-tutorial=cloud-run-ai-challenge`
- **Health Check Endpoint**: `/api/health` exposes health state, service metadata, and challenge identification.
- **Serverless Architecture**: Stateless container with sub-second healthchecks, automatic scaling, and Secret Manager integration.

---

## 11. Known Limitations

- **Synthetic SOP Corpus**: The knowledge base contains 10 synthetic SOPs designed for demonstration. Integration with enterprise document management systems (e.g. SharePoint, OpenText) is not included.
- **Advisory Only**: The Copilot provides advisory and drafting assistance. It does not execute live core banking transactions, wire releases, or credit approvals.

=======
# AI Banker Sentinel

**AI-powered banking transaction risk monitoring and investigation platform.**

AI Banker Sentinel helps banking analysts review suspicious transaction patterns, understand risk indicators, examine supporting evidence, and manage investigation cases while keeping humans responsible for final decisions.

## Live Application

🚀 **Demo:** https://ai-banker-sentinel-tx-187809946297.asia-south1.run.app

💻 **Source Code:** https://github.com/strategysamuel/ai-banker-sentinel-transaction-module

## Key Features

- **Transaction Sentinel:** Review transactions, risk scores, and contributing indicators.
- **Investigation Case Management:** Track investigation status, priority, assignment, and analyst notes.
- **Evidence-Grounded Explanations:** Examine observed transaction facts, risk factors, missing information, and recommended investigation checks.
- **Project Compass:** Search a synthetic banking SOP knowledge base and retrieve relevant policy information.
- **Banker Productivity Tools:** Demonstrations of customer meeting preparation, banking email assistance, and process optimization.

## Technology

- Google Cloud Run — application deployment.
- Gemini — AI capabilities, subject to runtime configuration and successful model responses.
- Firebase — authentication and related application services, subject to configuration.
- Node.js and the web application build toolchain.

## Responsible AI and Data Safety

This is a demonstration prototype using synthetic transaction data. It is not connected to live banking systems.

- Risk scores are alerts for human review, not proof of fraud.
- Authorized analysts remain responsible for investigation outcomes.
- Never enter real customer personal information, bank account numbers, passwords, PINs, API keys, or confidential banking data.
- AI explanations may use a labelled fallback when a live model response is unavailable.
- This project is not represented as a production-certified banking system.

## Demo Video

https://drive.google.com/file/d/1vwU648VpXDBqU8iIppyh2dnxAvk747p2/view?usp=drive_link

## Local Setup

Review `package.json` for the project's actual scripts and prerequisites before running locally. Keep secrets in local environment files and never commit `.env` files or API keys.

## Project

Built for **AI Builder Cup 2026**.
>>>>>>> origin/main
