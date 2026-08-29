"use client";

import { useMemo, useState, type FormEvent } from "react";
import { runEvidenceAgent } from "../agent/run-agent";
import type { AgentRun, Decision, Evidence } from "../core/types";
import { SYNTHETIC_ENTITIES } from "../data/synthetic-entities";
import { createReview, saveReview } from "../review/feedback-store";
import styles from "./agent-workspace.module.css";
import { TraceView } from "./trace-view";
import { buildAgentViewModel } from "./view-model";

const EXAMPLES = [
  {
    label: "Steady check",
    entityId: "content_steady",
    query: "近 7 天正常吗",
  },
  {
    label: "Scale check",
    entityId: "content_scale",
    query: "近 7 天值得追投吗",
  },
  {
    label: "Feed drop",
    entityId: "content_feed_drop",
    query: "近 7 天为什么掉了",
  },
  {
    label: "Incomplete evidence",
    entityId: "content_incomplete",
    query: "近 7 天正常吗",
  },
] as const;

const DECISION_OPTIONS: ReadonlyArray<{ value: Decision; label: string }> = [
  { value: "expected", label: "Expected" },
  { value: "scale", label: "Worth scaling" },
  { value: "intervene", label: "Needs intervention" },
  { value: "insufficient_evidence", label: "Insufficient evidence" },
];

function evidenceValue(value: Evidence["value"]): string {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

function correctionChoice(run: AgentRun): Decision {
  return DECISION_OPTIONS.find((option) => option.value !== run.decision)?.value
    ?? "expected";
}

export function AgentWorkspace({ auditPassRate }: { auditPassRate: number }) {
  const initialRun = useMemo(() => runEvidenceAgent({
    entityId: "content_feed_drop",
    query: "近 7 天为什么掉了",
  }), []);
  const [entityId, setEntityId] = useState(initialRun.request.entityId);
  const [query, setQuery] = useState(initialRun.request.query);
  const [run, setRun] = useState(initialRun);
  const [correctedDecision, setCorrectedDecision] = useState<Decision>(
    correctionChoice(initialRun),
  );
  const [reviewStatus, setReviewStatus] = useState("");
  const [error, setError] = useState("");
  const view = buildAgentViewModel(run);
  const auditPercent = Math.round(auditPassRate * 100);
  const correctionOptions = DECISION_OPTIONS.filter(
    (option) => option.value !== run.decision,
  );

  function execute(nextEntityId = entityId, nextQuery = query) {
    try {
      const nextRun = runEvidenceAgent({
        entityId: nextEntityId,
        query: nextQuery,
      });
      setRun(nextRun);
      setCorrectedDecision(correctionChoice(nextRun));
      setReviewStatus("");
      setError("");
    } catch {
      setError("The local run could not be completed. Check the request and try again.");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    execute();
  }

  function applyExample(example: (typeof EXAMPLES)[number]) {
    setEntityId(example.entityId);
    setQuery(example.query);
    setReviewStatus("");
  }

  function storeReview(verdict: "accurate" | "needs_correction") {
    const selectedLabel = DECISION_OPTIONS.find(
      (option) => option.value === correctedDecision,
    )?.label;
    const record = createReview({
      run,
      verdict,
      ...(verdict === "needs_correction" ? { correctedDecision } : {}),
      note: verdict === "accurate"
        ? "Marked accurate in the local review workspace."
        : `Reviewer selected ${selectedLabel ?? correctedDecision}.`,
      groupFeedback: "unreviewed",
      createdAt: new Date().toISOString(),
    });

    saveReview(window.localStorage, record);
    setReviewStatus("Saved only in this browser.");
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Open source evidence agent</p>
          <h1>Audit the path, then judge the decision.</h1>
          <p className={styles.heroSummary}>
            Run a deterministic evidence path and inspect every capability call before accepting the decision.
          </p>
        </div>
        <div className={styles.auditMetric} aria-label={`Current audit pass rate ${auditPercent} percent`}>
          <span>Current Audit Pass Rate</span>
          <strong>{auditPercent}%</strong>
          <small>Built from benchmark/latest.json</small>
        </div>
      </header>

      <section className={styles.workspace} aria-labelledby="workspace-title">
        <div className={styles.workspaceIntro}>
          <h2 id="workspace-title">Run the synthetic workspace</h2>
          <p>One request enters. One auditable decision returns.</p>
        </div>

        <div className={styles.workspaceGrid}>
          <form className={styles.runner} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor="entity-id">Synthetic entity</label>
              <select
                id="entity-id"
                value={entityId}
                onChange={(event) => setEntityId(event.target.value)}
              >
                {SYNTHETIC_ENTITIES.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.id}
                  </option>
                ))}
              </select>
              <p className={styles.helper}>Six declared fixtures. No production data.</p>
            </div>

            <div className={styles.field}>
              <label htmlFor="query">Query</label>
              <input
                id="query"
                name="query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-describedby="query-help"
                required
              />
              <p className={styles.helper} id="query-help">
                The parser supports diagnosis, scale intent, and declared time windows.
              </p>
            </div>

            <div className={styles.examples} aria-label="Example queries">
              <span>Examples</span>
              <div>
                {EXAMPLES.map((example) => (
                  <button
                    type="button"
                    className={styles.exampleButton}
                    key={example.label}
                    onClick={() => applyExample(example)}
                  >
                    {example.label}
                  </button>
                ))}
              </div>
            </div>

            <button className={styles.runButton} type="submit">
              Run analysis
            </button>
            {error ? <p className={styles.error} role="alert">{error}</p> : null}
          </form>

          <section className={styles.result} aria-labelledby="decision-title" aria-live="polite">
            <div className={styles.decisionHeader}>
              <div>
                <span className={styles.decisionKey}>Decision</span>
                <h2 id="decision-title">{view.title}</h2>
              </div>
              <code>{view.decision}</code>
            </div>
            <p className={styles.decisionSummary}>{view.summary}</p>

            <div className={styles.evidenceBlock}>
              <h3>Primary evidence</h3>
              <ul>
                {view.primaryEvidence.map((evidence) => (
                  <li key={evidence.id}>
                    <div>
                      <strong>{evidence.claim}</strong>
                      <span>{evidence.source}, {evidence.confidence} confidence</span>
                    </div>
                    <code>{evidenceValue(evidence.value)}</code>
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.nextAction}>
              <h3>Next action</h3>
              <p>{view.falsification[0] ?? "Rerun after adding a declared synthetic evidence source."}</p>
            </div>

            <details className={styles.traceDetails}>
              <summary>Capability trace <span>{view.traceCount} calls</span></summary>
              <TraceView run={run} />
            </details>

            <fieldset className={styles.reviewControls}>
              <legend>Review this run</legend>
              <div className={styles.reviewRow}>
                <button type="button" onClick={() => storeReview("accurate")}>
                  Accurate
                </button>
                <label htmlFor="corrected-decision">Correction decision</label>
                <select
                  id="corrected-decision"
                  value={correctedDecision}
                  onChange={(event) => setCorrectedDecision(event.target.value as Decision)}
                >
                  {correctionOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <button type="button" onClick={() => storeReview("needs_correction")}>
                  Needs correction
                </button>
              </div>
              <p className={styles.reviewNote}>Reviews stay in local storage and are never submitted.</p>
              <p className={styles.reviewStatus} role="status">{reviewStatus}</p>
            </fieldset>
          </section>
        </div>
      </section>

      <footer className={styles.disclosure}>
        <strong>Scope disclosure</strong>
        <p>{view.disclosure} No model training occurred.</p>
      </footer>
    </main>
  );
}
