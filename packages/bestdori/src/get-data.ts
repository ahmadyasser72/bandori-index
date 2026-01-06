import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

import * as devalue from "devalue";

import { bestdori } from ".";
import { Bands } from "./schema/bands";
import { Cards } from "./schema/cards";
import { Characters } from "./schema/characters";
import { Events } from "./schema/events";
import { Gachas } from "./schema/gachas";

const DATA_ENTRIES = [
	["bands", "/api/bands/all.1.json", Bands],
	["cards", "/api/cards/all.5.json", Cards],
	["characters", "/api/characters/main.3.json", Characters],
	["events", "/api/events/all.5.json", Events],
	["gachas", "/api/gacha/all.5.json", Gachas],
] as const;

const data = Object.fromEntries(
	await Promise.all(
		DATA_ENTRIES.map(async ([name, pathname, schema]) => {
			const json = await bestdori(pathname).then((response) => response.json());
			const data = await schema.parseAsync(json);

			return [name, data] as const;
		}),
	),
);

const keys = Object.keys(data).join(", ");
const content = devalue.uneval(data);
writeFileSync(
	path.join(import.meta.dirname, "data.js"),
	`export const { ${keys} } = ${content};`,
);
