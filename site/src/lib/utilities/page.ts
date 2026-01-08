import type { APIContext } from "astro";

import { z } from "zod";

const PageSchema = z.coerce.number().positive().catch(1);
export const getPage = (context: APIContext) =>
	PageSchema.parse(context.url.searchParams.get("page"));

interface PaginateOptions<T> {
	items: T[];
	page: number;
	size?: number;
}
export const paginate = <T>({ items, page, size = 12 }: PaginateOptions<T>) => {
	const offset = page * size;
	return {
		items: items.slice(offset, offset + size),
		nextPage: offset + size < items.length ? page + 1 : undefined,
	};
};
