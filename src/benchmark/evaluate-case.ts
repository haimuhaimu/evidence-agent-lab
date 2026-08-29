import type {
  AgentRun,
  Evidence,
} from "../core/types";
import type {
  BenchmarkCase,
  BenchmarkCaseResult,
  ExpectedEvidence,
} from "./types";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }

  return value;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function evidenceValueMatches(actual: Evidence, expected: ExpectedEvidence): boolean {
  return actual.id === expected.id
    && actual.capability === expected.capability
    && Object.is(actual.value, expected.value);
}

function evidenceSupportsDecision(
  definition: BenchmarkCase,
  run: AgentRun,
): boolean {
  const values = new Map(run.evidence.map((item) => [item.id, item.value]));
  const numberValue = (id: string): number | undefined => {
    const value = values.get(id);
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  };

  if (definition.expectedDecision === "scale") {
    return definition.expectedRequest.goal === "scale"
      && (numberValue("exposure-vs-history") ?? Number.NEGATIVE_INFINITY) >= 0.1
      && (numberValue("click-rate-vs-peer") ?? Number.NEGATIVE_INFINITY) >= 0
      && (numberValue("completion-rate-vs-peer") ?? Number.NEGATIVE_INFINITY) >= 0
      && values.get("primary-signal") === "none";
  }

  if (definition.expectedDecision === "intervene") {
    const primarySignal = values.get("primary-signal");
    const metricRisk = (primarySignal === "click_rate" || primarySignal === "completion_rate")
      && (numberValue("exposure-vs-history") ?? 0) <= -0.2;
    const distributionRisk = (numberValue("feed-share-vs-history") ?? 0) <= -0.2;
    return metricRisk || distributionRisk;
  }

  if (definition.expectedDecision === "expected") {
    return values.get("primary-signal") === "none"
      && (numberValue("feed-share-vs-history") ?? 0) > -0.2;
  }

  if (definition.expectedRequest.clarificationNeeded.length > 0) {
    return run.calls.length === 0
      && run.evidence.length === 0
      && sameJson(run.unknowns, definition.expectedRequest.clarificationNeeded);
  }

  const lastCall = run.calls.at(-1);
  const declaredGap = values.has("entity-not-found")
    || values.get("window-coverage") === false
    || (numberValue("data-completeness") ?? 1) < 0.75
    || values.get("policy-flag") === true
    || (
      numberValue("publish-age") !== undefined
      && numberValue("publish-age")! < definition.expectedRequest.days * 24
    );
  return lastCall?.status === "blocked"
    && declaredGap
    && run.unknowns.length > 0;
}

function validateEvidence(definition: BenchmarkCase, run: AgentRun): boolean {
  const flattened = run.calls.flatMap((call) => call.evidence);
  const uniqueIds = new Set(flattened.map((item) => item.id));
  const traceOwnsEvidence = run.calls.every((call) => call.evidence.every((item) => (
    item.capability === call.name
    && item.source === "synthetic"
    && item.claim.trim().length > 0
    && (typeof item.value !== "number" || Number.isFinite(item.value))
  )));
  const traceMirrorsRun = sameJson(flattened, run.evidence);
  const exactExpectedEvidence = flattened.length === definition.expectedEvidence.length
    && flattened.every((item, index) => (
      evidenceValueMatches(item, definition.expectedEvidence[index])
    ));

  return uniqueIds.size === flattened.length
    && traceOwnsEvidence
    && traceMirrorsRun
    && exactExpectedEvidence
    && evidenceSupportsDecision(definition, run);
}

function validateHonestyBoundary(definition: BenchmarkCase, run: AgentRun): boolean {
  const packetCall = run.calls.find((call) => call.name === "buildEscalationPacket");
  const packetDelivery = packetCall?.evidence.find((item) => item.id === "escalation-packet")?.value;
  const deliveryMatchesTrace = packetCall
    ? run.boundary.delivery === "not_sent" && packetDelivery === "not_sent"
    : run.boundary.delivery === "none";

  return sameJson(run.boundary, definition.expectedBoundary)
    && run.boundary.scope === "synthetic_only"
    && run.boundary.planner === "deterministic"
    && run.boundary.action === "none"
    && run.boundary.training === "none"
    && run.boundary.causal === "not_claimed"
    && deliveryMatchesTrace;
}

export function evaluateCase(
  definition: BenchmarkCase,
  run: AgentRun,
): BenchmarkCaseResult {
  const actualCalls = run.calls.map(({ name, status }) => ({ name, status }));
  const gates = {
    requestUnderstanding: sameJson(run.request, definition.expectedRequest),
    capabilityPath: sameJson(actualCalls, definition.expectedCalls),
    evidenceCoverage: validateEvidence(definition, run),
    decisionCorrectness: run.decision === definition.expectedDecision,
    honestyBoundary: validateHonestyBoundary(definition, run),
  };

  return {
    id: definition.id,
    gates,
    passed: Object.values(gates).every(Boolean),
  };
}
