# AI Banker Sentinel

**AI-powered banking transaction risk monitoring, investigation and banker productivity assistant.**

AI Banker Sentinel is a demonstration application built for **AI Builder Cup 2026**. It helps banking professionals review suspicious transaction patterns, understand risk indicators, explore supporting evidence, manage investigation workflows and access AI-assisted banking productivity tools.

## 🚀 Live Demo

- **Application:** https://ai-banker-sentinel-tx-187809946297.asia-south1.run.app
- **GitHub Repository:** https://github.com/strategysamuel/ai-banker-sentinel-transaction-module
- **Demo Video:** https://drive.google.com/file/d/1vwU648VpXDBqU8iIppyh2dnxAvk747p2/view?usp=drive_link

## ✨ Key Features

### 1. Transaction Sentinel
- Review transaction records and risk indicators.
- Examine risk scores and contributing factors.
- Import and export transaction data where supported.
- Use flagged transactions to support analyst review.

**Data note:** The demonstration uses synthetic transaction data. It is not connected to a live bank transaction feed.

### 2. Investigation Case Management
- Create investigation cases from selected transactions.
- Track case status, severity, priority and assignment.
- Add categorized analyst notes and review case history.
- Maintain an audit-style event trail within the application workflow.

**Persistence note:** The reviewed implementation stores cases in browser `localStorage`. This is not a shared server-side case database, and browser-local audit records are not a substitute for a production-grade, tamper-resistant audit system.

### 3. AI Evidence Explanations
- Summarize observed transaction attributes and risk indicators.
- Identify missing evidence and suggest investigation checks.
- Use Gemini-powered explanations when the live model call succeeds.
- Distinguish fallback explanations when a live model response is unavailable.

AI-generated explanations support analyst review; they do not establish that fraud has occurred.

### 4. Project Compass — Banking SOP Knowledge Base
- Search a synthetic banking Standard Operating Procedure (SOP) catalog.
- Retrieve relevant policy information and citations.
- Apply retrieval and policy-version safeguards to supported queries.
- Support human verification for sensitive banking procedures.

The SOP catalog is synthetic demonstration content, not an official bank policy library.

### 5. Banker Productivity Tools
The workspace also demonstrates:
- Customer meeting preparation
- Banking email assistance
- Process optimization
- Transformation assessment
- AI learning resources
- Session history and a 30-day transformation plan

Availability and persistence may differ by module.

## 🏗️ Technology

- **Application hosting:** Google Cloud Run
- **AI:** Google Gemini API
- **Authentication:** Firebase Authentication, subject to application configuration
- **Application stack:** Node.js, TypeScript and the web frontend build toolchain
- **Knowledge retrieval:** Project Compass synthetic SOP catalog and vector index

The application uses server-side configuration for Gemini credentials. Verify the deployed runtime and service configuration before treating any status indicator as proof of live service health.

## 🔐 Responsible AI and Security

- Use synthetic data for demonstrations and testing.
- Never enter real customer personal information, bank account details, PINs, passwords, API keys or confidential banking records.
- Treat risk scores as indicators for review, not proof of fraud.
- Keep final investigation and operational decisions with authorized human reviewers.
- Recognize that AI outputs can be incomplete or incorrect and require verification.
- Do not treat browser-local case records as production audit evidence.

This project is a demonstration prototype. It is not represented as a production-certified banking platform or as a replacement for a bank's core systems, fraud controls or regulatory obligations.

## 💻 Local Development

### Prerequisites
- Node.js and npm compatible with the versions specified by the project.
- A Gemini API key if you intend to test live AI features.
- Firebase configuration for authentication features.

### Setup

```bash
git clone https://github.com/strategysamuel/ai-banker-sentinel-transaction-module.git
cd ai-banker-sentinel-transaction-module
npm ci
```

Configure the required environment variables using the project's example configuration, if provided. Keep secrets in a local `.env` file or an appropriate secret manager; **never commit credentials**.

Check `package.json` for the available development, build and test scripts before running them.

## ☁️ Deployment

The demonstration application is deployed on Google Cloud Run in the `asia-south1` region.

- **Cloud Run service:** `ai-banker-sentinel-tx`
- **Cloud project:** `ai-banker-sentinel-e07db`

For deployment changes, use the repository's Dockerfile and verify the relevant environment variables, Secret Manager permissions, authentication configuration and health endpoint.

## ⚠️ Current Limitations

- Transaction monitoring uses synthetic demonstration data, not a live banking feed.
- Investigation cases use browser-local persistence rather than a shared server-side case database.
- Synthetic SOPs do not represent official banking policy.
- Some AI explanations may use a fallback when live model generation is unavailable.
- Production use would require appropriate server-side persistence, access controls, durable audit logging, operational monitoring, security testing and integration with authorized banking systems.

## 🎯 Project Goal

Demonstrate how AI-assisted transaction review, evidence-oriented explanations, policy retrieval and structured investigation workflows can support banking professionals while keeping human judgment and responsible AI safeguards central.

**Built for AI Builder Cup 2026.**