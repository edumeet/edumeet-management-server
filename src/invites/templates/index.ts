import { InviteTemplate } from './types';
import { enTemplate } from './en';
import { deTemplate } from './de';
import { plTemplate } from './pl';
import { csTemplate } from './cs';
import { dkTemplate } from './dk';
import { elTemplate } from './el';
import { esTemplate } from './es';
import { frTemplate } from './fr';
import { hiTemplate } from './hi';
import { hrTemplate } from './hr';
import { huTemplate } from './hu';
import { itTemplate } from './it';
import { kkTemplate } from './kk';
import { lvTemplate } from './lv';
import { nbTemplate } from './nb';
import { ptTemplate } from './pt';
import { roTemplate } from './ro';
import { ruTemplate } from './ru';
import { trTemplate } from './tr';
import { ukTemplate } from './uk';
import { cnTemplate } from './cn';
import { twTemplate } from './tw';

// Locale keys match the file codes used by edumeet-client (src/utils/intlManager.tsx).
// Anything not in this map falls through to English — getTemplate is tolerant by design.
const templates: Record<string, InviteTemplate> = {
	en: enTemplate,
	de: deTemplate,
	pl: plTemplate,
	cs: csTemplate,
	dk: dkTemplate,
	el: elTemplate,
	es: esTemplate,
	fr: frTemplate,
	hi: hiTemplate,
	hr: hrTemplate,
	hu: huTemplate,
	it: itTemplate,
	kk: kkTemplate,
	lv: lvTemplate,
	nb: nbTemplate,
	pt: ptTemplate,
	ro: roTemplate,
	ru: ruTemplate,
	tr: trTemplate,
	uk: ukTemplate,
	cn: cnTemplate,
	tw: twTemplate
};

export const getTemplate = (locale: string): InviteTemplate => {
	return templates[locale] ?? templates.en;
};

export type { InviteTemplate, InviteContext } from './types';
