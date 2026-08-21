# Edumeet management server

> This is the management service for the edumeet service.

## About

This project uses [Feathers](http://feathersjs.com). An open source framework for building APIs and real-time applications.

## Getting Started

Postgresql and application config 
```
docker run  --name edumeet-db -p 5432:5432 -e POSTGRES_PASSWORD=edumeet -d postgres
docker exec -it edumeet-db psql -U postgres -c "create database edumeet;"
```
Install your dependencies (this project uses Yarn 4 via Corepack)
```
corepack enable
yarn install --immutable
```
Start the service
```
yarn compile
yarn migrate
yarn start
```

## Testing

```
yarn test
```

Ways to access the management server:
* For edumeet 4.0 (the management-client, which is a standalone application that provides an UI for all the API calls)
* For edumeet 4.1 and above the mangement client is integrated into the edumeet client (on path '/mgmt-admin')
* Directly from curl / thunder client / postman ... 

For accessing certain API calls you have to have the proper JWT token authorization.

The thenant owner/admin/local admin can access tenant settings.

The normal users can create and manage their own rooms inside their own tenant.

## Dev tips for testing (with curl)

### Add user (option has been removed, use migration to create your initial user)
```
curl 'http://edumeet.example.com:3030/users/' \
  -H 'Content-Type: application/json' \
  --data-binary '{ "email": "edumeet@edu.meet", "password": "edumeet" }'
```
### Auth with user 
```
curl 'http://edumeet.example.com:3030/authentication/' \
  -H 'Content-Type: application/json' \
  --data-binary '{ "strategy": "local", "email": "edumeet@edu.meet", "password": "edumeet" }'
```
### Use user with jwt
```
curl 'http://edumeet.example.com:3030/roomOwners/' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <accessToken>' 
```
### Add room
```
curl 'http://edumeet.example.com:3030/rooms/' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <accessToken>' \
  --data-binary '{ "name": "test","description": "testdesc","maxActiveVideos":4}'
```
### Get rooms
```
curl 'http://edumeet.example.com:3030/rooms/' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <accessToken>' \
```

## Calendar invites (iTIP / RFC 5545)

The management server ships iTIP calendar invites (REQUEST / CANCEL / REPLY) tied to existing
edumeet rooms. See
[edumeet-docker README — Calendar invites](https://github.com/edumeet/edumeet-docker/blob/main/README.md#calendar-invites)
for deploy/config: secrets (`invites.encryptionKey`, `invites.rsvpTokenSecret`), optional knobs
(`imapPollIntervalMs`, `imapRetentionDays`), and the per-tenant UI walkthrough.

### Relevant API surface

| Service path | Purpose |
| --- | --- |
| `tenantInviteConfigs` | per-tenant SMTP/IMAP credentials (passwords AES-256-GCM encrypted at rest) |
| `meetings` | room-bound events; rrule + recurrenceCount for recurring series |
| `meetingAttendees` | RSVP rows; `partstat` updated by IMAP reply poller |
| `meetingOccurrenceRsvps` | per-occurrence exceptions (RECURRENCE-ID replies) |
| `inviteTests` | server-side nodemailer `verify()` + imapflow connect; validates a tenant's config |
| `invite-server-status` | read-only: whether the server has `encryptionKey` + `rsvpTokenSecret` (booleans only) — drives the client's "invites not configured" warning |

Permissions (all hooks run before any write):
- `tenantInviteConfigs`, `inviteTests`, `invite-server-status` — tenant admins (scoped to their own tenant) or super admin. `tenantInviteConfigs` create/patch additionally rejects `enabled=true` without a complete SMTP block.
- `meetings`, `meetingAttendees`, `meetingOccurrenceRsvps` — room owners of the meeting's room, tenant admins of the room's tenant, or super admin. Non-admin find/get is additionally scoped to meetings where the user is organizer / attendee / room-owner.
- Landing-page "my meetings" filter: pass `?upcomingForMe=true` on `find meetings`.

### End-to-end sanity check

```
# 1. Create a meeting in an existing room (requires room-owner or tenantAdmin JWT)
curl 'http://edumeet.example.com:3030/meetings/' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <accessToken>' \
  --data-binary '{
    "roomId": 1,
    "title": "Weekly sync",
    "startsAt": 1779984000000,
    "endsAt": 1779987600000,
    "timezone": "Europe/Berlin",
    "locale": "en"
  }'

# 2. Add an attendee — triggers the dispatcher to email the iTIP REQUEST
curl 'http://edumeet.example.com:3030/meetingAttendees/' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <accessToken>' \
  --data-binary '{"meetingId": 42, "email": "alice@example.com", "name": "Alice"}'
```

Logs: `[invites/dispatcher]`, `[invites/sender]`, `[invites/replyPoller]`. Set `LOG_LEVEL=debug`
in the env to see the poller's per-message decisions.

### Internal modules

| File | Role |
| --- | --- |
| `src/invites/registry.ts` | reconciles IMAP pollers on tenantInviteConfig changes (deduped per mailbox, not per tenant) |
| `src/invites/dispatcher.ts` | debounced emit of REQUEST/CANCEL on meeting & attendee events; organizer is included as a recipient |
| `src/invites/sender.ts` | nodemailer wrapper, cached per tenant; pooled + rate-limited (≤10/s); Intl-formatted Start/End in the meeting's timezone |
| `src/invites/replyPoller.ts` | one poller per unique mailbox; IMAP FETCH → parse ICS → update `partstat`; RECURRENCE-ID + dtstamp/sequence dedup; retention cleanup |
| `src/invites/templates/` | per-locale email subject/body (`getTemplate(locale)`, falls back to en) |
| `src/invites/icsBuilder.ts` | RFC 5545 ICS generation (UTC; no VTIMEZONE for max client compatibility) |
| `src/invites/crypto.ts` | AES-256-GCM encrypt/decrypt (passwords), HMAC-SHA256 (RSVP tokens) |
| `src/invites/tester.ts` | test-connection endpoint implementation |

## Rules

Rules are per-tenant policy attached to SSO user provisioning. They let a tenant express
"only my domain may sign in" and "staff@ become tenant admins" without anyone administering
users by hand. They are managed in the client under Management → Rules, and stored in the
`rules` service.

### Data model

Each row is one predicate plus an outcome:

| Column | Meaning |
| --- | --- |
| `tenantId` | the tenant the rule belongs to; a rule never applies outside it |
| `parameter` | which field of the incoming user data to test — only `email`, `name`, `ssoId` and `tenantId` are ever carried, so nothing else can match |
| `method` | `contains` \| `equals` \| `startswith` \| `endswith` |
| `value` | what to test `parameter` against |
| `negate` | inverts the result of `method` |
| `type` | `assert` (deny) or `gain` (grant) |
| `action` | `gain` only — `groupUsers`, `tenantOwners`, `tenantAdmins`, `superAdmin` |
| `accessId` | `groupUsers` only — the id of the group to add the user to |

The data being tested is what `OAuthTenantStrategy.getEntityData()` builds from the OIDC
profile: `{ ssoId, email, name, tenantId }`.

### When they fire

| Hook | Registered on | Fires |
| --- | --- | --- |
| `assertRules` | `before.create` of `users` | when a new account is provisioned, i.e. a user's **first** SSO login |
| `gainRules` | `after.all` of `users`, guarded to `create` + `patch` | on **every** SSO login — the OAuth strategy patches the existing user each time, which is what keeps group membership in sync |

**`assert` gates account creation, not login.** Once a user row exists they can keep signing
in even if a matching deny rule is added later, and accounts created by hand are never
subject to assert rules at all. Revoking access for an existing user means deleting the user.

A matching `assert` rule makes the SSO callback fail with `403 Action not allowed by rule`.

`gain` grants are idempotent — each action checks for the row before creating it — so
repeated logins do not accumulate duplicates.

### Evaluation and failure behaviour

`src/hooks/ruleMatch.ts` holds the shared evaluator used by both hooks.

- If `parameter` is absent from the profile (typo in the rule, or the IdP did not send the
  attribute), or `method` is not one of the four known values, the rule is **unevaluatable**:
  it is skipped and a warning naming the rule id is logged. `negate` is not applied in this
  case — otherwise a single typo on a negated assert rule would lock out the whole tenant.
- A `gain` action that fails at runtime (group deleted, DB error) is logged at error level
  and the login proceeds. One broken rule must not take sign-in down for a tenant.
- `type`, `method`, `parameter` and `action` are stored as free strings and are not
  enum-validated, so existing rows keep working. Off-list values are reported instead:
  `logRuleShape` warns when a rule is **saved** in a shape that can never do anything, and
  the hooks warn again at evaluation time — including for a rule whose `type` is neither
  `assert` nor `gain`, which is why they query the tenant's rules without a type filter
  (filtering in SQL would make such a rule invisible rather than merely inert).

Grep the logs for `assertRules:` / `gainRules:` / `rules:` when a rule appears not to apply.

### Who can manage rules

Reads and writes are tenant-scoped: a tenant admin or owner only ever sees and edits rules
of their own tenant (`ruleQueryResolver` / `ruleDataResolver` pin `tenantId`), while a super
admin manages every tenant and picks the tenant in the UI. Creating a rule with
`action: superAdmin` is rejected for anyone who is not a super admin (`adminOnlyData`).

A rule's `accessId` is **not** validated against the rule's tenant, so the tenant boundary is
enforced where the grant lands instead: `groupAndUserInSameTenant` rejects any `groupUsers`
create whose group and user belong to different tenants. An external super admin is exempt —
they manage every tenant — but **internal calls are not**, because `gainRules` is itself the
internal caller and the rule it is acting on may have been written by a tenant admin.

### Examples

Only `@our.edu` addresses may auto-provision — everyone else is refused at first login:

```
{ "tenantId": 1, "name": "our.edu only", "type": "assert",
  "parameter": "email", "method": "endswith", "value": "@our.edu",
  "negate": true, "action": "", "accessId": "" }
```

Anyone whose address starts with `staff-` becomes a tenant admin, re-checked at every login:

```
{ "tenantId": 1, "name": "staff are admins", "type": "gain",
  "parameter": "email", "method": "startswith", "value": "staff-",
  "negate": false, "action": "tenantAdmins", "accessId": "" }
```

