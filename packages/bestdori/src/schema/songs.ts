import z from "zod";

import { bestdori } from "..";
import { Id, SongDifficulty } from "./constants";
import { dateTimestamp, parseRegionTuple } from "./helpers";

// /api/songs/all.5.json
export const Songs = z
	.record(
		z.string(),
		z.object({ musicTitle: z.string().apply(parseRegionTuple) }),
	)
	.transform(async (songs) => {
		const entries = await Promise.all(
			Object.entries(songs)
				.filter(([, { musicTitle }]) => !!musicTitle.jp || !!musicTitle.en)
				.map(
					async ([id]) =>
						[
							Number(id),
							await bestdori(`/api/songs/${id}.json`)
								.then((response) => response.json())
								.then(Song.parse),
						] as const,
				),
		);

		return new Map(entries);
	})
	.readonly();

// /api/songs/$id.json
export const Song = z
	.object({
		tag: z.enum(["normal", "anime", "tie_up"]),
		bandId: Id,
		jacketImage: z.array(z.string()),
		musicTitle: z.string().apply(parseRegionTuple),
		publishedAt: dateTimestamp.apply(parseRegionTuple),
		difficulty: z
			.record(z.string(), z.object({ playLevel: z.number().positive() }))
			.pipe(
				z.preprocess(
					(difficultyMap) =>
						Object.fromEntries(
							Object.entries(difficultyMap).map(
								([difficulty, { playLevel }]) => [difficulty, playLevel],
							),
						),
					z.record(SongDifficulty, z.number().positive()),
				),
			),
	})
	.transform(({ musicTitle: title, ...entry }) => ({ title, ...entry }))
	.readonly();

export type Songs = z.infer<typeof Songs>;
export type Song = z.infer<typeof Song>;
