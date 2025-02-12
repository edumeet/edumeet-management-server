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
Install your dependencies
```
yarn
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

### Add user 
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
