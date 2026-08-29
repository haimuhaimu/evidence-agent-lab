import type { IssueGroup, ReviewRecord } from "./types";

export function groupConfirmedIssues(records: readonly ReviewRecord[]): IssueGroup[] {
  const groupedIds = new Map<string, string[]>();

  for (const record of records) {
    if (
      record.verdict !== "needs_correction"
      || record.groupFeedback !== "same_issue"
    ) {
      continue;
    }

    const recordIds = groupedIds.get(record.fingerprint);
    if (recordIds) {
      recordIds.push(record.id);
    } else {
      groupedIds.set(record.fingerprint, [record.id]);
    }
  }

  return [...groupedIds.entries()]
    .filter(([, recordIds]) => recordIds.length >= 2)
    .map(([fingerprint, recordIds]) => ({
      fingerprint,
      recordIds: [...recordIds],
    }));
}
