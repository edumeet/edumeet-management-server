// For more information about this file see https://dove.feathersjs.com/guides/cli/logging.html
import { createLogger, format, transports } from 'winston';

// Configure the Winston logger. For the complete documentation see https://github.com/winstonjs/winston
// Level is controlled by the LOG_LEVEL environment variable (e.g. 'debug', 'info', 'warn', 'error').
// Defaults to 'info'. Same convention as edumeet-common/src/Logger.ts.
export const logger = createLogger({
	level: process.env.LOG_LEVEL || 'info',
	format: format.combine(format.splat(), format.simple()),
	transports: [ new transports.Console() ]
});
