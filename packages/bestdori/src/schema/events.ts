import z from "zod";

import { bestdori } from "..";
import { CardAttribute, EventType, Id } from "./constants";
import { dateTimestamp, parseRegionTuple } from "./helpers";

// /api/events/all.5.json
export const Events = z
	.record(
		z.string(),
		z.object({ eventName: z.string().apply(parseRegionTuple) }),
	)
	.transform(async (cards) => {
		const entries = await Promise.all(
			Object.entries(cards)
				.filter(([, { eventName }]) => !!eventName.jp)
				.map(
					async ([id]) =>
						[
							Number(id),
							await bestdori(`/api/events/${id}.json`)
								.then((response) => response.json())
								.then(Event.parse),
						] as const,
				),
		);

		return new Map(entries);
	})
	.readonly();

// /api/events/$id.json
export const Event = z
	.object({
		eventType: EventType,
		eventName: z.string().apply(parseRegionTuple),
		assetBundleName: z.string().nonempty(),
		bannerAssetBundleName: z.string(),
		startAt: dateTimestamp.apply(parseRegionTuple),
		endAt: dateTimestamp.apply(parseRegionTuple),

		attributes: z.tuple([z.object({ attribute: CardAttribute })]),
		characters: z.array(z.object({ characterId: Id })),
		members: z.array(z.object({ situationId: Id })),
	})
	.transform(
		({
			eventName: name,
			eventType: type,
			attributes: [{ attribute }],
			characters,
			members,
			...entry
		}) => ({
			name: { jp: name.jp!, en: name.en },
			type,
			attribute,
			characters: characters.map(({ characterId }) => characterId),
			cards: members.map(({ situationId }) => situationId),
			...entry,
		}),
	)
	.readonly();

export type Events = z.infer<typeof Events>;
export type Event = z.infer<typeof Event>;
