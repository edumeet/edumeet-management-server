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

Permissions (all hooks run before any write):
- `tenantInviteConfigs`, `inviteTests` — tenant admins (scoped to their own tenant) or super admin.
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
| `src/invites/registry.ts` | starts/stops per-tenant pollers on tenantInviteConfig changes |
| `src/invites/dispatcher.ts` | debounced emit of REQUEST/CANCEL on meeting & attendee events |
| `src/invites/sender.ts` | nodemailer wrapper, cached per tenant |
| `src/invites/replyPoller.ts` | IMAP FETCH → parse ICS → update `partstat`; handles RECURRENCE-ID + dtstamp/sequence dedup; retention cleanup |
| `src/invites/icsBuilder.ts` | RFC 5545 ICS generation (UTC; no VTIMEZONE for max client compatibility) |
| `src/invites/crypto.ts` | AES-256-GCM encrypt/decrypt (passwords), HMAC-SHA256 (RSVP tokens) |
| `src/invites/tester.ts` | test-connection endpoint implementation |

