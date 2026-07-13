import type { Metadata } from "next";
import { ModelsView } from "@/components/models-view";

export const metadata: Metadata = {
  title: "Models",
  description:
    "Every model available through your gateway, with live usage and pricing.",
};

export default function Page() {
  return <ModelsView />;
}
