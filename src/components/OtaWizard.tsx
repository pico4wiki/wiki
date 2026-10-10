import {openAdb} from "../scripts/adb.ts";
import {type Firmware, getFamilyAndBuildNumber} from "../scripts/headsetVersion.ts";
import {type Component, createEffect, createResource, createSignal, For, Show} from "solid-js";

type OtaData = Record<Firmware["product"], Firmware[]>

const PickProduct: Component<{ setFamily: (f: Firmware["product"]) => void }> = (props) => (
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
	<button class="p4w-custom" style={{ "margin-top": 0 }} onclick={() => props.setVariant("seko")}>true (SEKO)</button>
	<button class="p4w-custom" style={{ "margin-top": 0 }} onclick={() => props.setVariant("sek")}>false (SEK)</button>
	</div>
</>)

const PickPN3Variant: Component<{ setVariant: (v: Firmware["variant"]) => void }> = (props) => (<>
	<div>
		Please connect your headset to your PC, run <code>adb shell getprop ro.secure.boot.tag</code>,
		and select its output:
	</div>

	<div style={{ display: "flex", gap: ".5rem" }}>
	<button class="p4w-custom" style={{ "margin-top": 0 }} onclick={() => props.setVariant("sek")}>true (SEK)</button>
	<button class="p4w-custom" style={{ "margin-top": 0 }} onclick={() => props.setVariant("k")}>false (K)</button>
	</div>
</>)

const PickRegion: Component<{ setRegion: (r: Firmware["region"]) => void }> = (props) => (<div style={{ display: "flex", gap: ".5rem" }}>
	<button class="p4w-custom" style={{ "margin-top": 0 }} onclick={() => props.setRegion("china")}>China</button>
	<button class="p4w-custom" style={{ "margin-top": 0 }} onclick={() => props.setRegion("overseas")}>Rest of World</button>
</div>);

const FirmwareDisplay: Component<{ firmware: Firmware }> = (props) => (<>
	{props.firmware.region === "china" ? "Chinese, " : "Global, "}
		Version {props.firmware.version},
		{["phoenix", "neo3"].includes(props.firmware.product) && <>{" "}Variant {props.firmware.variant},</>}
		{props.firmware.buildDate && <>{" "}Dated {props.firmware.buildDate},</>}
		{props.firmware.buildNo && <>{" "}No. {props.firmware.buildNo}</>}
</>)

export default () => {

	const [otaData] = createResource(() => fetch("https://ota-scraper.pico4-wiki.workers.dev/").then(r => r.json() as Promise<OtaData>));

	const [fwTrigger, setSwTrigger] = createSignal(undefined, {equals: false});
	const [headsetFirmware] = createResource(fwTrigger, async () => {
		const adb = await openAdb();
		const familyAndBuildNo = adb && await getFamilyAndBuildNumber(adb);

		return familyAndBuildNo && otaData()?.[familyAndBuildNo[0]].find(f => f.buildNo === familyAndBuildNo[1]);
	});

	const [region, setRegion] = createSignal<Firmware["region"]>();
	const [product, setProduct] = createSignal<Firmware["product"]>();
	const [variant, setVariant] = createSignal<Firmware["variant"]>();

	const careAboutVariant = () => ["phoenix", "neo3"].includes(product()!);

	const latestFirmware = () => {
		if (!product() || !region()) return;

		if (careAboutVariant() && !variant()) return;

		return otaData()?.[product()!].findLast(f => f.region === region() && (!careAboutVariant() || f.variant === variant()) );
	}

	createEffect(() => headsetFirmware.state === "ready" && setRegion(headsetFirmware()?.region));
	createEffect(() => headsetFirmware.state === "ready" && setProduct(headsetFirmware()?.product));
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
				<Show when={product()} fallback={<PickProduct setFamily={setProduct}/>}>
					<Show when={variant() || !careAboutVariant()}
						  fallback={product() === "phoenix" ? <PickP4Variant setVariant={setVariant}/> :
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
