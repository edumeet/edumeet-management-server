// A room's or tenant's background and logo reach every participant's page; the background as
// CSS url(). Empty, an absolute http(s) URL or a path, without the characters that can end
// url() or a CSS rule. The columns hold 255 characters.
export const IMAGE_URL_MAX_LENGTH = 255;

// Opens a character class of everything except white space, quotes, ( ) < > { } ; and \.
const CSS_SAFE = '[^\\s"\'()<>{};\\\\';

export const IMAGE_URL_PATTERN = [
	'^(',
	`https?://${CSS_SAFE}]+`,
	`|/(?!/)${CSS_SAFE}:]*`,
	`|[A-Za-z0-9._~-]${CSS_SAFE}:]*`,
	')?$'
].join('');
