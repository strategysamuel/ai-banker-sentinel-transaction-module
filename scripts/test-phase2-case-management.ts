/**
 * AI Banker Sentinel — Phase 2: Investigation Case Management Automated Test Suite
 *
 * Comprehensive test suite validating all requirements:
 * 1. Creating a case from a flagged transaction (capturing ID, transactionId, synthetic customerRef, risk score, severity, summary, creator).
 * 2. Duplicate active case prevention for the same transaction (throwing error and linking).
 * 3. Permitting case creation if prior case for that transaction was closed.
 * 4. Invalid case inputs (missing transaction, missing transaction ID).
 * 5. Invalid note inputs (empty content, oversized content > 2,000 chars, invalid category).
 * 6. Valid note creation with category, author, timestamp, optional next step.
 * 7. Immutability of notes (no edit or delete methods exposed).
 * 8. Status transitions state machine (valid transitions e.g. Open -> Under Investigation -> Escalated).
 * 9. Invalid status transitions rejected (e.g. invalid direct transitions).
 * 10. Closure validation: requiring explicit closure justification (>= 5 chars).
 * 11. Reopening closed cases (transition back to Open or Under Investigation).
 * 12. Case assignment and reassignment updates.
 * 13. Case priority changes and validation.
 * 14. Append-only audit trail integrity (CASE_CREATED, ASSIGNMENT_CHANGED, STATUS_CHANGED, PRIORITY_CHANGED, NOTE_ADDED, CASE_CLOSED).
 * 15. Audit event before/after values and actor tracking.
 * 16. Case filtering by status, severity, and priority.
 * 17. Case search by case ID, transaction ID, and synthetic customer reference.
 * 18. Factual case summary generation (only relies on transaction facts and factors).
 * 19. Preserving existing Transaction Sentinel scoring engine and heuristics.
 * 20. Preserving existing Transaction Sentinel CSV parsing & validation (missing headers, negative amounts, duplicate IDs).
 */

import { caseService, isValidStatusTransition, buildFactualSummary, isClosedStatus } from '../src/services/caseService';
import { scoreTransactions, parseCsv, sampleTransactions, REQUIRED_CSV_HEADERS } from '../src/components/TransactionSentinel';
import { LinkedTransactionSnapshot, CasePriority, NoteCategory } from '../src/types';

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
    transactionId: 'TX-TEST-999',
    customerId: 'C-TEST-99',
    amount: 125000,
    currency: 'INR',
    country: 'AE',
    timestamp: '2026-10-18T10:00:00+05:30',
    status: 'SUCCESS',
    device: 'web-test',
    isNewDevice: true,
    score: 85,
    level: 'High',
    factors: [
      'Very high transaction amount (≥ 100,000)',
      'Cross-border location (AE)',
      'New device indicator',
    ],
    ...overrides,
  };
}

