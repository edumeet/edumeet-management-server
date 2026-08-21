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

Rules are per-tenant policy applied to SSO users. They let a tenant express "only my domain may sign
in" and "staff become tenant admins" without anyone administering users by hand. They are managed in
the client under Management → Rules, and stored in the `rules` service.

There are **two categories**, answering different questions. A user is normally subject to both.

| Category | Question | Stored `type` |
| --- | --- | --- |
| **Access** | may this person sign in? | `block` or `allow` |
| **Grant** | what do they get once they are in? | `gain` |

### Data model

Each row is one condition plus an outcome:

| Column | Meaning |
| --- | --- |
| `tenantId` | the tenant the rule belongs to; a rule never applies outside it |
| `parameter` | which attribute to test. Only `email`, `name`, `ssoId` and `tenantId` are ever carried by a login, so nothing else can match |
| `method` | `contains` \| `equals` \| `startswith` \| `endswith` \| `anyone`. The last is the catch-all: it tests nothing, always matches, and ranks below every other rule |
| `negate` | inverts the condition. Meaningful only on a Grant rule, where "grant to everyone except X" has no other spelling. Access rules carry their direction in `type`, so the migration clears it there. Not offered in the dialog: it is honoured for rules that already use it, but new ones are written with plain comparisons |
| `value` | what to test `parameter` against |
| `type` | `block` \| `allow` \| `gain` |
| `action` | `gain` only: `groupUsers`, `tenantOwners`, `tenantAdmins`, `superAdmin` |
| `accessId` | `groupUsers` only: the id of the group to add the user to |

The attributes being tested are what `OAuthTenantStrategy.getEntityData()` builds from the OIDC
profile: `{ ssoId, email, name, tenantId }`.

### How access is decided

Think of it as a firewall, including the `deny all` at the bottom - except here you write that line
yourself, as an ordinary rule.

```
the most specific matching rule decides
a Block wins a tie at the same level
nothing matched at all                  -> permit
```

Specificity has three levels, and it is what makes the default expressible as a rule:

| level | comparison | describes |
| --- | --- | --- |
| 2 | `equals` | one person |
| 1 | `contains`, `startswith`, `endswith` | a group |
| 0 | `anyone` | nobody in particular, so it always loses to a real rule |

A rule still carrying the old `negate` flag counts as level 1 whatever its comparison, because
inverting a test turns it into a statement about everyone else: "does not equal `bob@x.com`" describes
a group, not an individual, so it must not outrank a real Block.

> **A tenant is open by default.** To admit only the people you list, add a rule with the `anyone`
> comparison set to Block. Because it sits at level 0 it applies only to people no other rule
> mentions, which turns your Allow rules into the guest list. Its presence closes the tenant and its
> absence leaves it open, and either way it is a row an admin can see rather than a hidden default.

> **Administrators are never refused.** The super admin, and the admins and owners of the tenant being
> entered, are exempt from access rules. Without that, one careless rule would lock out the very people
> who could undo it, and the rules are edited through the interface they would lose. The exemption is
> only consulted for a sign in that the rules refused, and a brand new account cannot be an
> administrator, so first registration is still governed normally.

Specificity is what makes exceptions work in both directions, without any rule ordering to maintain:

- `Block ends with @gmail.com` plus `Allow equals someone@gmail.com` admits that one address, because
  naming a person (level 2) outranks describing a group (level 1).
- `Allow ends with @acme.edu` plus `Block ends with @students.acme.edu` still refuses the students,
  because both describe groups (level 1) and Block breaks the tie.

Comparisons are only offered in their plain form. A negated Allow looks like a way to say "everyone
except", but two of them combine to exclude nobody at all; Allow and Block express the same intent
correctly.

"Evaluatable" is deliberate. A rule whose `parameter` is absent from the login, or whose `method` is
not recognised, cannot be evaluated. It is skipped, logged, and does **not** count towards "an allow
list exists" - otherwise a single typo in the only Allow rule would lock out the whole tenant.

### Setting a tenant up

**Allow rules broaden, Block rules narrow, and the catch-all sets the default.**

1. **Add Allow rules for the groups of people who should get in.** One per organisation, domain or
   whatever else identifies them. They combine, so listing three domains admits all three.
2. **Add `Block` with the `anyone` comparison** to shut out everyone else. Without it the tenant stays
   open and your Allow rules only act as exceptions.
3. **Add Block rules for anyone inside those groups who should not get in.** They outrank the
   catch-all, and beat an Allow rule of the same specificity.

