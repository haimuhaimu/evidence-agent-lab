import type { AgentRequest, ParsedRequest } from "../core/types";

const WINDOW_PATTERNS: Array<[RegExp, (match: RegExpMatchArray) => number]> = [
  [/半个月/, () => 15],
  [/(?:一|1)个?季度|近一季度/, () => 90],
  [/近\s*(\d+)\s*天/, (match) => Number(match[1])],
];

export function parseAgentRequest(request: AgentRequest): ParsedRequest {
  const clarificationNeeded = request.entityId.trim() ? [] : ["Choose a synthetic content object."];
  const explicitDays = WINDOW_PATTERNS.map(([pattern, toDays]) => {
    const match = request.query.match(pattern);
    return match ? toDays(match) : undefined;
  }).find((value) => value !== undefined);

  if (explicitDays !== undefined && (!Number.isFinite(explicitDays) || explicitDays < 1 || explicitDays > 180)) {
    clarificationNeeded.push("Use a time window between 1 and 180 days.");
  }

  return {
    entityId: request.entityId.trim(),
    query: request.query.trim(),
    days: explicitDays ?? 7,
    goal: /追投|放大|加预算|scale/i.test(request.query) ? "scale" : "diagnose",
    clarificationNeeded,
  };
}
