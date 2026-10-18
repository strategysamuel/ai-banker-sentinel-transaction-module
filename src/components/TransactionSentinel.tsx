import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  AlertTriangle,
  Activity,
  Upload,
  ShieldAlert,
  Search,
  RefreshCw,
  FileDown,
  FolderPlus,
  ExternalLink,
  CheckCircle,
  FileText,
  UserCheck,
  Sparkles,
} from 'lucide-react';
import { caseService } from '../services/caseService';
import { explainTransactionWithAI } from '../services/aiService';
import { AIExplanationModal } from './AIExplanationModal';
import {
  InvestigationCase,
  LinkedTransactionSnapshot,
  CasePriority,
  InvestigationExplanationOutput,
} from '../types';
import { useAuth } from '../context/AuthContext';

export type Transaction = {
  transactionId: string;
  customerId: string;
  amount: number;
  currency: string;
  country: string;
  timestamp: string;
  status: string;
  device: string;
  isNewDevice: boolean;
};

export type ScoredTransaction = Transaction & {
  score: number;
  level: 'High' | 'Medium' | 'Low';
  factors: string[];
};

export const sampleTransactions: Transaction[] = [
  { transactionId: 'TX-1001', customerId: 'C-104', amount: 420, currency: 'INR', country: 'IN', timestamp: '2026-10-18T09:12:00+05:30', status: 'SUCCESS', device: 'mobile-1', isNewDevice: false },
  { transactionId: 'TX-1002', customerId: 'C-205', amount: 185000, currency: 'INR', country: 'IN', timestamp: '2026-10-18T09:18:00+05:30', status: 'SUCCESS', device: 'web-9', isNewDevice: true },
  { transactionId: 'TX-1003', customerId: 'C-205', amount: 92000, currency: 'INR', country: 'AE', timestamp: '2026-10-18T09:24:00+05:30', status: 'SUCCESS', device: 'web-9', isNewDevice: true },
  { transactionId: 'TX-1004', customerId: 'C-331', amount: 1500, currency: 'INR', country: 'IN', timestamp: '2026-10-18T02:41:00+05:30', status: 'DECLINED', device: 'mobile-8', isNewDevice: false },
  { transactionId: 'TX-1005', customerId: 'C-331', amount: 2200, currency: 'INR', country: 'IN', timestamp: '2026-10-18T02:43:00+05:30', status: 'DECLINED', device: 'mobile-8', isNewDevice: false },
  { transactionId: 'TX-1006', customerId: 'C-087', amount: 780, currency: 'INR', country: 'IN', timestamp: '2026-10-18T11:02:00+05:30', status: 'SUCCESS', device: 'mobile-3', isNewDevice: false },
  { transactionId: 'TX-1007', customerId: 'C-519', amount: 51000, currency: 'INR', country: 'GB', timestamp: '2026-10-18T03:17:00+05:30', status: 'SUCCESS', device: 'browser-4', isNewDevice: true },
  { transactionId: 'TX-1008', customerId: 'C-112', amount: 1250, currency: 'INR', country: 'IN', timestamp: '2026-10-18T14:10:00+05:30', status: 'SUCCESS', device: 'mobile-5', isNewDevice: false },
];

export const REQUIRED_CSV_HEADERS = ['transactionId', 'customerId', 'amount', 'currency', 'country', 'timestamp', 'status', 'device'];

