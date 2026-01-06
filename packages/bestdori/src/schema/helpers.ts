import z from "zod";

export const parseRegionTuple = <T extends z.ZodType>(schema: T) => {
	const nullable = schema.nullable();
	const tuple = z.tuple([nullable, nullable, nullable, nullable, nullable]);

	return tuple.pipe(
		z.preprocess(
			([jp, en]) => ({ jp, en }),
			z.record(z.enum(["jp", "en"]), nullable),
		),
	);
};

export const dateTimestamp = z.coerce.number().transform((it) => new Date(it));
