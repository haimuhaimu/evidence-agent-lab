import type { AgentRun, Decision } from "../core/types";
import type { CreateReviewInput, ReviewRecord } from "./types";

const STORAGE_KEY = "evidence-agent-lab:reviews";
const DECISIONS: readonly Decision[] = [
  "expected",
  "scale",
  "intervene",
  "insufficient_evidence",
];

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isDecision(value: unknown): value is Decision {
  return typeof value === "string" && DECISIONS.includes(value as Decision);
}

function isVerdict(value: unknown): value is ReviewRecord["verdict"] {
  return value === "accurate" || value === "needs_correction";
}

function isGroupFeedback(value: unknown): value is ReviewRecord["groupFeedback"] {
  return value === "unreviewed" || value === "same_issue" || value === "different_issue";
}

function isReviewRecord(value: unknown): value is ReviewRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<ReviewRecord>;
  if (
    !hasText(record.id)
    || !hasText(record.runId)
    || !hasText(record.entityId)
    || !isDecision(record.originalDecision)
    || !isVerdict(record.verdict)
    || !hasText(record.note)
    || !hasText(record.fingerprint)
    || !isGroupFeedback(record.groupFeedback)
    || !hasText(record.createdAt)
  ) {
    return false;
  }

  if (record.verdict === "accurate") {
    return record.correctedDecision === undefined;
  }

  return isDecision(record.correctedDecision)
    && record.correctedDecision !== record.originalDecision;
}

function primaryEvidenceId(run: AgentRun): string {
  return run.evidence.find((evidence) => evidence.id === "primary-signal")?.id
    ?? run.evidence[0]?.id
    ?? "no-primary-evidence";
}

export function buildRunId(run: AgentRun): string {
  return `${run.request.entityId}:${run.request.days}:${run.request.goal}:${run.decision}`;
}

export function buildIssueFingerprint(run: AgentRun): string {
  return `${run.decision}:${primaryEvidenceId(run)}`;
}

export function createReview(input: CreateReviewInput): ReviewRecord {
  const runId = buildRunId(input.run);
  const originalDecision = input.run.decision;

  if (!hasText(input.note) || !hasText(input.createdAt)) {
    throw new Error("Review notes and timestamps must be provided.");
  }

  if (input.verdict === "needs_correction") {
    if (!isDecision(input.correctedDecision) || input.correctedDecision === originalDecision) {
      throw new Error("A correction must name a different target decision.");
    }
  } else if (input.correctedDecision !== undefined) {
    throw new Error("Accurate reviews cannot include a corrected decision.");
  }

  const correctedDecision = input.correctedDecision;
  return {
    id: `${runId}:${input.verdict}:${correctedDecision ?? ""}`,
    runId,
    entityId: input.run.request.entityId,
    originalDecision,
    verdict: input.verdict,
    ...(correctedDecision ? { correctedDecision } : {}),
    note: input.note,
    fingerprint: buildIssueFingerprint(input.run),
    groupFeedback: input.groupFeedback,
    createdAt: input.createdAt,
  };
}

export function parseReviewRecords(raw: string | null): ReviewRecord[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isReviewRecord)) {
      return [];
    }

    return parsed.map((record) => ({ ...record }));
  } catch {
    return [];
  }
}

export function saveReview(storage: StorageLike, record: ReviewRecord): void {
  const records = parseReviewRecords(storage.getItem(STORAGE_KEY));
  const next = [
    ...records.filter((storedRecord) => storedRecord.id !== record.id),
    { ...record },
  ]
    .sort((left, right) => (
      right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id)
    ))
    .slice(0, 50);

  storage.setItem(STORAGE_KEY, JSON.stringify(next));
}
