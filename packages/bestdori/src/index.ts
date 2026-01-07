import { exists, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { limitFunction } from "p-limit";

const CACHE_DIR = path.join(import.meta.dirname, "..", ".bestdori-cache");
const cacheDirExists = await exists(CACHE_DIR);
if (!cacheDirExists) await mkdir(CACHE_DIR);

const fetch = limitFunction(globalThis.fetch, { concurrency: 4 });

export const bestdori = async <T = never>(
	pathname: string,
	skipFetch: ((cached: T) => boolean) | boolean,
) => {
	const url = new URL(pathname, "https://bestdori.com");

	const cachePath = path.join(CACHE_DIR, pathname.replaceAll("/", "_"));
	const alreadyCached = await exists(cachePath);
	if (skipFetch !== false && alreadyCached) {
		const cached = await readFile(cachePath);
		if (skipFetch === true || skipFetch(JSON.parse(cached.toString())))
			return new Response(cached);
	}

	const response = await fetch(url);
	const isHTML = response.headers.get("content-type") === "text/html";
	if (!response.ok || isHTML) {
		throw new Error(`request to ${url.href} failed`);
	}

	const data = await response.clone().arrayBuffer();
	await writeFile(cachePath, Buffer.from(data));

	return response;
};

export const bestdoriJSON = <T = unknown>(
	...args: Parameters<typeof bestdori<T>>
) => bestdori(...args).then((response) => response.json() as Promise<T>);
