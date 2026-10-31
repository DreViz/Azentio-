// Self-check for the post-sign-in redirect guard. Run: npm run test:validate
import assert from "node:assert/strict";
import { safeNext } from "../lib/validate";

assert.equal(safeNext("/portal"), "/portal");
assert.equal(safeNext("/invite/abc?x=1"), "/invite/abc?x=1");
for (const bad of ["", "//evil.com", "/\\evil.com", "/\\/evil.com", "/\t/evil.com", "https://evil.com", "evil.com"]) assert.equal(safeNext(bad), null, JSON.stringify(bad));
console.log("redirect guard self-check passed");
