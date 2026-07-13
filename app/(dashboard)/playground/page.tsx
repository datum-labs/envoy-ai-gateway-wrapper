import type { Metadata } from "next";
import { PlaygroundView } from "@/components/playground-view";

export const metadata: Metadata = {
  title: "Playground",
  description:
    "Send requests through the gateway and inspect latency, tokens, and cost per response.",
};

export default function Page() {
  return <PlaygroundView />;
}
