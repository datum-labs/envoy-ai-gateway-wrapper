import type { Metadata } from "next";
import { LeaderboardView } from "@/components/leaderboard-view";

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "Compare every model routed through the gateway by traffic, cost, and performance.",
};

export default function Page() {
  return <LeaderboardView />;
}
