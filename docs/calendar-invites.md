# Calendar invites (iTIP / RFC 5545)

The management server ships iTIP calendar invites (REQUEST / CANCEL / REPLY) tied to existing
edumeet rooms. See
[edumeet-docker — Calendar invites](https://github.com/edumeet/edumeet-docker/blob/main/docs/meetings.md#calendar-invites)
for deploy/config: the required `invites.encryptionKey`, the optional
`invites.rsvpTokenSecret` (reserved for a future token flow), and optional knobs
(`imapPollIntervalMs`, `imapRetentionDays`), and the per-tenant UI walkthrough.
`invites.maxMeetingsPerRoom` (default `100`) limits the recurring or upcoming meetings of a
room; past single meetings do not count.

### Relevant API surface

| Service path | Purpose |
| --- | --- |
| `tenantInviteConfigs` | per-tenant SMTP/IMAP credentials (passwords AES-256-GCM encrypted at rest) |
| `meetings` | room-bound events; rrule + recurrenceCount for recurring series |
| `meetingAttendees` | RSVP rows; `partstat` updated by IMAP reply poller |
| `meetingOccurrenceRsvps` | per-occurrence exceptions (RECURRENCE-ID replies) |
| `inviteTests` | server-side nodemailer `verify()` + imapflow connect; validates a tenant's config |
| `invite-server-status` | Read-only booleans for `encryptionKey` and `rsvpTokenSecret`; `configured` and the client's warning depend on `encryptionKey` only. `rsvpTokenSecret` is not required by the current invite workers. |

Permissions (all hooks run before any write):
- `tenantInviteConfigs`, `inviteTests`, `invite-server-status` — tenant admins (scoped to their own tenant) or super admin. `tenantInviteConfigs` create/patch additionally rejects `enabled=true` without a complete SMTP block.
- `meetings`, `meetingAttendees`, `meetingOccurrenceRsvps` — room owners of the meeting's room, tenant admins of the room's tenant, or super admin. Non-admin find/get is additionally scoped to meetings where the user is organizer / attendee / room-owner.
- Landing-page "my meetings" filter: pass `?upcomingForMe=true` on `find meetings`.

### End-to-end sanity check

```
# Replace these sample timestamps with future Unix timestamps in milliseconds.
# 1. Create a meeting in an existing room (requires room-owner, tenant-admin or super-admin JWT)
curl 'http://edumeet.example.com:3030/meetings/' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <accessToken>' \
  --data-binary '{
    "roomId": 1,
    "title": "Weekly sync",
    "startsAt": 1800007200000,
    "endsAt": 1800010800000,
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
| `src/invites/registry.ts` | reconciles SMTP senders and IMAP pollers on tenantInviteConfig changes (shared mailboxes are deduped) |
| `src/invites/dispatcher.ts` | debounced emit of REQUEST/CANCEL on meeting & attendee events; organizer is included as a recipient |
| `src/invites/sender.ts` | nodemailer wrapper, cached per SMTP account configuration; pooled + rate-limited (≤10/s); Intl-formatted Start/End in the meeting's timezone |
| `src/invites/replyPoller.ts` | one poller per unique mailbox; IMAP FETCH → parse ICS → update `partstat`; RECURRENCE-ID + dtstamp/sequence dedup; retention cleanup |
| `src/invites/templates/` | per-locale email subject/body (`getTemplate(locale)`, falls back to en) |
| `src/invites/icsBuilder.ts` | RFC 5545 ICS generation (UTC; no VTIMEZONE for max client compatibility) |
| `src/invites/crypto.ts` | AES-256-GCM encrypt/decrypt (passwords), HMAC-SHA256 (RSVP tokens) |
| `src/invites/tester.ts` | test-connection endpoint implementation |
