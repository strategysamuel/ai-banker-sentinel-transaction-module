/**
 * AI Banker Sentinel — Phase 2: Investigation Case Management Service
 *
 * Dedicated case service with:
 * - Deterministic, sequential Case ID generation (e.g. CASE-2026-0001)
 * - Duplicate active case prevention for the same transaction
 * - Synthetic summary builder grounded strictly in transaction facts and risk factors
 * - Human-analyst governance: risk score is an alert, fraud confirmation requires human analyst decision
 * - Note validation, tamper-resistance (no editing/deleting notes), max note length limit (2,000 chars)
 * - Append-only audit trail capturing actor, eventType, timestamp, beforeValue, afterValue
 * - Valid status transition state-machine with closure confirmation/reason enforcement
 * - Dual persistence: Local demo store (in-memory + localStorage backup) with seamless listener subscriptions
 *
 * CRITICAL SAFEGUARDS:
 * - Uses synthetic demo data only (never real customer data).
 * - Clear disclaimer that client-side logs are for demonstration; production audit integrity requires server-side authorization.
 */

import {
  InvestigationCase,
  CaseStatus,
  CasePriority,
  CaseNote,
  NoteCategory,
  AuditEvent,
  CreateCaseInput,
  AddNoteInput,
  UpdateStatusInput,
  UpdateAssignmentInput,
  UpdatePriorityInput,
  LinkedTransactionSnapshot,
} from '../types';

const STORAGE_KEY = 'ai_banker_sentinel_cases_v1';
const MAX_NOTE_LENGTH = 2000;

// Valid status transitions state machine
export const VALID_STATUS_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  Open: ['Under Investigation', 'Escalated', 'Closed — No Fraud', 'Closed — Confirmed Fraud'],
  'Under Investigation': ['Escalated', 'Closed — No Fraud', 'Closed — Confirmed Fraud', 'Open'],
  Escalated: ['Under Investigation', 'Closed — No Fraud', 'Closed — Confirmed Fraud', 'Open'],
  'Closed — No Fraud': ['Open', 'Under Investigation'], // Can be reopened by analyst if new evidence surfaces
  'Closed — Confirmed Fraud': ['Under Investigation'], // Reopening requires fresh analyst review
};

export const CASE_CLOSURE_STATUSES: CaseStatus[] = [
  'Closed — No Fraud',
  'Closed — Confirmed Fraud',
];

export function isClosedStatus(status: CaseStatus): boolean {
  return CASE_CLOSURE_STATUSES.includes(status);
}

export function isValidStatusTransition(currentStatus: CaseStatus, targetStatus: CaseStatus): boolean {
  if (currentStatus === targetStatus) return true;
  const allowed = VALID_STATUS_TRANSITIONS[currentStatus];
  return Boolean(allowed && allowed.includes(targetStatus));
}

/**
 * Builds a concise, factual summary from available synthetic transaction facts & risk factors.
 * Strictly adheres to not inventing facts beyond what is in the snapshot.
 */
export function buildFactualSummary(t: LinkedTransactionSnapshot): string {
  const parts: string[] = [];
  parts.push(`Flagged transaction ${t.transactionId} for synthetic customer ${t.customerId}`);
  parts.push(`amount: ${t.currency} ${t.amount.toLocaleString('en-IN')}`);
  parts.push(`origin: ${t.country}`);
  parts.push(`status: ${t.status}`);
  parts.push(`device: ${t.device}${t.isNewDevice ? ' (new device)' : ''}`);
  parts.push(`risk score: ${t.score}/100 (${t.level} risk)`);

  if (t.factors && t.factors.length > 0) {
    parts.push(`Contributing indicators: ${t.factors.join('; ')}.`);
  } else {
    parts.push('No specific high-risk indicators triggered.');
  }

  return parts.join(' · ');
}

