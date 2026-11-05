import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { PageHeader } from "@/components/layout/page-header";

export default function AnalyticsPage() {
  return (
    <div>
      <PageHeader title="analytics.title" subtitle="analytics.subtitle" />
      <AnalyticsDashboard />
    </div>
  );
}
