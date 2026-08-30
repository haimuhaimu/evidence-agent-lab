import type { Metadata } from "next";
import benchmark from "../benchmark/latest.json";
import { AgentWorkspace } from "../src/ui/agent-workspace";

export const metadata: Metadata = {
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='3' fill='%23952d27'/%3E%3C/svg%3E",
  },
};

export default function Home() {
  return <AgentWorkspace auditPassRate={benchmark.auditPassRate} />;
}
