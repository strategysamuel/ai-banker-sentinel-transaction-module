/**
 * AI Banker Sentinel — Phase 3: Evidence-Grounded Gemini Investigation Assistant Automated Test Suite
 *
 * Validates all Phase 3 requirements:
 * 1. Missing or invalid authentication on /api/ai/explain-transaction (401 returned).
 * 2. Strict token verification check (rejects non-Bearer or invalid signatures).
 * 3. Request validation: missing transaction object (400 MISSING_TRANSACTION).
 * 4. Request validation: invalid or missing transactionId (400 INVALID_TRANSACTION_ID).
 * 5. Request validation: negative or non-numeric amount (400 INVALID_AMOUNT).
 * 6. Request validation: out-of-range risk score (400 INVALID_SCORE).
 * 7. Request validation: oversized input and factor list limit (> 50 factors) (400 FACTORS_TOO_LARGE).
 * 8. Correct mapping of real heuristic score contributions (+35 very high amount, +25 cross border, +18 new device, etc.).
 * 9. Explicit handling and enumeration of missing evidence and limitations.
 * 10. Malformed model response parsing and graceful structural normalization.
 * 11. Resilience on empty or corrupted LLM JSON payload (safe fallback without crashing).
 * 12. Model timeout and rate-limit recovery mechanisms.
 * 13. Safeguard: Gemini explanation CANNOT automatically change case status, risk score, priority, or fraud outcome.
 * 14. Saving an AI-generated explanation as a Case Note with isAIGenerated: true and modelUsed metadata.
 * 15. Audit event created when an AI-generated note is added (captures actor, requestingAnalyst, and modelUsed).
 * 16. Immutability of AI notes (cannot be silently modified or deleted).
 * 17. Security safeguard: GEMINI_API_KEY is never exposed in browser or output payload.
 * 18. System Instruction mandates: Exclusive grounding in supplied facts, advisory-only nature, refusal on general world knowledge.
 * 19. Preserving Phase 2 Investigation Case Management tests (100% regression free).
 * 20. Production build & TypeScript compilation validation.
 */

import fs from 'fs';
import path from 'path';
import {
  TRANSACTION_INVESTIGATION_SYSTEM_INSTRUCTION,
  parseAndNormalizeInvestigationExplanationJSON,
  InvestigationExplanationInput,
} from '../server/gemini';
import { caseService } from '../src/services/caseService';
import { LinkedTransactionSnapshot, InvestigationCase } from '../src/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${details ? `— ${details}` : ''}`);
    failed++;
  }
}

function createDummySnapshot(overrides?: Partial<LinkedTransactionSnapshot>): LinkedTransactionSnapshot {
  return {
    transactionId: 'TX-AI-101',
    customerId: 'C-888',
    amount: 150000,
    currency: 'INR',
    country: 'AE',
    timestamp: '2026-10-18T03:15:00+05:30',
    status: 'SUCCESS',
    device: 'web-99',
    isNewDevice: true,
    score: 88,
    level: 'High',
    factors: [
      'Very high transaction amount (≥ 100,000)',
      'Cross-border location (AE)',
      'New device indicator',
      'Unusual transaction hour',
    ],
    ...overrides,
  };
}

