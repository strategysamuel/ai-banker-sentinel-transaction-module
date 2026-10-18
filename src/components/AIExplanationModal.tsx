import React from 'react';
import {
  Sparkles,
  AlertTriangle,
  HelpCircle,
  ClipboardList,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  PlusCircle,
  Cpu,
  Clock,
  Info,
} from 'lucide-react';
import { InvestigationExplanationOutput } from '../types';

interface AIExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  error: string | null;
  explanation: InvestigationExplanationOutput | null;
  onRetry: () => void;
  onSaveAsNote?: (category: 'Observation' | 'Evidence' | 'Action' | 'Decision', noteText: string) => void;
  canSaveAsNote?: boolean;
  caseId?: string;
  transactionId: string;
}

export const AIExplanationModal: React.FC<AIExplanationModalProps> = ({
  isOpen,
  onClose,
  isLoading,
  error,
  explanation,
  onRetry,
  onSaveAsNote,
  canSaveAsNote = false,
  caseId,
  transactionId,
}) => {
  const [copied, setCopied] = React.useState(false);
  const [savedSuccess, setSavedSuccess] = React.useState(false);

  if (!isOpen) return null;

  const handleCopySummary = () => {
    if (!explanation) return;
    const text = `AI INVESTIGATION EXPLANATION [${transactionId}]\nModel: ${explanation.modelUsed} (${explanation.generatedAt})\n\nSUMMARY:\n${explanation.transactionSummary}\n\nOBSERVED FACTS:\n${explanation.observedFacts.map((f) => `- ${f}`).join('\n')}\n\nRISK CONTRIBUTIONS:\n${explanation.riskFactorContributions.map((r) => `- ${r.factor} (+${r.points} pts): ${r.description}`).join('\n')}\n\nMISSING EVIDENCE & LIMITATIONS:\n${explanation.missingEvidenceAndLimitations.map((m) => `- ${m}`).join('\n')}\n\nRECOMMENDED CHECKS:\n${explanation.recommendedInvestigationChecks.map((c) => `- ${c.check} (${c.tiedFactOrRationale})`).join('\n')}\n\nCAUTIOUS ASSESSMENT:\n${explanation.cautiousAssessment}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveToCase = () => {
    if (!explanation || !onSaveAsNote) return;
    const formattedNote = `[AI Evidence-Grounded Explanation - ${explanation.modelUsed}]\n\nSummary: ${explanation.transactionSummary}\n\nKey Facts:\n${explanation.observedFacts.slice(0, 3).map((f) => `• ${f}`).join('\n')}\n\nMissing Evidence:\n${explanation.missingEvidenceAndLimitations.slice(0, 2).map((m) => `• ${m}`).join('\n')}\n\nRecommended Checks:\n${explanation.recommendedInvestigationChecks.slice(0, 2).map((c) => `• ${c.check}`).join('\n')}\n\nAnalyst Note: ${explanation.cautiousAssessment}`;

    onSaveAsNote('Evidence', formattedNote);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-600/20 text-white">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Gemini Evidence-Grounded Explanation</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 border border-blue-800 text-blue-300 font-semibold">
                  TX: {transactionId}
                </span>
                {caseId && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300 font-semibold">
                    Case: {caseId}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Transparent synthesis of observed facts, scoring factors, missing evidence, and recommended checks.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-base px-2 py-1 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Advisory Banner */}
        <div className="bg-amber-950/30 border-b border-amber-900/40 px-6 py-2.5 text-[11px] text-amber-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Human Governance Safeguard:</strong> This explanation is advisory and grounded strictly in supplied facts. A risk alert is not proof of fraud. Only an authorized human analyst can confirm a fraud determination.
          </span>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-white font-semibold text-sm">Synthesizing Evidence with Gemini...</div>
              <p className="text-slate-400 text-xs max-w-sm text-center">
                Grounding observations strictly in supplied transaction attributes, calculating actual heuristic contributions, and enumerating missing facts.
              </p>
            </div>
          )}

          {error && !isLoading && (
            <div className="rounded-xl border border-red-800 bg-red-950/40 p-5 space-y-3">
              <div className="flex items-center gap-2 text-red-300 font-bold text-sm">
                <AlertTriangle className="w-5 h-5" /> Explanation Generation Notice
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">{error}</p>
              <div className="pt-2">
                <button
                  onClick={onRetry}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-800/60 hover:bg-red-700 border border-red-700 text-white font-semibold text-xs transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry Request
                </button>
              </div>
            </div>
          )}

          {explanation && !isLoading && (
            <div className="space-y-6">
              {/* Provenance Badge */}
              <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-blue-400" /> Model:{' '}
                  <span className="font-mono text-cyan-300 font-bold">{explanation.modelUsed}</span>
                  {explanation.isFallback && ' (Factual Fallback)'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Generated: {new Date(explanation.generatedAt).toLocaleString()}
                </span>
              </div>

              {/* 1. Transaction Summary */}
              <div className="space-y-2">
                <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-cyan-400" /> 1. Transaction Summary
                </h4>
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 leading-relaxed">
                  {explanation.transactionSummary}
                </div>
              </div>

              {/* 2. Observed Facts */}
              <div className="space-y-2">
                <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 2. Verified Observed Facts
                </h4>
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  {explanation.observedFacts.map((fact, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-slate-300">
                      <span className="text-emerald-400 font-mono font-bold mt-0.5">•</span>
                      <span>{fact}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Risk Factor Contributions */}
              <div className="space-y-2">
                <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" /> 3. Contributing Risk Factors & Actual Score Impact
                </h4>
                <div className="space-y-2">
                  {explanation.riskFactorContributions.map((contrib, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="font-semibold text-slate-200">{contrib.factor}</div>
                        <p className="text-[11px] text-slate-400">{contrib.description}</p>
                      </div>
                      <span className="shrink-0 font-mono font-bold text-xs px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60">
                        +{contrib.points} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Missing Evidence & Limitations */}
              <div className="space-y-2">
                <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-blue-400" /> 4. Missing Evidence & Known Limitations
                </h4>
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <p className="text-[11px] text-slate-400 mb-2">
                    The AI engine acknowledges the following unprovided data dimensions. Human analysts must verify these items independently:
                  </p>
                  {explanation.missingEvidenceAndLimitations.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-slate-300">
                      <span className="text-blue-400 font-mono font-bold mt-0.5">✕</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. Recommended Investigation Checks */}
              <div className="space-y-2">
                <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-cyan-400" /> 5. Recommended Human Investigation Checks
                </h4>
                <div className="space-y-2">
                  {explanation.recommendedInvestigationChecks.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200">{item.check}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                            item.isGeneralCheck
                              ? 'bg-slate-800 text-slate-400 border border-slate-700'
                              : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                          }`}
                        >
                          {item.isGeneralCheck ? 'General Check' : 'Fact-Tied Check'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        <strong>Rationale:</strong> {item.tiedFactOrRationale}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 6. Cautious Assessment */}
              <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-900/60 text-blue-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-white">
                  <ShieldCheck className="w-4 h-4 text-blue-400" /> 6. Cautious Risk Assessment
                </div>
                <p className="text-xs text-blue-300 leading-relaxed">{explanation.cautiousAssessment}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4 bg-slate-950/80">
          <div className="text-[11px] text-slate-400">
            {savedSuccess && <span className="text-emerald-400 font-semibold">✓ Saved as AI Note on Case Timeline!</span>}
            {copied && <span className="text-cyan-400 font-semibold">✓ Copied full explanation to clipboard!</span>}
          </div>

          <div className="flex gap-2">
            {explanation && (
              <>
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition cursor-pointer"
                >
                  Copy Report
                </button>
                {canSaveAsNote && onSaveAsNote && (
                  <button
                    type="button"
                    onClick={handleSaveToCase}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-2 text-xs font-bold text-white shadow-md shadow-blue-700/30 transition cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" /> Save as Case AI Note
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
