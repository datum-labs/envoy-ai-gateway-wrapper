import type { Metadata } from "next";
import { LogsView } from "@/components/logs-view";

export const metadata: Metadata = {
  title: "Logs",
  description:
    "Every request routed through the gateway, with token usage, latency, and cost.",
};

export default function Page() {
  return <LogsView />;
}
