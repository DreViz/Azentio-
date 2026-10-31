// End-to-end run of the brief's illustrative scenario through the real UI in Chrome.
// Requires a freshly seeded database and DEMO_MODE=true. Saves screenshots to docs/screenshots.
// Usage: BASE_URL=http://localhost:3100 node scripts/e2e.mjs
import { chromium } from "playwright-core";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3100";
const SHOTS = "docs/screenshots";
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", headless: true });
let step = 0;
const ok = (msg) => console.log(`PASS  ${String(++step).padStart(2, "0")}  ${msg}`);
function expect(cond, msg) { if (!cond) throw new Error(`FAIL: ${msg}`); ok(msg); }

async function as(email) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.click("text=Send code");
  await page.waitForSelector("#code");
  await page.click("text=Verify and continue"); // demo mode pre-fills the displayed code
  await page.waitForURL(/\/portal/);
  return { page, close: () => ctx.close() };
}
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
/** Clicks a control that runs a server action and waits until the status message changes. */
async function act(page, target) {
  const before = (await page.locator('[role="status"]').allTextContents()).join("|");
  await (typeof target === "string" ? page.click(target) : target.click());
  await page.waitForFunction((b) => [...document.querySelectorAll('[role="status"]')].map((e) => e.textContent).join("|") !== b, before, { timeout: 30000 });
}
const flash = async (page) => (await page.locator('[role="status"]').first().textContent().catch(() => "")) ?? "";

