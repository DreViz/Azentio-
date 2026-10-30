"use server";
import { redirect } from "next/navigation";
import { asUser } from "@/lib/db";
import { email, opt, str, InputError } from "@/lib/validate";

export async function enquiryAction(f: FormData) {
  const kind = f.get("kind") === "hackathon" ? "hackathon" : "demo";
  const back = kind === "hackathon" ? "/hackathon/register" : "/connect";
  try {
    const row = [kind, str(f, "name", 2, 120), email(f), opt(f, "company", 160), opt(f, "message", 2000)];
    if (f.get("website")) throw new InputError("Rejected."); // honeypot field for bots
    await asUser({ userId: null, orgId: null }, (q) => q("insert into enquiries(kind, name, email, company, message) values ($1,$2,$3,$4,$5)", row));
  } catch (e) {
    redirect(`${back}?error=${encodeURIComponent(e instanceof InputError ? e.message : "Could not save your request.")}`);
  }
  redirect(`${back}?msg=${encodeURIComponent("Thank you. Your request is recorded and our team will reply by email. (No confirmation email is sent from this demo.)")}`);
}
