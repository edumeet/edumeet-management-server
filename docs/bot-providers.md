# Bots, recordings and providers

A bot is a headless browser page (`?headless=1`) that records, streams or transcribes a room; the room-server keeps it out of the participant list and lets it neither send nor take part in decisions. Whether bots may join a tenant's rooms is the tenant's `botPolicy`: `disabled` (the default), `tokenOnly` or `all`.

Access tokens live in `tenantBotCredentials`, one row per token: a `label`, the SHA-256 `tokenHash`, the `allowedIps` the bot may connect from (single IPv4/IPv6 addresses or CIDR ranges, at least one), `enabled`, `createdAt` and `lastUsedAt`. The tenant admin's browser generates the raw token and sends only its hash when saving the credential. The raw token is shown once; a bot later presents it for verification, where the server hashes it and compares it with the stored value. Credential APIs do not return the hash. Tenant owners and admins manage tokens in the tenant editor; the hash cannot be changed, so rotation means revoking the old credential and creating a new one.

The room-server asks `bot-verify` (`create`, roles `super-admin` or `edumeet-server`) with `{ tenantId, botToken?, address }` on every headless connection into a tenant and gets `{ allowed, verified }` or `{ allowed: false, reason }` back, with `reason` one of `botsNotAllowed` (policy) or `botTokenRejected` (unknown, disabled or wrong-address token; one answer for all three on purpose, the detail is logged). A verified bot skips locks and meeting tokens on the room-server side.

### Tenant language

`tenants.locale` (optional, a translation file code such as `pl`) is the language a tenant writes to
its people in. The room-server passes it to a bot provider with every job, for the notice that a
recording is ready, and the client offers it as the starting language of a new meeting invitation.
Empty means English. The room-server also resolves the recipients of such a notice, the room owners
and the starting moderator, with `users.find` by id, which the `edumeet-server` role may do; only
the address is used.

### Bot jobs per room

`tenants.maxBotJobsPerRoom` (optional, a whole number from 1 to 100) is how many recordings, live
streams and transcriptions one room of the tenant, its breakout rooms included, may run at the same
time. The room-server's own `maxBotJobsPerRoom` (10 unless its config says otherwise) is both the
value for an empty field and the most a tenant gets: a tenant can lower the limit, and a higher
value counts as the room-server's. The room-server reads it with the tenant when a room opens.
Tenant admins set it in the tenant editor, like the bot policy.

### Bot providers

A credential row becomes a **provider** when it also has `jobTypes` (a list of `recorder`,
`transcriber` and `streamer`, stored as JSON text like `allowedIps`), an `apiUrl` and an
`apiSecret`. Moderators can then start and stop those kinds of job from the room, and the
room-server calls the provider's API to do it; one bot of the provider serves every job of a
session at once. The contract is
[BOT-PROVIDER-API.md](https://github.com/edumeet/edumeet/blob/main/BOT-PROVIDER-API.md). A row
without those three stays what it was, an access token for a bot somebody starts by hand.

All three or none: a half-configured provider is refused. The `apiUrl` must be https and carry no
query, fragment or credentials, because the room-server appends its own paths to it; a trailing
slash is trimmed. The `apiSecret` is the key the provider issued, must be printable characters
without spaces, and is write-only: it is stored encrypted, never returned to any client, and the row
reports only `hasApiSecret`. Leaving it empty in a patch keeps the stored key, and clearing `apiUrl`
clears the job types and the key with it. `bot-verify` additionally returns the `credentialId` and
the row's `jobTypes`, which the room-server uses to tie a bot to the jobs it was started for and to
refuse a bot that claims a kind its key is not for.

The key is encrypted with `bots.encryptionKey`, a 32-byte value in hex, deliberately separate from
`invites.encryptionKey` so that either can be rotated on its own. Without it, saving a key is
refused and `bot-providers` hands out nothing; rooms then simply have no providers.

`bot-providers` (`find`, roles `super-admin` or `edumeet-server`) answers `?tenantId=` with that
tenant's enabled provider rows and their keys **decrypted**. It is the only way a key leaves the
server, which is why it is limited to the room-server's own role; it returns nothing while the
tenant's bot policy is `disabled`, and skips a row whose key cannot be decrypted, for instance after
the encryption key was replaced.
