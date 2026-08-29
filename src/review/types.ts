import type { AgentRun, Decision } from "../core/types";

export type ReviewRecord = {
  id: string;
  runId: string;
  entityId: string;
  originalDecision: Decision;
  verdict: "accurate" | "needs_correction";
  correctedDecision?: Decision;
  note: string;
  fingerprint: string;
  groupFeedback: "unreviewed" | "same_issue" | "different_issue";
  createdAt: string;
};

export type CreateReviewInput = {
  run: AgentRun;
  verdict: "accurate" | "needs_correction";
  correctedDecision?: Decision;
  note: string;
  groupFeedback: "unreviewed" | "same_issue" | "different_issue";
  createdAt: string;
};

export type IssueGroup = {
  fingerprint: string;
  recordIds: string[];
};
