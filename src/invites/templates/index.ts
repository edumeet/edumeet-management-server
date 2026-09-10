import { InviteStrings, InviteTemplate } from './types';
import { fromStrings } from './render';
import { enStrings } from './en';
import { deStrings } from './de';
import { plStrings } from './pl';
import { csStrings } from './cs';
import { dkStrings } from './dk';
import { elStrings } from './el';
import { esStrings } from './es';
import { frStrings } from './fr';
import { hiStrings } from './hi';
import { hrStrings } from './hr';
import { huStrings } from './hu';
import { itStrings } from './it';
import { kkStrings } from './kk';
import { lvStrings } from './lv';
import { nbStrings } from './nb';
import { ptStrings } from './pt';
import { roStrings } from './ro';
import { ruStrings } from './ru';
import { trStrings } from './tr';
import { ukStrings } from './uk';
import { cnStrings } from './cn';
import { twStrings } from './tw';

// Locale keys match the file codes used by edumeet-client (src/utils/intlManager.tsx).
// Anything not in this map falls through to English — getTemplate is tolerant by design.
const strings: Record<string, InviteStrings> = {
	en: enStrings,
	de: deStrings,
	pl: plStrings,
	cs: csStrings,
	dk: dkStrings,
	el: elStrings,
	es: esStrings,
	fr: frStrings,
	hi: hiStrings,
	hr: hrStrings,
	hu: huStrings,
	it: itStrings,
	kk: kkStrings,
	lv: lvStrings,
	nb: nbStrings,
	pt: ptStrings,
	ro: roStrings,
	ru: ruStrings,
	tr: trStrings,
	uk: ukStrings,
	cn: cnStrings,
	tw: twStrings
};

const templates: Record<string, InviteTemplate> = Object.fromEntries(
	Object.entries(strings).map(([ locale, s ]) => [ locale, fromStrings(s) ])
);

export const getTemplate = (locale: string): InviteTemplate => {
	return templates[locale] ?? templates.en;
};

export const getStrings = (locale: string): InviteStrings => {
	return strings[locale] ?? strings.en;
};

export const templateLocales = (): string[] => Object.keys(strings);

export type { InviteTemplate, InviteContext, InviteStrings, EventDescription } from './types';
