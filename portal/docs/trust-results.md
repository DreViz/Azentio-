# Trust Proof results

Live run 2026-10-30T10:00:08.245Z after the end-to-end scenario. Probes run as each persona through the portal_app role; writes are rolled back.

| Test | Persona | Attempt | Expected | Actual | Result |
|---|---|---|---|---|---|
| AT-01 | Anonymous visitor | Read client contributions | 0 rows | 0 (26 ms) | PASS |
| AT-02 | Anonymous visitor | List employee-only media files | 0 rows | 0 (2 ms) | PASS |
| AT-03 | Meridian client admin | Forge active workspace = Northwind | workspace rejected, no Northwind content | active org null, entitled RIVA items 0 (1 ms) | PASS |
| AT-04 | Lotus client member | Read Meridian's contributions | 0 rows | 0 (1 ms) | PASS |
| AT-05 | Lotus client member | Open employee-only experiment offering by id | 0 rows | 0 (1 ms) | PASS |
| AT-06 | Employee, no moderator grant | Read the moderation queue | 0 rows | 0 (1 ms) | PASS |
| AT-07 | Learning moderator | Read unsubmitted private drafts | 0 drafts, reviewed items still visible | drafts 0, reviewable 9 (2 ms) | PASS |
| AT-08 | Meridian client admin | Grant themselves the moderator role | denied | denied: not allowed (1 ms) | PASS |
| AT-09 | Meridian client admin | Invite an @azentio.com user into the client workspace | denied | denied: employees are provisioned by Azentio, not invited into client workspaces (1 ms) | PASS |
| AT-10 | Verified email, no membership | Read shared learning and restricted content | 0 rows | 0 (3 ms) | PASS |
| AT-12 | Lotus client member | Select the hidden source link of a shared item | denied (column not granted) | denied: permission denied for table shared_items (1 ms) | PASS |
| AT-14 | Meridian author → Lotus reader | Withdraw a published item, then search and ask AIRA as another client | visible before, gone after | before 1, after 0, propagation 2 ms (3 ms) | PASS |
| AT-15 | Lotus client member | Read the organisation count of a two-institution theme | withheld | items 3, orgs withheld (1 ms) | PASS |
| AT-16 | Lotus client member | Three posts from one institution count once | 3 institutions for 3+ posts | items 3, orgs 3 (1 ms) | PASS |
| AT-17 | Anonymous visitor | Ask AIRA about internal experiments | no employee or shared sources | 1 sources, 0 restricted (4 ms) | PASS |
| AT-19 | Meridian client member | Publish their own submission (skip moderation) | denied | denied: not allowed (2 ms) | PASS |
| AT-19b | Meridian client member | Set state = published directly with UPDATE | denied (column not granted) | denied: permission denied for table contributions (1 ms) | PASS |
| AT-20 | System | Every published contribution has an audit event | 0 missing | 0 (1 ms) | PASS |
| AT-20b | Portal administrator | Delete or edit audit events | denied | denied: permission denied for table audit_events (1 ms) | PASS |
| AT-21 | Content publisher | Publish content without an audience | denied | denied: null value in column "audience" of relation "content_items" violates not-null constraint (1 ms) | PASS |
| AT-22 | Lotus client member | Read internal idea priority | 0 rows | 0 (1 ms) | PASS |
| AT-23 | Learning moderator | Identify client authors | 0 client users visible | 0 (3 ms) | PASS |
| AT-24 | Portal administrator | Read a client's private draft | 0 rows | 0 (1 ms) | PASS |
| AT-25 | Northwind admin, active workspace Lotus | See RIVA content entitled to Northwind only | 0 rows | 0 (9 ms) | PASS |
