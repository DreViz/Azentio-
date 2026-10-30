# HTTP acceptance results

Run 2026-10-30T16:08:53.158Z against http://localhost:3100. 21/21 passed.

| Test | Scenario | HTTP status | Result |
|---|---|---|---|
| HTTP-01 | Anonymous: employee recording by direct link | 404 | PASS |
| HTTP-02 | Employee: employee recording | 200 | PASS |
| HTTP-03 | Lotus client: Meridian-only briefing media | 404 | PASS |
| HTTP-04 | Meridian client: own briefing media | 200 | PASS |
| HTTP-05 | Northwind (entitled to RIVA): RIVA webinar media | 200 | PASS |
| HTTP-06 | Same user, active workspace Lotus (not entitled): RIVA media | 404 | PASS |
| HTTP-07 | Anonymous: employee-only product page by URL | 404 | PASS |
| HTTP-08 | Employee: employee-only product page | 200 | PASS |
| HTTP-09 | Client: employee experiment notes by URL | 404 | PASS |
| HTTP-10 | Same Meridian author: own private draft | 200 | PASS |
| HTTP-11 | Meridian colleague: another member's private draft | 404 | PASS |
| HTTP-12 | Meridian colleague: organisation-visible observation | 200 | PASS |
| HTTP-13 | Lotus client: Meridian organisation-visible observation | 404 | PASS |
| HTTP-14 | Moderator: Meridian private draft | 404 | PASS |
| HTTP-15 | Anonymous: portal redirects to sign-in | 307 | PASS |
| HTTP-16 | Client: moderation page shows no queue | 200 | PASS |
| HTTP-17 | Anonymous: AIRA does not reveal internal notes | 200 | PASS |
| HTTP-18 | Client: shared feed has no source or org fields | 200 | PASS |
| HTTP-19 | Client: ideas page hides internal priority | 200 | PASS |
| HTTP-20 | Security headers present | 200 | PASS |
| HTTP-21 | Media id that is not a UUID | 404 | PASS |
