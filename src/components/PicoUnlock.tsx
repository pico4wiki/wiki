import {createSignal, createResource, Show, Switch, Match, createEffect, createMemo} from "solid-js";
import {openAdb, openFastboot, openQdl, qdlBackup, qdlFlashRoot} from "../scripts/usb.ts";
import {generateUnlock} from "../scripts/unlockCode.ts";
import JSZip from "jszip";

function packOutputFiles(log: string, unlockCode: string, abl4: Blob, abl3: Blob, devinfo: Blob, magisk?: { bootOg: Blob, bootPatched: Blob }) {
	const zip = new JSZip();
	abl4 && zip.file("abl-p4-original.bin", abl4);
	abl3 && zip.file("abl-p3-picounlock.bin", abl3);
	devinfo && zip.file("devinfo", devinfo);

	log && zip.file("picounlock-web-log.txt", log);

	unlockCode && zip.file(unlockCode, `Before the ABl will accept any fastboot flashing commands, you must run \`fastboot oem ${unlockCode} unlock\`.`)

	return zip.generateAsync({ compression: "STORE", type: "blob" });
}

function downloadZip(zip: Blob) {
	const dataUrl = URL.createObjectURL(zip);
	const a = document.createElement("a");
	a.href = dataUrl;
	a.download = "picounlock-output.zip";
	a.click();

	URL.revokeObjectURL(dataUrl);
}