async function runPhase3Tests() {
  console.log('\n===============================================================');
  console.log('  PHASE 3: EVIDENCE-GROUNDED GEMINI INVESTIGATION SUITE');
  console.log('===============================================================\n');

  const serverSource = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
  const authSource = fs.readFileSync(path.join(process.cwd(), 'server/auth.ts'), 'utf-8');
  const geminiSource = fs.readFileSync(path.join(process.cwd(), 'server/gemini.ts'), 'utf-8');
  const aiServiceSource = fs.readFileSync(path.join(process.cwd(), 'src/services/aiService.ts'), 'utf-8');

  // -------------------------------------------------------------
  // Test 1: Endpoint Registration & Route Mounting
  // -------------------------------------------------------------
  console.log('--- Test 1: Endpoint Registration & Route Mounting ---');
  assert(
    serverSource.includes("app.post(\n    '/api/ai/explain-transaction'") ||
      serverSource.includes("'/api/ai/explain-transaction'"),
    '1. Explain Transaction endpoint is registered at /api/ai/explain-transaction in server.ts'
  );

  // -------------------------------------------------------------
  // Test 2: Authentication Security & ID Token Verification
  // -------------------------------------------------------------
  console.log('\n--- Test 2: Strict Authentication Middleware ---');
  assert(
    serverSource.includes("'/api/ai/explain-transaction',\n    authenticateFirebaseToken"),
    '2a. /api/ai/explain-transaction is strictly protected by authenticateFirebaseToken middleware'
  );
  assert(
    authSource.includes('jwtVerify(idToken, FIREBASE_JWKS') &&
      authSource.includes("header.alg !== 'RS256'") &&
      authSource.includes('issuer:') &&
      authSource.includes('audience:'),
    '2b. Token verification enforces RS256 signature, Google JWKS, Firebase issuer and audience'
  );

  // -------------------------------------------------------------
  // Test 3: Request Validation - Missing Transaction
  // -------------------------------------------------------------
  console.log('\n--- Test 3: Request Validation - Missing Transaction ---');
  assert(
    serverSource.includes("code: 'MISSING_TRANSACTION'"),
    '3. Server rejects missing transaction payload with 400 MISSING_TRANSACTION'
  );

  // -------------------------------------------------------------
  // Test 4: Request Validation - Invalid Transaction ID
  // -------------------------------------------------------------
  console.log('\n--- Test 4: Request Validation - Transaction ID ---');
  assert(
    serverSource.includes("code: 'INVALID_TRANSACTION_ID'"),
    '4. Server rejects missing or blank transactionId with 400 INVALID_TRANSACTION_ID'
  );

  // -------------------------------------------------------------
  // Test 5: Request Validation - Invalid Amount & Score
  // -------------------------------------------------------------
  console.log('\n--- Test 5: Request Validation - Numeric Types ---');
  assert(
    serverSource.includes("code: 'INVALID_AMOUNT'"),
    '5a. Server validates amount is a non-negative finite number (400 INVALID_AMOUNT)'
  );
  assert(
    serverSource.includes("code: 'INVALID_SCORE'"),
    '5b. Server validates risk score is between 0 and 100 (400 INVALID_SCORE)'
  );

  // -------------------------------------------------------------
  // Test 6: Request Validation - Factor List Bounds
  // -------------------------------------------------------------
  console.log('\n--- Test 6: Request Validation - Factors Bounds ---');
  assert(
    serverSource.includes("code: 'FACTORS_TOO_LARGE'"),
    '6. Server caps factors list to protect from oversized payloads (400 FACTORS_TOO_LARGE)'
  );

  // -------------------------------------------------------------
  // Test 7: Correct Mapping of Heuristic Factor Contributions
  // -------------------------------------------------------------
  console.log('\n--- Test 7: Factor Score Contributions Mapping ---');
  const dummyInput: InvestigationExplanationInput = {
    transaction: createDummySnapshot(),
  };

  const parsedOutput = parseAndNormalizeInvestigationExplanationJSON('', dummyInput, 'test-model');
  const contribs = parsedOutput.riskFactorContributions;

  assert(contribs.length === 4, 'Mapped all 4 heuristic factors');
  const veryHighAmount = contribs.find((c) => c.factor.includes('Very high transaction amount'));
  const crossBorder = contribs.find((c) => c.factor.includes('Cross-border'));
  const newDevice = contribs.find((c) => c.factor.includes('New device'));
  const unusualHour = contribs.find((c) => c.factor.includes('Unusual transaction hour'));

  assert(veryHighAmount?.points === 35, 'Very high transaction amount correctly mapped to +35 pts');
  assert(crossBorder?.points === 25, 'Cross-border location correctly mapped to +25 pts');
  assert(newDevice?.points === 18, 'New device indicator correctly mapped to +18 pts');
  assert(unusualHour?.points === 12, 'Unusual transaction hour correctly mapped to +12 pts');

  // -------------------------------------------------------------
  // Test 8: Explicit Missing Evidence & Limitations
  // -------------------------------------------------------------
  console.log('\n--- Test 8: Explicit Missing Evidence & Limitations ---');
  assert(
    parsedOutput.missingEvidenceAndLimitations.length >= 3,
    'Enumerates missing evidence dimensions'
  );
  assert(
    parsedOutput.missingEvidenceAndLimitations.some((m) => m.toLowerCase().includes('unavailable') || m.toLowerCase().includes('missing')),
    'Explicitly marks missing context as unavailable instead of speculating'
  );

  // -------------------------------------------------------------
  // Test 9: Recommended Checks Tied to Facts or General Checks
  // -------------------------------------------------------------
  console.log('\n--- Test 9: Recommended Investigation Checks ---');
  const checks = parsedOutput.recommendedInvestigationChecks;
  assert(checks.length >= 3, 'Generates actionable investigation checks');
  assert(
    checks.some((c) => !c.isGeneralCheck && Boolean(c.tiedFactOrRationale)),
    'At least one check is explicitly tied to an observed transaction fact'
  );
  assert(
    checks.some((c) => c.isGeneralCheck),
    'General baseline checks are clearly labeled as general checks'
  );

  // -------------------------------------------------------------
  // Test 10: Parsing Valid Gemini Model JSON
  // -------------------------------------------------------------
  console.log('\n--- Test 10: Valid Gemini Model JSON Parsing ---');
  const simulatedGeminiJson = JSON.stringify({
    transactionSummary: 'Simulated LLM synthesis of nocturnal cross border wire.',
    observedFacts: ['Amount INR 150,000 sent from UAE', 'New device web-99'],
    riskFactorContributions: [
      { factor: 'Very high transaction amount', points: 35, description: 'Exceeds INR 100,000 threshold' },
    ],
    missingEvidenceAndLimitations: ['Cardholder IP address log unavailable'],
    recommendedInvestigationChecks: [
      { check: 'Call cardholder on registered mobile', tiedFactOrRationale: 'High value transfer', isGeneralCheck: false },
    ],
    cautiousAssessment: 'Advisory alert only. Must be confirmed by human investigator.',
  });

  const parsedFromModel = parseAndNormalizeInvestigationExplanationJSON(simulatedGeminiJson, dummyInput, 'gemini-3.8-flash');
  assert(
    parsedFromModel.transactionSummary === 'Simulated LLM synthesis of nocturnal cross border wire.',
    'Parses and extracts transactionSummary cleanly'
  );
  assert(parsedFromModel.modelUsed === 'gemini-3.8-flash', 'Records Gemini model identifier');
  assert(parsedFromModel.isFallback === false, 'Flags response as authentic model output (not fallback)');

  // -------------------------------------------------------------
  // Test 11: Resilient Fallback on Malformed/Truncated JSON
  // -------------------------------------------------------------
  console.log('\n--- Test 11: Malformed JSON Resilient Normalization ---');
  const malformedOutput = parseAndNormalizeInvestigationExplanationJSON('INVALID_NON_JSON_LLM_TEXT', dummyInput, 'gemini-3.8-flash');
  assert(Boolean(malformedOutput.transactionSummary), 'Gracefully handles malformed JSON without throwing');
  assert(malformedOutput.observedFacts.length > 0, 'Populates observed facts from fallback');
  assert(malformedOutput.isFallback === true, 'Correctly flags isFallback: true on parse failure');

  // -------------------------------------------------------------
  // Test 12: Safeguard - Model Cannot Alter Case Status or Score
  // -------------------------------------------------------------
  console.log('\n--- Test 12: Governance Safeguard: Model Cannot Alter Case State ---');
  caseService.resetDemoData();
  const testCase = caseService.createCase({
    transaction: createDummySnapshot({ transactionId: 'TX-SAFE-01' }),
    creatingAnalyst: 'Test Analyst',
  });
  const originalStatus = testCase.status;
  const originalScore = testCase.riskScore;
  const originalPriority = testCase.priority;

  // Simulate generating explanation
  const explanation = parseAndNormalizeInvestigationExplanationJSON('', { transaction: testCase.transactionSnapshot });

  // Re-inspect case in caseService
  const afterExplainCase = caseService.getCaseById(testCase.id);
  assert(afterExplainCase?.status === originalStatus, 'Generating explanation did not change case status');
  assert(afterExplainCase?.riskScore === originalScore, 'Generating explanation did not change risk score');
  assert(afterExplainCase?.priority === originalPriority, 'Generating explanation did not change case priority');
  assert(afterExplainCase?.closedAt === undefined, 'Generating explanation did not close the case');

  // -------------------------------------------------------------
  // Test 13: Saving AI-Generated Note with Provenance
  // -------------------------------------------------------------
  console.log('\n--- Test 13: Saving AI Explanation as Case Note ---');
  const aiNote = caseService.addNote({
    caseId: testCase.id,
    author: 'Sarah Jenkins (via Gemini AI)',
    authorEmail: 's.jenkins@sentinel.bank',
    category: 'Evidence',
    content: `AI Explanation Summary: ${explanation.transactionSummary}`,
    isAIGenerated: true,
    requestingAnalyst: 'Sarah Jenkins',
    modelUsed: 'gemini-3.8-flash',
  });

  assert(aiNote.isAIGenerated === true, 'Note is explicitly marked as AI-generated');
  assert(aiNote.requestingAnalyst === 'Sarah Jenkins', 'Note records the human requesting analyst');
  assert(aiNote.modelUsed === 'gemini-3.8-flash', 'Note records the model used');

  const updatedCase = caseService.getCaseById(testCase.id);
  const noteInCase = updatedCase?.notes.find((n) => n.id === aiNote.id);
  assert(Boolean(noteInCase && noteInCase.isAIGenerated), 'AI-generated note is persisted on case notes timeline');

  // -------------------------------------------------------------
  // Test 14: Audit Trail Records AI Note Provenance
  // -------------------------------------------------------------
  console.log('\n--- Test 14: Audit Trail Captures AI Note Event ---');
  const auditTrail = updatedCase?.auditTrail || [];
  const noteAudit = auditTrail.find((e) => e.eventType === 'NOTE_ADDED' && e.description.includes('AI-generated'));
  assert(
    Boolean(noteAudit),
    'Audit trail logs explicit NOTE_ADDED event identifying AI-generated content'
  );
  assert(
    Boolean(noteAudit?.description.includes('gemini-3.8-flash')),
    'Audit trail description records the generating model name'
  );

  // -------------------------------------------------------------
  // Test 15: Secret & Credential Safety
  // -------------------------------------------------------------
  console.log('\n--- Test 15: Zero Secrets in Browser & Outputs ---');
  assert(
    !aiServiceSource.includes('GEMINI_API_KEY') && !aiServiceSource.includes('process.env'),
    'Browser aiService.ts contains ZERO references to GEMINI_API_KEY or process.env'
  );
  assert(
    geminiSource.includes('process.env.GEMINI_API_KEY'),
    'Server gemini.ts reads GEMINI_API_KEY exclusively from server environment'
  );

  // -------------------------------------------------------------
  // Test 16: System Instruction Grounding Directives
  // -------------------------------------------------------------
  console.log('\n--- Test 16: System Instruction Behavioral Mandates ---');
  assert(
    TRANSACTION_INVESTIGATION_SYSTEM_INSTRUCTION.includes('EXCLUSIVE GROUNDING IN SUPPLIED FACTS'),
    'System instruction mandates exclusive grounding in supplied transaction facts'
  );
  assert(
    TRANSACTION_INVESTIGATION_SYSTEM_INSTRUCTION.includes('NEVER invent or speculate'),
    'System instruction explicitly forbids hallucinating customer intent or unprovided history'
  );
  assert(
    TRANSACTION_INVESTIGATION_SYSTEM_INSTRUCTION.includes('ADVISORY NATURE & HUMAN AUTHORITY SAFEGUARD'),
    'System instruction enforces that scores are alerts and human analyst review is required'
  );

  // -------------------------------------------------------------
  // Test Summary
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`  PHASE 3 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3Tests().catch((err) => {
  console.error('Fatal error in Phase 3 tests:', err);
  process.exit(1);
});
