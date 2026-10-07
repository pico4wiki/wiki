import {openAdb} from "../scripts/adb.ts";
import {type Firmware, getFullFirmwareInfo} from "../scripts/headsetVersion.ts";
import {type Component, createEffect, createResource, createSignal, For, Show, Switch, Match} from "solid-js";
import {Aside} from "@astrojs/starlight/components";

const PickFamily: Component<{ setFamily: (f: Firmware["family"]) => void }> = (props) => (
	<For each={[["sparrow", "PICO 4 Ultra"], ["phoenix", "PICO 4"], ["neo3", "PICO Neo3"], ["merline", "PICO G3"]] as const}>
		{([code, pretty]) => <button onclick={() => props.setFamily(code)}>{pretty}</button>}
	</For>
)

const PickP4Variant: Component<{ setVariant: (v: Firmware["variant"]) => void }> = (props) => (<>
	Please connect your headset to your PC, and run the following ADB command: <code>adb shell getprop ro.oem.state</code>,
	and select the output:

	<button onclick={() => props.setVariant("SEKO")}>true (SEKO)</button>
	<button onclick={() => props.setVariant("SEK")}>false (SEK)</button>
</>)

const PickPN3Variant: Component<{ setVariant: (v: Firmware["variant"]) => void }> = (props) => (<>
	Please connect your headset to your PC, and run the following ADB command: <code>adb shell getprop ro.secure.boot.tag</code>,
	and select the output:

	<button onclick={() => props.setVariant("SEK")}>true (SEK)</button>
	<button onclick={() => props.setVariant("K")}>false (K)</button>
</>)

const PickRegion: Component<{ setRegion: (r: Firmware["region"]) => void }> = (props) => (<>
	<button onclick={() => props.setRegion("china")}>China</button>
	<button onclick={() => props.setRegion("overseas")}>Rest of World</button>
</>);

export default () => {
	const [headsetFirmware, actions] = createResource(async () => {
		const adb = await openAdb();
		return adb && await getFullFirmwareInfo(adb);
	});

	const [region, setRegion] = createSignal<Firmware["region"]>();
	const [family, setFamily] = createSignal<Firmware["family"]>();
	const [variant, setVariant] = createSignal<Firmware["variant"]>();

	createEffect(() => headsetFirmware.state === "ready" && setRegion(headsetFirmware()?.region));
	createEffect(() => headsetFirmware.state === "ready" && setFamily(headsetFirmware()?.family));
	createEffect(() => headsetFirmware.state === "ready" && setVariant(headsetFirmware()?.variant));

	return <>
		<button onclick={actions.refetch}>Auto-detect</button>

		<Show when={headsetFirmware.state === "errored"}>
			Headset auto-detection failed: {headsetFirmware.error}
		</Show>

		<Show when={region()} fallback={<PickRegion setRegion={setRegion} />}>
			<Switch fallback={<PickFamily setFamily={setFamily} />}>
				<Match when={family() === "sparrow"}>
					{region() === "china" ? "🐉" : "🌍"} pico 4 ultra stuff idk
				</Match>
				<Match when={family() === "phoenix"}>
					<Show when={variant()} fallback={<PickP4Variant setVariant={setVariant} />}>
						{region() === "china" ? "🐉" : "🌍"} pico 4 {variant()} stuff idk
					</Show>
				</Match>
				<Match when={family() === "neo3"}>
					<Show when={variant()} fallback={<PickPN3Variant setVariant={setVariant} />}>
						{region() === "china" ? "🐉" : "🌍"} pico Neo3 {variant()} stuff idk
					</Show>
				</Match>
				<Match when={family() === "merline"}>
					{region() === "china" ? "🐉" : "🌍"} pico G3 stuff idk
				</Match>
			</Switch>
		</Show>
	</>;
}
