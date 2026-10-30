// Self-check for the deterministic redaction rules. Run: npm run test:redact
import assert from "node:assert/strict";
import { ruleProposal, periodLabel, regionBand } from "../lib/redact";

const src = {
  title: "Kesar Agro Foods Pvt Ltd seasonal issue",
  body: "Our client Kesar Agro Foods Pvt Ltd in Nashik (account 004512339871) repaid for six years. On 14 March 2026 the limit was cut by ₹3.2 crore and Rs. 40,000. Email credit.ops@northwind.example or call +971 4 5551234. Meridian Bank noticed it.",
  industry: "Banking", region: "Nashik, Maharashtra, India", period_start: "2026-01-01", period_end: "2026-03-31",
};
const p = ruleProposal(src, ["Meridian Bank"]);
for (const leak of ["Kesar", "004512339871", "Nashik", "14 March", "3.2 crore", "40,000", "credit.ops@", "5551234", "Meridian Bank"]) assert.ok(!p.body.includes(leak) && !p.title.includes(leak), `leaked: ${leak}`);
assert.ok(p.body.includes("six years."), "ordinary words must survive (no false 'rs.' amount match)");
assert.equal(p.risk, "high");
assert.equal(p.region_band, "Western India");
assert.equal(periodLabel("2026-01-01", "2026-03-31"), "Q1 2026");
assert.equal(periodLabel("2026-01-01", "2026-06-30"), "H1 2026");
assert.equal(regionBand("Dubai, UAE"), "GCC");
const clean = ruleProposal({ ...src, title: "Harvest-cycle repayments look like arrears", body: "Borrowers repay in lumps after harvest across several years." }, []);
assert.equal(clean.flags.length, 0, `unexpected flags: ${JSON.stringify(clean.flags)}`);
console.log("redaction self-check passed");
