import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  FolderOpen,
  ArrowLeft,
  Clock,
  User,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Activity,
  History,
  Send,
  Lock,
  ChevronRight,
  RefreshCw,
  Info,
  ShieldCheck,
  AlertOctagon,
  ArrowRight,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import {
  InvestigationCase,
  CaseStatus,
  CasePriority,
  CaseSeverity,
  NoteCategory,
  CaseNote,
  AuditEvent,
  InvestigationExplanationOutput,
} from '../types';
import {
  caseService,
  VALID_STATUS_TRANSITIONS,
  isClosedStatus,
  CASE_CLOSURE_STATUSES,
} from '../services/caseService';
import { explainTransactionWithAI } from '../services/aiService';
import { AIExplanationModal } from './AIExplanationModal';
import { useAuth } from '../context/AuthContext';

interface CaseManagementProps {
  initialCaseId?: string | null;
  onNavigateToSentinel?: () => void;
}

export const CaseManagement: React.FC<CaseManagementProps> = ({
  initialCaseId,
  onNavigateToSentinel,
}) => {
  const { user, userProfile } = useAuth();
  const [cases, setCases] = useState<InvestigationCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(initialCaseId || null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [severityFilter, setSeverityFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');

  // Messages & Modals
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Note form state
  const [noteCategory, setNoteCategory] = useState<NoteCategory>('Observation');
  const [noteContent, setNoteContent] = useState('');
  const [noteNextStep, setNoteNextStep] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Status Change / Closure modal state
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<CaseStatus | null>(null);
  const [closureReason, setClosureReason] = useState('');
  const [closureConfirmed, setClosureConfirmed] = useState(false);

  // Assignment modal state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [newAssignee, setNewAssignee] = useState('');

  // Priority change modal state
  const [isPriorityModalOpen, setIsPriorityModalOpen] = useState(false);
  const [newPriority, setNewPriority] = useState<CasePriority>('High');

  // AI Explanation Modal State
  const [isExplainModalOpen, setIsExplainModalOpen] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [explanationData, setExplanationData] = useState<InvestigationExplanationOutput | null>(null);

  // Subscribe to case service updates
  useEffect(() => {
    const unsub = caseService.subscribe((updatedCases) => {
      setCases(updatedCases);
    });
    return () => unsub();
  }, []);

  // Sync selectedCaseId if initialCaseId prop changes
  useEffect(() => {
    if (initialCaseId) {
      setSelectedCaseId(initialCaseId);
    }
  }, [initialCaseId]);

  // The active selected case object
  const activeCase = useMemo(() => {
    if (!selectedCaseId) return null;
    return cases.find((c) => c.id === selectedCaseId) || null;
  }, [cases, selectedCaseId]);

  // Filtered cases
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      // Query filter: matches Case ID or Transaction ID or Customer Ref
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        c.id.toLowerCase().includes(q) ||
        c.transactionId.toLowerCase().includes(q) ||
        c.customerReference.toLowerCase().includes(q);

      // Status filter
      const matchesStatus = statusFilter === 'All' || c.status === statusFilter;

      // Severity filter
      const matchesSeverity = severityFilter === 'All' || c.severity === severityFilter;

      // Priority filter
      const matchesPriority = priorityFilter === 'All' || c.priority === priorityFilter;

      return matchesQuery && matchesStatus && matchesSeverity && matchesPriority;
    });
  }, [cases, searchQuery, statusFilter, severityFilter, priorityFilter]);

  // Current logged in analyst identifier
  const currentAnalystName = userProfile?.displayName || user?.displayName || 'Authorized Banking Analyst';
  const currentAnalystEmail = user?.email || undefined;

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 4000);
  };

  // Add Note Handler
  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCase) return;
    if (!noteContent.trim()) {
      showFeedback('error', 'Note content cannot be empty.');
      return;
    }
    if (noteContent.length > 2000) {
      showFeedback('error', 'Note exceeds maximum length of 2,000 characters.');
      return;
    }

    setIsSubmittingNote(true);
    try {
      caseService.addNote({
        caseId: activeCase.id,
        author: currentAnalystName,
        authorEmail: currentAnalystEmail,
        category: noteCategory,
        content: noteContent.trim(),
        nextStep: noteNextStep.trim() || undefined,
      });

      setNoteContent('');
      setNoteNextStep('');
      showFeedback('success', 'Analyst note recorded on chronological timeline.');
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to add note.');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Initiate Status Change
  const handleInitiateStatusChange = (status: CaseStatus) => {
    if (!activeCase) return;
    setPendingStatus(status);
    setClosureReason('');
    setClosureConfirmed(false);
    setIsStatusModalOpen(true);
  };

  // Confirm Status Change
  const handleConfirmStatusChange = () => {
    if (!activeCase || !pendingStatus) return;

    if (isClosedStatus(pendingStatus)) {
      if (!closureReason.trim() || closureReason.trim().length < 5) {
        showFeedback('error', 'Please provide a clear justification (at least 5 characters) for closing this case.');
        return;
      }
      if (!closureConfirmed) {
        showFeedback('error', 'You must explicitly confirm the closure decision.');
        return;
      }
    }

    try {
      caseService.updateStatus({
        caseId: activeCase.id,
        newStatus: pendingStatus,
        actor: currentAnalystName,
        actorEmail: currentAnalystEmail,
        closureReason: isClosedStatus(pendingStatus) ? closureReason.trim() : undefined,
      });

      setIsStatusModalOpen(false);
      setPendingStatus(null);
      showFeedback('success', `Case status updated to "${pendingStatus}".`);
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to update status.');
    }
  };

  // Confirm Assignment Change
  const handleConfirmAssignment = () => {
    if (!activeCase) return;
    if (!newAssignee.trim()) {
      showFeedback('error', 'Assigned analyst cannot be empty.');
      return;
    }

    try {
      caseService.updateAssignment({
        caseId: activeCase.id,
        assignedAnalyst: newAssignee.trim(),
        actor: currentAnalystName,
        actorEmail: currentAnalystEmail,
      });

      setIsAssignModalOpen(false);
      showFeedback('success', `Case reassigned to "${newAssignee.trim()}".`);
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to update assignment.');
    }
  };

  // Confirm Priority Change
  const handleConfirmPriority = () => {
    if (!activeCase) return;
    try {
      caseService.updatePriority({
        caseId: activeCase.id,
        priority: newPriority,
        actor: currentAnalystName,
        actorEmail: currentAnalystEmail,
      });

      setIsPriorityModalOpen(false);
      showFeedback('success', `Case priority updated to "${newPriority}".`);
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to update priority.');
    }
  };

  // AI Explanation Handler for Case
  const handleExplainActiveCaseWithAI = async () => {
    if (!activeCase) return;
    setIsExplainModalOpen(true);
    setIsExplaining(true);
    setExplainError(null);

    try {
      const response = await explainTransactionWithAI({
        transaction: activeCase.transactionSnapshot,
        caseContext: {
          caseId: activeCase.id,
          status: activeCase.status,
          priority: activeCase.priority,
          assignedAnalyst: activeCase.assignedAnalyst,
          existingNotesCount: activeCase.notes.length,
          lastUpdated: activeCase.updatedAt,
        },
      });

      if (response && response.explanation) {
        setExplanationData(response.explanation);
      } else {
        throw new Error('Received incomplete response from explanation service.');
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to generate explanation. Please check your network or credentials.';
      setExplainError(message);
    } finally {
      setIsExplaining(false);
    }
  };

  // Save AI Note to Case Handler
  const handleSaveAIExplanationAsCaseNote = (
    category: 'Observation' | 'Evidence' | 'Action' | 'Decision',
    noteText: string
  ) => {
    if (!activeCase) return;

    try {
      caseService.addNote({
        caseId: activeCase.id,
        author: `${currentAnalystName} (via Gemini AI)`,
        authorEmail: currentAnalystEmail,
        category,
        content: noteText,
        isAIGenerated: true,
        requestingAnalyst: currentAnalystName,
        modelUsed: explanationData?.modelUsed || 'gemini-3.8-flash',
      });
      showFeedback('success', `AI explanation saved as ${category} note on case timeline!`);
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to save AI note to case.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Title */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-800 bg-blue-950/60 px-3 py-1 text-xs font-semibold text-blue-300">
            <FolderOpen className="h-4 w-4" /> INVESTIGATION CASE MANAGEMENT · PHASE 2
          </div>
          <h1 className="mt-3 text-2xl font-bold text-white">Investigation Cases</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Human-in-the-loop investigation workflow for flagged transactions. Risk scores trigger reviews; only human analysts confirm outcomes.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {onNavigateToSentinel && (
            <button
              id="case-back-to-sentinel-btn"
              onClick={onNavigateToSentinel}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Sentinel Queue</span>
            </button>
          )}
          <button
            id="case-reset-demo-btn"
            onClick={() => {
              caseService.resetDemoData();
              showFeedback('success', 'Demonstration investigation cases reloaded.');
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Reset Demo Cases</span>
          </button>
        </div>
      </div>

      {/* Human-Review Governance Banner */}
      <div className="rounded-xl border border-blue-900/60 bg-blue-950/30 p-3.5 text-xs text-blue-200 flex items-start gap-3">
        <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-white">Human Analyst Authority Safeguard:</strong> A risk score is a triage alert for human review, not proof of fraud. Only an authorized human analyst can confirm a fraud outcome, escalate, or close a case. All analyst notes and workflow transitions are captured in the immutable audit trail.
        </div>
      </div>

      {feedbackMsg && (
        <div
          role="alert"
          className={`rounded-lg border p-3 text-sm flex items-center justify-between ${
            feedbackMsg.type === 'success'
              ? 'border-emerald-800 bg-emerald-950/50 text-emerald-200'
              : 'border-red-800 bg-red-950/50 text-red-200'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="text-xs opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Total Cases"
          value={String(cases.length)}
          detail="All logged investigation files"
          icon={<FolderOpen className="h-5 w-5" />}
        />
        <Metric
          label="Open & In Progress"
          value={String(cases.filter((c) => !isClosedStatus(c.status)).length)}
          detail="Active reviewer workload"
          icon={<Activity className="h-5 w-5" />}
        />
        <Metric
          label="Escalated to 2nd Line"
          value={String(cases.filter((c) => c.status === 'Escalated').length)}
          detail="Complex / high-priority reviews"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <Metric
          label="Closed Cases"
          value={String(cases.filter((c) => isClosedStatus(c.status)).length)}
          detail="Analyst-confirmed determinations"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
      </div>

      {/* Main Layout: Case Table or Detail View */}
      {activeCase ? (
        /* Case Detail View */
        <div className="space-y-6">
          {/* Header of Detail View */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <button
                  id="case-detail-back-btn"
                  onClick={() => setSelectedCaseId(null)}
                  className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                  title="Back to all cases"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white font-mono">{activeCase.id}</h2>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${getStatusBadgeStyle(activeCase.status)}`}>
                      {activeCase.status}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${getPriorityBadgeStyle(activeCase.priority)}`}>
                      {activeCase.priority} Priority
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Created: {new Date(activeCase.createdAt).toLocaleString()} by <span className="text-slate-200">{activeCase.createdBy}</span>
                  </p>
                </div>
              </div>

              {/* Action Buttons for Assign, Priority, and Status */}
              <div className="flex flex-wrap gap-2">
                <button
                  id="case-change-assignee-btn"
                  onClick={() => {
                    setNewAssignee(activeCase.assignedAnalyst);
                    setIsAssignModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition cursor-pointer"
                >
                  <User className="h-3.5 w-3.5 text-blue-400" />
                  <span>Reassign</span>
                </button>
                <button
                  id="case-change-priority-btn"
                  onClick={() => {
                    setNewPriority(activeCase.priority);
                    setIsPriorityModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition cursor-pointer"
                >
                  <AlertOctagon className="h-3.5 w-3.5 text-amber-400" />
                  <span>Priority</span>
                </button>
                <button
                  id="case-explain-ai-btn"
                  onClick={handleExplainActiveCaseWithAI}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-800/80 bg-cyan-950/40 hover:bg-cyan-900/60 px-3 py-1.5 text-xs font-bold text-cyan-300 shadow-sm transition cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Explain with AI</span>
                </button>

                {/* Transition Status Dropdown / Quick Actions */}
                <div className="flex gap-1.5">
                  {(VALID_STATUS_TRANSITIONS[activeCase.status] || []).map((target) => (
                    <button
                      key={target}
                      onClick={() => handleInitiateStatusChange(target)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                        isClosedStatus(target)
                          ? 'border border-slate-700 bg-slate-850 text-slate-200 hover:bg-slate-800'
                          : 'bg-blue-600 hover:bg-blue-500 text-white'
                      }`}
                    >
                      <span>Move to {target}</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Closure Info Banner if closed */}
            {isClosedStatus(activeCase.status) && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="font-bold flex items-center gap-1.5 text-white">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" /> Case Closed Determination
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Closed on {activeCase.closedAt ? new Date(activeCase.closedAt).toLocaleString() : 'N/A'} by {activeCase.closedBy}
                  </span>
                </div>
                <p className="text-slate-300 pl-5">
                  <strong>Analyst Rationale:</strong> {activeCase.closureReason || 'No closure rationale recorded.'}
                </p>
              </div>
            )}

            {/* Summary & Facts Strip */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Linked Transaction</span>
                <span className="text-cyan-200 font-mono font-bold text-sm">{activeCase.transactionId}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Synthetic Customer</span>
                <span className="text-white font-mono font-bold text-sm">{activeCase.customerReference}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Captured Risk Score</span>
                <span className={`font-bold text-sm ${activeCase.severity === 'High' ? 'text-red-400' : 'text-amber-400'}`}>
                  {activeCase.riskScore}/100 · {activeCase.severity}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Current Assignee</span>
                <span className="text-white font-semibold text-sm truncate block">{activeCase.assignedAnalyst}</span>
              </div>
            </div>

            {/* Factual Transaction Summary */}
            <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-xs">
              <span className="font-semibold text-slate-300 block mb-1">Factual Case Summary (Grounded in Transaction Facts):</span>
              <p className="text-slate-300 leading-relaxed">{activeCase.summary}</p>
            </div>
          </div>

          {/* Two-Column Workspace: Left = Transaction Snapshot & Contributing Factors, Right = Notes & Audit Trail */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Transaction Snapshot (4 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-cyan-400" /> Linked Transaction Snapshot
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">Captured at creation</span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Amount & Currency</span>
                    <span className="font-semibold text-white">
                      {activeCase.transactionSnapshot.currency} {activeCase.transactionSnapshot.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Country of Origin</span>
                    <span className="font-semibold text-slate-200">{activeCase.transactionSnapshot.country}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Transaction Status</span>
                    <span className="font-semibold text-slate-200">{activeCase.transactionSnapshot.status}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Device Fingerprint</span>
                    <span className="font-semibold text-slate-200">
                      {activeCase.transactionSnapshot.device} {activeCase.transactionSnapshot.isNewDevice && '(New)'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Timestamp</span>
                    <span className="font-semibold text-slate-300">
                      {new Date(activeCase.transactionSnapshot.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-white mb-2">Contributing Risk Factors</h4>
                  {activeCase.transactionSnapshot.factors.length ? (
                    <ul className="space-y-1.5">
                      {activeCase.transactionSnapshot.factors.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-300 bg-slate-950/50 p-2 rounded-lg border border-slate-800/70">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">No specific risk triggers logged.</p>
                  )}
                </div>
              </div>

              {/* Integrity Notice */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-[11px] text-slate-400 space-y-2">
                <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-blue-400" /> Evidence Integrity Safeguard
                </div>
                <p>
                  Analyst notes are append-only and cannot be silently edited or deleted. Each entry records the authenticated author, category, and timestamp.
                </p>
                <p className="text-slate-500">
                  Note: Client-side logs are for prototype demonstration. Production compliance requires server-side write authorization and tamper-proof storage.
                </p>
              </div>
            </div>

            {/* Right Column: Notes & Chronological Audit Timeline (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Add Note Card */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-3">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-400" /> Add Analyst Note & Evidence
                </h3>

                <form onSubmit={handleAddNote} className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="sm:w-1/3">
                      <label className="block text-[11px] text-slate-400 font-medium mb-1">Note Category</label>
                      <select
                        aria-label="Note Category"
                        value={noteCategory}
                        onChange={(e) => setNoteCategory(e.target.value as NoteCategory)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                      >
                        <option value="Observation">Observation</option>
                        <option value="Evidence">Evidence</option>
                        <option value="Action">Action</option>
                        <option value="Decision">Decision</option>
                      </select>
                    </div>

                    <div className="sm:w-2/3">
                      <label className="block text-[11px] text-slate-400 font-medium mb-1">
                        Author / Reviewer
                      </label>
                      <input
                        type="text"
                        disabled
                        value={currentAnalystName}
                        className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-1.5 text-xs text-slate-400 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 font-medium mb-1">
                      Note Content <span className="text-slate-500">(Max 2,000 characters)</span>
                    </label>
                    <textarea
                      aria-label="Note Content"
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      maxLength={2000}
                      rows={3}
                      placeholder="Enter verified facts, customer outreach findings, or risk assessment observations..."
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-white outline-none focus:border-blue-500"
                    />
                    <div className="text-[10px] text-slate-500 text-right">{noteContent.length} / 2000</div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 font-medium mb-1">
                      Optional Next Step <span className="text-slate-500">(Max 500 characters)</span>
                    </label>
                    <input
                      aria-label="Optional Next Step"
                      type="text"
                      value={noteNextStep}
                      onChange={(e) => setNoteNextStep(e.target.value)}
                      maxLength={500}
                      placeholder="e.g. Request identity verification documents from customer branch..."
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      id="case-submit-note-btn"
                      disabled={isSubmittingNote || !noteContent.trim()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-600/30 transition cursor-pointer disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>{isSubmittingNote ? 'Saving...' : 'Add Note to Case'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Chronological Notes Timeline */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-cyan-400" /> Analyst Notes ({activeCase.notes.length})
                  </h3>
                  <span className="text-[10px] text-slate-400">Append-only · Cannot be edited</span>
                </div>

                {activeCase.notes.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    No notes recorded yet. Add observations or evidence above.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {activeCase.notes.map((note) => (
                      <div
                        key={note.id}
                        className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-3.5 space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getNoteCategoryBadge(note.category)}`}>
                              {note.category}
                            </span>
                            {note.isAIGenerated && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800">
                                <Sparkles className="w-3 h-3 text-cyan-400" /> AI-Generated ({note.modelUsed || 'Gemini'})
                              </span>
                            )}
                            <span className="font-semibold text-slate-200">{note.author}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {new Date(note.timestamp).toLocaleString()}
                          </span>
                        </div>
                        {note.requestingAnalyst && (
                          <div className="text-[10px] text-slate-400 italic">
                            Requested by analyst: <span className="text-slate-300">{note.requestingAnalyst}</span>
                          </div>
                        )}
                        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                        {note.nextStep && (
                          <div className="text-[11px] text-cyan-300 bg-cyan-950/30 p-2 rounded-lg border border-cyan-900/40">
                            <strong>Next Step:</strong> {note.nextStep}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Append-Only Audit Trail */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <History className="h-4 w-4 text-purple-400" /> Audit Trail ({activeCase.auditTrail.length})
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">Immutable Log</span>
                </div>

                <div className="space-y-2.5">
                  {activeCase.auditTrail.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-start gap-3 text-xs border-b border-slate-800/60 pb-2.5 last:border-b-0"
                    >
                      <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                      <div className="flex-1 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200">{ev.eventType.replace('_', ' ')}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(ev.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-slate-300 text-[11px]">{ev.description}</p>
                        {(ev.beforeValue || ev.afterValue) && (
                          <div className="text-[10px] text-slate-400">
                            {ev.beforeValue && <span>From: <span className="text-slate-300 font-mono">{ev.beforeValue}</span> </span>}
                            {ev.afterValue && <span>To: <span className="text-slate-200 font-mono">{ev.afterValue}</span></span>}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-500">Actor: {ev.actor}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Case List Table View */
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
          {/* Filter Bar */}
          <div className="flex flex-col gap-3 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1 max-w-sm relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                id="case-search-input"
                aria-label="Search cases"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search case ID, TX ID, customer..."
                className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <select
                id="case-filter-status"
                aria-label="Filter by Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
              >
                <option value="All">All Statuses</option>
                <option value="Open">Open</option>
                <option value="Under Investigation">Under Investigation</option>
                <option value="Escalated">Escalated</option>
                <option value="Closed — No Fraud">Closed — No Fraud</option>
                <option value="Closed — Confirmed Fraud">Closed — Confirmed Fraud</option>
              </select>

              <select
                id="case-filter-severity"
                aria-label="Filter by Severity"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
              >
                <option value="All">All Severities</option>
                <option value="High">High Severity</option>
                <option value="Medium">Medium Severity</option>
                <option value="Low">Low Severity</option>
              </select>

              <select
                id="case-filter-priority"
                aria-label="Filter by Priority"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
              >
                <option value="All">All Priorities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-xs">
              <thead className="bg-slate-950/70 text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Case ID</th>
                  <th className="px-4 py-3">Transaction</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Risk Score</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Assignee</th>
                  <th className="px-4 py-3">Last Updated</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedCaseId(c.id)}
                    className="cursor-pointer border-t border-slate-800/80 hover:bg-slate-800/40 transition"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-blue-300">{c.id}</td>
                    <td className="px-4 py-3 font-mono text-cyan-200">{c.transactionId}</td>
                    <td className="px-4 py-3 text-slate-200">{c.customerReference}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                          c.severity === 'High'
                            ? 'border-red-800 bg-red-950/60 text-red-300'
                            : c.severity === 'Medium'
                            ? 'border-amber-800 bg-amber-950/50 text-amber-300'
                            : 'border-emerald-800 bg-emerald-950/50 text-emerald-300'
                        }`}
                      >
                        {c.riskScore} · {c.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${getStatusBadgeStyle(c.status)}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${getPriorityBadgeStyle(c.priority)}`}>
                        {c.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 truncate max-w-[140px]">{c.assignedAnalyst}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                      {new Date(c.updatedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCaseId(c.id);
                        }}
                        className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
                      >
                        <span>Inspect</span>
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
                {!filteredCases.length && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                      No investigation cases match the current filter or search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Modal: Status Change / Case Closure */}
      {isStatusModalOpen && activeCase && pendingStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-400" /> Confirm Status Change
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Transition case <span className="font-mono text-cyan-200">{activeCase.id}</span>
                </p>
              </div>
              <button
                onClick={() => setIsStatusModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400">Current Status:</span>
                <span className="font-semibold text-white">{activeCase.status}</span>
              </div>
              <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400">Target Status:</span>
                <span className="font-bold text-blue-300">{pendingStatus}</span>
              </div>

              {isClosedStatus(pendingStatus) && (
                <div className="space-y-3 border-t border-slate-800 pt-3">
                  <div className="rounded-lg border border-amber-900/60 bg-amber-950/30 p-2.5 text-amber-200">
                    <strong>Analyst Closure Governance:</strong> Closing a case requires explicit human review and recorded rationale.
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Closure Justification / Rationale <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      aria-label="Closure Justification"
                      value={closureReason}
                      onChange={(e) => setClosureReason(e.target.value)}
                      rows={3}
                      placeholder="Detail the investigative evidence and reason for closing (minimum 5 characters)..."
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white outline-none focus:border-blue-500"
                    />
                  </div>

                  <label className="flex items-start gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={closureConfirmed}
                      onChange={(e) => setClosureConfirmed(e.target.checked)}
                      className="mt-0.5 rounded border-slate-700 bg-slate-950 text-blue-600"
                    />
                    <span>
                      I certify that as an authorized human analyst, I have reviewed the facts and confirm this outcome.
                    </span>
                  </label>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(false)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-status-change-btn"
                onClick={handleConfirmStatusChange}
                className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-700/30 transition cursor-pointer"
              >
                Apply Transition
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reassign Analyst */}
      {isAssignModalOpen && activeCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-400" /> Reassign Case
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Case {activeCase.id}</p>
              </div>
              <button onClick={() => setIsAssignModalOpen(false)} className="text-slate-400 hover:text-white text-sm px-2 py-1">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Assigned Analyst</label>
                <input
                  aria-label="Assigned Analyst"
                  type="text"
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value)}
                  placeholder="Enter analyst name or team..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-reassign-btn"
                onClick={handleConfirmAssignment}
                className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-700/30 transition cursor-pointer"
              >
                Save Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Update Priority */}
      {isPriorityModalOpen && activeCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <AlertOctagon className="h-5 w-5 text-amber-400" /> Update Case Priority
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Case {activeCase.id}</p>
              </div>
              <button onClick={() => setIsPriorityModalOpen(false)} className="text-slate-400 hover:text-white text-sm px-2 py-1">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Select Priority</label>
                <select
                  aria-label="Select Priority"
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as CasePriority)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-blue-500"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsPriorityModalOpen(false)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-priority-btn"
                onClick={handleConfirmPriority}
                className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-700/30 transition cursor-pointer"
              >
                Save Priority
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Explanation Modal */}
      {activeCase && (
        <AIExplanationModal
          isOpen={isExplainModalOpen}
          onClose={() => setIsExplainModalOpen(false)}
          isLoading={isExplaining}
          error={explainError}
          explanation={explanationData}
          onRetry={handleExplainActiveCaseWithAI}
          onSaveAsNote={handleSaveAIExplanationAsCaseNote}
          canSaveAsNote={true}
          caseId={activeCase.id}
          transactionId={activeCase.transactionId}
        />
      )}
    </div>
  );
};

// Helpers for badges
function getStatusBadgeStyle(status: CaseStatus): string {
  switch (status) {
    case 'Open':
      return 'border-blue-800 bg-blue-950/60 text-blue-300';
    case 'Under Investigation':
      return 'border-cyan-800 bg-cyan-950/60 text-cyan-300';
    case 'Escalated':
      return 'border-purple-800 bg-purple-950/60 text-purple-300';
    case 'Closed — No Fraud':
      return 'border-emerald-800 bg-emerald-950/60 text-emerald-300';
    case 'Closed — Confirmed Fraud':
      return 'border-red-800 bg-red-950/60 text-red-300';
    default:
      return 'border-slate-700 bg-slate-800 text-slate-300';
  }
}

function getPriorityBadgeStyle(priority: CasePriority): string {
  switch (priority) {
    case 'Critical':
      return 'border-red-800 bg-red-950 text-red-300';
    case 'High':
      return 'border-amber-800 bg-amber-950 text-amber-300';
    case 'Medium':
      return 'border-blue-800 bg-blue-950 text-blue-300';
    case 'Low':
      return 'border-slate-700 bg-slate-900 text-slate-400';
  }
}

function getNoteCategoryBadge(cat: NoteCategory): string {
  switch (cat) {
    case 'Observation':
      return 'border-blue-800 bg-blue-950/70 text-blue-300';
    case 'Evidence':
      return 'border-cyan-800 bg-cyan-950/70 text-cyan-300';
    case 'Action':
      return 'border-amber-800 bg-amber-950/70 text-amber-300';
    case 'Decision':
      return 'border-purple-800 bg-purple-950/70 text-purple-300';
  }
}

const Metric: React.FC<{ label: string; value: string; detail: string; icon: React.ReactNode }> = ({
  label,
  value,
  detail,
  icon,
}) => (
  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
    <div className="flex items-center justify-between text-blue-400">
      <span className="text-xs font-semibold text-slate-300">{label}</span>
      {icon}
    </div>
    <div className="mt-3 text-2xl font-bold text-white">{value}</div>
    <p className="mt-1 text-[11px] text-slate-500">{detail}</p>
  </div>
);
