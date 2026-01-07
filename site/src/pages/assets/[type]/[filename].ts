import type {
	APIRoute,
	GetStaticPaths,
	GetStaticPathsResult,
	InferGetStaticParamsType,
	InferGetStaticPropsType,
} from "astro";

import { bestdori } from "@bandori-index/bestdori";
import {
	attributes,
	bands,
	cards,
	characters,
	events,
	gachas,
	songs,
} from "@bandori-index/bestdori/data";
import { compressAudio } from "~/lib/preprocess/compress-audio";
import { compressImage } from "~/lib/preprocess/compress-image";
import { AUDIO_FORMAT, IMAGE_FORMAT } from "~/lib/preprocess/config";

export const prerender = true;

export const GET: APIRoute<Props, Params> = async ({ props, params }) => {
	const response = await bestdori(props.pathname, true);

	const filename = [params.type, params.filename].join("__");
	const buffer = Buffer.from(await response.arrayBuffer());
	switch (props.kind) {
		case "audio":
			return compressAudio(filename, buffer);

		case "image":
			return compressImage(filename, buffer);

		default:
			throw new Error(`invalid route ${JSON.stringify({ props, params })}`);
	}
};

export const getStaticPaths = (() => {
	const attributeAssets = [...attributes.values()].map(({ name, assets }) => ({
		params: { type: "attribute", filename: `${name}.svg` },
		props: { kind: "image" as const, pathname: assets.icon },
	})) satisfies GetStaticPathsResult;
	const bandAssets = [...bands.entries()]
		.filter(([id]) => [1, 2, 3, 4, 5, 18, 21, 45].includes(id))
		.map(([id, { assets }]) => ({
			params: { type: "band", filename: `${id}.svg` },
			props: { kind: "image" as const, pathname: assets.icon },
		})) satisfies GetStaticPathsResult;
	const characterAssets = [...characters.entries()].map(([id, { assets }]) => ({
		params: { type: "character", filename: `${id}.${IMAGE_FORMAT}` },
		props: { kind: "image" as const, pathname: assets.icon },
	})) satisfies GetStaticPathsResult;

	const cardAssets = [...cards.entries()].flatMap(([id, { assets }]) => {
		const audio = assets.voice
			? [
					{
						params: { type: "card", filename: `${id}.${AUDIO_FORMAT}` },
						props: { kind: "audio" as const, pathname: assets.voice },
					},
				]
			: [];

		const images = (["icon", "full"] as const).flatMap((variant) =>
			assets[variant].map(([trained, pathname]) => ({
				params: {
					type: "card",
					filename:
						[id, variant, trained ? "trained" : "base"].join("_") +
						".${IMAGE_FORMAT}",
				},
				props: { kind: "image" as const, pathname },
			})),
		);

		return [...audio, ...images];
	}) satisfies GetStaticPathsResult;

	const eventAssets = [...events.entries()].flatMap(([id, { assets }]) =>
		(["banner", "background"] as const).map((variant) => ({
			params: {
				type: "event",
				filename: [id, variant].join("_") + ".${IMAGE_FORMAT}",
			},
			props: { kind: "image" as const, pathname: assets[variant] },
		})),
	) satisfies GetStaticPathsResult;

	const gachaAssets = [...gachas.entries()].flatMap(([id, { assets }]) =>
		(["logo", "banner"] as const)
			.filter((variant) => assets[variant] !== undefined)
			.map((variant) => ({
				params: {
					type: "gacha",
					filename: [id, variant].join("_") + ".${IMAGE_FORMAT}",
				},
				props: { kind: "image" as const, pathname: assets[variant]! },
			})),
	) satisfies GetStaticPathsResult;

	const songAssets = [...songs.entries()].flatMap(([id, { assets }]) => [
		{
			params: { type: "song", filename: `${id}.${AUDIO_FORMAT}` },
			props: { kind: "audio" as const, pathname: assets.audio },
		},
		...assets.cover.map((pathname, idx) => ({
			params: { type: "song", filename: `${id}_${idx}.${IMAGE_FORMAT}` },
			props: { kind: "image" as const, pathname },
		})),
	]) satisfies GetStaticPathsResult;

	return [
		...attributeAssets,
		...bandAssets,
		...characterAssets,
		...cardAssets,
		...eventAssets,
		...gachaAssets,
		...songAssets,
	] as const;
}) satisfies GetStaticPaths;

type Props = InferGetStaticPropsType<typeof getStaticPaths>;
type Params = InferGetStaticParamsType<typeof getStaticPaths>;
