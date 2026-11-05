import { Suspense } from "react";
import { LeadsList } from "@/components/leads/leads-list";
import { PageHeader } from "@/components/layout/page-header";

export default function LeadsPage() {
  return (
    <div>
      <PageHeader title="nav.leads" subtitle="leads.subtitle" />
      <Suspense fallback={null}>
        <LeadsList />
      </Suspense>
    </div>
  );
}
