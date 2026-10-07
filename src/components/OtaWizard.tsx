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
	<div style={{ display: "flex", gap: ".5rem" }}>
		<For
			each={[["sparrow", "PICO 4 Ultra"], ["phoenix", "PICO 4"], ["neo3", "PICO Neo3"], ["merline", "PICO G3"]] as const}>
			{([code, pretty]) => <button class="p4w-custom" style={{ "margin-top": 0 }} onclick={() => props.setFamily(code)}>{pretty}</button>}
		</For>
	</div>
)

const PickP4Variant: Component<{ setVariant: (v: Firmware["variant"]) => void }> = (props) => (<>
	<div>
		Please connect your headset to your PC, run <code>adb shell getprop ro.oem.state</code>,
		and select its output:
	</div>

	<div style={{ display: "flex", gap: ".5rem" }}>
	<button class="p4w-custom" style={{ "margin-top": 0 }} onclick={() => props.setVariant("SEKO")}>true (SEKO)</button>
	<button class="p4w-custom" style={{ "margin-top": 0 }} onclick={() => props.setVariant("SEK")}>false (SEK)</button>
	</div>
</>)

const PickPN3Variant: Component<{ setVariant: (v: Firmware["variant"]) => void }> = (props) => (<>
	<div>
		Please connect your headset to your PC, run <code>adb shell getprop ro.secure.boot.tag</code>,
		and select its output:
	</div>

	<div style={{ display: "flex", gap: ".5rem" }}>
	<button class="p4w-custom" style={{ "margin-top": 0 }} onclick={() => props.setVariant("SEK")}>true (SEK)</button>
	<button class="p4w-custom" style={{ "margin-top": 0 }} onclick={() => props.setVariant("K")}>false (K)</button>
	</div>
</>)

const PickRegion: Component<{ setRegion: (r: Firmware["region"]) => void }> = (props) => (<div style={{ display: "flex", gap: ".5rem" }}>
	<button class="p4w-custom" style={{ "margin-top": 0 }} onclick={() => props.setRegion("china")}>China</button>
	<button class="p4w-custom" style={{ "margin-top": 0 }} onclick={() => props.setRegion("overseas")}>Rest of World</button>
</div>);

const FirmwareDisplay: Component<{ firmware: Firmware }> = (props) => (<>
	{props.firmware.region === "china" ? "Chinese, " : "Global, "}
		Version {props.firmware.version},
		{["phoenix", "neo3"].includes(props.firmware.family) && <>{" "}Variant {props.firmware.variant},</>}
		{props.firmware.buildDate && <>{" "}Dated {props.firmware.buildDate},</>}
		{props.firmware.buildNo && <>{" "}No. {props.firmware.buildNo}</>}
</>)

export default () => {
	const [fwTrigger, setSwTrigger] = createSignal(undefined, {equals: false});
	const [headsetFirmware] = createResource(fwTrigger, async () => {
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
		<div>
			This tool will find the latest OTA image for your headset.
			{"usb" in navigator && " To use auto-detection, connect your headset to your PC with a USB cable."}
		</div>

		<div class="p4w-custom card">
			<Show when={"usb" in navigator}>
				<div><button class="p4w-custom" onclick={setSwTrigger}>Auto-detect headset & current firmware</button></div>

				<Show when={headsetFirmware.state === "errored"}>
					<div>Headset auto-detection failed</div>
					<div>{headsetFirmware.error + ""}</div>
				</Show>

				<Show when={headsetFirmware.state === "ready" && headsetFirmware()}>
					<div>Current firmware: <FirmwareDisplay firmware={headsetFirmware()!}/></div>
				</Show>

				<hr />
			</Show>

			<Show when={region()} fallback={<PickRegion setRegion={setRegion}/>}>
				<Show when={family()} fallback={<PickFamily setFamily={setFamily}/>}>
					<Show when={variant() || !careAboutVariant()}
						  fallback={family() === "phoenix" ? <PickP4Variant setVariant={setVariant}/> :
							  <PickPN3Variant setVariant={setVariant}/>}>
						{latestFirmware() ?
							<div>Latest firmware: <FirmwareDisplay firmware={latestFirmware()!}/></div>
							: <div>No firmware could be found for this headset</div>}
					</Show>
				</Show>
			</Show>
		</div>
	</>;
}
