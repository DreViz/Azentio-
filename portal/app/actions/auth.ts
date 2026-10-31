"use server";
import { redirect } from "next/navigation";
import { requestCode, verifyCode, signOut, setActiveOrg, AuthError } from "@/lib/auth";
import { getViewer } from "@/lib/session";
import { email as emailField, str, uuid, safeNext, InputError } from "@/lib/validate";

const back = (path: string, params: Record<string, string>) => redirect(`${path}?${new URLSearchParams(params)}`);
const userMessage = (e: unknown, fallback: string) => (e instanceof InputError || e instanceof AuthError ? e.message : fallback);

export async function requestCodeAction(f: FormData) {
  let email = "";
  let res: { code?: string; delivered: boolean };
  const from = String(f.get("from") ?? "/login") === "/judge" ? "/judge" : "/login";
  try {
    email = emailField(f);
    res = await requestCode(email);
  } catch (e) {
    if (!(e instanceof InputError || e instanceof AuthError)) console.error("requestCode failed", e);
    return back(from, { error: userMessage(e, "Could not send a code. Please try again.") });
  }
  const p: Record<string, string> = { email, step: "code" };
  const next = safeNext(String(f.get("next") ?? ""));
  if (next) p.next = next;
  if (res.code) p.demo = res.code;
  if (!res.delivered && !res.code) p.error = "Email delivery is not configured on this deployment.";
  return back("/login", p);
}

export async function verifyCodeAction(f: FormData) {
  const email = String(f.get("email") ?? "").toLowerCase();
  try {
    const code = str(f, "code", 6, 6);
    await verifyCode(email, code);
  } catch (e) {
    if (!(e instanceof InputError || e instanceof AuthError)) console.error("verifyCode failed", e);
    return back("/login", { email, step: "code", error: userMessage(e, "Sign-in failed. Please try again.") });
  }
  redirect(safeNext(String(f.get("next") ?? "")) ?? "/portal");
}

export async function signOutAction() {
  await signOut();
  redirect("/");
}

export async function switchOrgAction(f: FormData) {
  const v = await getViewer();
  if (!v) redirect("/login");
  try {
    await setActiveOrg(v.id, uuid(f.get("org_id")));
  } catch (e) {
    return back("/portal", { error: userMessage(e, "Could not switch workspace.") });
  }
  redirect("/portal");
}
