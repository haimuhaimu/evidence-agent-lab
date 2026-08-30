import type { AgentRequest, ParsedRequest } from "../core/types";

const WINDOW_PATTERNS: Array<[RegExp, (match: RegExpMatchArray) => number]> = [
  [/半个月/, () => 15],
  [/(?:一|1)个?季度|近一季度/, () => 90],
];

const EXPLICIT_DAY_WINDOW = /近\s*([^\s天]+)\s*天/;

export function parseAgentRequest(request: AgentRequest): ParsedRequest {
  const clarificationNeeded = request.entityId.trim() ? [] : ["Choose a synthetic content object."];
  const namedDays = WINDOW_PATTERNS.map(([pattern, toDays]) => {
    const match = request.query.match(pattern);
    return match ? toDays(match) : undefined;
  }).find((value) => value !== undefined);
  const numericMatch = request.query.match(EXPLICIT_DAY_WINDOW);
  const numericText = numericMatch?.[1];
  const validNumericText = numericText !== undefined && /^\d+$/.test(numericText);
  const numericDays = validNumericText ? Number(numericText) : undefined;
  const explicitDays = numericText !== undefined ? numericDays : namedDays;
  const invalidExplicitWindow = numericText !== undefined && (
    !validNumericText
    || !Number.isSafeInteger(numericDays)
    || numericDays! < 1
    || numericDays! > 180
  );

  if (invalidExplicitWindow) {
    clarificationNeeded.push("Use a whole-number time window between 1 and 180 days.");
  }

  return {
    entityId: request.entityId.trim(),
    query: request.query.trim(),
    days: explicitDays ?? 7,
    goal: /追投|放大|加预算|scale/i.test(request.query) ? "scale" : "diagnose",
    clarificationNeeded,
  };
}
