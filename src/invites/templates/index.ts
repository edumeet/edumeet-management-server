import { InviteTemplate } from './types';
import { enTemplate } from './en';
import { deTemplate } from './de';
import { plTemplate } from './pl';

const templates: Record<string, InviteTemplate> = {
	en: enTemplate,
	de: deTemplate,
	pl: plTemplate
};

export const getTemplate = (locale: string): InviteTemplate => {
	return templates[locale] ?? templates.en;
};

export type { InviteTemplate, InviteContext } from './types';
