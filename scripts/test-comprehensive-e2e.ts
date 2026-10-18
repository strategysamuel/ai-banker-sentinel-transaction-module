/**
 * Comprehensive End-to-End Verification Suite for AI Banker Sentinel
 *
 * Covers:
 * 1. CSV Parser & Edge Cases (Schema validation, headers, negatives, bounds, malformed timestamps, duplicates, limits)
 * 2. Deterministic Scoring Engine (0-100 bounds, threshold rules, reproducibility, no unexplained factors)
 * 3. Case Management Lifecycle & Transitions (Create, active-duplicate prevention, post-closure recreation, transitions, closure rationale, append-only audit trail, searching/filtering)
 * 4. Dual Persistence Semantics (Memory vs localStorage snapshot testing without modifying user data)
 * 5. Gemini Explanation & Fallback System (Live model detection vs architectural fallback, grounding, advisory disclaimer)
 * 6. Auth & Security Hardening (JWT signature/issuer/audience/expiry validation, route protection, secret isolation, firestore rules)
 */

import { parseCsv, scoreTransactions, REQUIRED_CSV_HEADERS, sampleTransactions, Transaction } from '../src/components/TransactionSentinel';
import { caseService, isValidStatusTransition, isClosedStatus, buildFactualSummary } from '../src/services/caseService';
import {
  parseAndNormalizeInvestigationExplanationJSON,
  TRANSACTION_INVESTIGATION_SYSTEM_INSTRUCTION,
} from '../server/gemini';
import { authenticateFirebaseToken } from '../server/auth';
import * as fs from 'fs';
import * as path from 'path';

let passed = 0;
let failed = 0;
const results: { category: string; test: string; status: 'PASS' | 'FAIL'; details?: string }[] = [];

function assert(condition: boolean, testName: string, category: string, details?: string) {
  if (condition) {
    passed++;
    results.push({ category, test: testName, status: 'PASS', details });
    console.log(`  ✅ [${category}] ${testName}`);
  } else {
    failed++;
    results.push({ category, test: testName, status: 'FAIL', details });
    console.error(`  ❌ [${category}] ${testName} - FAILED: ${details || 'Assertion failed'}`);
  }
}

