// For more information about this file see https://dove.feathersjs.com/guides/cli/application.html
import { feathers } from '@feathersjs/feathers';
import { OAuthService } from '@feathersjs/authentication-oauth/lib/service';
import configuration from '@feathersjs/configuration';
import { koa, rest, bodyParser, errorHandler, parseAuthentication, cors, serveStatic } from '@feathersjs/koa';
import socketio from '@feathersjs/socketio';

import type { Application, HookContext } from './declarations';
import { configurationValidator } from './configuration';
import { logError } from './hooks/log-error';
import { postgresql } from './postgresql';
import { authentication } from './authentication';
import { services } from './services/index';
import { channels } from './channels';
// import { setDebug } from '@feathersjs/commons';

// eslint-disable-next-line no-console
// setDebug(() => console.log);

const app: Application = koa(feathers());

// Load our app configuration (see config/ folder)
app.configure(configuration(configurationValidator));

// Set up Koa middleware
app.use(cors());
app.use(serveStatic(app.get('public')));
app.use(errorHandler());
app.use(parseAuthentication());
app.use(bodyParser());

// Configure services and transports
app.configure(rest());
app.configure(socketio({ cors: { origin: app.get('origins') } }));
app.configure(postgresql);
app.configure(authentication);
app.configure(services);
app.configure(channels);

// Register hooks that run on all service methods
app.hooks({
	around: {
		all: [ logError ]
	},
	before: {
		find: [ async (context: HookContext) => {
			if (context.service instanceof OAuthService) {
				const { tenantId } = context.params.query;

				if (!tenantId) throw new Error('Missing tenantId');

				const { total, data } = await app.service('tenantOAuths').find({ query: { tenantId } });

				if (total === 0) throw new Error('Missing OAuth configuration');

				// eslint-disable-next-line camelcase
				const { key, secret, authorize_url, access_url, profile_url, scope, scope_delimiter } = data[0];

				if (!key) throw new Error('Missing OAuth key');
				if (!secret) throw new Error('Missing OAuth secret');
				if (!scope) throw new Error('Missing OAuth scope');
				// eslint-disable-next-line camelcase
				if (!authorize_url) throw new Error('Missing OAuth authorize_url');
				// eslint-disable-next-line camelcase
				if (!access_url) throw new Error('Missing OAuth access_url');
				// eslint-disable-next-line camelcase
				if (!profile_url) throw new Error('Missing OAuth profile_url');
				// eslint-disable-next-line camelcase
				if (!scope_delimiter) throw new Error('Missing OAuth scope_delimiter');

				context.params.query.key = key;
				context.params.query.secret = secret;
				context.params.query.scope = scope;
				// eslint-disable-next-line camelcase
				context.params.query.authorize_url = authorize_url;
				// eslint-disable-next-line camelcase
				context.params.query.access_url = access_url;
				// eslint-disable-next-line camelcase
				context.params.query.profile_url = profile_url;
				// eslint-disable-next-line camelcase
				context.params.query.scope_delimiter = scope_delimiter;
			}
		} ],
	},
	after: {},
	error: {}
});
// Register application setup and teardown hooks here
app.hooks({
	setup: [],
	teardown: []
});

export { app };
