import type { Metadata } from "next";
import { ModelDetailView } from "@/components/model-detail-view";
import { MODEL_CATALOG } from "@/lib/demo";

export function generateStaticParams() {
  return MODEL_CATALOG.map((m) => ({ id: m.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  const model = MODEL_CATALOG.find((m) => m.id === id);
  return {
    title: model ? model.name : id,
    description: model
      ? `Usage, latency, spend, and error rate for ${model.name} (${model.provider}) through the gateway.`
      : `Usage, latency, spend, and error rate for ${id} through the gateway.`,
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  return <ModelDetailView id={id} />;
}
