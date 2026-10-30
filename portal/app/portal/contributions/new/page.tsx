import { requireViewer, db } from "@/lib/session";
import { Flash, Notice, PageHeader } from "@/components/ui";
import ContributionForm from "@/components/ContributionForm";
import { createContribution } from "@/app/actions/portal";

export default async function NewContribution({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const v = await requireViewer();
  if (v.activeOrg?.kind !== "client") return <Notice>Observations are recorded from a client workspace.</Notice>;
  const offerings = await db(v, (q) => q<{ id: string; name: string }>("select id, name from offerings where audience = 'public' order by name"));
  return (
    <div>
      <PageHeader eyebrow={v.activeOrg.org_name} title="New observation">Starts as a private draft. Nothing is shared when you click save.</PageHeader>
      <Flash sp={sp} />
      <ContributionForm action={createContribution} offerings={offerings} isNew />
    </div>
  );
}
