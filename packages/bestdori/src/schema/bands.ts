import z from "zod";

import { parseRegionTuple } from "./helpers";

// /api/bands/all.1.json
export const Bands = z
	.record(
		z.string(),
		z.object({ bandName: z.string().apply(parseRegionTuple) }),
	)
	.transform((bands) => {
		const entries = Object.entries(bands)
			.filter(([, { bandName }]) => !!bandName.jp)
			.map(([id, { bandName }]) => [Number(id), bandName] as const);

		return new Map(entries);
	})
	.readonly();

export type Bands = z.infer<typeof Bands>;
