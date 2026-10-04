import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

import solidJs from "@astrojs/solid-js";

export default defineConfig({
	site: "https://pico4.wiki",
	integrations: [
		starlight({
			title: "pico4.wiki",
			social: [
				{
					icon: "github",
					label: "GitHub",
					href: "//github.com/pico4wiki/wiki",
				},
				{
					icon: "discord",
					label: "Discord",
					href: "//discord.gg/GKGQxQXw7X",
				},
			],
			editLink: {
				baseUrl: "https://github.com/pico4wiki/wiki/edit/master/",
			},
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
							label: "Rooting",
							items: [
								{ label: "Rooting", slug: "guides/root/01-root" },
								{ label: "Post-Root Suggestions", slug: "guides/root/02-post-root" },
								{ label: "Unrooting", slug: "guides/root/03-unroot" },
							],
						},
						{
							label: "Face Tracking",
							items: [
								{ label: "Baballonia", slug: "guides/ft/baballonia" },
								{ label: "VRCFT without PICO Connect", slug: "guides/ft/vrcft-stream" },
							],
						},
					],
				},
				{
					label: "Utilities",
					items: [
						{ label: "Downloads", slug: "downloads" },
						{ label: "Debloating Tool", slug: "debloat" },
					],
				},
			],
			customCss: ["/src/styles/components.css"],
		}),
		solidJs(),
	],
});
