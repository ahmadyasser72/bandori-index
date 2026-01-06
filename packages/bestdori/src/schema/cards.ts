import z from "zod";

import { bestdori } from "..";
import { CardAttribute, CardRarity, CardType, Id } from "./constants";
import { dateTimestamp, parseRegionTuple } from "./helpers";

// /api/cards/all.5.json
export const Cards = z
	.record(z.string(), z.object({ prefix: z.string().apply(parseRegionTuple) }))
	.transform(async (cards) => {
		const entries = await Promise.all(
			Object.entries(cards)
				.filter(([, { prefix }]) => !!prefix.jp)
				.map(
					async ([id]) =>
						[
							Number(id),
							await bestdori(`/api/cards/${id}.json`)
								.then((response) => response.json())
								.then(Card.parse),
						] as const,
				),
		);

		return new Map(entries);
	})
	.readonly();

// /api/cards/$id.json
export const Card = z
	.object({
		characterId: Id,
		rarity: CardRarity,
		attribute: CardAttribute,
		type: CardType,
		resourceSetName: z.string(),
		prefix: z.string().apply(parseRegionTuple),
		releasedAt: dateTimestamp.apply(parseRegionTuple),
	})
	.transform(({ prefix: name, ...entry }) => ({
		...entry,
		name: { jp: name.jp!, en: name.en },
	}))
	.readonly();

export type Cards = z.infer<typeof Cards>;
export type Card = z.infer<typeof Card>;