try {
  // 0. Public visitor
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await shot(page, "01-home");
    await page.goto(`${BASE}/aira?q=${encodeURIComponent("What does the SME credit decisioning workbench do?")}`);
    expect(await page.locator("text=SME Credit Decisioning Workbench").count() > 0, "Public visitor gets a cited AIRA answer from public content");
    await shot(page, "02-aira-public");
    await ctx.close();
  }

  // 0b. Sign-in safeguards
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const email = `visitor.${Date.now()}@example.com`;
    const requestCode = async () => {
      await page.goto(`${BASE}/login`);
      await page.fill("#email", email);
      await page.click("text=Send code");
      await page.waitForURL(/step=code|error=/);
      await page.waitForLoadState("networkidle"); // let hydration finish before typing into the form
      return page.inputValue("#code").catch(() => "");
    };
    const code = await requestCode();
    await page.fill("#code", code === "000000" ? "111111" : "000000");
    await act(page, "text=Verify and continue");
    expect((await flash(page)).includes("not correct"), "A wrong sign-in code is rejected");
    await page.waitForLoadState("networkidle");
    await page.fill("#code", code);
    await page.click("text=Verify and continue");
    await page.waitForURL(/\/portal/);
    await page.waitForSelector("text=No workspace yet"); // count() does not auto-wait, so wait for the streamed render first
    expect(await page.getByRole("heading", { name: "No workspace yet" }).isVisible(), "An unknown verified email signs in with no workspace and no data");
    await shot(page, "00-no-workspace");
    await page.click("text=Sign out");
    await page.waitForURL(`${BASE}/`);
    await page.goto(`${BASE}/login?email=${encodeURIComponent(email)}&step=code`);
    await page.waitForLoadState("networkidle");
    await page.fill("#code", code);
    await act(page, "text=Verify and continue");
    expect((await flash(page)).includes("expired"), "A used sign-in code cannot be reused");
    const fresh = await requestCode();
    for (let i = 0; i < 5; i++) {
      await page.fill("#code", fresh === "000000" ? "111111" : "000000");
      await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), page.click("text=Verify and continue")]);
      await page.waitForSelector('[role="status"]');
      await page.waitForLoadState("networkidle");
    }
    await page.fill("#code", fresh);
    await act(page, "text=Verify and continue");
    const lockMsg = await flash(page);
    expect(lockMsg.includes("expired"), `Five wrong attempts lock the code, even the right one afterwards (${lockMsg})`);
    for (let i = 0; i < 4; i++) await requestCode();
    expect((await flash(page)).includes("Too many codes"), "Requesting more than five codes in 15 minutes is refused");
    await ctx.close();
  }

  // 1. Moderator: review the three seasonal observations
  {
    const { page, close } = await as("maya@azentio.com");
    await page.goto(`${BASE}/portal/moderation`);
    await shot(page, "03-moderation-queue");
    await page.click("text=Seasonal SME cash flow read as volatility");
    await page.waitForSelector("text=Copilot findings");
    const body = await page.inputValue("#body");
    expect(!body.includes("004512339871") && !body.includes("Kesar Agro") && !body.includes("Nashik"), "Copilot removed the account number, customer name and city from the proposed shared copy");
    expect(await page.locator("text=re-identification risk: high").count() === 1, "Copilot rated re-identification risk as high");
    await shot(page, "04-moderation-copilot");
    await page.fill("#ret", "Please confirm the observation period and whether this pattern affects more than one borrower.");
    await page.click("text=Return to author");
    await page.waitForURL(/\/portal\/moderation\?/);
    expect((await flash(page)).includes("Returned"), "Moderator requested clarification from the Meridian author");
    for (const title of ["Festive-season traders penalised by monthly averages", "Harvest-cycle repayments look like arrears"]) {
      await page.click(`text=${title}`);
      await page.waitForSelector("text=Shared copy to publish");
      // The model copilot rewrites the proposed title; pin it to the canonical title so later steps can reference it.
      await page.fill("#title", title);
      await page.check('input[name="confirm"]');
      await page.click("text=Publish shared copy");
      await page.waitForURL(/\/portal\/moderation\?msg/);
      ok(`Moderator published a de-identified copy of "${title}"`);
    }
    await close();
  }

  // 2. Author amends and resubmits
  {
    const { page, close } = await as("sam@meridian.example");
    await page.goto(`${BASE}/portal/contributions`);
    await page.click("text=Seasonal SME cash flow read as volatility");
    await page.waitForURL(/\/portal\/contributions\/[0-9a-f-]{36}/);
    expect(await page.locator("text=A moderator asked for clarification").count() === 1, "Author sees the clarification request in-app");
    await page.fill("#body", (await page.inputValue("#body")) + " This pattern affects several agri-processing borrowers in our SME book across Q1 2026.");
    await act(page, "text=Save changes");
    await act(page, "text=Submit for review");
    expect((await flash(page)).includes("Submitted for review"), "Author amended and resubmitted");
    await shot(page, "05-contribution-visibility-card");
    await close();
  }

  // 3. Moderator publishes the amended version
  {
    const { page, close } = await as("maya@azentio.com");
    await page.goto(`${BASE}/portal/moderation`);
    await page.click("text=Seasonal SME cash flow read as volatility");
    await page.waitForSelector("text=Shared copy to publish");
    await page.fill("#title", "Seasonal SME cash flow read as volatility");
    await page.check('input[name="confirm"]');
    await page.click("text=Publish shared copy");
    await page.waitForURL(/\/portal\/moderation\?msg/);
    ok("Moderator published the amended Meridian observation");
    await close();
  }

  // 4. Product owner: theme and improvement idea
  {
    const { page, close } = await as("omar@azentio.com");
    await page.goto(`${BASE}/portal/themes?suggest=1`);
    // With a model key the suggested titles are model wording, not the keyword fallback. Accept the first valid suggestion.
    await page.waitForSelector("form input[name='title']");
    const form = page.locator("form", { has: page.locator('input[name="title"]') }).first();
    const themeTitle = await form.locator('input[name="title"]').inputValue();
    expect(themeTitle.length > 0, "Theme suggestion grouped approved observations for review");
    await act(page, form.locator("text=Create theme"));
    await shot(page, "06-themes");
    expect(await page.locator(`text=${themeTitle}`).count() > 0, "Theme dashboard shows the new theme");
    expect(await page.locator("section", { hasText: "Document intake exceptions" }).locator('text="Withheld"').count() === 1, "Two-institution theme withholds its count");

    await page.goto(`${BASE}/portal/ideas`);
    await page.fill("#title", "Seasonality-aware comparison explanation");
    await page.selectOption("#offering_id", "financial-analysis");
    await page.fill("#problem", "Seasonal SME cash flow is read as volatility, which leads to conservative limits for healthy seasonal businesses.");
    await page.fill("#proposed_outcome", "Explain seasonality when comparing an applicant with peers, so credit officers can see what is seasonal and what is risk.");
    const themeOpt = await page.locator("#theme_id option", { hasText: themeTitle }).getAttribute("value");
    await page.selectOption("#theme_id", themeOpt);
    for (const t of ["Seasonal", "Festive", "Harvest"]) await page.locator("label", { hasText: t }).locator('input[name="evidence"]').first().check();
    await act(page, "text=Create as Proposed");
    const card = page.locator("section", { hasText: "Seasonality-aware comparison explanation" });
    await card.locator("select").selectOption("Under review");
    await card.locator('input[name="public_note"]').fill("Under review by the Financial Analysis team. This is not a delivery commitment.");
    await act(page, card.getByRole("button", { name: "Update" }));
    expect((await flash(page)).includes("Status updated"), "Product owner created the idea and moved it to Under review");
    await shot(page, "07-ideas-product-owner");
    await close();
  }

  // 5. Another client sees the loop closed, without private details
  {
    const { page, close } = await as("li@lotus.example");
    await page.goto(`${BASE}/portal/ideas`);
    expect(await page.locator("text=Seasonality-aware comparison explanation").count() === 1 && await page.locator("text=priority").count() === 0, "Lotus client sees the idea status without internal priority");
    await shot(page, "08-ideas-client");
    await page.goto(`${BASE}/portal/learning?q=seasonal`);
    const html = await page.content();
    expect(!html.includes("Kesar") && !html.includes("004512339871") && !html.includes("credit.ops@northwind"), "Shared feed holds no names, account numbers or contact details");
    await shot(page, "09-shared-feed");
    await page.goto(`${BASE}/aira?q=${encodeURIComponent("What have institutions observed about seasonal SME cash flow?")}`);
    expect(await page.locator("text=approved shared observation").count() > 0, "AIRA cites approved shared observations for a client");
    await shot(page, "10-aira-client");
    await close();
  }

  // 6. Withdrawal propagates
  {
    const { page, close } = await as("sam@meridian.example");
    await page.goto(`${BASE}/portal/contributions`);
    await page.click("text=Seasonal SME cash flow read as volatility");
    await page.waitForSelector("text=Withdraw from sharing");
    await act(page, "text=Withdraw from sharing");
    const msg = await flash(page);
    expect(msg.includes("Verified removed"), `Withdrawal verified: ${msg.match(/in \d+ ms/)?.[0] ?? ""}`);
    await shot(page, "11-withdrawn");
    await close();
    const li = await as("li@lotus.example");
    await li.page.goto(`${BASE}/aira?q=${encodeURIComponent("seasonal SME cash flow volatility scorecard")}`);
    const t = await li.page.content();
    expect(!t.includes("read as volatility"), "Withdrawn item no longer appears in another client's AIRA answer");
    await li.close();
  }

  // 6b. Invitation: single-use, bound to the invited email, joins only the inviting organisation
  {
    const { page, close } = await as("alex@meridian.example");
    await page.goto(`${BASE}/portal/org`);
    await page.fill("#email", "new.analyst@meridian.example");
    await act(page, "text=Create invitation");
    const link = (await flash(page)).match(/\/invite\/[\w-]+/)?.[0];
    expect(!!link, "Client admin created a single-use invitation link");
    expect(await page.locator('#role option[value="employee"], #role option[value="moderator"]').count() === 0, "Invitation roles are limited to client roles");
    await shot(page, "15-org-admin");
    await close();
    const wrong = await as("li@lotus.example");
    await wrong.page.goto(BASE + link);
    await act(wrong.page, "text=I have read the terms");
    expect((await flash(wrong.page)).includes("different email"), "A different verified account cannot accept the invitation");
    await wrong.close();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p2 = await ctx.newPage();
    await p2.goto(BASE + link);
    await p2.click("text=Sign in to accept");
    await p2.fill("#email", "new.analyst@meridian.example");
    await p2.click("text=Send code");
    await p2.waitForSelector("#code");
    await p2.click("text=Verify and continue");
    await p2.waitForURL(/\/invite\//);
    await shot(p2, "16-invite-terms");
    await p2.click("text=I have read the terms");
    await p2.waitForURL(/\/portal\?msg/);
    expect(await p2.locator("text=Meridian Bank (fictional)").count() > 0, "Invited analyst joined Meridian's workspace after reading the terms");
    await p2.goto(BASE + link);
    expect(await p2.locator("text=This invitation is used").count() === 1, "The invitation cannot be reused");
    await ctx.close();
  }

  // 7. Trust proof and federated lab
  {
    const { page, close } = await as("ada@azentio.com");
    await page.goto(`${BASE}/trust?run=1`);
    const rows = await page.locator("tbody tr").evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent.trim().replace(/\|/g, "/"))));
    fs.writeFileSync("docs/trust-results.md", `# Trust Proof results\n\nLive run ${new Date().toISOString()} after the end-to-end scenario. Probes run as each persona through the portal_app role; writes are rolled back.\n\n| Test | Persona | Attempt | Expected | Actual | Result |\n|---|---|---|---|---|---|\n${rows.map((r) => `| ${r.join(" | ")} |`).join("\n")}\n`);
    const fails = await page.locator("text=FAIL").count();
    expect(fails === 0, "Trust Proof page: every live check passes");
    await shot(page, "12-trust-proof");
    await page.goto(`${BASE}/portal/federated`);
    expect(await page.locator("text=Rejected update from Northwind Finance").count() === 1, "Federated lab shows the rejected poisoned update");
    await shot(page, "13-federated");
    await page.goto(`${BASE}/portal/admin`);
    await shot(page, "14-admin-audit");
    await close();
  }
  console.log(`\nAll ${step} end-to-end steps passed.`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
