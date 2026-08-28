import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
	site: "https://pico4.wiki",
	integrations: [
		starlight({
			title: "pico4.wiki",
			sidebar: [
				{
					label: "Required reading",
					items: [
						{ label: "List of devices", slug: "devices" },
					],
				},
				{
					label: "Guides",
					items: [
						{ label: "Sideloading an OTA image", slug: "guides/ota" },
						{
							label: "Rooting your device",
							items: [
								{ label: "Rooting", slug: "guides/root/01-root" },
								{ label: "Unrooting", slug: "guides/root/02-unroot" },
							],
						},
						{
							label: "Face Tracking",
							items: [
								{ label: "Baballonia", slug: "guides/ft/baballonia" },
								{ label: "VRCFT without PICO Connect", slug: "guides/ft/vrcft-stream" },
							]
						},
					],
				},
				{
					label: "Additional Info",
					items: [
						{ label: "Downloads", slug: "downloads" },
					],
				},
			],
		}),
	],
});
