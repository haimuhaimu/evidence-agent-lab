import process from "node:process";
import { runEvidenceAgent } from "../src/agent/run-agent";

type CaseArguments = {
  entityId: string;
  query: string;
};

function parseCaseArguments(args: string[]): CaseArguments | undefined {
  if (args.length !== 4) {
    return undefined;
  }

  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1]?.trim();
    if (
      (flag !== "--entity" && flag !== "--query")
      || values.has(flag)
      || !value
      || value.startsWith("--")
    ) {
      return undefined;
    }
    values.set(flag, value);
  }

  const entityId = values.get("--entity");
  const query = values.get("--query");
  return entityId && query ? { entityId, query } : undefined;
}

const parsedArguments = parseCaseArguments(process.argv.slice(2));

if (!parsedArguments) {
  console.error("Usage: npm run case -- --entity <synthetic-entity> --query <question>");
  process.exitCode = 1;
} else {
  const run = runEvidenceAgent(parsedArguments);
  const evidenceById = new Map(run.evidence.map((item) => [item.id, item]));
  const primaryEvidence = run.primaryEvidenceIds
    .map((id) => evidenceById.get(id))
    .filter((item) => item !== undefined);

  console.log(JSON.stringify({
    request: run.request,
    decision: run.decision,
    primaryEvidence,
    unknowns: run.unknowns,
    calls: run.calls,
    boundary: run.boundary,
  }, null, 2));
}
