import type { Metadata } from "next";
import { CreateCampaignForm } from "@/components/campaigns/create-campaign-form";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Nova campanha | Prospector" };

export default function NewCampaignPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="camp.newTitle" subtitle="camp.newSubtitle" />
      <CreateCampaignForm />
    </div>
  );
}
