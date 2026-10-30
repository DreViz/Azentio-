import { requireViewer, db } from "@/lib/session";
import { Badge, Empty, Flash, Notice, PageHeader, fmtDate } from "@/components/ui";
import { human } from "@/lib/labels";
import { createInvite, revokeInvite, setMember } from "@/app/actions/portal";

export default async function Org({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const v = await requireViewer();
  if (v.activeOrg?.kind !== "client" || v.activeOrg.role !== "client_admin") return <Empty title="Organisation administration is for client administrators of the active workspace." />;
  const d = await db(v, async (q) => ({
    members: await q<{ user_id: string; display_name: string; email: string; role: string; status: string }>(
      "select m.user_id, u.display_name, u.email, m.role, m.status from memberships m join users u on u.id = m.user_id where m.org_id = app_org() order by u.display_name"),
    invites: await q<{ id: string; email: string; role: string; expires_at: string; accepted_at: string | null; revoked_at: string | null }>(
      "select id, email, role, expires_at, accepted_at, revoked_at from invitations where org_id = app_org() order by created_at desc"),
  }));
  const inviteState = (i: (typeof d.invites)[0]) => i.accepted_at ? "accepted" : i.revoked_at ? "revoked" : new Date(i.expires_at) < new Date() ? "expired" : "pending";
  return (
    <div>
      <PageHeader eyebrow={v.activeOrg.org_name} title="Organisation">Invite colleagues and manage client roles. You can only manage your own organisation and only client roles.</PageHeader>
      <Flash sp={sp} />
      <form action={createInvite} className="card mb-6 flex flex-wrap items-end gap-3">
        <div className="flex-1"><label className="label" htmlFor="email">Colleague email</label><input id="email" name="email" type="email" required className="input" /></div>
        <div><label className="label" htmlFor="role">Role</label><select id="role" name="role" className="input"><option value="client_member">Client member</option><option value="client_admin">Client administrator</option></select></div>
        <button className="btn">Create invitation</button>
      </form>
      <Notice tone="slate">Invitations are single-use, expire after 72 hours and can only be accepted by the verified email they name. Employee, moderator, publisher and administrator roles cannot be granted from here.</Notice>
      <h2 className="h2 mb-3 mt-6">Members</h2>
      <div className="card divide-y p-0">
        {d.members.map((m) => (
          <form key={m.user_id} action={setMember} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
            <input type="hidden" name="user_id" value={m.user_id} />
            <span><span className="font-medium">{m.display_name}</span> <span className="muted">{m.email}</span></span>
            <span className="flex items-center gap-2">
              <Badge tone={m.status === "active" ? "green" : "slate"}>{m.status}</Badge>
              {m.user_id === v.id ? <Badge>{human(m.role)} (you)</Badge> : <>
                <select name="role" defaultValue={m.role} aria-label="Role" className="input mt-0 w-auto py-1"><option value="client_member">Client member</option><option value="client_admin">Client administrator</option></select>
                <select name="status" defaultValue={m.status} aria-label="Status" className="input mt-0 w-auto py-1"><option value="active">Active</option><option value="revoked">Revoked</option></select>
                <button className="btn-ghost px-2 py-1 text-xs">Save</button></>}
            </span>
          </form>))}
      </div>
      <h2 className="h2 mb-3 mt-6">Invitations</h2>
      {d.invites.length ? <div className="card divide-y p-0">{d.invites.map((i) => (
        <div key={i.id} className="flex items-center justify-between px-5 py-3 text-sm">
          <span>{i.email} · {human(i.role)} · expires {fmtDate(i.expires_at)}</span>
          <span className="flex items-center gap-2"><Badge>{inviteState(i)}</Badge>
            {inviteState(i) === "pending" && <form action={revokeInvite}><input type="hidden" name="id" value={i.id} /><button className="btn-ghost px-2 py-1 text-xs">Revoke</button></form>}</span>
        </div>))}</div> : <Empty title="No invitations yet" />}
    </div>
  );
}
