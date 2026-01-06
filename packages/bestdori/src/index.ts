import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { limitFunction } from "p-limit";

const CACHE_DIR = path.join(import.meta.dirname, "..", ".bestdori-cache");
if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR);

export const bestdori = limitFunction(
	async (pathname: string, cache: boolean = true) => {
		const url = new URL(pathname, "https://bestdori.com");

		const cachePath = path.join(CACHE_DIR, pathname.replaceAll("/", "_"));
		if (cache && existsSync(cachePath)) {
			return new Response(readFileSync(cachePath));
		}

		const response = await fetch(url);
		const isHTML = response.headers.get("content-type") === "text/html";
		if (!response.ok || isHTML) {
			throw new Error(`request to ${url.href} failed`);
		}

		if (cache) {
			const data = await response.clone().arrayBuffer();
			writeFileSync(cachePath, Buffer.from(data));
		}

		return response;
	},
	{ concurrency: 4 },
);
