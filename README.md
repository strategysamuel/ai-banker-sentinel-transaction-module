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