// Seed demo cases with realistic synthetic data to jumpstart exploration
function generateSeedCases(): InvestigationCase[] {
  const now = new Date('2026-10-18T09:30:00+05:30').toISOString();
  const earlier = new Date('2026-10-18T09:20:00+05:30').toISOString();

  const tx1002: LinkedTransactionSnapshot = {
    transactionId: 'TX-1002',
    customerId: 'C-205',
    amount: 185000,
    currency: 'INR',
    country: 'IN',
    timestamp: '2026-10-18T09:18:00+05:30',
    status: 'SUCCESS',
    device: 'web-9',
    isNewDevice: true,
    score: 68,
    level: 'High',
    factors: [
      'Very high transaction amount (≥ 100,000)',
      'New device indicator',
      'Multiple transactions within 10 minutes',
    ],
  };

  const tx1003: LinkedTransactionSnapshot = {
    transactionId: 'TX-1003',
    customerId: 'C-205',
    amount: 92000,
    currency: 'INR',
    country: 'AE',
    timestamp: '2026-10-18T09:24:00+05:30',
    status: 'SUCCESS',
    device: 'web-9',
    isNewDevice: true,
    score: 80,
    level: 'High',
    factors: [
      'High transaction amount (≥ 50,000)',
      'Cross-border location (AE)',
      'New device indicator',
      'Multiple transactions within 10 minutes',
    ],
  };

  const tx1007: LinkedTransactionSnapshot = {
    transactionId: 'TX-1007',
    customerId: 'C-519',
    amount: 51000,
    currency: 'INR',
    country: 'GB',
    timestamp: '2026-10-18T03:17:00+05:30',
    status: 'SUCCESS',
    device: 'browser-4',
    isNewDevice: true,
    score: 77,
    level: 'High',
    factors: [
      'High transaction amount (≥ 50,000)',
      'Cross-border location (GB)',
      'New device indicator',
      'Unusual transaction hour',
    ],
  };

  return [
    {
      id: 'CASE-2026-0001',
      transactionId: 'TX-1003',
      customerReference: 'C-205',
      riskScore: 80,
      severity: 'High',
      createdAt: earlier,
      createdBy: 'Sentinel Rule Engine / Lead Analyst',
      createdByEmail: 'analyst1@sentinel.bank',
      updatedAt: earlier,
      status: 'Under Investigation',
      priority: 'High',
      assignedAnalyst: 'Sarah Jenkins (Senior Investigator)',
      assignedAnalystEmail: 's.jenkins@sentinel.bank',
      summary: buildFactualSummary(tx1003),
      transactionSnapshot: tx1003,
      notes: [
        {
          id: 'NOTE-101',
          author: 'Sarah Jenkins',
          authorEmail: 's.jenkins@sentinel.bank',
          timestamp: earlier,
          category: 'Observation',
          content: 'Rapid cross-border velocity observed for customer C-205 following TX-1002 in India. Device signature web-9 reported as new.',
          nextStep: 'Check customer contact history and outbound SMS verification status.',
        },
      ],
      auditTrail: [
        {
          id: 'AUDIT-101',
          timestamp: earlier,
          actor: 'Lead Analyst',
          actorEmail: 'analyst1@sentinel.bank',
          eventType: 'CASE_CREATED',
          description: 'Case created for transaction TX-1003',
          beforeValue: null,
          afterValue: 'CASE-2026-0001 (Open, Priority: High)',
        },
        {
          id: 'AUDIT-102',
          timestamp: earlier,
          actor: 'Lead Analyst',
          actorEmail: 'analyst1@sentinel.bank',
          eventType: 'ASSIGNMENT_CHANGED',
          description: 'Case assigned to Sarah Jenkins',
          beforeValue: 'Unassigned',
          afterValue: 'Sarah Jenkins (Senior Investigator)',
        },
        {
          id: 'AUDIT-103',
          timestamp: earlier,
          actor: 'Sarah Jenkins',
          actorEmail: 's.jenkins@sentinel.bank',
          eventType: 'STATUS_CHANGED',
          description: 'Investigation started',
          beforeValue: 'Open',
          afterValue: 'Under Investigation',
        },
        {
          id: 'AUDIT-104',
          timestamp: earlier,
          actor: 'Sarah Jenkins',
          actorEmail: 's.jenkins@sentinel.bank',
          eventType: 'NOTE_ADDED',
          description: 'Added Observation note regarding cross-border velocity',
        },
      ],
    },
    {
      id: 'CASE-2026-0002',
      transactionId: 'TX-1007',
      customerReference: 'C-519',
      riskScore: 77,
      severity: 'High',
      createdAt: now,
      createdBy: 'Automated Rule Alert',
      createdByEmail: 'sentinel-bot@sentinel.bank',
      updatedAt: now,
      status: 'Open',
      priority: 'Critical',
      assignedAnalyst: 'Unassigned',
      summary: buildFactualSummary(tx1007),
      transactionSnapshot: tx1007,
      notes: [],
      auditTrail: [
        {
          id: 'AUDIT-201',
          timestamp: now,
          actor: 'Automated Rule Alert',
          actorEmail: 'sentinel-bot@sentinel.bank',
          eventType: 'CASE_CREATED',
          description: 'Case auto-triaged from nocturnal cross-border alert',
          beforeValue: null,
          afterValue: 'CASE-2026-0002 (Open, Priority: Critical)',
        },
      ],
    },
    {
      id: 'CASE-2026-0003',
      transactionId: 'TX-1002',
      customerReference: 'C-205',
      riskScore: 68,
      severity: 'High',
      createdAt: earlier,
      createdBy: 'David Mercer',
      createdByEmail: 'd.mercer@sentinel.bank',
      updatedAt: now,
      status: 'Escalated',
      priority: 'Medium',
      assignedAnalyst: 'David Mercer (Risk Officer)',
      assignedAnalystEmail: 'd.mercer@sentinel.bank',
      summary: buildFactualSummary(tx1002),
      transactionSnapshot: tx1002,
      notes: [
        {
          id: 'NOTE-301',
          author: 'David Mercer',
          authorEmail: 'd.mercer@sentinel.bank',
          timestamp: earlier,
          category: 'Action',
          content: 'Escalated to Second-Line Financial Crime compliance for multi-transaction aggregate review.',
          nextStep: 'Await response from Fraud Ops triage desk.',
        },
      ],
      auditTrail: [
        {
          id: 'AUDIT-301',
          timestamp: earlier,
          actor: 'David Mercer',
          actorEmail: 'd.mercer@sentinel.bank',
          eventType: 'CASE_CREATED',
          description: 'Case created for high-value domestic transaction',
          beforeValue: null,
          afterValue: 'CASE-2026-0003',
        },
        {
          id: 'AUDIT-302',
          timestamp: now,
          actor: 'David Mercer',
          actorEmail: 'd.mercer@sentinel.bank',
          eventType: 'STATUS_CHANGED',
          description: 'Escalated to 2nd Line Risk',
          beforeValue: 'Open',
          afterValue: 'Escalated',
        },
      ],
    },
  ];
}

