import type { Metadata } from "next";
import { Kanban } from "@/components/crm/kanban";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "CRM | Prospector" };

export default function CrmPage() {
  return (
    <div>
      <PageHeader title="crm.title" subtitle="crm.subtitle" />
      <Kanban />
    </div>
  );
}
