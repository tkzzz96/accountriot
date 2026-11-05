import type { Metadata } from "next";
import { IntegrationsPage } from "@/components/integrations/integrations-page";

export const metadata: Metadata = { title: "Integrações | Prospector" };

export default function Page() {
  return <IntegrationsPage />;
}
