import { writeFile } from "node:fs/promises";
import path from "node:path";

import * as devalue from "devalue";
import type { z } from "zod";

import { bestdoriJSON } from ".";
import { Bands } from "./schema/bands";
import { Cards } from "./schema/cards";
import { Characters } from "./schema/characters";
import { CardAttribute } from "./schema/constants";
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

const resourceNameList = await time(
	"fetch resourceNameList",
	Promise.all(
		["birthdayspin", "limitedspin", "operationspin", "spin"].map(
			(resourceName) =>
				bestdoriJSON<string[]>(
					`/api/explorer/jp/assets/sound/voice/gacha/${resourceName}.json`,
					false,
				).then((values) => ({
					resourceName,
					values: new Set(
						values
							.filter((it) => it.endsWith("mp3"))
							.map((it) => it.replace(".mp3", "")),
					),
				})),
		),
	),
);

const data = await time("resolve references", () => ({
	get attributes() {
		return new Map(
			CardAttribute.options.map((name) => [
				name,
				{ name, assets: { icon: `/res/icon/${name}.svg` } },
			]),
		);
	},

	get bands() {
		return new Map(
			[...bands.entries()].map(([id, entry]) => [
				id,
				{ ...entry, assets: { icon: `/res/icon/band_${id}.svg` } },
			]),
		);
	},

	get cards() {
		return new Map(
			[...cards.entries()].map(
				([
					id,
					{ characterId, attribute, resourceSetName, training, ...entry },
				]) => [
					id,
					{
						get character() {
							return { id: characterId, ...data.characters.get(characterId)! };
						},
						get attribute() {
							return data.attributes.get(attribute)!;
						},
						...entry,

						get assets() {
							const { resourceName } =
								resourceNameList.find(({ values }) =>
									values.has(resourceSetName),
								) ?? {};

							const out = {
								voice: resourceName
									? `/assets/jp/sound/voice/gacha/${resourceName}_rip/${resourceSetName}.mp3`
									: undefined,
								icon: [] as string[],
								full: [] as string[],
							};

							const icon = (trained: boolean) => {
								const chunkId = Math.floor(id / 50)
									.toString()
									.padStart(5, "0");

								return `/assets/jp/thumb/chara/card${chunkId}_rip/${resourceSetName}_${trained ? "after_training" : "normal"}.png`;
							};
							const full = (trained: boolean) => {
								return `/assets/jp/characters/resourceset/${resourceSetName}_rip/card_${trained ? "after_training" : "normal"}.png`;
							};

							const noTrained = training === undefined;
							const noPreTrained = training?.levelLimit === 0;
							if (noTrained) {
								out.icon.push(icon(false));
								out.full.push(full(false));
							} else if (noPreTrained) {
								out.icon.push(icon(true));
								out.full.push(full(true));
							} else {
								out.icon.push(icon(false), icon(true));
								out.full.push(full(false), icon(true));
							}

							return out;
						},
					},
				],
			),
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

					assets: { icon: `/res/icon/chara_icon_${id}.png` },
				},
			]),
		);
	},

	get events() {
		return new Map(
			[...events.entries()].map(
				([id, { attribute, characters, cards, assetBundleName, ...entry }]) => [
					id,
					{
						get attribute() {
							return data.attributes.get(attribute)!;
						},
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

						assets: {
							banner: `/assets/jp/event/${assetBundleName}/images_rip/banner.png`,
							background: `/assets/jp/event/${assetBundleName}/topscreen_rip/bg_eventtop.png`,
						},
					},
				],
			),
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
				([id, { rates, resourceName, bannerAssetBundleName, ...entry }]) =>
					[
						id,
						{
							get rates() {
								const { jp, en } = rates;
								return { jp: resolveRates(jp), en: resolveRates(en) };
							},
							...entry,

							assets: {
								logo: `/assets/jp/gacha/screen/${resourceName}_rip/logo.png`,
								banner: bannerAssetBundleName
									? `/assets/jp/homebanner_rip/${bannerAssetBundleName}.png`
									: undefined,
							},
						},
					] as const,
			),
		);
	},

	get songs() {
		return new Map(
			[...songs.entries()].map(
				([id, { bandId, bgmId, jacketImage, ...entry }]) => [
					id,
					{
						get band() {
							return { id: bandId, ...data.bands.get(bandId)! };
						},
						...entry,

						get assets() {
							const chunk = 10 * Math.ceil(id / 10);
							return {
								audio: `/assets/jp/sound/${bgmId}_rip/${bgmId}.mp3`,
								cover: jacketImage.map(
									(id) =>
										`/assets/jp/musicjacket/musicjacket${chunk}_rip/assets-star-forassetbundle-startapp-musicjacket-musicjacket${chunk}-${id}-jacket.png`,
								),
							};
						},
					},
				],
			),
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
