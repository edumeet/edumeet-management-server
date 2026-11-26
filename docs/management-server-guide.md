# eduMEET management server guide

> This is the management service for the edumeet service.

## About

This project uses [Feathers](http://feathersjs.com). An open source framework for building APIs and real-time applications.

## Getting Started

Start PostgreSQL for local development:
```
docker run --name edumeet-db -p 127.0.0.1:5432:5432 \
  -e POSTGRES_PASSWORD=edumeet -e POSTGRES_DB=edumeet -d postgres:18-alpine
```
Install your dependencies (this project uses Yarn 4 via Corepack)
```
corepack enable
yarn install --immutable
```
Before running migrations or starting the service, generate your own JWT signing
key pair and put the private key in `config/local.json` as
`authentication.secret`. The published example key is rejected. Configure the
matching public key in the room server. See the [developer setup guide](https://github.com/edumeet/edumeet/blob/main/DEVELOPMENT.md#43-config-files)
for the commands and configuration.

Compile and run the migrations:
```
yarn compile
yarn migrate
```
The first migration creates the super-admin `edumeet-admin@localhost`. Its initial
password is publicly known and is refused at sign in, so set your own (at least
12 characters; it is read from standard input):
```
yarn set-password edumeet-admin@localhost
yarn start
```
With edumeet-docker: `docker compose exec -it edumeet-management-server yarn set-password edumeet-admin@localhost`.

An address is unique per tenant only. Without a tenant, `set-password` changes the account
that belongs to no tenant, such as the super-admin. For the account of a tenant, add the
tenant's id: `yarn set-password someone@example.edu 3`.

## Testing

Configure a separate test database first: `yarn test` runs migrations and changes
test data. See [the test database setup](https://github.com/edumeet/edumeet/blob/main/DEVELOPMENT.md#43-config-files).
Then run:
```
yarn test
```

## Ways to use the service

- In eduMEET 4.1 and later, open the integrated management UI at `/mgmt-admin`.
- eduMEET 4.0 used a separate `management-client`.
- The REST and WebSocket APIs can also be called directly with a valid JWT access token.

Tenant owners and admins can update their own tenant settings; super-admins can manage any tenant.
Other actions are limited by the caller's role and tenant. Regular users can create and manage their
own rooms within their tenant.

## Dev tips for testing (with curl)

Create the initial super-admin with the migration and password setup above.
### Auth with user
```
curl 'http://edumeet.example.com:3030/authentication/' \
  -H 'Content-Type: application/json' \
  --data-binary '{ "strategy": "local", "email": "<user email>", "password": "<password>" }'
```
Use an existing local account. Avoid putting a real password in shell history.
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
  -H 'Authorization: Bearer <accessToken>'
```

## Feature guides

- [Calendar invites](calendar-invites.md)
- [Tenant rules](tenant-rules.md)
- [Bots, recordings and providers](bot-providers.md)
