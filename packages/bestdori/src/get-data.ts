import { writeFile } from "node:fs/promises";
import path from "node:path";

import * as devalue from "devalue";
import type { z } from "zod";

import { bestdoriJSON } from ".";
import { Bands } from "./schema/bands";
import { Cards } from "./schema/cards";
import { Characters } from "./schema/characters";
import { Events } from "./schema/events";
import { Gacha, Gachas } from "./schema/gachas";
import { Songs } from "./schema/songs";

console.time("everything");

const time = async <T>(
	message: string,
	it: Promise<T> | (() => T),
): Promise<T> => {
	console.time(message);
	const result = it instanceof Promise ? await it : it();
	console.timeEnd(message);
	return result;
};

const SCHEMAS = {
	bands: Bands,
	cards: Cards,
	characters: Characters,
	events: Events,
	gachas: Gachas,
	songs: Songs,
} as const;

const get = async <K extends keyof typeof SCHEMAS>(
	key: K,
	pathname: string,
): Promise<z.infer<(typeof SCHEMAS)[K]>> => {
	const json = await time(
		`get ${key} (${pathname})`,
		bestdoriJSON(pathname, false),
	);
	return SCHEMAS[key].parseAsync(json) as never;
};

const [bands, cards, characters, events, gachas, songs] = await Promise.all([
	get("bands", "/api/bands/all.1.json"),
	get("cards", "/api/cards/all.5.json"),
	get("characters", "/api/characters/main.3.json"),
	get("events", "/api/events/all.5.json"),
	get("gachas", "/api/gacha/all.5.json"),
	get("songs", "/api/songs/all.5.json"),
]);

const data = await time("resolve references", () => ({
	bands,

	get cards() {
		return new Map(
			[...cards.entries()].map(([id, { characterId, ...entry }]) => [
				id,
				{
					get character() {
						return { id: characterId, ...data.characters.get(characterId)! };
					},
					...entry,
				},
			]),
		);
	},

	get characters() {
		return new Map(
			[...characters.entries()].map(([id, { bandId, ...entry }]) => [
				id,
				{
					get band() {
						return { id: bandId, ...data.bands.get(bandId)! };
					},
					...entry,
				},
			]),
		);
	},

	get events() {
		return new Map(
			[...events.entries()].map(([id, { characters, cards, ...entry }]) => [
				id,
				{
					get characters() {
						return characters.map((id) => ({
							id,
							...data.characters.get(id)!,
						}));
					},
					get cards() {
						return cards.map((id) => ({ id, ...data.cards.get(id)! }));
					},
					...entry,
				},
			]),
		);
	},

	get gachas() {
		const resolveRates = (rates: Gacha["rates"]["jp"]) => {
			if (!rates) return null;

			return rates.map(({ cardId, ...entry }) => ({
				get card() {
					return { id: cardId, ...data.cards.get(cardId)! };
				},
				...entry,
			}));
		};

		return new Map(
			[...gachas.entries()].map(
				([id, { rates, ...entry }]) =>
					[
						id,
						{
							get rates() {
								const { jp, en } = rates;
								return { jp: resolveRates(jp), en: resolveRates(en) };
							},
							...entry,
						},
					] as const,
			),
		);
	},

	get songs() {
		return new Map(
			[...songs.entries()].map(([id, { bandId, ...entry }]) => [
				id,
				{
					get band() {
						return { id: bandId, ...data.bands.get(bandId)! };
					},
					...entry,
				},
			]),
		);
	},
}));
export type Data = typeof data;

const keys = Object.keys(data).join(", ");
const content = await time("uneval data", () => devalue.uneval(data));
await time(
	"write data.js",
	writeFile(
		path.join(import.meta.dirname, "data.js"),
		`export const { ${keys} } = ${content};`,
	),
);

console.timeEnd("everything");
