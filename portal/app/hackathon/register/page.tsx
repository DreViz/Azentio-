import EnquiryForm from "@/components/EnquiryForm";
import { Flash, PageHeader } from "@/components/ui";

export default async function Register({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <PageHeader eyebrow="azentio.ai Build Labs" title="Register interest in the hackathon">Build intelligence with Azentio teams and mentors.</PageHeader>
      <Flash sp={sp} />
      <EnquiryForm kind="hackathon" />
    </div>
  );
}
