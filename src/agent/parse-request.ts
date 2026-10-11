import type { AgentRequest, ParsedRequest } from "../core/types";

const WINDOW_PATTERNS: Array<[RegExp, (match: RegExpMatchArray) => number]> = [
  [/半个月/, () => 15],
  [/(?:一|1)个?季度|近一季度/, () => 90],
];

const EXPLICIT_DAY_WINDOW = /近\s*([^\s天近]+)\s*天/g;

export function parseAgentRequest(request: AgentRequest): ParsedRequest {
  const clarificationNeeded = request.entityId.trim() ? [] : ["Choose a synthetic content object."];
  const namedDays = WINDOW_PATTERNS.map(([pattern, toDays]) => {
    const match = request.query.match(pattern);
    return match ? toDays(match) : undefined;
  }).filter((value): value is number => value !== undefined);
  const numericDays = Array.from(request.query.matchAll(EXPLICIT_DAY_WINDOW), (match) => (
    /^\d+$/.test(match[1]) ? Number(match[1]) : undefined
  ));
  const explicitDays = numericDays.length > 0 ? numericDays[0] : namedDays[0];
  const invalidExplicitWindow = numericDays.some((days) => (
    days === undefined || !Number.isSafeInteger(days) || days < 1 || days > 180
  ));

  if (invalidExplicitWindow) {
    clarificationNeeded.push("Use a whole-number time window between 1 and 180 days.");
  } else if (new Set([...numericDays, ...namedDays]).size > 1) {
    clarificationNeeded.push("Choose one time window per request.");
  }

  return {
    entityId: request.entityId.trim(),
    query: request.query.trim(),
    days: explicitDays ?? 7,
    goal: /追投|放大|加预算|scale/i.test(request.query) ? "scale" : "diagnose",
    clarificationNeeded,
  };
}