export function scoreTransactions(rows: Transaction[]): ScoredTransaction[] {
  const byCustomer = new Map<string, Transaction[]>();
  rows.forEach((t) => byCustomer.set(t.customerId, [...(byCustomer.get(t.customerId) || []), t]));
  return rows.map((t) => {
    const factors: string[] = [];
    let score = 0;
    if (t.amount >= 100000) { score += 35; factors.push('Very high transaction amount (≥ 100,000)'); }
    else if (t.amount >= 50000) { score += 22; factors.push('High transaction amount (≥ 50,000)'); }
    if (t.country && t.country.toUpperCase() !== 'IN') { score += 25; factors.push(`Cross-border location (${t.country.toUpperCase()})`); }
    if (t.isNewDevice) { score += 18; factors.push('New device indicator'); }
    const hour = new Date(t.timestamp).getHours();
    if (Number.isFinite(hour) && (hour < 5 || hour >= 23)) { score += 12; factors.push('Unusual transaction hour'); }
    if (/declin/i.test(t.status)) {
      const declines = (byCustomer.get(t.customerId) || []).filter((x) => /declin/i.test(x.status)).length;
      if (declines >= 2) { score += 18; factors.push('Repeated declined transactions for customer'); }
      else { score += 8; factors.push('Transaction declined'); }
    }
    const timestamp = new Date(t.timestamp).getTime();
    const nearDuplicates = (byCustomer.get(t.customerId) || []).filter((x) => {
      if (x.transactionId === t.transactionId) return false;
      const delta = Math.abs(new Date(x.timestamp).getTime() - timestamp);
      return Number.isFinite(delta) && delta <= 10 * 60 * 1000;
    }).length;
    if (nearDuplicates > 0) { score += 15; factors.push('Multiple transactions within 10 minutes'); }
    score = Math.min(100, score);
    return { ...t, score, level: score >= 60 ? 'High' : score >= 30 ? 'Medium' : 'Low', factors };
  });
}

export function parseCsv(text: string): Transaction[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error('CSV must include a header row and at least one transaction.');
  const parseLine = (line: string) => {
    const cells: string[] = [];
    let value = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && quoted && line[i + 1] === '"') { value += '"'; i++; }
      else if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) { cells.push(value.trim()); value = ''; }
      else value += char;
    }
    if (quoted) throw new Error('CSV contains an unclosed quoted field.');
    cells.push(value.trim());
    return cells;
  };
  const headers = parseLine(lines[0]).map((h) => h.replace(/^"|"$/g, '').trim());
  const missing = REQUIRED_CSV_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length) throw new Error(`Missing required columns: ${missing.join(', ')}. Required: ${REQUIRED_CSV_HEADERS.join(', ')}. Optional: isNewDevice.`);
  if (lines.length > 1001) throw new Error('Upload limit is 1,000 transactions per file.');
  const seen = new Set<string>();
  return lines.slice(1).map((line, index) => {
    const cells = parseLine(line);
    const record: Record<string, string> = {};
    headers.forEach((h, i) => { record[h] = (cells[i] || '').replace(/^"|"$/g, '').trim(); });
    const rowNum = index + 2;
    if (REQUIRED_CSV_HEADERS.some((h) => !record[h])) throw new Error(`Row ${rowNum}: one or more required fields are blank.`);
    if (!Number.isFinite(Number(record.amount)) || Number(record.amount) < 0) throw new Error(`Row ${rowNum}: amount must be a non-negative number.`);
    if (!Number.isFinite(new Date(record.timestamp).getTime())) throw new Error(`Row ${rowNum}: timestamp is invalid.`);
    if (seen.has(record.transactionId)) throw new Error(`Duplicate transactionId "${record.transactionId}" at row ${rowNum}.`);
    seen.add(record.transactionId);
    return {
      transactionId: record.transactionId, customerId: record.customerId, amount: Number(record.amount),
      currency: record.currency, country: record.country, timestamp: record.timestamp, status: record.status,
      device: record.device, isNewDevice: /^(true|1|yes)$/i.test(record.isNewDevice || 'false'),
    };
  });
}

