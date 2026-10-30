import EnquiryForm from "@/components/EnquiryForm";
import { Flash, PageHeader } from "@/components/ui";

export default async function Connect({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <PageHeader eyebrow="Connect" title="Request a demo">Tell us what you would like to explore. Demonstrations use synthetic data.</PageHeader>
      <Flash sp={sp} />
      <EnquiryForm kind="demo" product={sp.product} />
    </div>
  );
}
