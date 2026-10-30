import { PageHeader } from "@/components/ui";

export default function About() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <PageHeader eyebrow="About" title="azentio.ai is where Azentio builds and shares applied intelligence." />
      <div className="card space-y-3 text-slate-700">
        <p>Azentio serves banks, insurers and financial institutions with core software. azentio.ai showcases the applied AI layer: prototypes for credit, reporting and documents that are explored with clients in governed sandboxes.</p>
        <p>The portal connects three groups. Visitors discover offerings. Employees experiment and build. Clients collaborate in private workspaces and, when they choose to, contribute observations that become reviewed, de-identified learning for the whole community.</p>
        <p className="muted">This build is a hackathon submission. All organisations, people and data shown are synthetic.</p>
      </div>
    </div>
  );
}
