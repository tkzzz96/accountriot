import { CampaignsList } from "@/components/campaigns/campaigns-list";
import { PageHeader } from "@/components/layout/page-header";

export default function CampaignsPage() {
  return (
    <div>
      <PageHeader title="camp.title" subtitle="camp.subtitle" />
      <CampaignsList />
    </div>
  );
}