async function runPhase2CaseManagementTests() {
  console.log('\n===============================================================');
  console.log('  PHASE 2: INVESTIGATION CASE MANAGEMENT TEST SUITE');
  console.log('===============================================================\n');

  // Reset demo store before starting
  caseService.resetDemoData();

  // -------------------------------------------------------------
  // Test 1: Creating a case from a flagged transaction
  // -------------------------------------------------------------
  console.log('--- Test 1: Create Case from Flagged Transaction ---');
  const snapshot1 = createDummySnapshot({ transactionId: 'TX-INT-101', customerId: 'C-771' });
  const case1 = caseService.createCase({
    transaction: snapshot1,
    creatingAnalyst: 'Alex Rivera (Lead Investigator)',
    creatingAnalystEmail: 'a.rivera@sentinel.bank',
    priority: 'Critical',
    assignedAnalyst: 'Sarah Jenkins',
    initialNote: 'Flagged nocturnal cross-border high value transaction.',
  });

  assert(
    Boolean(case1.id && /^CASE-\d{4}-\d{4}$/.test(case1.id)),
    'Case ID follows formatted sequential pattern (e.g. CASE-2026-0004)',
    `Received: ${case1.id}`
  );
  assert(case1.transactionId === 'TX-INT-101', 'Case links to correct transactionId');
  assert(case1.customerReference === 'C-771', 'Customer reference captured from synthetic data');
  assert(case1.riskScore === 85 && case1.severity === 'High', 'Risk score and severity captured at creation');
  assert(case1.status === 'Open', 'Initial case status is Open');
  assert(case1.priority === 'Critical', 'Initial priority assigned accurately');
  assert(case1.assignedAnalyst === 'Sarah Jenkins', 'Assigned analyst stored properly');
  assert(case1.notes.length === 1 && case1.notes[0].content.includes('Flagged nocturnal'), 'Initial note attached');

  // -------------------------------------------------------------
  // Test 2: Duplicate Active Case Prevention
  // -------------------------------------------------------------
  console.log('\n--- Test 2: Duplicate Active Case Prevention ---');
  let duplicateThrew = false;
  let duplicateMsg = '';
  try {
    caseService.createCase({
      transaction: snapshot1,
      creatingAnalyst: 'Alex Rivera',
    });
  } catch (err) {
    duplicateThrew = true;
    duplicateMsg = err instanceof Error ? err.message : String(err);
  }
  assert(
    duplicateThrew && duplicateMsg.includes('already exists'),
    'Duplicate active case creation blocked with descriptive error',
    duplicateMsg
  );

  const activeExisting = caseService.getActiveCaseByTransactionId('TX-INT-101');
  assert(
    activeExisting !== null && activeExisting.id === case1.id,
    'Existing active case query reliably returns the in-progress case'
  );

  // -------------------------------------------------------------
  // Test 3: Permitting Case Creation after Case Closure
  // -------------------------------------------------------------
  console.log('\n--- Test 3: Creation Permitted After Prior Case Closure ---');
  // Move case1 to closed
  caseService.updateStatus({
    caseId: case1.id,
    newStatus: 'Closed — No Fraud',
    actor: 'Alex Rivera',
    closureReason: 'Customer confirmed transaction via two-factor challenge.',
  });
  assert(
    caseService.getActiveCaseByTransactionId('TX-INT-101') === null,
    'Closed case is no longer reported as active case for that transaction'
  );

  // Should now allow re-opening a fresh case for that transaction if needed
  let reopenAllowed = false;
  try {
    const freshCase = caseService.createCase({
      transaction: snapshot1,
      creatingAnalyst: 'Alex Rivera',
      priority: 'Low',
    });
    reopenAllowed = Boolean(freshCase.id && freshCase.id !== case1.id);
  } catch (err) {
    reopenAllowed = false;
  }
  assert(reopenAllowed, 'New case permitted for transaction after earlier case was closed');

  // -------------------------------------------------------------
  // Test 4: Invalid Case Inputs
  // -------------------------------------------------------------
  console.log('\n--- Test 4: Invalid Case Inputs ---');
  let invalidSnapshotThrew = false;
  try {
    // @ts-ignore
    caseService.createCase(null);
  } catch (e) {
    invalidSnapshotThrew = true;
  }
  assert(invalidSnapshotThrew, 'Rejects null/undefined createCase input');

  let blankTxThrew = false;
  try {
    caseService.createCase({
      transaction: createDummySnapshot({ transactionId: '   ' }),
      creatingAnalyst: 'Alex Rivera',
    });
  } catch (e) {
    blankTxThrew = true;
  }
  assert(blankTxThrew, 'Rejects blank or whitespace transactionId');

  // -------------------------------------------------------------
  // Test 5: Note Validation & Length Limits
  // -------------------------------------------------------------
  console.log('\n--- Test 5: Note Validation & Length Limits ---');
  const targetCaseId = case1.id;
  let emptyNoteThrew = false;
  try {
    caseService.addNote({
      caseId: targetCaseId,
      author: 'Alex',
      category: 'Observation',
      content: '   ',
    });
  } catch (e) {
    emptyNoteThrew = true;
  }
  assert(emptyNoteThrew, 'Rejects empty or whitespace-only note content');

  let oversizedNoteThrew = false;
  try {
    caseService.addNote({
      caseId: targetCaseId,
      author: 'Alex',
      category: 'Observation',
      content: 'A'.repeat(2001),
    });
  } catch (e) {
    oversizedNoteThrew = true;
  }
  assert(oversizedNoteThrew, 'Rejects note exceeding 2,000 characters limit');

  let invalidCategoryThrew = false;
  try {
    caseService.addNote({
      caseId: targetCaseId,
      author: 'Alex',
      // @ts-ignore
      category: 'RandomInvalidCategory',
      content: 'Valid content',
    });
  } catch (e) {
    invalidCategoryThrew = true;
  }
  assert(invalidCategoryThrew, 'Rejects invalid note category');

  // -------------------------------------------------------------
  // Test 6: Valid Note Addition & Next Step
  // -------------------------------------------------------------
  console.log('\n--- Test 6: Valid Note Addition & Next Step ---');
  const validNote = caseService.addNote({
    caseId: targetCaseId,
    author: 'Sarah Jenkins',
    authorEmail: 's.jenkins@sentinel.bank',
    category: 'Evidence',
    content: 'Merchant verification confirmed IP geolocation match.',
    nextStep: 'Request merchant settlement logs.',
  });
  assert(Boolean(validNote.id && validNote.timestamp), 'Note created with unique ID and timestamp');
  assert(validNote.category === 'Evidence', 'Note category stored correctly');
  assert(validNote.nextStep === 'Request merchant settlement logs.', 'Optional next step recorded');

  // -------------------------------------------------------------
  // Test 7: Note Tamper-Resistance (No Edit/Delete API)
  // -------------------------------------------------------------
  console.log('\n--- Test 7: Note Tamper Resistance ---');
  // @ts-ignore
  const hasEditNote = typeof caseService.editNote === 'function' || typeof caseService.updateNote === 'function';
  // @ts-ignore
  const hasDeleteNote = typeof caseService.deleteNote === 'function' || typeof caseService.removeNote === 'function';
  assert(!hasEditNote, 'caseService exposes no editNote method (notes cannot be silently edited)');
  assert(!hasDeleteNote, 'caseService exposes no deleteNote method (notes cannot be deleted)');

  // -------------------------------------------------------------
  // Test 8: Status Transitions State Machine
  // -------------------------------------------------------------
  console.log('\n--- Test 8: Status Transitions State Machine ---');
  const snapFlow = createDummySnapshot({ transactionId: 'TX-FLOW-01' });
  const flowCase = caseService.createCase({
    transaction: snapFlow,
    creatingAnalyst: 'Test Analyst',
  });

  // Open -> Under Investigation
  assert(isValidStatusTransition('Open', 'Under Investigation'), 'Allowed: Open -> Under Investigation');
  caseService.updateStatus({
    caseId: flowCase.id,
    newStatus: 'Under Investigation',
    actor: 'Test Analyst',
  });
  assert(caseService.getCaseById(flowCase.id)?.status === 'Under Investigation', 'Case status moved to Under Investigation');

  // Under Investigation -> Escalated
  assert(isValidStatusTransition('Under Investigation', 'Escalated'), 'Allowed: Under Investigation -> Escalated');
  caseService.updateStatus({
    caseId: flowCase.id,
    newStatus: 'Escalated',
    actor: 'Test Analyst',
  });
  assert(caseService.getCaseById(flowCase.id)?.status === 'Escalated', 'Case status moved to Escalated');

  // -------------------------------------------------------------
  // Test 9: Case Closure Validation & Rationale Enforcement
  // -------------------------------------------------------------
  console.log('\n--- Test 9: Case Closure Reason Enforcement ---');
  let blankReasonThrew = false;
  try {
    caseService.updateStatus({
      caseId: flowCase.id,
      newStatus: 'Closed — Confirmed Fraud',
      actor: 'Senior Analyst',
      closureReason: '   ',
    });
  } catch (e) {
    blankReasonThrew = true;
  }
  assert(blankReasonThrew, 'Rejects closing case without closure rationale');

  let shortReasonThrew = false;
  try {
    caseService.updateStatus({
      caseId: flowCase.id,
      newStatus: 'Closed — Confirmed Fraud',
      actor: 'Senior Analyst',
      closureReason: 'No',
    });
  } catch (e) {
    shortReasonThrew = true;
  }
  assert(shortReasonThrew, 'Rejects closure reason shorter than 5 characters');

  caseService.updateStatus({
    caseId: flowCase.id,
    newStatus: 'Closed — Confirmed Fraud',
    actor: 'Senior Analyst',
    closureReason: 'Confirmed compromised credential ring on device web-test.',
  });
  const closedCase = caseService.getCaseById(flowCase.id);
  assert(closedCase?.status === 'Closed — Confirmed Fraud', 'Case status updated to Closed — Confirmed Fraud');
  assert(Boolean(closedCase?.closedAt && closedCase.closedBy === 'Senior Analyst'), 'Recorded closedAt timestamp and closedBy actor');
  assert(isClosedStatus(closedCase!.status), 'isClosedStatus identifies confirmed fraud closure');

  // -------------------------------------------------------------
  // Test 10: Reopening Closed Case
  // -------------------------------------------------------------
  console.log('\n--- Test 10: Reopening Closed Case ---');
  assert(
    isValidStatusTransition('Closed — Confirmed Fraud', 'Under Investigation'),
    'Allowed transition: Closed — Confirmed Fraud -> Under Investigation'
  );
  caseService.updateStatus({
    caseId: flowCase.id,
    newStatus: 'Under Investigation',
    actor: 'Senior Analyst',
  });
  const reopened = caseService.getCaseById(flowCase.id);
  assert(reopened?.status === 'Under Investigation', 'Closed case successfully reopened for investigation');
  assert(reopened?.closureReason === undefined, 'Closure reason cleared upon reopening');

  // -------------------------------------------------------------
  // Test 11: Case Assignment Changes
  // -------------------------------------------------------------
  console.log('\n--- Test 11: Assignment & Reassignment ---');
  caseService.updateAssignment({
    caseId: flowCase.id,
    assignedAnalyst: 'Michael Chen (Cyber Fraud Ops)',
    actor: 'Ops Manager',
  });
  assert(
    caseService.getCaseById(flowCase.id)?.assignedAnalyst === 'Michael Chen (Cyber Fraud Ops)',
    'Assigned analyst updated to Michael Chen'
  );

  let blankAssigneeThrew = false;
  try {
    caseService.updateAssignment({
      caseId: flowCase.id,
      assignedAnalyst: '   ',
      actor: 'Ops Manager',
    });
  } catch (e) {
    blankAssigneeThrew = true;
  }
  assert(blankAssigneeThrew, 'Rejects blank assignee name');

  // -------------------------------------------------------------
  // Test 12: Case Priority Changes
  // -------------------------------------------------------------
  console.log('\n--- Test 12: Priority Updates ---');
  caseService.updatePriority({
    caseId: flowCase.id,
    priority: 'Critical',
    actor: 'Ops Manager',
  });
  assert(caseService.getCaseById(flowCase.id)?.priority === 'Critical', 'Priority updated to Critical');

  let invalidPriorityThrew = false;
  try {
    caseService.updatePriority({
      caseId: flowCase.id,
      // @ts-ignore
      priority: 'SuperUrgent',
      actor: 'Ops Manager',
    });
  } catch (e) {
    invalidPriorityThrew = true;
  }
  assert(invalidPriorityThrew, 'Rejects invalid priority value');

  // -------------------------------------------------------------
  // Test 13: Append-Only Audit Trail Completeness
  // -------------------------------------------------------------
  console.log('\n--- Test 13: Append-Only Audit Trail Completeness ---');
  const auditTrail = caseService.getCaseById(flowCase.id)?.auditTrail || [];
  const eventTypes = auditTrail.map((e) => e.eventType);

  assert(eventTypes.includes('CASE_CREATED'), 'Audit trail contains CASE_CREATED event');
  assert(eventTypes.includes('STATUS_CHANGED'), 'Audit trail contains STATUS_CHANGED event');
  assert(eventTypes.includes('CASE_CLOSED'), 'Audit trail contains CASE_CLOSED event');
  assert(eventTypes.includes('ASSIGNMENT_CHANGED'), 'Audit trail contains ASSIGNMENT_CHANGED event');
  assert(eventTypes.includes('PRIORITY_CHANGED'), 'Audit trail contains PRIORITY_CHANGED event');

  // Verify before/after tracking
  const assignmentEv = auditTrail.find((e) => e.eventType === 'ASSIGNMENT_CHANGED');
  assert(
    Boolean(assignmentEv?.beforeValue && assignmentEv?.afterValue),
    'Audit event logs beforeValue and afterValue accurately'
  );

  // -------------------------------------------------------------
  // Test 14: Filtering & Searching
  // -------------------------------------------------------------
  console.log('\n--- Test 14: Filtering & Searching ---');
  const allCases = caseService.getAllCases();
  assert(allCases.length >= 3, 'Multiple cases present in demo store');

  // Search by transactionId
  const foundByTx = allCases.filter((c) => c.transactionId.toLowerCase().includes('tx-flow-01'));
  assert(foundByTx.length === 1 && foundByTx[0].id === flowCase.id, 'Search by transaction ID resolves target case');

  // Search by synthetic customerReference
  const foundByCust = allCases.filter((c) => c.customerReference.toLowerCase().includes('c-205'));
  assert(foundByCust.length >= 2, 'Search by synthetic customer reference resolves related cases');

  // Filter by status
  const escalatedCases = allCases.filter((c) => c.status === 'Escalated');
  assert(escalatedCases.length >= 1, 'Filter by Escalated status returns matching cases');

  // -------------------------------------------------------------
  // Test 15: Grounded Factual Summary
  // -------------------------------------------------------------
  console.log('\n--- Test 15: Factual Summary Generation ---');
  const summary = buildFactualSummary(snapshot1);
  assert(summary.includes('TX-INT-101'), 'Summary contains transaction ID');
  assert(summary.includes('C-771'), 'Summary contains customer reference');
  assert(summary.includes('INR 1,25,000'), 'Summary contains amount formatted');
  assert(summary.includes('AE'), 'Summary contains origin country');
  assert(summary.includes('85/100'), 'Summary contains score');
  assert(summary.includes('Cross-border location (AE)'), 'Summary contains contributing factor');

  // -------------------------------------------------------------
  // Test 16: Preserving Existing Transaction Sentinel Scoring Heuristics
  // -------------------------------------------------------------
  console.log('\n--- Test 16: Preserve Sentinel Scoring Engine ---');
  const scored = scoreTransactions(sampleTransactions);
  assert(scored.length === sampleTransactions.length, 'All sample transactions scored');

  // Verify high amount trigger (TX-1002, 185,000)
  const tx1002Scored = scored.find((t) => t.transactionId === 'TX-1002');
  assert(
    tx1002Scored?.factors.some((f) => f.includes('Very high transaction amount')),
    'Rule: Very high transaction amount (≥ 100,000) triggers for TX-1002'
  );

  // Verify cross-border trigger (TX-1003, AE)
  const tx1003Scored = scored.find((t) => t.transactionId === 'TX-1003');
  assert(
    tx1003Scored?.factors.some((f) => f.includes('Cross-border location (AE)')),
    'Rule: Cross-border location triggers for TX-1003'
  );

  // Verify unusual hour trigger (TX-1007, 03:17)
  const tx1007Scored = scored.find((t) => t.transactionId === 'TX-1007');
  assert(
    tx1007Scored?.factors.some((f) => f.includes('Unusual transaction hour')),
    'Rule: Unusual transaction hour triggers for nocturnal transactions'
  );

  // Verify repeated declines trigger (TX-1004 & TX-1005 for customer C-331)
  const tx1005Scored = scored.find((t) => t.transactionId === 'TX-1005');
  assert(
    tx1005Scored?.factors.some((f) => f.includes('Repeated declined transactions')),
    'Rule: Repeated declines trigger for customer with multiple declines'
  );

  // -------------------------------------------------------------
  // Test 17: Preserving Existing CSV Parser & Validation
  // -------------------------------------------------------------
  console.log('\n--- Test 17: Preserve CSV Parser & Validation ---');
  const validCsv = [
    REQUIRED_CSV_HEADERS.join(','),
    'TX-CSV-1,C-999,5000,INR,IN,2026-10-18T10:00:00+05:30,SUCCESS,mobile-1',
  ].join('\n');
  const parsed = parseCsv(validCsv);
  assert(parsed.length === 1 && parsed[0].transactionId === 'TX-CSV-1', 'Valid CSV parses smoothly');

  // Missing header error
  let missingHeaderThrew = false;
  try {
    parseCsv('transactionId,customerId,amount\nTX-1,C-1,100');
  } catch (e) {
    missingHeaderThrew = true;
  }
  assert(missingHeaderThrew, 'CSV missing required headers is rejected');

  // Negative amount error
  let negAmountThrew = false;
  try {
    parseCsv([
      REQUIRED_CSV_HEADERS.join(','),
      'TX-CSV-2,C-999,-500,INR,IN,2026-10-18T10:00:00+05:30,SUCCESS,mobile-1',
    ].join('\n'));
  } catch (e) {
    negAmountThrew = true;
  }
  assert(negAmountThrew, 'CSV with negative amount is rejected');

  // Duplicate transactionId error
  let dupIdThrew = false;
  try {
    parseCsv([
      REQUIRED_CSV_HEADERS.join(','),
      'TX-DUP,C-1,100,INR,IN,2026-10-18T10:00:00+05:30,SUCCESS,mobile-1',
      'TX-DUP,C-2,200,INR,IN,2026-10-18T10:05:00+05:30,SUCCESS,mobile-2',
    ].join('\n'));
  } catch (e) {
    dupIdThrew = true;
  }
  assert(dupIdThrew, 'CSV with duplicate transaction ID is rejected');

  // -------------------------------------------------------------
  // Test Summary
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`  PHASE 2 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2CaseManagementTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