Watching a tenant on a federated login as the rules are added:

```
                                    alice        bob            eva        dave
                                    @man.poznan  @students.man  @agh.edu   @renater.fr

0. no rules (fresh tenant)          IN           IN             IN         IN
1. + Allow man.poznan.pl            IN           IN             IN         IN     <- still open
2. + Block anyone                   IN           IN             OUT        OUT    <- now closed
3. + Allow agh.edu.pl               IN           IN             IN         OUT
4. + Block students.man.poznan.pl   IN           OUT            IN         OUT
```

Three things to know before you start:

- **Step 2 is what closes the tenant**, and nothing else does. Adding an Allow rule on its own never
  changes the default, so you can admit one extra address to an open tenant without shutting out
  everybody else by accident.
- **A Block can have exceptions, if the exception is more specific.** `Block ends with @gmail.com`
  plus `Allow equals someone@gmail.com` admits that one address. Two rules of the same specificity
  tie, and Block wins, which is what keeps a `students.*` carve-out working.
- **You can skip steps 2 and 3.** Block rules on an open tenant simply subtract, which reads as
  "everyone, except these". That is a perfectly good configuration for a tenant that really is open.

### Examples

A federated login (eduGAIN and similar) presents users from every organisation in the federation, so
the common case is a tenant admitting only their own. The catch-all shuts out the rest of the
federation, and a sub-domain is carved out with a Block:

```
{ "type": "allow", "parameter": "email", "method": "endswith", "value": "man.poznan.pl" }
{ "type": "block", "parameter": "email", "method": "endswith", "value": "students.man.poznan.pl" }
{ "type": "block", "method": "anyone" }
```

`alice@man.poznan.pl` signs in, `bob@students.man.poznan.pl` does not, and neither does anyone from
another NREN. The Block on the sub-domain is required because `students.man.poznan.pl` also ends with
`man.poznan.pl`, so the Allow rule matches it too; both describe groups, and Block wins the tie.
Writing the Allow as `endswith "@man.poznan.pl"` excludes every sub-domain on its own, if that is what
you want.

Only two domains may sign in. Allow rules compose, so one per domain, plus the catch-all:

```
{ "type": "allow", "parameter": "email", "method": "endswith", "value": "@acme.edu" }
{ "type": "allow", "parameter": "email", "method": "endswith", "value": "@partner.org" }
{ "type": "block", "method": "anyone" }
```

Keep one consumer domain out and leave everything else open. No catch-all, so the tenant stays open
and the Block simply subtracts:

```
{ "type": "block", "parameter": "email", "method": "endswith", "value": "@gmail.com" }
```

The same, but admitting one address from that domain. Naming an exact address outranks a rule about a
group, so the Allow wins for that one person and the Block still holds for everyone else on it:

```
{ "type": "block", "parameter": "email", "method": "endswith", "value": "@gmail.com" }
{ "type": "allow", "parameter": "email", "method": "equals",   "value": "test@gmail.com" }
```

`test@gmail.com` signs in, the rest of gmail does not, and everyone else is unaffected because the
tenant has no catch-all and so remains open.

Admit a whole university except one account. The exact Block outranks the pattern Allow:

```
{ "type": "allow", "parameter": "email", "method": "endswith", "value": "@acme.edu" }
{ "type": "block", "parameter": "email", "method": "equals",   "value": "bad@acme.edu" }
{ "type": "block", "method": "anyone" }
```

Everyone whose address starts with `staff-` becomes a tenant admin, re-checked at every login:

```
{ "type": "gain", "parameter": "email", "method": "startswith", "value": "staff-",
  "negate": false, "action": "tenantAdmins", "accessId": "" }
```

### When rules fire

| Hook | Where | Fires |
| --- | --- | --- |
| access | `OAuthTenantStrategy.getEntityData()` | **every SSO login**, both the first (which creates the account) and every one after it. It runs before any database write, so a refused user is never created and picks up no grants |
| access | `before.create` on `users` | accounts an admin creates directly rather than via SSO |
| `gainRules` | `after.all` on `users`, guarded to create and patch | **every SSO login**, which is what keeps group membership in sync |

Grants are **additive only**. Nothing in the rules engine ever revokes: if a user stops matching a
Grant rule they keep what they were given, and removing it is a manual operation.

A refused login fails with `403 Action not allowed by rule`, surfaced on the auth callback as
`?error=`.

### If you were already using rules