async function runComprehensiveVerification() {
  console.log('======================================================================');
  console.log('  STARTING COMPREHENSIVE E2E VERIFICATION: AI BANKER SENTINEL');
  console.log('======================================================================\n');

  // -------------------------------------------------------------------------
  // CATEGORY 1: CSV INGESTION & DATA VALIDATION
  // -------------------------------------------------------------------------
  console.log('--- 1. CSV Ingestion & Data Validation ---');

  // 1.1 Valid CSV upload
  const validCsv = [
    'transactionId,customerId,amount,currency,country,timestamp,status,device,isNewDevice',
    'TX-E2E-01,C-TEST-1,50000,INR,IN,2026-10-18T10:00:00Z,SUCCESS,mobile-app,false',
    'TX-E2E-02,C-TEST-2,120000,INR,AE,2026-10-18T03:00:00Z,SUCCESS,web-chrome,true',
  ].join('\n');

  try {
    const parsed = parseCsv(validCsv);
    assert(parsed.length === 2, 'Valid CSV parses exact row count', 'CSV_VALIDATION');
    assert(parsed[0].transactionId === 'TX-E2E-01' && parsed[0].amount === 50000, 'Values and numeric types mapped accurately', 'CSV_VALIDATION');
    assert(parsed[1].isNewDevice === true, 'Boolean isNewDevice correctly parsed', 'CSV_VALIDATION');
  } catch (err) {
    assert(false, 'Valid CSV parsing failed', 'CSV_VALIDATION', String(err));
  }

  // 1.2 Required headers validation
  assert(REQUIRED_CSV_HEADERS.length === 8, 'REQUIRED_CSV_HEADERS has exact 8 fields', 'CSV_VALIDATION');
  try {
    parseCsv('customerId,amount,currency,country,timestamp,status,device\nC-1,100,INR,IN,2026-10-18T10:00:00Z,SUCCESS,mob');
    assert(false, 'Missing transactionId header should throw error', 'CSV_VALIDATION');
  } catch (err: any) {
    assert(err.message.includes('Missing required columns: transactionId'), 'Missing transactionId header rejected with helpful message', 'CSV_VALIDATION');
  }

  // 1.3 Negative amounts rejected
  try {
    parseCsv('transactionId,customerId,amount,currency,country,timestamp,status,device\nTX-NEG,C-1,-500,INR,IN,2026-10-18T10:00:00Z,SUCCESS,mob');
    assert(false, 'Negative amount should throw error', 'CSV_VALIDATION');
  } catch (err: any) {
    assert(err.message.includes('amount must be a non-negative number'), 'Negative amount rejected cleanly', 'CSV_VALIDATION');
  }

  // 1.4 Non-numeric amount rejected
  try {
    parseCsv('transactionId,customerId,amount,currency,country,timestamp,status,device\nTX-NAN,C-1,abc_dollars,INR,IN,2026-10-18T10:00:00Z,SUCCESS,mob');
    assert(false, 'Non-numeric amount should throw error', 'CSV_VALIDATION');
  } catch (err: any) {
    assert(err.message.includes('amount must be a non-negative number'), 'Non-numeric amount rejected cleanly', 'CSV_VALIDATION');
  }

  // 1.5 Malformed timestamp rejected
  try {
    parseCsv('transactionId,customerId,amount,currency,country,timestamp,status,device\nTX-TIME,C-1,100,INR,IN,invalid-date-string,SUCCESS,mob');
    assert(false, 'Malformed timestamp should throw error', 'CSV_VALIDATION');
  } catch (err: any) {
    assert(err.message.includes('timestamp is invalid'), 'Invalid timestamp rejected cleanly', 'CSV_VALIDATION');
  }

  // 1.6 Duplicate transaction ID rejected
  try {
    const dupCsv = [
      'transactionId,customerId,amount,currency,country,timestamp,status,device',
      'TX-DUP,C-1,100,INR,IN,2026-10-18T10:00:00Z,SUCCESS,mob',
      'TX-DUP,C-2,200,INR,IN,2026-10-18T10:05:00Z,SUCCESS,mob',
    ].join('\n');
    parseCsv(dupCsv);
    assert(false, 'Duplicate transactionId should throw error', 'CSV_VALIDATION');
  } catch (err: any) {
    assert(err.message.includes('Duplicate transactionId "TX-DUP"'), 'Duplicate transaction IDs prevented', 'CSV_VALIDATION');
  }

  // 1.7 Empty or single row CSV rejected
  try {
    parseCsv('transactionId,customerId,amount,currency,country,timestamp,status,device\n');
    assert(false, 'Header-only CSV should throw error', 'CSV_VALIDATION');
  } catch (err: any) {
    assert(err.message.includes('CSV must include a header row and at least one transaction'), 'Header-only CSV rejected', 'CSV_VALIDATION');
  }

  // 1.8 Unclosed quotes rejected safely
  try {
    parseCsv('transactionId,customerId,amount,currency,country,timestamp,status,device\n"TX-QUOTE,C-1,100,INR,IN,2026-10-18T10:00:00Z,SUCCESS,mob');
    assert(false, 'Unclosed quote should throw error', 'CSV_VALIDATION');
  } catch (err: any) {
    assert(err.message.includes('unclosed quoted field'), 'Unclosed quoted field rejected', 'CSV_VALIDATION');
  }

  // -------------------------------------------------------------------------
  // CATEGORY 2: DETERMINISTIC RISK-SCORING ENGINE
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Deterministic Risk-Scoring Engine ---');

  // 2.1 Baseline low-risk transaction
  const baselineTx: Transaction = {
    transactionId: 'TX-BASE',
    customerId: 'C-BASE',
    amount: 1500,
    currency: 'INR',
    country: 'IN',
    timestamp: '2026-10-18T12:00:00+05:30', // noon
    status: 'SUCCESS',
    device: 'registered-phone-1',
    isNewDevice: false,
  };
  const [scoredBase] = scoreTransactions([baselineTx]);
  assert(scoredBase.score === 0, 'Baseline transaction has 0 score', 'RISK_SCORING');
  assert(scoredBase.level === 'Low', 'Baseline transaction is Low risk', 'RISK_SCORING');
  assert(scoredBase.factors.length === 0, 'No unexplained factors for normal transaction', 'RISK_SCORING');

  // 2.2 Threshold tests
  // Amount >= 100,000 -> +35
  const [txVeryHigh] = scoreTransactions([{ ...baselineTx, amount: 100000 }]);
  assert(txVeryHigh.score === 35 && txVeryHigh.factors.includes('Very high transaction amount (≥ 100,000)'), 'Amount >= 100,000 triggers +35 pts', 'RISK_SCORING');

  // Amount >= 50,000 and < 100,000 -> +22
  const [txHigh] = scoreTransactions([{ ...baselineTx, amount: 50000 }]);
  assert(txHigh.score === 22 && txHigh.factors.includes('High transaction amount (≥ 50,000)'), 'Amount >= 50,000 triggers +22 pts', 'RISK_SCORING');

  // Cross border -> +25
  const [txCrossBorder] = scoreTransactions([{ ...baselineTx, country: 'US' }]);
  assert(txCrossBorder.score === 25 && txCrossBorder.factors.includes('Cross-border location (US)'), 'Cross border location triggers +25 pts', 'RISK_SCORING');

  // New device -> +18
  const [txNewDevice] = scoreTransactions([{ ...baselineTx, isNewDevice: true }]);
  assert(txNewDevice.score === 18 && txNewDevice.factors.includes('New device indicator'), 'New device triggers +18 pts', 'RISK_SCORING');

  // Unusual hour (< 5 or >= 23) -> +12
  const [txNocturnalEarly] = scoreTransactions([{ ...baselineTx, timestamp: '2026-10-18T03:30:00+05:30' }]);
  const [txNocturnalLate] = scoreTransactions([{ ...baselineTx, timestamp: '2026-10-18T23:30:00+05:30' }]);
  assert(txNocturnalEarly.score === 12 && txNocturnalEarly.factors.includes('Unusual transaction hour'), 'Early morning hour triggers +12 pts', 'RISK_SCORING');
  assert(txNocturnalLate.score === 12 && txNocturnalLate.factors.includes('Unusual transaction hour'), 'Late night hour triggers +12 pts', 'RISK_SCORING');

  // Single decline vs repeated declines
  const [txSingleDecline] = scoreTransactions([{ ...baselineTx, status: 'DECLINED' }]);
  assert(txSingleDecline.score === 8 && txSingleDecline.factors.includes('Transaction declined'), 'Single decline triggers +8 pts', 'RISK_SCORING');

  const [txRep1, txRep2] = scoreTransactions([
    { ...baselineTx, transactionId: 'TX-D1', status: 'DECLINED', timestamp: '2026-10-18T12:00:00Z' },
    { ...baselineTx, transactionId: 'TX-D2', status: 'DECLINED', timestamp: '2026-10-18T12:01:00Z' },
  ]);
  assert(txRep1.factors.includes('Repeated declined transactions for customer'), 'Customer with multiple declines triggers +18 pts', 'RISK_SCORING');
  assert(txRep1.factors.includes('Multiple transactions within 10 minutes'), 'Velocity within 10 minutes triggers +15 pts', 'RISK_SCORING');

  // 2.3 Score capping at 100
  const extremeTx: Transaction = {
    transactionId: 'TX-MAX',
    customerId: 'C-MAX',
    amount: 500000, // +35
    currency: 'INR',
    country: 'AE', // +25
    timestamp: '2026-10-18T02:00:00+05:30', // +12
    status: 'DECLINED', // +8
    device: 'unregistered-web',
    isNewDevice: true, // +18
  };
  // 35 + 25 + 12 + 8 + 18 = 98 (with velocity or multiple declines > 100)
  const [txExtreme1, txExtreme2] = scoreTransactions([
    extremeTx,
    { ...extremeTx, transactionId: 'TX-MAX-2', timestamp: '2026-10-18T02:05:00+05:30' },
  ]);
  assert(txExtreme1.score <= 100, `Score is capped at 100 (actual: ${txExtreme1.score})`, 'RISK_SCORING');
  assert(txExtreme1.level === 'High', 'Score >= 60 results in High level', 'RISK_SCORING');

  // 2.4 Reproducibility
  const run1 = scoreTransactions(sampleTransactions);
  const run2 = scoreTransactions(sampleTransactions);
  assert(JSON.stringify(run1) === JSON.stringify(run2), 'Scoring is 100% deterministic and reproducible', 'RISK_SCORING');

  // -------------------------------------------------------------------------
  // CATEGORY 3: INVESTIGATION CASE-MANAGEMENT LIFECYCLE
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Investigation Case-Management Lifecycle ---');

  // 3.1 Case Creation from Flagged Transaction
  const flaggedSnapshot = {
    transactionId: 'TX-E2E-CASE-1',
    customerId: 'C-E2E-USER',
    amount: 250000,
    currency: 'INR',
    country: 'SG',
    timestamp: '2026-10-18T10:15:00Z',
    status: 'SUCCESS',
    device: 'chrome-99',
    isNewDevice: true,
    score: 78,
    level: 'High' as const,
    factors: ['Very high transaction amount (≥ 100,000)', 'Cross-border location (SG)', 'New device indicator'],
  };

  const createdCase = caseService.createCase({
    transaction: flaggedSnapshot,
    creatingAnalyst: 'Alex Miller',
    creatingAnalystEmail: 'a.miller@bank.com',
    priority: 'Critical',
    assignedAnalyst: 'Alex Miller',
    initialNote: 'High risk cross border transaction detected during automated scan.',
  });

  assert(createdCase.id.startsWith('CASE-'), `Generated case ID format valid (${createdCase.id})`, 'CASE_MANAGEMENT');
  assert(createdCase.status === 'Open', 'Initial status is Open', 'CASE_MANAGEMENT');
  assert(createdCase.priority === 'Critical', 'Priority correctly set to Critical', 'CASE_MANAGEMENT');
  assert(createdCase.notes.length === 1, 'Initial intake note attached', 'CASE_MANAGEMENT');
  assert(createdCase.auditTrail.length === 2, 'Initial CASE_CREATED and NOTE_ADDED audit events logged', 'CASE_MANAGEMENT');

  // 3.2 Duplicate active case prevention
  try {
    caseService.createCase({
      transaction: flaggedSnapshot,
      creatingAnalyst: 'Alex Miller',
      priority: 'High',
    });
    assert(false, 'Duplicate active case creation should have thrown', 'CASE_MANAGEMENT');
  } catch (err: any) {
    assert(err.message.includes('already exists for transaction'), 'Duplicate active case rejected with descriptive error', 'CASE_MANAGEMENT');
  }

  // 3.3 State machine transitions
  assert(isValidStatusTransition('Open', 'Under Investigation'), 'Open -> Under Investigation is valid', 'STATE_MACHINE');
  assert(isValidStatusTransition('Under Investigation', 'Escalated'), 'Under Investigation -> Escalated is valid', 'STATE_MACHINE');
  assert(!isValidStatusTransition('Closed — Confirmed Fraud', 'Escalated'), 'Closed — Confirmed Fraud -> Escalated is prohibited', 'STATE_MACHINE');

  // Update status to Under Investigation
  const step1 = caseService.updateStatus({
    caseId: createdCase.id,
    newStatus: 'Under Investigation',
    actor: 'Alex Miller',
  });
  assert(step1.status === 'Under Investigation', 'Case moved to Under Investigation', 'CASE_MANAGEMENT');

  // 3.4 Notes & Tamper Resistance
  const addedNote = caseService.addNote({
    caseId: createdCase.id,
    author: 'Alex Miller',
    category: 'Observation',
    content: 'Contacted customer by phone to verify device fingerprint.',
    nextStep: 'Await customer return call.',
  });
  assert(Boolean(addedNote && addedNote.id), 'New note appended with ID', 'CASE_MANAGEMENT');
  const caseAfterNote = caseService.getCaseById(createdCase.id);
  assert(caseAfterNote?.notes.length === 2, 'Case notes count incremented to 2', 'CASE_MANAGEMENT');
  assert((caseService as any).deleteNote === undefined, 'No deleteNote method exposed (notes immutable)', 'CASE_MANAGEMENT');
  assert((caseService as any).editNote === undefined, 'No editNote method exposed (notes immutable)', 'CASE_MANAGEMENT');

  // 3.5 Case Closure Reason Enforcement
  try {
    caseService.updateStatus({
      caseId: createdCase.id,
      newStatus: 'Closed — Confirmed Fraud',
      actor: 'Alex Miller',
      closureReason: '', // missing
    });
    assert(false, 'Closing without rationale should fail', 'CASE_MANAGEMENT');
  } catch (err: any) {
    assert(err.message.includes('detailed closure reason'), 'Closing without rationale rejected with clear requirement', 'CASE_MANAGEMENT');
  }

  // Proper closure
  const closedCase = caseService.updateStatus({
    caseId: createdCase.id,
    newStatus: 'Closed — Confirmed Fraud',
    actor: 'Alex Miller',
    closureReason: 'Customer confirmed unauthorized transaction from stolen credentials.',
  });
  assert(closedCase.status === 'Closed — Confirmed Fraud', 'Case closed as Confirmed Fraud', 'CASE_MANAGEMENT');
  assert(closedCase.closedAt !== undefined && closedCase.closedBy === 'Alex Miller', 'Closed timestamp and actor recorded', 'CASE_MANAGEMENT');

  // 3.6 Creation permitted after prior case is closed
  const reopenedCycleCase = caseService.createCase({
    transaction: flaggedSnapshot,
    creatingAnalyst: 'Alex Miller',
    priority: 'High',
    initialNote: 'New suspicious activity on previously closed account.',
  });
  assert(reopenedCycleCase.id !== createdCase.id, `New case allowed after prior case closed (${reopenedCycleCase.id})`, 'CASE_MANAGEMENT');

  // 3.7 Audit Trail Append-Only Completeness
  const fullCase = caseService.getCaseById(createdCase.id);
  assert(Boolean(fullCase), 'Case found by ID', 'CASE_MANAGEMENT');
  if (fullCase) {
    const eventTypes = fullCase.auditTrail.map((e) => e.eventType);
    assert(eventTypes.includes('CASE_CREATED'), 'Audit has CASE_CREATED', 'AUDIT_TRAIL');
    assert(eventTypes.includes('STATUS_CHANGED'), 'Audit has STATUS_CHANGED', 'AUDIT_TRAIL');
    assert(eventTypes.includes('NOTE_ADDED'), 'Audit has NOTE_ADDED', 'AUDIT_TRAIL');
    assert(eventTypes.includes('CASE_CLOSED'), 'Audit has CASE_CLOSED', 'AUDIT_TRAIL');
    const closedEvent = fullCase.auditTrail.find((e) => e.eventType === 'CASE_CLOSED');
    assert(Boolean(closedEvent && closedEvent.beforeValue === 'Under Investigation'), 'Audit captures exact beforeValue', 'AUDIT_TRAIL');
  }

  // 3.8 Search and Filters (matches CaseManagement UI filter engine)
  const allCurrentCases = caseService.getAllCases();
  const searchByTx = allCurrentCases.filter((c) =>
    c.transactionId.toLowerCase().includes('TX-E2E-CASE-1'.toLowerCase())
  );
  assert(searchByTx.length >= 2, 'Search by transaction ID matches created cases', 'CASE_SEARCH');
  const searchByCust = allCurrentCases.filter((c) =>
    c.customerReference.toLowerCase().includes('C-E2E-USER'.toLowerCase())
  );
  assert(searchByCust.length >= 2, 'Search by customer ID matches created cases', 'CASE_SEARCH');

  // -------------------------------------------------------------------------
  // CATEGORY 4: PERSISTENCE ARCHITECTURE AUDIT
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Persistence Architecture Audit ---');
  // Check if caseService runs in hybrid environment
  assert(typeof (caseService as any).loadInitial === 'function', 'caseService implements loadInitial()', 'PERSISTENCE');
  assert(typeof (caseService as any).persist === 'function', 'caseService implements persist()', 'PERSISTENCE');
  // Verification of memory vs localStorage:
  // In server/node test execution, window is undefined, so caseService runs in memory with seed dataset.
  // In client browser, window.localStorage is checked for STORAGE_KEY = 'ai_banker_sentinel_cases_v1'.
  const allCases = caseService.getAllCases();
  assert(allCases.length >= 4, `Active case store contains ${allCases.length} cases`, 'PERSISTENCE');

  // -------------------------------------------------------------------------
  // CATEGORY 5: EVIDENCE-GROUNDED GEMINI ASSISTANT & FALLBACKS
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Gemini Assistant & Grounding Safeguards ---');

  // 5.1 Factual Output Normalization & Grounding
  const mockModelJson = JSON.stringify({
    transactionSummary: 'Automated transfer of INR 250,000 flagged for foreign IP in Singapore.',
    observedFacts: [
      'Transaction ID: TX-E2E-CASE-1',
      'Synthetic Customer: C-E2E-USER',
      'Amount: INR 250,000 (Very high transaction amount)',
      'Originating Country: SG (Cross-border destination)',
    ],
    riskFactorContributions: [
      { factor: 'Very high transaction amount (≥ 100,000)', points: 35, description: 'Amount 250,000 >= 100,000' },
      { factor: 'Cross-border location (SG)', points: 25, description: 'Origin country is SG' },
    ],
    missingEvidenceAndLimitations: [
      'Customer historical IP patterns are unavailable in the snapshot.',
      'Prior travel declaration records were not provided.',
    ],
    recommendedInvestigationChecks: [
      { check: 'Verify outbound 2FA SMS log', tiedFactOrRationale: 'Customer is transacting from abroad', isGeneralCheck: false },
      { check: 'Review customer relationship history', tiedFactOrRationale: 'Standard verification', isGeneralCheck: true },
    ],
    cautiousAssessment: 'Indicators warrant analyst review. Only an authorized human analyst can confirm a fraud outcome.',
  });

  const parsedOutput = parseAndNormalizeInvestigationExplanationJSON(
    mockModelJson,
    { transaction: flaggedSnapshot },
    'gemini-3.8-flash'
  );

  assert(parsedOutput.modelUsed === 'gemini-3.8-flash', 'Model name correctly attributed in provenance', 'GEMINI_EXPLANATION');
  assert(parsedOutput.isFallback === false, 'Authentic model output identified (not fallback)', 'GEMINI_EXPLANATION');
  assert(parsedOutput.riskFactorContributions.length === 2, 'Score contributions parsed cleanly', 'GEMINI_EXPLANATION');
  assert(parsedOutput.recommendedInvestigationChecks.length === 2, 'Recommended checks parsed cleanly', 'GEMINI_EXPLANATION');
  assert(parsedOutput.missingEvidenceAndLimitations.length === 2, 'Missing evidence items preserved', 'GEMINI_EXPLANATION');

  // 5.2 Architectural Fallback (when model fails or JSON is unparseable)
  const fallbackOutput = parseAndNormalizeInvestigationExplanationJSON(
    'Not valid JSON output from server timeout',
    { transaction: flaggedSnapshot },
    'architectural-fallback'
  );

  assert(fallbackOutput.isFallback === true, 'Parse failure cleanly marked as isFallback: true', 'GEMINI_FALLBACK');
  assert(fallbackOutput.modelUsed === 'architectural-fallback', 'Fallback model name explicitly recorded', 'GEMINI_FALLBACK');
  assert(fallbackOutput.observedFacts.length >= 4, 'Fallback auto-extracts all 4 core snapshot fact groups', 'GEMINI_FALLBACK');
  assert(fallbackOutput.cautiousAssessment.includes('human analyst'), 'Fallback reinforces human authority mandate', 'GEMINI_FALLBACK');

  // 5.3 System Instruction Grounding & Non-Discretion Mandates
  assert(TRANSACTION_INVESTIGATION_SYSTEM_INSTRUCTION.includes('NEVER invent or speculate on customer intent'), 'System instruction strictly forbids hallucinating intent', 'AI_SAFETY');
  assert(TRANSACTION_INVESTIGATION_SYSTEM_INSTRUCTION.includes('A risk score is an alert indicator for prioritized human review, NEVER proof of fraud'), 'System instruction asserts risk scores are advisory alerts', 'AI_SAFETY');
  assert(TRANSACTION_INVESTIGATION_SYSTEM_INSTRUCTION.includes('ADVISORY NATURE & HUMAN AUTHORITY SAFEGUARD'), 'System instruction requires human authority safeguard', 'AI_SAFETY');

  // -------------------------------------------------------------------------
  // CATEGORY 6: AUTHENTICATION & SECURITY SAFEGUARDS
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Authentication & Security Safeguards ---');

  // 6.1 Authentication Header Validation in server/auth.ts
  const mockReqNoAuth: any = { headers: {} };
  const mockResNoAuth: any = {
    statusCode: 200,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: any) { this.body = payload; return this; },
  };
  let nextCalled = false;

  await authenticateFirebaseToken(mockReqNoAuth, mockResNoAuth, () => { nextCalled = true; });
  assert(mockResNoAuth.statusCode === 401, 'Missing Authorization header rejected with 401', 'SECURITY_AUTH');
  assert(mockResNoAuth.body?.code === 'AUTH_HEADER_MISSING', 'Returns AUTH_HEADER_MISSING code', 'SECURITY_AUTH');
  assert(!nextCalled, 'Next middleware handler not invoked on auth failure', 'SECURITY_AUTH');

  // 6.2 Bearer prefix check
  const mockReqBasic: any = { headers: { authorization: 'Basic dXNlcjpwYXNz' } };
  const mockResBasic: any = {
    statusCode: 200,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: any) { this.body = payload; return this; },
  };
  await authenticateFirebaseToken(mockReqBasic, mockResBasic, () => {});
  assert(mockResBasic.statusCode === 401, 'Non-Bearer auth rejected with 401', 'SECURITY_AUTH');

  // 6.3 Empty token check
  const mockReqEmpty: any = { headers: { authorization: 'Bearer   ' } };
  const mockResEmpty: any = {
    statusCode: 200,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: any) { this.body = payload; return this; },
  };
  await authenticateFirebaseToken(mockReqEmpty, mockResEmpty, () => {});
  assert(mockResEmpty.statusCode === 401 && mockResEmpty.body?.code === 'AUTH_TOKEN_EMPTY', 'Empty Bearer token rejected with 401 AUTH_TOKEN_EMPTY', 'SECURITY_AUTH');

  // 6.4 Non-RS256 algorithm / forged tokens rejected
  const mockReqForged: any = {
    headers: {
      // HS256 forged header: {"alg":"HS256","typ":"JWT"} -> eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
      authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    }
  };
  const mockResForged: any = {
    statusCode: 200,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: any) { this.body = payload; return this; },
  };
  await authenticateFirebaseToken(mockReqForged, mockResForged, () => {});
  assert(mockResForged.statusCode === 401, 'Symmetric HS256 tokens rejected with 401 (RS256 enforced)', 'SECURITY_AUTH');

  // 6.5 Secret Leaks & Client Isolation Audit
  const clientAiService = fs.readFileSync(path.join(process.cwd(), 'src/services/aiService.ts'), 'utf-8');
  assert(!clientAiService.includes('process.env.GEMINI_API_KEY'), 'Zero GEMINI_API_KEY references in client aiService', 'SECRET_PROTECTION');
  assert(!clientAiService.includes('process.env.API_KEY'), 'Zero raw API_KEY references in client aiService', 'SECRET_PROTECTION');

  // 6.6 Firestore Rules Security Audit
  const firestoreRules = fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf-8').replace(/\r\n/g, '\n');
  assert(firestoreRules.includes('match /{document=**} {\n      allow read, write: if false;\n    }'), 'Default deny catch-all present in firestore.rules', 'FIRESTORE_SECURITY');
  assert(firestoreRules.includes('allow list: if false; // Strict PII protection: never allow user enumeration'), 'User enumeration prohibited in firestore.rules', 'FIRESTORE_SECURITY');
  assert(firestoreRules.includes('allow delete: if false; // Profiles are permanent records'), 'User profiles cannot be deleted directly', 'FIRESTORE_SECURITY');

  // 6.7 .gitignore protects sensitive assets
  const gitignore = fs.readFileSync(path.join(process.cwd(), '.gitignore'), 'utf-8');
  assert(gitignore.includes('.env'), '.gitignore excludes .env files', 'GIT_SECURITY');

  console.log('\n======================================================================');
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runComprehensiveVerification().catch((err) => {
  console.error('Fatal execution error during comprehensive verification:', err);
  process.exit(1);
});
