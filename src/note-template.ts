export const DEFAULT_TEMPLATE = `# {{title}}

- **Date**: {{date}}
- **Time**: {{time}}
- **App**: {{app}}

## Attendees

-

## Agenda

-

## Notes



## Action Items

- [ ]
`;

export interface TemplateVariables {
	date: string;
	time: string;
	app: string;
	title: string;
}

/** Replaces `{{date}}`, `{{time}}`, `{{app}}` and `{{title}}` in one pass, so values are never expanded again. */
export function fillTemplate(content: string, vars: TemplateVariables): string {
	return content.replace(
		/\{\{(date|time|app|title)\}\}/g,
		(_match, key: keyof TemplateVariables) => vars[key]
	);
}

/** Vault path of a note named `baseName` in `folder` (empty or "/" means the vault root). */
export function notePath(folder: string, baseName: string): string {
	const dir = folder.trim().replace(/^\/+|\/+$/g, "");
	return dir ? `${dir}/${baseName}.md` : `${baseName}.md`;
}
