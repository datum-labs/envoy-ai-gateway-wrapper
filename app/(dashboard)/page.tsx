import type { Metadata } from "next";
import { OverviewView } from "@/components/overview-view";

export const metadata: Metadata = {
  title: "Overview",
  description: "Traffic, spend, and health across your Envoy AI Gateway.",
};

export default function Page() {
  return <OverviewView />;
}
