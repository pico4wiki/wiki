import {openAdb} from "../scripts/adb.ts";
import {type Firmware, getFullFirmwareInfo} from "../scripts/headsetVersion.ts";
import {type Component, createEffect, createResource, createSignal, For, Show, Switch, Match} from "solid-js";

// I sure hope this doesn't become a mess to maintain!
const LATEST_FIRMWARE: Record<Firmware["family"], Firmware[]> = {
	sparrow: [
		{
			family: "sparrow",
			region: "china",
			variant: "SEK",
			buildDate: "202608080434",
			buildNo: 9105,
			version: "5.15.7"
		},
		{
			family: "sparrow",
			region: "overseas",
			variant: "SEK",
			buildDate: "202608080609",
			buildNo: 9111,
			version: "5.15.7"
		}
	],
	phoenix: [
		{
			family: "phoenix",
			region: "china",
			variant: "SEK",
			buildDate: "202510300015",
			buildNo: 9651,
			version: "5.13.7"
		},
		{
			family: "phoenix",
			region: "china",
			variant: "SEKO",
			buildDate: "202510300008",
			buildNo: 9650,
			version: "5.13.7"
		},
		{
			family: "phoenix",
			region: "overseas",
			variant: "SEK",
			buildDate: "202609031155",
			buildNo: 10113,
			version: "5.13.8"
		},
		{
			family: "phoenix",
			region: "overseas",
			variant: "SEKO",
			buildDate: "202609021949",
			buildNo: 10102,
			version: "5.13.8"
		}
	],
	neo3: [
		{family: "neo3", region: "china", variant: "SEK", buildDate: "202510301728", buildNo: 5902, version: "5.13.7"},
		{family: "neo3", region: "china", variant: "K", buildDate: "202409100309", buildNo: 5348, version: "5.9.9"},
		{
			family: "neo3",
			region: "overseas",
			variant: "SEK",
			buildDate: "202510301731",
			buildNo: 3527,
			version: "5.13.7.0"
		},
		{
			family: "neo3",
			region: "overseas",
			variant: "K",
			buildDate: "202409120321",
			buildNo: 3013,
			version: "5.11.3.0"
		}
	],
	merline: [
		{
			family: "merline",
			region: "china",
			variant: "SEK",
			buildDate: "202409030326",
			buildNo: 3033,
			version: "5.9.9"
		},
		{
			family: "merline",
			region: "overseas",
			variant: "SEK",
			buildDate: "202409030309",
			buildNo: 3032,
			version: "5.9.9"
		}
	],
};

const PickFamily: Component<{ setFamily: (f: Firmware["family"]) => void }> = (props) => (
	<For
		each={[["sparrow", "PICO 4 Ultra"], ["phoenix", "PICO 4"], ["neo3", "PICO Neo3"], ["merline", "PICO G3"]] as const}>
		{([code, pretty]) => <button onclick={() => props.setFamily(code)}>{pretty}</button>}
	</For>
)

const PickP4Variant: Component<{ setVariant: (v: Firmware["variant"]) => void }> = (props) => (<>
	Please connect your headset to your PC, and run the following ADB command: <code>adb shell getprop
	ro.oem.state</code>,
	and select the output:

	<button onclick={() => props.setVariant("SEKO")}>true (SEKO)</button>
	<button onclick={() => props.setVariant("SEK")}>false (SEK)</button>
</>)

const PickPN3Variant: Component<{ setVariant: (v: Firmware["variant"]) => void }> = (props) => (<>
	Please connect your headset to your PC, and run the following ADB command: <code>adb shell getprop
	ro.secure.boot.tag</code>,
	and select the output:

	<button onclick={() => props.setVariant("SEK")}>true (SEK)</button>
	<button onclick={() => props.setVariant("K")}>false (K)</button>
</>)

const PickRegion: Component<{ setRegion: (r: Firmware["region"]) => void }> = (props) => (<>
	<button onclick={() => props.setRegion("china")}>China</button>
	<button onclick={() => props.setRegion("overseas")}>Rest of World</button>
</>);

const FirmwareDisplay: Component<{ firmware: Firmware }> = (props) => (<>
	{props.firmware.region === "china" ? "Chinese, " : "Global, "}
		Version {props.firmware.version},
		{["phoenix", "neo3"].includes(props.firmware.family) && <>{" "}Variant {props.firmware.variant},</>}
		{props.firmware.buildDate && <>{" "}Dated {props.firmware.buildDate},</>}
		{props.firmware.buildNo && <>{" "}No. {props.firmware.buildNo}</>}
</>)

export default () => {
	const [headsetFirmware, actions] = createResource(async () => {
		const adb = await openAdb();
		return adb && await getFullFirmwareInfo(adb);
	});

	const [region, setRegion] = createSignal<Firmware["region"]>();
	const [family, setFamily] = createSignal<Firmware["family"]>();
	const [variant, setVariant] = createSignal<Firmware["variant"]>();

	const careAboutVariant = () => ["phoenix", "neo3"].includes(family()!);

	const latestFirmware = () => {
		if (!family() || !region()) return;

		if (careAboutVariant() && !variant()) return;

		return LATEST_FIRMWARE[family()!].find(f => f.region === region() && (!careAboutVariant() || f.variant === variant()))
	}

	createEffect(() => headsetFirmware.state === "ready" && setRegion(headsetFirmware()?.region));
	createEffect(() => headsetFirmware.state === "ready" && setFamily(headsetFirmware()?.family));
	createEffect(() => headsetFirmware.state === "ready" && setVariant(headsetFirmware()?.variant));

	return <>
		<button onclick={actions.refetch}>Auto-detect</button>

		<Show when={headsetFirmware.state === "errored"}>
			Headset auto-detection failed: {headsetFirmware.error}
		</Show>

		<Show when={headsetFirmware.state === "ready" && headsetFirmware()}>
			Your current firmware is: <FirmwareDisplay firmware={headsetFirmware()!}/>
		</Show>

		<Show when={region()} fallback={<PickRegion setRegion={setRegion}/>}>
			<Show when={family()} fallback={<PickFamily setFamily={setFamily}/>}>
				<Show when={variant() || !careAboutVariant()}
				      fallback={family() === "phoenix" ? <PickP4Variant setVariant={setVariant}/> :
					      <PickPN3Variant setVariant={setVariant}/>}>
					{latestFirmware() ?
						<>The latest firmware for your headset is: <FirmwareDisplay firmware={latestFirmware()!}/></>
						: <>No firmware could be found for this headset</>}
				</Show>
			</Show>
		</Show>
	</>;
}