export function PicoUnlock() {
	const [next, setNext] = createSignal(false);

	return (
		<div class="p4w-custom card">
			<Show when={"usb" in navigator}
				  fallback={"Your browser does not support WebUSB. Please use one (such as Chromium) that does to use this tool."}>
				<Show when={!next()}
					  fallback={<Step1 />}>
					<p>
						You will need a reliable USB cable, and as the headset will not charge while in Qualcomm EDL
						mode,
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


// in android: get device type and serial number, reboot into EDL
function Step1() {
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
		() => deviceInfo.state === "ready" && deviceInfo(),
		async (devInfo) => {
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
					<p>It looks like you may already have an ADB instance running on your system. Run <code>adb
						kill-server</code> in a terminal and try again.</p>
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

// in EDL: flash ABL and reboot into android
function Step2(props: { serialNo: number, isProEnterprise: boolean }) {
	const [checkReady, setCheckReady] = createSignal(false);

	const [qdlConnection] = createResource(checkReady, () => openQdl(props.isProEnterprise ? "lite" : "ddr"));

	const [pulledImages] = createResource(() => qdlConnection.state === "ready" && qdlConnection(), (qdl) => qdlBackup(qdl));

	// flash root! omg!
	const [flashResource] = createResource(() => pulledImages.state === "ready" && pulledImages(), async () => {
		const newAbl = await qdlFlashRoot(qdlConnection()!);

		// reboot back into android
		await qdlConnection()!.reset();
		return newAbl;
	});

	return <>
		<Show when={!checkReady()}>
			<p>Are you running Linux?</p>
			<p>
				On Linux hosts, the qcserial driver binds to QDL devices before we can get to them.
				You must run the following command to release them (this is not needed on macOS and Windows):
			</p>
			<p>
				<code>{`for d in /sys/bus/usb/drivers/qcserial/*-*; do [ -e "$d" ] && echo -n "$(basename $d)" | sudo tee /sys/bus/usb/drivers/qcserial/unbind > /dev/null; done`}</code>
			</p>
			<p>Click done if you are on Windows/macOS, or you are on Linux and you have run that command.</p>
			<button on:click={() => setCheckReady(true)}>Done</button>
		</Show>
		<Show when={checkReady()}>
			<Show when={pulledImages.state === "ready"} fallback={"Backing up stock firmware..."}>
				<Show when={flashResource.state === "ready"} fallback={"Flashing vulnerable Pico Neo3 ABL..."}>
					<Step3 serialNo={props.serialNo} backups={{ ...pulledImages()!, ablNew: flashResource()! }} />
				</Show>
			</Show>
		</Show>
	</>
}

// in android: reboot into fastboot, then unlock the bootloader
function Step3(props: { serialNo: number; backups: { abl: Blob, ablNew: Blob, devinfo: Blob, boot: Blob } }) {
	const [ackReboot, setAckReboot] = createSignal(false);

	const [rebootedToFastboot] = createResource(ackReboot, async () => {
		const adb = await openAdb();
		if (!adb) throw new Error("Could not open ADB");
		await adb?.power.bootloader();
		return true;
	});

	const unlockCode = createMemo(() => generateUnlock(props.serialNo));

	const [ackFastboot, setAckFastboot] = createSignal(0);

	const [fastbootResource] = createResource(() => /*rebootedToFastboot.state === "ready" &&*/ !!ackFastboot(), async () => {
		const fastboot = await openFastboot();

		// check is locked
		const isAlreadyUnlocked = await fastboot.getVariable("unlocked") === "yes";
		if (isAlreadyUnlocked) {
			await fastboot.reboot();
			return true; // already unlocked
		}

		// unlock headset
		await fastboot.runCommand(`oem ${unlockCode()} unlock`);

		try {
			await fastboot.runCommand(`flashing unlock_critical`);
		} catch (e) {
			if (!(e + "").includes("already : unlocked")) throw e;
			console.log(e)
		}

		try {
			await fastboot.runCommand(`flashing unlock`);
		} catch (e) {
			if (!(e + "").includes("already : unlocked")) throw e;
			console.log(e)
		}

		await fastboot.runCommand(`oem setenforce 0`);

		const success = await fastboot.getVariable("unlocked") === "yes";

		await fastboot.reboot(success ? "" : "bootloader");

		return success;
	});

	const RebootYapping = () => <>
		<p>
			The headset is now rebooting into Android.
			As a side effect of using the vulnerable Pico Neo3 ABL, this can take a very long time. Please be
			patient.
		</p>
		<p>
			If the PICO logo disappears and, instead of PICO OS starting, the screen just goes black,
			the headset failed to boot and bailed to EDL mode. Please hold the power button for 15 seconds until it
			reboots and try again.
		</p>
	</>

	const [moveOn, setMoveOn] = createSignal<undefined | "choice" | "magisk" | "done">();

	// download backup zip
	createEffect(async () => {
		if (moveOn() === "done") {
			const finishedZip = await packOutputFiles("TODO: logging", unlockCode(), props.backups.abl, props.backups.ablNew, props.backups.devinfo);
			downloadZip(finishedZip);
		}
	})

	return <>
		<Show when={!ackReboot()}>
			<RebootYapping/>
			<button onclick={() => setAckReboot(true)}>The headset is in PICO OS</button>
		</Show>
		<Show when={rebootedToFastboot.state === "ready" && !moveOn()}>
			<Show when={!ackFastboot()}>
				Please allow USB access for fastboot, to unlock the bootloader.
				<button onclick={() => setAckFastboot(a => a + 1)}>OK</button>
			</Show>
			<Show when={fastbootResource.state === "errored"}>{fastbootResource.error + ""}</Show>
			<Show when={fastbootResource.state === "ready" && !fastbootResource()}>
				<p>Unlocking failed first try. Rebooting fastboot for a second try</p>
				<button onclick={() => setAckFastboot(a => a + 1)}>Try again</button>
			</Show>
			<Show when={fastbootResource.state === "ready" && fastbootResource()}>
				<RebootYapping/>
				<button onclick={() => setMoveOn("choice")}>The headset is in PICO OS</button>
			</Show>
		</Show>
		<Switch>
			<Match when={moveOn() === "choice"}>
				<p>Your PICO now has an unlocked bootloader, with working fastboot.</p>
				<p>
					Before your bootloader will accept fastboot commands, you must send it
					<code>fastboot oem {unlockCode()} unlock</code>.
				</p>
				<p>
					For a root (recommended), you can continue to install Magisk.
					This will give you userspace `su`, ability to install Magisk modules, and will allow you to restore
					the original PICO 4 ABL, which resolves the slow and unreliable boot issue.
					You will lose fastboot by doing that final step, but having root allows you to easily go back to the
					Pico Neo3 ABL to get it, or just flash partitions from booted Android, at any time.
				</p>

				<div>
					<button onclick={() => setMoveOn("magisk")}>Install Magisk (recommended)</button>
					<button onclick={() => setMoveOn("done")}>Leave with unlocked bootloader</button>
				</div>
			</Match>
			<Match when={moveOn() === "done"}>
				<p>
					Thank you for using PicoUnlock web!
				</p>
				<p>Made by pico4.wiki team.</p>
				<p>
					Remember to save your unlock code before leaving:
					<code>fastboot oem {unlockCode()} unlock</code>
				</p>
				<p>
					<code>picounlock-backup.zip</code>
					contains your original ABL and the log of this tool, for future reference.
				</p>
			</Match>
			<Match when={moveOn() === "magisk"}><Step4 {...props} /></Match>
		</Switch>
	</>;
}

// in android: install magisk, patch boot.img, and reboot to fastboot
function Step4(props: { serialNo: number; backups: { abl: Blob, ablNew: Blob, devinfo: Blob, boot: Blob } }) {
	return <>
		TODO: Do magisk patching
	</>
}

// step5: in fastboot: reboot to fastboot and flash boot.img and the original abl
