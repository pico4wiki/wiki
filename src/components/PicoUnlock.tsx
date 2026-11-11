import {createSignal, createResource, Show, Switch, Match, createEffect} from "solid-js";
import {openAdb, openQdl} from "../scripts/usb.ts";

export function PicoUnlock() {
	const [next, setNext] = createSignal(false);

	return <div class="p4w-custom card"><Step2 serialNo={2458380675} isProEnterprise={true} /></div>

	return (
		<div class="p4w-custom card">
			<Show when={"usb" in navigator}
				  fallback={"Your browser does not support WebUSB. Please use one (such as Chromium) that does to use this tool."}>
				<Show when={!next()} fallback={<Step1/>}>
					<p>
					You will need a reliable USB cable, and as the headset will not charge while in Qualcomm EDL mode,
					you need to ensure your headset is relatively well charged.
					</p>
					<p>
						Please turn your headset on, and enable ADB if you have not yet done so.
					</p>

					<button onclick={() => setNext(true)}>Unlock my PICO</button>
				</Show>
			</Show>
		</div>)
}


function Step1() {
	// step 1: we are in android, and need to get the device type and serial number.
	const [deviceInfo, actions] = createResource(async () => {
		const adb = await openAdb();
		if (!adb) throw new Error("Could not open ADB");

		// get serial no
		const fs = await adb.sync();
		const sno = fs.read("/sys/devices/soc0/serial_number");
		const chunks: Uint8Array[] = [];
		for await (const chunk of sno) {
			chunks.push(chunk);
		}
		await fs.dispose();
		const serialNo = parseFloat(([] as number[]).concat(...chunks.map(u8a => [...u8a])).map(code => String.fromCodePoint(code)).join(""));

		// get device type
		// PICO 4 / PICO 4 Pro / PICO 4 Enterprise
		const productName = await adb.getProp("sys.pxr.product.name");
		const isProEnterprise = productName === "PICO 4 Enterprise" || productName === "PICO 4 Pro";

		// not a pico 4! bail!
		if (productName !== "PICO 4" && !isProEnterprise) throw new Error(`Headset '${productName}' not supported`);

		return {serialNo, isProEnterprise, adb};
	});

	const [isInQdlMode] = createResource(
		() => deviceInfo.state === "ready" ? deviceInfo() : undefined,
		async (devInfo) => {
			if (!devInfo) return false;

			await devInfo.adb.power.qualcommEdlMode();
			await devInfo.adb.close();

			return true;
		});

	return <>
		<Switch>
			<Match when={deviceInfo.state === "pending"}>
				Identifying device... (this shouldn't take long)
			</Match>
			<Match when={deviceInfo.state === "errored"}>
				<p>Something went wrong!: {deviceInfo.error + ""}.</p>

				<Show when={deviceInfo.error.message.includes("The device is already in used by another program")}>
					<p>It looks like you may already have an ADB instance running on your system. Run <code>adb kill-server</code> in a terminal and try again.</p>
				</Show>

				<button onclick={() => actions.refetch()}>Try again</button>
			</Match>
			<Match when={deviceInfo.state === "ready"}>
				<Show when={!isInQdlMode} fallback={<Step2 serialNo={deviceInfo()!.serialNo}
				                                           isProEnterprise={deviceInfo()!.isProEnterprise}/>}>
					Rebooting your device into Qualcomm EDL mode, please wait...
				</Show>
			</Match>
		</Switch>
	</>
}


function Step2(props: { serialNo: number, isProEnterprise: boolean }) {
	const [checkReady, setCheckReady] = createSignal(false);

	const [qdlConnection] = createResource(checkReady, async () => {
		if (!checkReady()) return;
		return (window as any).qdl = await openQdl(props.isProEnterprise ? "lite" : "ddr")
	});

	return <>
		<Show when={!checkReady()}>
			<p>Are you running Linux?</p>
			<p>
				On Linux hosts, the qcserial driver binds to QDL devices before we can get to them.
				You must run the following command to release them (this is not needed on macOS and Windows):
			</p>
			<p><code>{`for d in /sys/bus/usb/drivers/qcserial/*-*; do [ -e "$d" ] && echo -n "$(basename $d)" | sudo tee /sys/bus/usb/drivers/qcserial/unbind > /dev/null; done`}</code></p>
			<p>Click done if you are on Windows/macOS, or you are on Linux and you have run that command.</p>
			<button on:click={() => setCheckReady(true)}>Done</button>
		</Show>
		<Show when={checkReady()}>
			<p>{qdlConnection.state}</p>
			<p>Err: {qdlConnection.state === "errored" && (qdlConnection.error+"")}</p>
			<p>Value: {qdlConnection.state === "ready" && JSON.stringify(qdlConnection())}</p>
		</Show>
	</>
}
