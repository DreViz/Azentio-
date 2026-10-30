# Lifecycle test results

Run 2026-10-30T09:58:41.582Z. 41/41 passed. Each test runs as personas through the portal_app role in a rolled-back transaction.

| Test | Area | Scenario | Result |
|---|---|---|---|
| LC-01 | Capture | Saving creates a private draft visible only to its author | PASS |
| LC-02 | Capture | A contribution cannot be created in another organisation | PASS |
| LC-03 | Capture | A contribution cannot be created on behalf of another user | PASS |
| LC-04 | Capture | A contribution cannot be inserted directly as published | PASS |
| LC-05 | Capture | Database rejects too-short body and a period that ends before it starts | PASS |
| LC-06 | Capture | Organisation visibility is visible to colleagues at once, never to other clients | PASS |
| LC-07 | Consent | Submitting requires publication consent | PASS |
| LC-08 | Consent | Only items proposed for community sharing can be submitted | PASS |
| LC-09 | Workflow | Submission notifies moderators, writes audit, and becomes visible to org and moderators | PASS |
| LC-10 | Workflow | Only the author can submit | PASS |
| LC-11 | Moderation | Return requires a reason, notifies the author, and allows edit and resubmission | PASS |
| LC-12 | Moderation | Publishing copies only reviewed fields; the shared copy carries no source, org or author | PASS |
| LC-13 | Moderation | Only moderators can publish, return or reject | PASS |
| LC-14 | Moderation | Illegal transitions are refused (draft to published, published to returned) | PASS |
| LC-15 | Moderation | Attribution needs the author's attribution consent | PASS |
| LC-16 | Moderation | Rejection stores the reason for the author and keeps the internal note private | PASS |
| LC-17 | Withdrawal | Revoking publication consent on a published item withdraws it | PASS |
| LC-18 | Withdrawal | A client admin of the same organisation can withdraw; another organisation's admin cannot | PASS |
| LC-18b | Withdrawal | Anonymous callers cannot submit, withdraw or change consent on any contribution | PASS |
| LC-19 | Withdrawal | Withdrawal is not possible from draft | PASS |
| LC-20 | Versions | Revising a published item keeps the old copy live until the new version is reviewed | PASS |
| LC-21 | Consent | Revoking attribution consent removes the attribution label | PASS |
| LC-22 | Consent | Consent history is append-only and only the author can change it | PASS |
| LC-23 | Reports | A client can report a shared item; moderators can unpublish, republish and dismiss | PASS |
| LC-24 | Aggregation | Facet counts only show values backed by at least 3 institutions | PASS |
| LC-25 | Aggregation | The cohort threshold cannot be lowered below 3, and only admins can change it | PASS |
| LC-26 | Themes | Only moderators and product owners can assign themes | PASS |
| LC-27 | Ideas | Only product owners create ideas; withdrawn items cannot be linked as evidence | PASS |
| LC-28 | Ideas | Proposed ideas stay internal; later statuses reach clients and notify evidence authors | PASS |
| LC-29 | Ideas | Status changes require the product owner grant | PASS |
| LC-30 | Invitations | Members cannot invite; admins invite client roles only | PASS |
| LC-31 | Invitations | Invitations are bound to the email, single-use, and expire | PASS |
| LC-32 | Members | Client admins manage only client members of their own org and not themselves | PASS |
| LC-33 | Grants | Admins grant platform roles to employees only, and cannot remove their own admin grant | PASS |
| LC-34 | Grants | A grant row on a non-employee has no effect | PASS |
| LC-35 | Provisioning | Only admins provision employees, and only @azentio.com addresses | PASS |
| LC-36 | Sandbox | Clients can run only entitled offerings in their own workspace; employees run internally | PASS |
| LC-37 | Content | Only publishers publish content, and every item needs an audience | PASS |
| LC-38 | Public | Anonymous visitors can submit enquiries but cannot read them | PASS |
| LC-39 | Notifications | Notifications are private to their recipient | PASS |
| LC-40 | Federated | Model runs are visible to employees only and decisions need a portal admin | PASS |
