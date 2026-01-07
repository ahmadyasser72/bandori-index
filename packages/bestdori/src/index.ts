import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { limitFunction } from "p-limit";

const CACHE_DIR = path.join(import.meta.dirname, "..", ".bestdori-cache");
if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR);

const fetch = limitFunction(globalThis.fetch, { concurrency: 4 });

export const bestdori = async <T = never>(
	pathname: string,
	isFresh?: (cached: T) => boolean,
) => {
	const url = new URL(pathname, "https://bestdori.com");

	const cachePath = path.join(CACHE_DIR, pathname.replaceAll("/", "_"));
	if (existsSync(cachePath)) {
		const cached = readFileSync(cachePath);
		if (isFresh === undefined || isFresh(JSON.parse(cached.toString())))
			return new Response(cached);
	}

	const response = await fetch(url);
	const isHTML = response.headers.get("content-type") === "text/html";
	if (!response.ok || isHTML) {
		throw new Error(`request to ${url.href} failed`);
	}

	const data = await response.clone().arrayBuffer();
	writeFileSync(cachePath, Buffer.from(data));

	return response;
};

export const bestdoriJSON = <T = unknown>(
	...args: Parameters<typeof bestdori<T>>
) => bestdori(...args).then((response) => response.json() as Promise<T>);