Before this change there was a single access type, `assert`, and the `negate` checkbox decided
whether it blocked or admitted. A rule always refused whoever its condition matched, so:

- `negate` **off** refused the people who matched, i.e. a **block list**
- `negate` **on** refused everyone who did **not** match, i.e. an **allow list**

A data migration converts existing rows automatically. No schema change, and `gain` rules are
untouched:

| before | after |
| --- | --- |
| `assert` with `negate` off or unset | `block`, condition unchanged |
| `assert` with `negate` on | `allow`, condition unchanged, `negate` reset to false |
| `gain` | unchanged, and `negate` keeps its literal meaning as a condition inverter |
| any tenant left holding an `allow` rule | gains a `Block anyone` row, so its allow list keeps restricting |

The last row is what preserves an allow list. Before, an allow-list rule restricted the tenant simply
by existing; now a tenant restricts only when it says so with a catch-all. Without that row an
existing allow list would open on upgrade, so it is added automatically and logged. It is an ordinary
rule, visible in the list, and can be deleted if the tenant should in fact be open.

**What actually changes for you:**

1. **Access rules now apply at every sign in, not only at account creation.** Previously a rule could
   stop an account from being created, but once someone had an account they signed in forever. Now a
   Block rule refuses them at their next login. This is what makes revocation possible without
   deleting the user, but it means **existing accounts that match a block rule will stop working**.
2. **If you had two or more allow-list rules, they were blocking everybody.** OR-ing two inverted
   rules means "deny unless A" *and* "deny unless B", which no one satisfies, so the tenant could
   onboard nobody. After the migration they compose as an OR allow list and work as intended. This is
   the one change that **admits people who are currently being refused**, so review those tenants.
3. **The negate checkbox is gone.** Whether a rule lets people in or keeps them out is the Effect
   dropdown now, Block or Allow, and negated conditions are not offered at all. Two of them combine
   to exclude nobody, so Allow and Block are the correct way to say "everyone except".
   **Nothing changes for rules you already have.** The `negate` column is kept and still honoured, so
   an existing rule keeps working and still reads correctly in the list. This matters most for Grant
   rules, where "grant to everyone except X" genuinely has no other spelling and the column is a
   permanent part of the model. You simply cannot create a new negated rule from the dialog.
4. **A tenant's default is now a rule instead of being implied.** An allow-list rule used to restrict
   the tenant just by existing, which is invisible in the list and means one exception shuts out
   everybody else. A tenant is now open unless it holds a `Block` rule with the `anyone` comparison.
   Your existing allow lists get that row added by the migration, so nothing changes, and you can
   delete it if the tenant should be open.
   It also means a Block rule can have exceptions: `Block ends with @gmail.com` plus
   `Allow equals someone@gmail.com` admits that one address, because naming a person outranks a rule
   about a group.

Worth running before you upgrade, to see what you will hit:

```sql
SELECT "tenantId", type, negate, parameter, method, value
FROM rules WHERE type = 'assert' ORDER BY "tenantId";
```

Any tenant with two or more `negate = true` rows is currently locked shut and will open up. Any with
`negate = false` rows may lock out existing users who match them.

The client and the management server must be upgraded together, since the client reads and writes the
new `type` values. The migration has a `down` that restores the old shape.

### Diagnosing a rule that is not doing what you expect

`logRuleShape` warns when a rule is **saved** in a shape that cannot work, and the hooks warn again at
evaluation time. Grep the logs for `accessRules`, `gainRules` or `rules:`. Reported cases include an
unrecognised `type`, `method` or `parameter`, a Grant rule with no action, and a `groupUsers` grant
naming no group.

### Known limitations

- **A live session is not re-checked.** `token-refresh` reissues a token to anyone holding a valid
  one, so a user who is blocked while signed in keeps working until they next sign in from scratch.
- **Room access lags a block by up to the token lifetime (1 day by default).** The room server
  verifies peer tokens offline against public keys and has no channel to learn that a user was
  blocked, so an unexpired token still joins rooms.
- **Local password sign in is not re-checked.** Access rules only apply where a `tenantId` is
  present, and the super admin has none, so this affects only local accounts inside a tenant.
- **A group grant is not validated against the rule's tenant.** The tenant boundary is enforced where
  the grant lands instead: `groupAndUserInSameTenant` refuses any `groupUsers` create whose group and
  user belong to different tenants. An external super admin is exempt; internal calls are not,
  because `gainRules` is itself the internal caller.