class CaseService {
  private cases: InvestigationCase[] = [];
  private listeners: Set<(cases: InvestigationCase[]) => void> = new Set();
  private nextCaseSeq: number = 4;

  constructor() {
    this.loadInitial();
  }

  private loadInitial() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.cases = parsed;
            this.syncSequence();
            return;
          }
        }
      } catch (err) {
        console.warn('Could not read cases from localStorage, using seed cases:', err);
      }
    }
    this.cases = generateSeedCases();
    this.syncSequence();
    this.persist();
  }

  private syncSequence() {
    let max = 0;
    for (const c of this.cases) {
      const match = c.id.match(/^CASE-(\d{4})-(\d+)$/);
      if (match) {
        const num = parseInt(match[2], 10);
        if (!isNaN(num) && num > max) max = num;
      }
    }
    this.nextCaseSeq = Math.max(max + 1, 1);
  }

  private persist() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cases));
      } catch (err) {
        console.warn('Failed to persist cases to localStorage:', err);
      }
    }
    this.notify();
  }

  private notify() {
    const copy = this.getAllCases();
    this.listeners.forEach((listener) => {
      try {
        listener(copy);
      } catch (err) {
        console.error('Error in case subscriber listener:', err);
      }
    });
  }

  public subscribe(listener: (cases: InvestigationCase[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getAllCases());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getAllCases(): InvestigationCase[] {
    // Return sorted by updatedAt descending
    return [...this.cases].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  public getCaseById(caseId: string): InvestigationCase | null {
    if (!caseId) return null;
    const found = this.cases.find((c) => c.id.toUpperCase() === caseId.trim().toUpperCase());
    return found ? { ...found, notes: [...found.notes], auditTrail: [...found.auditTrail] } : null;
  }

  public getCaseByTransactionId(transactionId: string): InvestigationCase | null {
    if (!transactionId) return null;
    const found = this.cases.find(
      (c) => c.transactionId.toUpperCase() === transactionId.trim().toUpperCase()
    );
    return found ? { ...found, notes: [...found.notes], auditTrail: [...found.auditTrail] } : null;
  }

  public getActiveCaseByTransactionId(transactionId: string): InvestigationCase | null {
    if (!transactionId) return null;
    const found = this.cases.find(
      (c) =>
        c.transactionId.toUpperCase() === transactionId.trim().toUpperCase() &&
        !isClosedStatus(c.status)
    );
    return found ? { ...found, notes: [...found.notes], auditTrail: [...found.auditTrail] } : null;
  }

  public resetDemoData(): void {
    this.cases = generateSeedCases();
    this.syncSequence();
    this.persist();
  }

  private generateCaseId(): string {
    const year = new Date().getFullYear();
    const seqStr = String(this.nextCaseSeq).padStart(4, '0');
    this.nextCaseSeq += 1;
    return `CASE-${year}-${seqStr}`;
  }

  /**
   * Create an investigation case from a flagged transaction snapshot.
   * Validates duplicate active cases for the same transaction.
   */
  public createCase(input: CreateCaseInput): InvestigationCase {
    if (!input || !input.transaction) {
      throw new Error('A valid transaction snapshot is required to create a case.');
    }
    const { transaction } = input;
    if (!transaction.transactionId || !transaction.transactionId.trim()) {
      throw new Error('Transaction ID is required.');
    }

    const existingActive = this.getActiveCaseByTransactionId(transaction.transactionId);
    if (existingActive) {
      throw new Error(
        `Active case ${existingActive.id} already exists for transaction ${transaction.transactionId} (Status: ${existingActive.status}).`
      );
    }

    const now = new Date().toISOString();
    const caseId = this.generateCaseId();
    const creatingAnalyst = (input.creatingAnalyst || '').trim() || 'Authorized Banking Analyst';
    const assignedAnalyst = (input.assignedAnalyst || '').trim() || 'Unassigned';
    const priority: CasePriority = input.priority || (transaction.level === 'High' ? 'High' : 'Medium');

    const auditTrail: AuditEvent[] = [
      {
        id: `AUDIT-${Date.now()}-1`,
        timestamp: now,
        actor: creatingAnalyst,
        actorEmail: input.creatingAnalystEmail,
        eventType: 'CASE_CREATED',
        description: `Case ${caseId} created for flagged transaction ${transaction.transactionId} with risk score ${transaction.score}/100`,
        beforeValue: null,
        afterValue: `${caseId} (Status: Open, Priority: ${priority}, Assignee: ${assignedAnalyst})`,
      },
    ];

    const notes: CaseNote[] = [];
    if (input.initialNote && input.initialNote.trim()) {
      const noteContent = input.initialNote.trim();
      if (noteContent.length > MAX_NOTE_LENGTH) {
        throw new Error(`Initial note exceeds maximum limit of ${MAX_NOTE_LENGTH} characters.`);
      }
      const noteId = `NOTE-${Date.now()}`;
      notes.push({
        id: noteId,
        author: creatingAnalyst,
        authorEmail: input.creatingAnalystEmail,
        timestamp: now,
        category: 'Observation',
        content: noteContent,
      });
      auditTrail.push({
        id: `AUDIT-${Date.now()}-2`,
        timestamp: now,
        actor: creatingAnalyst,
        actorEmail: input.creatingAnalystEmail,
        eventType: 'NOTE_ADDED',
        description: 'Initial intake note added at case creation',
        beforeValue: null,
        afterValue: noteId,
      });
    }

    const newCase: InvestigationCase = {
      id: caseId,
      transactionId: transaction.transactionId,
      customerReference: transaction.customerId || 'Unknown Customer',
      riskScore: transaction.score,
      severity: transaction.level,
      createdAt: now,
      createdBy: creatingAnalyst,
      createdByEmail: input.creatingAnalystEmail,
      updatedAt: now,
      status: 'Open',
      priority,
      assignedAnalyst,
      assignedAnalystEmail: input.assignedAnalystEmail,
      summary: buildFactualSummary(transaction),
      transactionSnapshot: { ...transaction },
      notes,
      auditTrail,
    };

    this.cases = [newCase, ...this.cases];
    this.persist();
    return newCase;
  }

  /**
   * Append a validated, immutable note to a case.
   */
  public addNote(input: AddNoteInput): CaseNote {
    if (!input.caseId) throw new Error('Case ID is required.');
    const caseItem = this.cases.find((c) => c.id === input.caseId);
    if (!caseItem) throw new Error(`Case ${input.caseId} not found.`);

    const author = (input.author || '').trim();
    if (!author) throw new Error('Note author is required.');

    const content = (input.content || '').trim();
    if (!content) throw new Error('Note content cannot be empty.');
    if (content.length > MAX_NOTE_LENGTH) {
      throw new Error(`Note length (${content.length}) exceeds maximum limit of ${MAX_NOTE_LENGTH} characters.`);
    }

    const nextStep = input.nextStep ? input.nextStep.trim() : undefined;
    if (nextStep && nextStep.length > 500) {
      throw new Error('Next step cannot exceed 500 characters.');
    }

    const validCategories: NoteCategory[] = ['Observation', 'Evidence', 'Action', 'Decision'];
    if (!validCategories.includes(input.category)) {
      throw new Error(`Invalid note category: ${input.category}. Must be one of: ${validCategories.join(', ')}.`);
    }

    const now = new Date().toISOString();
    const newNote: CaseNote = {
      id: `NOTE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      author,
      authorEmail: input.authorEmail,
      timestamp: now,
      category: input.category,
      content,
      nextStep,
      isAIGenerated: input.isAIGenerated,
      requestingAnalyst: input.requestingAnalyst,
      modelUsed: input.modelUsed,
    };

    caseItem.notes = [...caseItem.notes, newNote];
    caseItem.updatedAt = now;

    // Append audit event
    const auditEvent: AuditEvent = {
      id: `AUDIT-${Date.now()}`,
      timestamp: now,
      actor: author,
      actorEmail: input.authorEmail,
      eventType: 'NOTE_ADDED',
      description: input.isAIGenerated
        ? `Added AI-generated explanation note (${input.category}) requested by ${input.requestingAnalyst || author} using ${input.modelUsed || 'Gemini'}`
        : `Added ${input.category} note${nextStep ? ' with defined next step' : ''}`,
      beforeValue: null,
      afterValue: `${newNote.id}: [${input.category}] ${content.slice(0, 80)}${content.length > 80 ? '...' : ''}`,
    };
    caseItem.auditTrail = [...caseItem.auditTrail, auditEvent];

    this.persist();
    return newNote;
  }

  /**
   * Update case status with state-machine validation and closure confirmation enforcement.
   */
  public updateStatus(input: UpdateStatusInput): InvestigationCase {
    if (!input.caseId) throw new Error('Case ID is required.');
    const caseItem = this.cases.find((c) => c.id === input.caseId);
    if (!caseItem) throw new Error(`Case ${input.caseId} not found.`);

    const currentStatus = caseItem.status;
    const newStatus = input.newStatus;
    const actor = (input.actor || '').trim() || 'Authorized Analyst';

    if (!isValidStatusTransition(currentStatus, newStatus)) {
      throw new Error(
        `Invalid status transition from "${currentStatus}" to "${newStatus}". Allowed transitions: ${
          VALID_STATUS_TRANSITIONS[currentStatus]?.join(', ') || 'None'
        }.`
      );
    }

    const isClosing = isClosedStatus(newStatus);
    if (isClosing) {
      const reason = (input.closureReason || '').trim();
      if (!reason || reason.length < 5) {
        throw new Error('A detailed closure reason (at least 5 characters) is required to close a case.');
      }
    }

    const now = new Date().toISOString();
    caseItem.status = newStatus;
    caseItem.updatedAt = now;

    if (isClosing) {
      caseItem.closureReason = input.closureReason?.trim();
      caseItem.closedAt = now;
      caseItem.closedBy = actor;
    } else {
      caseItem.closureReason = undefined;
      caseItem.closedAt = undefined;
      caseItem.closedBy = undefined;
    }

    const auditEvent: AuditEvent = {
      id: `AUDIT-${Date.now()}`,
      timestamp: now,
      actor,
      actorEmail: input.actorEmail,
      eventType: isClosing ? 'CASE_CLOSED' : 'STATUS_CHANGED',
      description: isClosing
        ? `Case closed as "${newStatus}". Reason: ${caseItem.closureReason}`
        : `Status changed from "${currentStatus}" to "${newStatus}"`,
      beforeValue: currentStatus,
      afterValue: newStatus,
    };
    caseItem.auditTrail = [...caseItem.auditTrail, auditEvent];

    this.persist();
    return { ...caseItem };
  }

  /**
   * Reassign case to a new analyst.
   */
  public updateAssignment(input: UpdateAssignmentInput): InvestigationCase {
    if (!input.caseId) throw new Error('Case ID is required.');
    const caseItem = this.cases.find((c) => c.id === input.caseId);
    if (!caseItem) throw new Error(`Case ${input.caseId} not found.`);

    const newAssignee = (input.assignedAnalyst || '').trim();
    if (!newAssignee) throw new Error('Assigned analyst name cannot be blank.');

    const before = caseItem.assignedAnalyst;
    const actor = (input.actor || '').trim() || 'Authorized Analyst';
    const now = new Date().toISOString();

    caseItem.assignedAnalyst = newAssignee;
    caseItem.assignedAnalystEmail = input.assignedAnalystEmail;
    caseItem.updatedAt = now;

    const auditEvent: AuditEvent = {
      id: `AUDIT-${Date.now()}`,
      timestamp: now,
      actor,
      actorEmail: input.actorEmail,
      eventType: 'ASSIGNMENT_CHANGED',
      description: `Case reassigned from "${before}" to "${newAssignee}"`,
      beforeValue: before,
      afterValue: newAssignee,
    };
    caseItem.auditTrail = [...caseItem.auditTrail, auditEvent];

    this.persist();
    return { ...caseItem };
  }

  /**
   * Update case priority.
   */
  public updatePriority(input: UpdatePriorityInput): InvestigationCase {
    if (!input.caseId) throw new Error('Case ID is required.');
    const caseItem = this.cases.find((c) => c.id === input.caseId);
    if (!caseItem) throw new Error(`Case ${input.caseId} not found.`);

    const validPriorities: CasePriority[] = ['Low', 'Medium', 'High', 'Critical'];
    if (!validPriorities.includes(input.priority)) {
      throw new Error(`Invalid priority: ${input.priority}. Must be one of: ${validPriorities.join(', ')}.`);
    }

    const before = caseItem.priority;
    const actor = (input.actor || '').trim() || 'Authorized Analyst';
    const now = new Date().toISOString();

    caseItem.priority = input.priority;
    caseItem.updatedAt = now;

    const auditEvent: AuditEvent = {
      id: `AUDIT-${Date.now()}`,
      timestamp: now,
      actor,
      actorEmail: input.actorEmail,
      eventType: 'PRIORITY_CHANGED',
      description: `Priority updated from "${before}" to "${input.priority}"`,
      beforeValue: before,
      afterValue: input.priority,
    };
    caseItem.auditTrail = [...caseItem.auditTrail, auditEvent];

    this.persist();
    return { ...caseItem };
  }
}

// Singleton export
export const caseService = new CaseService();