const money = (amount: number, currency: string) => `${currency} ${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

interface TransactionSentinelProps {
  onNavigateToCase?: (caseId: string) => void;
  onOpenCaseManagement?: () => void;
}

export const TransactionSentinel: React.FC<TransactionSentinelProps> = ({
  onNavigateToCase,
  onOpenCaseManagement,
}) => {
  const { user, userProfile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>(sampleTransactions);
  const [filter, setFilter] = useState<'All' | 'High' | 'Medium' | 'Low'>('All');
  const [selectedId, setSelectedId] = useState<string | null>('TX-1002');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('Synthetic demonstration data loaded. No live banking systems are connected.');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [existingCaseForSelected, setExistingCaseForSelected] = useState<InvestigationCase | null>(null);

  // Create Case Modal / Form State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [casePriority, setCasePriority] = useState<CasePriority>('High');
  const [assignedAnalyst, setAssignedAnalyst] = useState('Unassigned');
  const [intakeNote, setIntakeNote] = useState('');
  const [creatingCase, setCreatingCase] = useState(false);

  // AI Explanation Modal State
  const [isExplainModalOpen, setIsExplainModalOpen] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [explanationData, setExplanationData] = useState<InvestigationExplanationOutput | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const scored = useMemo(() => scoreTransactions(transactions), [transactions]);
  const filtered = scored.filter((t) => (filter === 'All' || t.level === filter) && `${t.transactionId} ${t.customerId} ${t.country}`.toLowerCase().includes(query.toLowerCase()));
  const selected = scored.find((t) => t.transactionId === selectedId) || filtered[0] || null;
  const high = scored.filter((t) => t.level === 'High').length;
  const medium = scored.filter((t) => t.level === 'Medium').length;
  const totalValue = transactions.reduce((sum, t) => sum + t.amount, 0);

  // Sync existing active case check when selected transaction changes or cases change
  useEffect(() => {
    if (!selected) {
      setExistingCaseForSelected(null);
      return;
    }
    const updateCaseStatus = () => {
      const active = caseService.getActiveCaseByTransactionId(selected.transactionId);
      setExistingCaseForSelected(active);
    };
    updateCaseStatus();
    const unsub = caseService.subscribe(() => {
      updateCaseStatus();
    });
    return () => unsub();
  }, [selected?.transactionId]);

  const handleFile = async (file?: File) => {
    setError('');
    setSuccessMsg('');
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('File exceeds the 2 MB upload limit.'); return; }
    try {
      const rows = parseCsv(await file.text());
      setTransactions(rows);
      setSelectedId(rows[0]?.transactionId || null);
      setFilter('All');
      setQuery('');
      setNotice(`Loaded ${rows.length} transactions from ${file.name}. Scores are rule-based demo indicators, not confirmed fraud.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not parse CSV file.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const downloadCsv = () => {
    const header = ['transactionId','customerId','amount','currency','country','timestamp','status','device','isNewDevice','riskScore','riskLevel','riskFactors'];
    const sanitizeForSpreadsheet = (val: unknown): string => {
      let str = String(val ?? '');
      // Neutralize spreadsheet formula injection (=, +, -, @)
      if (/^[=+\-@]/.test(str)) {
        str = `'${str}`;
      }
      return `"${str.replace(/"/g, '""')}"`;
    };
    const rows = scored.map((t) => [t.transactionId,t.customerId,t.amount,t.currency,t.country,t.timestamp,t.status,t.device,t.isNewDevice,t.score,t.level,t.factors.join('; ')].map(sanitizeForSpreadsheet).join(','));
    const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'sentinel-risk-review.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const handleOpenCreateCaseModal = () => {
    if (!selected) return;
    setError('');
    setSuccessMsg('');
    // Check duplicate
    const active = caseService.getActiveCaseByTransactionId(selected.transactionId);
    if (active) {
      setExistingCaseForSelected(active);
      setError(`Cannot create case: Active case ${active.id} is already in progress for transaction ${selected.transactionId}.`);
      return;
    }
    setCasePriority(selected.level === 'High' ? 'High' : selected.level === 'Medium' ? 'Medium' : 'Low');
    const defaultAnalyst = userProfile?.displayName || user?.displayName || 'Sarah Jenkins (Senior Investigator)';
    setAssignedAnalyst(defaultAnalyst);
    setIntakeNote('');
    setIsCreateModalOpen(true);
  };

  const handleConfirmCreateCase = () => {
    if (!selected) return;
    setCreatingCase(true);
    setError('');
    try {
      const analystName = userProfile?.displayName || user?.displayName || 'Authorized Banking Analyst';
      const analystEmail = user?.email || undefined;
      const snapshot: LinkedTransactionSnapshot = {
        transactionId: selected.transactionId,
        customerId: selected.customerId,
        amount: selected.amount,
        currency: selected.currency,
        country: selected.country,
        timestamp: selected.timestamp,
        status: selected.status,
        device: selected.device,
        isNewDevice: selected.isNewDevice,
        score: selected.score,
        level: selected.level,
        factors: selected.factors,
      };

      const created = caseService.createCase({
        transaction: snapshot,
        creatingAnalyst: analystName,
        creatingAnalystEmail: analystEmail,
        priority: casePriority,
        assignedAnalyst: assignedAnalyst.trim() || 'Unassigned',
        assignedAnalystEmail: analystEmail,
        initialNote: intakeNote.trim() || undefined,
      });

      setIsCreateModalOpen(false);
      setSuccessMsg(`Investigation case ${created.id} created successfully! Assigned to: ${created.assignedAnalyst}.`);
      setExistingCaseForSelected(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create investigation case.');
    } finally {
      setCreatingCase(false);
    }
  };

  const handleExplainWithAI = async () => {
    if (!selected) return;
    setIsExplainModalOpen(true);
    setIsExplaining(true);
    setExplainError(null);

    const snapshot: LinkedTransactionSnapshot = {
      transactionId: selected.transactionId,
      customerId: selected.customerId,
      amount: selected.amount,
      currency: selected.currency,
      country: selected.country,
      timestamp: selected.timestamp,
      status: selected.status,
      device: selected.device,
      isNewDevice: selected.isNewDevice,
      score: selected.score,
      level: selected.level,
      factors: selected.factors,
    };

    const caseContext = existingCaseForSelected
      ? {
          caseId: existingCaseForSelected.id,
          status: existingCaseForSelected.status,
          priority: existingCaseForSelected.priority,
          assignedAnalyst: existingCaseForSelected.assignedAnalyst,
          existingNotesCount: existingCaseForSelected.notes.length,
          lastUpdated: existingCaseForSelected.updatedAt,
        }
      : undefined;

    try {
      const response = await explainTransactionWithAI({
        transaction: snapshot,
        caseContext,
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

  const handleSaveAIExplanationAsNote = (
    category: 'Observation' | 'Evidence' | 'Action' | 'Decision',
    noteText: string
  ) => {
    if (!existingCaseForSelected) return;
    const analystName = userProfile?.displayName || user?.displayName || 'Authorized Banking Analyst';
    const analystEmail = user?.email || undefined;

    try {
      caseService.addNote({
        caseId: existingCaseForSelected.id,
        author: `${analystName} (via Gemini AI)`,
        authorEmail: analystEmail,
        category,
        content: noteText,
        isAIGenerated: true,
        requestingAnalyst: analystName,
        modelUsed: explanationData?.modelUsed || 'gemini-3.8-flash',
      });
      setSuccessMsg(`AI explanation saved as ${category} note on case ${existingCaseForSelected.id}!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save AI note to case.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-800 bg-cyan-950/50 px-3 py-1 text-xs font-semibold text-cyan-300">
            <ShieldAlert className="h-4 w-4" /> TRANSACTION INTELLIGENCE
          </div>
          <h1 className="mt-3 text-2xl font-bold text-white">Transaction Sentinel</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Detect review-worthy patterns with transparent, rule-based transaction risk indicators and initiate human analyst investigation cases.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onOpenCaseManagement && (
            <button
              id="sentinel-go-to-cases-btn"
              onClick={onOpenCaseManagement}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-600 bg-blue-900/60 px-3 py-2 text-xs font-semibold text-blue-200 hover:bg-blue-800/80 transition cursor-pointer"
            >
              <FolderPlus className="h-4 w-4 text-blue-400" />
              <span>Investigation Cases</span>
            </button>
          )}
          <button
            id="sentinel-reset-demo-btn"
            onClick={() => {
              setTransactions(sampleTransactions);
              setSelectedId('TX-1002');
              setError('');
              setSuccessMsg('');
              setNotice('Synthetic demonstration data reloaded.');
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" /> Reset demo
          </button>
          <button
            id="sentinel-import-csv-btn"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-500 transition cursor-pointer"
          >
            <Upload className="h-4 w-4" /> Import CSV
          </button>
          <button
            id="sentinel-export-csv-btn"
            onClick={downloadCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          >
            <FileDown className="h-4 w-4" /> Export results
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
        </div>
      </div>

      <div className="rounded-xl border border-amber-800/70 bg-amber-950/30 p-3 text-xs text-amber-200">
        <strong>Demo / human-review notice:</strong> Synthetic data only by default. A high score is an alert for human review, not proof of fraud. Only an authorized human analyst can confirm a fraud outcome.
      </div>

      {notice && <p className="text-xs text-slate-400">{notice}</p>}
      {error && <div role="alert" className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{error}</div>}
      {successMsg && (
        <div role="status" className="rounded-lg border border-emerald-800 bg-emerald-950/50 p-3 text-sm text-emerald-200 flex items-center justify-between">
          <span>{successMsg}</span>
          {existingCaseForSelected && onNavigateToCase && (
            <button
              onClick={() => onNavigateToCase(existingCaseForSelected.id)}
              className="inline-flex items-center gap-1 text-xs text-cyan-300 underline font-semibold hover:text-white"
            >
              Open Case <ExternalLink className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Transactions reviewed" value={transactions.length.toLocaleString()} detail="Current loaded dataset" icon={<Activity className="h-5 w-5" />} />
        <Metric label="High-risk indicators" value={String(high)} detail="Score 60–100 · review first" icon={<ShieldAlert className="h-5 w-5" />} />
        <Metric label="Medium-risk indicators" value={String(medium)} detail="Score 30–59 · review as needed" icon={<AlertTriangle className="h-5 w-5" />} />
        <Metric label="Total transaction value" value={totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })} detail="Mixed currencies; not FX-normalized" icon={<Activity className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]">
        {/* Transaction Review Queue */}
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
          <div className="flex flex-col gap-3 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-white">Transaction review queue</h2>
              <p className="mt-1 text-xs text-slate-400">Select a row to inspect score factors and launch case investigation.</p>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  aria-label="Search transactions"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search ID, customer, country"
                  className="w-52 rounded-lg border border-slate-700 bg-slate-950 py-2 pl-8 pr-2 text-xs text-white outline-none focus:border-cyan-500"
                />
              </div>
              <select
                aria-label="Filter by risk level"
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-white"
              >
                <option>All</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-slate-950/70 text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Transaction</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Risk score</th>
                  <th className="px-4 py-3">Case Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const hasActiveCase = caseService.getActiveCaseByTransactionId(t.transactionId);
                  return (
                    <tr
                      key={t.transactionId}
                      onClick={() => setSelectedId(t.transactionId)}
                      className={`cursor-pointer border-t border-slate-800/80 hover:bg-slate-800/40 transition ${
                        selectedId === t.transactionId ? 'bg-cyan-950/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-cyan-200">{t.transactionId}</td>
                      <td className="px-4 py-3 text-slate-200">{t.customerId}</td>
                      <td className="px-4 py-3 text-slate-200">{money(t.amount, t.currency)}</td>
                      <td className="px-4 py-3 text-slate-300">{t.country}</td>
                      <td className="px-4 py-3 text-slate-300">{t.status}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-2 py-1 font-semibold ${
                            t.level === 'High'
                              ? 'border-red-800 bg-red-950/60 text-red-300'
                              : t.level === 'Medium'
                              ? 'border-amber-800 bg-amber-950/50 text-amber-300'
                              : 'border-emerald-800 bg-emerald-950/50 text-emerald-300'
                          }`}
                        >
                          {t.score} · {t.level}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {hasActiveCase ? (
                          <span className="inline-flex items-center gap-1 rounded bg-blue-950/80 px-2 py-0.5 text-[10px] font-semibold text-blue-300 border border-blue-800/60">
                            {hasActiveCase.id}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      No transactions match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Selected Transaction & Case Action Panel */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white">Selected transaction</h2>
            {selected && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  selected.level === 'High'
                    ? 'bg-red-950 text-red-300 border border-red-800/60'
                    : selected.level === 'Medium'
                    ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                }`}
              >
                {selected.score}/100 · {selected.level}
              </span>
            )}
          </div>

          {selected ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-base font-bold text-cyan-200">{selected.transactionId}</div>
                    <div className="text-xs text-slate-400">
                      Customer <span className="text-white font-mono">{selected.customerId}</span> · Device <span className="text-white">{selected.device}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-white">{money(selected.amount, selected.currency)}</div>
                    <div className="text-[11px] text-slate-400">{selected.country} · {selected.status}</div>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 border-t border-slate-800/70 pt-2">
                  Timestamp: {new Date(selected.timestamp).toLocaleString()} {selected.isNewDevice && '• (New Device Indicator)'}
                </div>
              </div>

              {/* Investigation Case Action or Existing Case Link */}
              <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-cyan-400" /> Case Status
                  </span>
                  {existingCaseForSelected ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-semibold">
                      {existingCaseForSelected.status}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-medium">No Active Case</span>
                  )}
                </div>

                {existingCaseForSelected ? (
                  <div className="space-y-2 pt-1">
                    <div className="text-xs text-slate-300 bg-blue-950/30 p-2.5 rounded-lg border border-blue-800/40">
                      <div className="flex items-center justify-between text-blue-200 font-mono font-bold text-xs">
                        <span>{existingCaseForSelected.id}</span>
                        <span className="text-[10px] font-sans font-normal text-slate-400">
                          Priority: {existingCaseForSelected.priority}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Assignee: <span className="text-slate-200">{existingCaseForSelected.assignedAnalyst}</span>
                      </div>
                    </div>
                    {onNavigateToCase && (
                      <button
                        id="sentinel-view-existing-case-btn"
                        onClick={() => onNavigateToCase(existingCaseForSelected.id)}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-2 text-xs font-semibold text-white transition cursor-pointer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>View Existing Investigation Case</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    <p className="text-[11px] text-slate-400">
                      Initiate an official human analyst investigation workflow. Captures the risk score and factors snapshot.
                    </p>
                    <button
                      id="sentinel-create-case-btn"
                      onClick={handleOpenCreateCaseModal}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 px-3 py-2 text-xs font-bold text-white shadow-md shadow-blue-900/30 transition cursor-pointer"
                    >
                      <FolderPlus className="h-4 w-4" />
                      <span>Create Investigation Case</span>
                    </button>
                  </div>
                )}

                {/* Gemini Explain with AI Action */}
                <div className="border-t border-slate-800/80 pt-2.5">
                  <button
                    id="sentinel-explain-ai-btn"
                    onClick={handleExplainWithAI}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-800/70 bg-cyan-950/40 hover:bg-cyan-900/60 px-3 py-2 text-xs font-bold text-cyan-300 shadow-sm transition cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4 text-cyan-400" />
                    <span>Explain with AI (Gemini)</span>
                  </button>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-white mb-2">Contributing risk factors</div>
                {selected.factors.length ? (
                  <ul className="space-y-1.5">
                    {selected.factors.map((factor) => (
                      <li key={factor} className="flex gap-2 text-xs text-slate-300 bg-slate-950/40 p-2 rounded-lg border border-slate-800/60">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-emerald-300 p-2 rounded bg-emerald-950/30 border border-emerald-900/40">
                    No configured risk indicators triggered.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Choose a transaction row to inspect it.</p>
          )}

          <div className="border-t border-slate-800 pt-4">
            <h2 className="font-bold text-white">Risk scoring model</h2>
            <p className="mt-1 text-xs text-slate-400">Transparent demo rules; human analyst review required before taking adverse action.</p>
            <div className="mt-3 space-y-2">
              <Rule label="Very high amount" points="+35" />
              <Rule label="High amount" points="+22" />
              <Rule label="Cross-border location" points="+25" />
              <Rule label="New device" points="+18" />
              <Rule label="Unusual hour (before 05:00 / from 23:00)" points="+12" />
              <Rule label="Repeated declines" points="+18" />
              <Rule label="Other customer transaction within 10 min" points="+15" />
            </div>
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-2.5 text-[11px] text-slate-400">
              Score capped at 100. High ≥60, Medium 30–59, Low &lt;30. Heuristic weights are illustrative demonstration rules.
            </div>
          </div>
        </section>
      </div>

      <p className="text-[11px] text-slate-500">
        CSV headers required: {REQUIRED_CSV_HEADERS.join(', ')}. Optional column: isNewDevice (true/false). Maximum 1,000 rows and 2 MB. Avoid sensitive customer information.
      </p>

      {/* Modal: Create Investigation Case */}
      {isCreateModalOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FolderPlus className="h-5 w-5 text-cyan-400" /> Create Investigation Case
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Initiate case file for transaction <span className="font-mono text-cyan-200">{selected.transactionId}</span>
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Customer Ref</span>
                  <span className="text-white font-mono font-semibold">{selected.customerId} (Synthetic)</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Transaction Amount</span>
                  <span className="text-white font-semibold">{money(selected.amount, selected.currency)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Captured Risk Score</span>
                  <span className={`font-bold ${selected.level === 'High' ? 'text-red-400' : 'text-amber-400'}`}>
                    {selected.score}/100 ({selected.level})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Location & Status</span>
                  <span className="text-slate-200">{selected.country} · {selected.status}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Investigation Priority</label>
                <select
                  aria-label="Investigation Priority"
                  value={casePriority}
                  onChange={(e) => setCasePriority(e.target.value as CasePriority)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-500"
                >
                  <option value="Low">Low Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="High">High Priority</option>
                  <option value="Critical">Critical Priority</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Assign to Analyst</label>
                <input
                  aria-label="Assign to Analyst"
                  type="text"
                  value={assignedAnalyst}
                  onChange={(e) => setAssignedAnalyst(e.target.value)}
                  placeholder="e.g. Sarah Jenkins (Senior Investigator)"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Intake Note <span className="text-slate-500 font-normal">(Optional observation/initial guidance)</span>
                </label>
                <textarea
                  aria-label="Intake Note"
                  value={intakeNote}
                  onChange={(e) => setIntakeNote(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Enter initial investigative observations, hypothesis, or intake instructions..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-white outline-none focus:border-cyan-500"
                />
                <div className="text-[10px] text-slate-500 text-right">{intakeNote.length} / 2000 characters</div>
              </div>

              <div className="rounded-lg border border-cyan-900/60 bg-cyan-950/30 p-2.5 text-[11px] text-cyan-300">
                <strong>Governance Safeguard:</strong> The case summary and risk metrics are immutably derived from transaction facts. Client-side logs are for demonstration; server-side integrity is required for production.
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-create-case-btn"
                disabled={creatingCase}
                onClick={handleConfirmCreateCase}
                className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-700/30 transition cursor-pointer disabled:opacity-50"
              >
                {creatingCase ? 'Creating Case...' : 'Confirm & Open Case'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Explanation Modal */}
      <AIExplanationModal
        isOpen={isExplainModalOpen}
        onClose={() => setIsExplainModalOpen(false)}
        isLoading={isExplaining}
        error={explainError}
        explanation={explanationData}
        onRetry={handleExplainWithAI}
        onSaveAsNote={handleSaveAIExplanationAsNote}
        canSaveAsNote={Boolean(existingCaseForSelected)}
        caseId={existingCaseForSelected?.id}
        transactionId={selected?.transactionId || ''}
      />
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; detail: string; icon: React.ReactNode }> = ({
  label,
  value,
  detail,
  icon,
}) => (
  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
    <div className="flex items-center justify-between text-cyan-300">
      <span className="text-xs font-semibold text-slate-300">{label}</span>
      {icon}
    </div>
    <div className="mt-3 text-2xl font-bold text-white">{value}</div>
    <p className="mt-1 text-[11px] text-slate-500">{detail}</p>
  </div>
);

const Rule: React.FC<{ label: string; points: string }> = ({ label, points }) => (
  <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2 text-xs">
    <span className="text-slate-300">{label}</span>
    <span className="font-mono font-bold text-cyan-300">{points}</span>
  </div>
);
