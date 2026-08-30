import type { Evidence, AgentRun } from "../core/types";
import styles from "./agent-workspace.module.css";

function formatEvidenceValue(value: Evidence["value"]): string {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

export function TraceView({ run }: { run: AgentRun }) {
  return (
    <ol className={styles.traceList} aria-label="Capability calls">
      {run.calls.map((call, index) => (
        <li className={styles.traceCall} key={`${call.name}-${index}`}>
          <div className={styles.traceHeading}>
            <span className={styles.traceIndex} aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <strong>{call.name}</strong>
            <span className={styles.traceStatus}>{call.status}</span>
          </div>
          <p className={styles.traceReason}>{call.reason}</p>
          {call.evidence.length > 0 ? (
            <ul className={styles.traceEvidence} aria-label={`${call.name} evidence`}>
              {call.evidence.map((evidence) => (
                <li key={evidence.id}>
                  <span>{evidence.claim}</span>
                  <code>{formatEvidenceValue(evidence.value)}</code>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
