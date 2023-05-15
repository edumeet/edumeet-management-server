# Edumeet management server

> This is the management service for the edumeet service.

## About

This project uses [Feathers](http://feathersjs.com). An open source framework for building APIs and real-time applications.

## Getting Started

0. Postgress and application config 
```
docker run  --name edumeet-db -p 5432:5432 -e POSTGRES_PASSWORD=edumeet -d postgres
docker exec -it edumeet-db sh
psql postgres://postgres:edumeet@localhost:5432/
create database edumeet;
exit
exit
```
1. Make sure you have [NodeJS](https://nodejs.org/) and [npm](https://www.npmjs.com/) installed.

2. Install your dependencies

    ```
    cd path/to/edumeet-management-server
    npm install
    ```

3. Start the service

    ```
    npm run compile # Compile TypeScript source
    npm run migrate # Run migrations to set up the database
    npm start
    ```

## Testing

Run `npm test` and all your tests in the `test/` directory will be run.

## Dev tips for testing 

### add user 
curl 'http://edumeet.sth.sze.hu:3030/users/' \
  -H 'Content-Type: application/json' \
  --data-binary '{ "email": "edumeet@edu.meet", "password": "edumeet" }'
### auth with user 
curl 'http://edumeet.sth.sze.hu:3030/authentication/' \
  -H 'Content-Type: application/json' \
  --data-binary '{ "strategy": "local", "email": "edumeet@edu.meet", "password": "edumeet" }'

### use user with jwt
curl 'http://edumeet.sth.sze.hu:3030/roomOwners/' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <accessToken>' 

## Scaffolding

This app comes with a powerful command line interface for Feathers. Here are a few things it can do:

```
$ npx feathers help                           # Show all commands
$ npx feathers generate service               # Generate a new Service
```

## Help

For more information on all the things you can do with Feathers visit [docs.feathersjs.com](http://docs.feathersjs.com).
