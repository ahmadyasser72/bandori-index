import z from "zod";

import { bestdoriJSON } from "..";
import { CardRarity, GachaType, Id } from "./constants";
import { dateTimestamp, parseRegionTuple } from "./helpers";

// /api/gacha/$id.json
export const Gacha = z
	.object({
		type: GachaType,
		gachaName: z.string().apply(parseRegionTuple),
		resourceName: z.string(),
		bannerAssetBundleName: z.string().optional(),
		publishedAt: dateTimestamp.apply(parseRegionTuple),
		closedAt: dateTimestamp.apply(parseRegionTuple),

		newCards: z.array(Id),
		details: z
			.record(
				Id,
				z.object({
					rarityIndex: CardRarity,
					weight: z.number().nonnegative(),
					pickup: z.boolean(),
				}),
			)
			.apply(parseRegionTuple),
		rates: z
			.partialRecord(
				CardRarity,
				z.object({
					rate: z.number().nonnegative(),
					weightTotal: z.number().nonnegative(),
				}),
			)
			.apply(parseRegionTuple),
	})
	.transform(({ type, gachaName: name, details, rates, ...entry }) => {
		const parseGachaRate = (region: keyof typeof details) => {
			const cards = details[region];
			const weights = rates[region];
			if (!cards || !weights) return null;

			return !!cards
				? new Map(
						Object.entries(cards)
							.filter(([, { pickup }]) => pickup)
							.map(([id, { rarityIndex: rarity, weight, pickup }]) => {
								const { rate, weightTotal } = weights[rarity]!;
								const weightedRate = (weight / weightTotal) * rate;
								return [
									Number(id),
									{
										pickup,
										rarity,
										rate:
											Math.round((weightedRate + Number.EPSILON) * 100) / 100,
									},
								] as const;
							}),
					)
				: null;
		};

		return {
			name: { jp: name.jp!, en: name.en },
			type,
			rates: { jp: parseGachaRate("jp"), en: parseGachaRate("en") },
			...entry,
		};
	})
	.readonly();

// /api/gacha/all.5.json
export const Gachas = z
	.record(
		z.string(),
		z.object({
			gachaName: z.string().apply(parseRegionTuple),
			type: GachaType,
		}),
	)
	.pipe(
		z.preprocess(async (gachas) => {
			const allowedGachas = new Set([
				"permanent",
				"limited",
				"dreamfes",
				"birthday",
				"kirafes",
			]);

			const entries = await Promise.all(
				Object.entries(gachas)
					.filter(
						([, { gachaName, type }]) =>
							!!gachaName.jp && allowedGachas.has(type),
					)
					.map(
						async ([id]) =>
							[id, await bestdoriJSON(`/api/gacha/${id}.json`)] as const,
					),
			);

			return new Map(entries);
		}, z.map(Id, Gacha).readonly()),
	);

export type Gachas = z.infer<typeof Gachas>;
export type Gacha = z.infer<typeof Gacha>;
