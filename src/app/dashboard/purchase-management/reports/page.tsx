
import { PageHeader } from "@/components/page-header";
import BranchUsageReport from "./branch-usage-report";
import MaterialUsageReport from "./material-usage-report";

export default function MaterialReportsPage() {
  return (
    <div>
      <PageHeader title="구매 분석 리포트" description="자재 및 지점별 구매 현황을 분석합니다." />
      <div className="container mx-auto py-10 space-y-8">
        <MaterialUsageReport />
        <BranchUsageReport />
      </div>
    </div>
  );
}
