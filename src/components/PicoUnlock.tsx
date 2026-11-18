import {createEffect, createMemo, createResource, createSignal, Match, Show, Switch} from "solid-js";
import {openAdb, openFastboot, openQdl, qdlPullPartition, qdlFlashRoot} from "../scripts/usb.ts";
import {PackageManager} from "@yume-chan/android-bin";
import {generateUnlock} from "../scripts/unlockCode.ts";
import JSZip from "jszip";
import type {AdbShellProtocolProcess} from "@yume-chan/adb";
import {PicoUnlockLogger} from "../scripts/picoUnlockLogger.ts";

function packOutputFiles(log: string, unlockCode: string, {abl4, abl3, devinfo, persist, bootOg, bootPatched}: {
	abl4: Blob,
	abl3: Blob,
	devinfo: Blob,
	persist: Blob,
	bootOg: Blob,
	bootPatched: Blob
}) {
	const zip = new JSZip();
	abl4 && zip.file("abl-p4-original.bin", abl4);
	abl3 && zip.file("abl-p3-picounlock.bin", abl3);
	devinfo && zip.file("devinfo", devinfo);
	persist && zip.file("persist", persist);

	log && zip.file("picounlock-web-log.txt", log);

	unlockCode && zip.file(unlockCode, `Before the ABl will accept any fastboot flashing commands, you must run \`fastboot oem ${unlockCode} unlock\`.`)

	zip.file("README.txt", `
These files are output by PicoUnlock Web, at https://pico4.wiki/guides/root/00-picounlock

picounlock-web-log.txt contains detailed logs from the rooting process.
${unlockCode} is there to remind you of your headset's unlock code, for use with the Pico Neo3 ABL.
abl-p4-original.bin is the PICO 4 Android Bootloader shipped with your headset.
abl-p3-picounlock.bin is the vulnerable Pico Neo3 Android Bootloader used in the rooting process.
devinfo is a backup of your headset's devinfo partition.
persist is a backup of your headset's persist partition, which contains headset-specific calibration data, in case you REALLY stuff it up.
boot-original.img is the boot image for the firmware that was installed on your headset at the time of rooting.
boot-magisk.img is the boot image for that same firmware, but with Magisk4Pico patched into it.
`.trim())

	bootOg && zip.file("boot-original.img", bootOg);
	bootPatched && zip.file("boot-magisk.img", bootPatched);


	return zip.generateAsync({type: "blob"});
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

	const logger = new PicoUnlockLogger();

	return (
		<>
			<div class="p4w-custom card">
				<Show when={"usb" in navigator}
					  fallback={"Your browser does not support WebUSB. Please use one (such as Chromium) that does to use this tool."}>
					<Show when={!next()}
						  fallback={<Step1 logger={logger}/>}>
						<p>
							This tool only covers <code>phoenix</code> headsets (PICO 4, PICO 4 Pro and PICO 4
							Enterprise). It will not work on <code>sparrow</code> headsets (PICO 4 Ultra or Ultra
							Enterprise)!
						</p>
						<p>
							Rooting your headset and unlocking the bootloader <strong>requires</strong> your headset to
							be factory reset! <strong>You will lose anything you do not back up!</strong>
						</p>

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
			</div>

			<h3>Logs</h3>
			<pre>
			<code>
				{logger.logs.map(l => <span>
					{l.severity}: {l.content.map(c => c + "").join(";")}
					<br/>
				</span>)}
			</code>
			</pre>
		</>
	);
}


// in android: get device type and serial number, reboot into EDL
function Step1(props: { logger: PicoUnlockLogger; }) {
	const [deviceInfo, actions] = createResource(async () => {
		props.logger.info("Connecting ADB to identify device...")
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

		props.logger.info(`Device is a ${productName} with serial number ${serialNo}`);

		return {serialNo, isProEnterprise, adb};
	});
	props.logger.logResourceErrors(deviceInfo);

	const [isInQdlMode] = createResource(
		() => deviceInfo.state === "ready" && deviceInfo(),
		async (devInfo) => {
			props.logger.info("Rebooting to EDL mode");
			await devInfo.adb.power.qualcommEdlMode();
			await devInfo.adb.close();

			return true;
		});

	props.logger.logResourceErrors(isInQdlMode);

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
				<Show when={!isInQdlMode} fallback={<Step2 logger={props.logger}
														   serialNo={deviceInfo()!.serialNo}
														   isProEnterprise={deviceInfo()!.isProEnterprise}/>}>
					Rebooting your device into Qualcomm EDL mode, please wait...
				</Show>
			</Match>
		</Switch>
	</>
}

// in EDL: flash ABL and reboot into android
function Step2(props: { logger: PicoUnlockLogger; serialNo: number, isProEnterprise: boolean }) {
	const [checkReady, setCheckReady] = createSignal(0);

	const [qdlConnection] = createResource(checkReady, async (r) => {
		if (!r) return;

		const qdl = await openQdl(props.isProEnterprise ? "lite" : "ddr");
		props.logger.info("Opened QDL connection");
		return qdl;
	});
	props.logger.logResourceErrors(qdlConnection);

	const [pulledImages] = createResource(() => qdlConnection.state === "ready" && qdlConnection(), async (qdl) => {
		props.logger.info("Backing up original partitions");

		props.logger.info("abl...");
		const abl = await qdlPullPartition(qdl, "abl");
		props.logger.info("devinfo...");
		const devinfo = await qdlPullPartition(qdl, "devinfo");
		props.logger.info("boot... (sometimes slow)");
		const boot = await qdlPullPartition(qdl, "boot", 3 * 60 * 1000); // give it 3 mins, 10 secs may not cut it.
		props.logger.info("persist...");
		const persist = await qdlPullPartition(qdl, "persist");

		props.logger.info("Backed up");
		return {abl, devinfo, boot, persist};
	});
	props.logger.logResourceErrors(pulledImages);

	// flash root! omg!
	const [flashResource] = createResource(() => pulledImages.state === "ready" && pulledImages(), async () => {
		props.logger.info("Flashing vulnerable Pico Neo3 ABL");
		const unlockAbl = await qdlFlashRoot(qdlConnection()!);
		props.logger.info("Flashed, rebooting to Android");

		// reboot back into android
		await qdlConnection()!.reset();
		return unlockAbl;
	});
	props.logger.logResourceErrors(flashResource);

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
			<button on:click={() => setCheckReady(a => a + 1)}>Done</button>
		</Show>
		<Show when={checkReady() && qdlConnection.state === "errored"}>
			<p>Connecting QDL failed: ${qdlConnection.error + ""}</p>
			<button on:click={() => setCheckReady(a => a + 1)}>Try again</button>
		</Show>
		<Show when={checkReady() && qdlConnection.state === "ready"}>
			<Show when={pulledImages.state === "ready"} fallback={"Backing up stock firmware..."}>
				<Show when={flashResource.state === "ready"} fallback={"Flashing vulnerable Pico Neo3 ABL..."}>
					<Step3 logger={props.logger} serialNo={props.serialNo}
						   backups={{...pulledImages()!, ablUnlock: flashResource()!}}/>
				</Show>
			</Show>
		</Show>
	</>
}

type Backups = { abl: Blob, ablUnlock: Blob, devinfo: Blob, boot: Blob, persist: Blob };

// in android: build magisk, then reboot to fastboot for unlock
function Step3(props: { logger: PicoUnlockLogger; serialNo: number; backups: Backups }) {

	const [magisk4pico] = createResource(() => fetch("https://pico4.wiki/magisk4pico/Magisk4Pico.apk").then(r => r.blob()));

	const [ackReboot, setAckReboot] = createSignal(0);

	const [adb] = createResource(() => !!ackReboot(), async () => {
		props.logger.info("Connecting ADB to install Magisk...")
		const adb = await openAdb();
		if (!adb) throw new Error("Could not open ADB");
		props.logger.info("Connected")
		return adb;
	});
	props.logger.logResourceErrors(adb);

	const [installResource] = createResource(() => magisk4pico.state === "ready" && adb.state === "ready", async () => {
		const magiskBlob = magisk4pico()!;
		props.logger.info("Installing Magisk4Pico.apk...")
		await new PackageManager(adb()!).installStream(magiskBlob.size, magiskBlob.stream() as any);
		props.logger.info("Installed Magisk")
	});
	props.logger.logResourceErrors(installResource);

	const [buildImageResource] = createResource(() => installResource.state === "ready", async () => {
		// find Magisk apk location
		const pkgs = new PackageManager(adb()!).listPackages({showSourceDir: true});

		let apkPath: string | undefined;
		for await (const pkg of pkgs) {
			if (pkg.packageName === "com.topjohnwu.magisk") apkPath = pkg.sourceDir;
		}

		props.logger.info("Magisk APK is located at", apkPath);

		if (!apkPath) throw new Error("No magisk installed on headset, even though we just installed it.")

		//const bootimg = await fetch("https://litter.catbox.moe/3vsywq2t0lx7d5ce.img").then(r => r.blob());

		props.logger.info("Pushing raw boot.img to headset...");
		// push boot to headset
		const sync = await adb()!.sync();
		await sync.write({
			file: props.backups.boot.stream() as any,
			filename: "/data/local/tmp/picounlock-boot.img"
		});

		props.logger.info("Patching image with Magisk");

		const shellProtocol = adb()!.subprocess.shellProtocol!;

		const patchScript = `
			# unzip magisk
			cd /data/local/tmp && \
			rm -rf magisk-ext && \
			mkdir magisk-ext && \
			unzip -d magisk-ext ${apkPath} && \
			# copy files to where we need them
			mkdir picounlock-patch-env && \
			cp magisk-ext/lib/armeabi-v7a/libmagisk.so picounlock-patch-env/magisk32 && \
			cp magisk-ext/assets/{stub.apk,util_functions.sh,boot_patch.sh,addon.d.sh} picounlock-patch-env && \
			for lib in magisk-ext/lib/arm64-v8a/*.so
				do cp $lib picounlock-patch-env/$(basename $lib | cut -c 4- | cut -d . -f 1)
			done && \
			mv picounlock-boot.img picounlock-patch-env/boot.img && \
			# build image
			cd picounlock-patch-env && \
			KEEPFORCEENCRYPT=true KEEPVERITY=true PATCHVBMETAFLAG=false RECOVERYMODE=false sh boot_patch.sh boot.img
		`;

		props.logger.verbose(patchScript);

		const patchProcess = await shellProtocol.spawn(patchScript);
		const readerPromise = (reader: AdbShellProtocolProcess["stdout"], outfn: (s: string) => void) => (async () => {
			let strbuf = "";
			for await (const chunk of reader) {
				// decode to string
				const chunkString = [...chunk].map(c => String.fromCodePoint(c)).join("");
				strbuf += chunkString;

				// new line?
				if (strbuf.includes("\n")) {
					const lines = strbuf.split("\n").map(s => s.trimEnd());
					lines.slice(0, -1).forEach(l => outfn(l));
					// the last line may not be done yet
					strbuf = lines.at(-1) ?? "";
				}
			}
			// the last line is definitely done now
			if (strbuf.trim()) outfn(strbuf);
		})();

		const readPatchStdoutPromise = readerPromise(patchProcess.stdout, props.logger.verbose);
		const readPatchStderrPromise = readerPromise(patchProcess.stderr, props.logger.verbose);
		const patchExitCode = await patchProcess.exited;
		await readPatchStdoutPromise;
		await readPatchStderrPromise;

		if (patchExitCode !== 0) throw new Error(`patching boot failed with status ${patchExitCode}`);

		// pull boot
		props.logger.info(`Pulling patched boot.img from device...`);
		const patchedImage = sync.read("/data/local/tmp/picounlock-patch-env/new-boot.img");
		const chunks: ArrayBuffer[] = [];
		for await (const chunk of patchedImage) chunks.push(chunk.buffer as ArrayBuffer);

		const patchedImageBlob = new Blob(chunks);


		props.logger.info(`Retrieved patched boot.img, size is`, patchedImageBlob.size);

		// now is a convenient time to push the ABL so they can easily be used later.
		// this could be done any time, but I have an alive ADB connection now, so just Do It TM
		props.logger.info("Pushing ABLs to /sdcard, for future safekeeping.")
		await sync.write({
			filename: "/sdcard/abl-pico4.bin",
			file: props.backups.abl.stream() as any,
		});
		await sync.write({
			filename: "/sdcard/abl-picounlock.bin",
			file: props.backups.ablUnlock.stream() as any,
		});
		await sync.dispose();

		// clean up
		const cleanupRes = await shellProtocol.spawnWaitText(`rm -rf /data/local/tmp/{picounlock-patch-env,magisk-ext}`);
		if (cleanupRes.exitCode) props.logger.warn("Failed to run cleanup task, proceeding anyway. Junk may be left in /data/local/tmp.");
		if (cleanupRes.stdout.trim()) props.logger.warn(cleanupRes.stdout);

		// reboot to fastboot
		props.logger.info("Rebooting headset to fastboot");
		await adb()!.power.bootloader();

		return patchedImageBlob;
	});
	props.logger.logResourceErrors(buildImageResource)

	return <>
		<Show when={!ackReboot()}>
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
			<button onclick={() => setAckReboot(a => a + 1)}>The headset is in PICO OS</button>
		</Show>
		<Show when={ackReboot()}>
			<Show when={adb.state === "errored"}>
				<p>Failed to get ADB connection.</p>
				<button onclick={() => setAckReboot(a => a + 1)}>Try again</button>
			</Show>

			<Show when={adb.state === "ready"}>
				<Show when={magisk4pico.loading || installResource.state === "pending"}>Installing Magisk...</Show>
				<Show when={buildImageResource.state === "pending"}>Patching boot image with Magisk...</Show>
				<Show when={buildImageResource.state === "ready"}>
					<Step4 logger={props.logger} serialNo={props.serialNo} backups={props.backups}
						   bootNew={buildImageResource()!}/>
				</Show>
			</Show>
		</Show>
	</>
}

// in fastboot: unlock the bootloader and flash bootNew (and the og ABL)
function Step4(props: { logger: PicoUnlockLogger; serialNo: number; backups: Backups; bootNew: Blob }) {
	const unlockCode = createMemo(() => generateUnlock(props.serialNo));

	const [ackFastboot, setAckFastboot] = createSignal(0);

	const [fastbootResource] = createResource(() => !!ackFastboot(), async () => {
		props.logger.info("Connecting to fastboot...")
		const fastboot = await openFastboot();
		props.logger.info("Connected")

		// check is locked
		const isAlreadyUnlocked = await fastboot.getVariable("unlocked") === "yes";
		if (isAlreadyUnlocked) {
			props.logger.info("Bootloader is already unlocked!")
			await fastboot.reboot();
			return fastboot as object; // already unlocked
		}

		props.logger.info("Unlocking bootloader...")
		// unlock headset
		props.logger.info(`oem ${unlockCode()} unlock`)
		await fastboot.runCommand(`oem ${unlockCode()} unlock`);

		try {
			props.logger.info(`flashing unlock_critical`)
			await fastboot.runCommand(`flashing unlock_critical`);
		} catch (e) {
			if ((e + "").includes("already : unlocked")) {
				props.logger.error(e)
			} else {
				throw e;
			}
		}

		try {
			props.logger.info(`flashing unlock`)
			await fastboot.runCommand(`flashing unlock`);
		} catch (e) {
			if ((e + "").includes("already : unlocked")) {
				props.logger.error(e)
			} else {
				throw e;
			}
		}

		props.logger.info(`oem setenforce 0`)
		await fastboot.runCommand(`oem setenforce 0`);

		props.logger.info(`Checking if bootloader is unlocked...`)
		const success = await fastboot.getVariable("unlocked") === "yes";
		props.logger.info('Unlocked: ', success);

		if (success)
			props.logger.info("Unlocked successfully, asking the user if they wish to install Magisk and restore the PICO 4 ABL")
		else {
			props.logger.warn("Unlock failed. Reboot and try again.")
			await fastboot.reboot(success ? "" : "bootloader");
		}

		return success && (fastboot as object);
	});

	const [moveOn, setMoveOn] = createSignal<undefined | "magisk" | "early">();

	const [installMagiskResource] = createResource(() => moveOn() === "magisk" && fastbootResource.state === "ready" && fastbootResource(), async (fastboot: any) => {
		props.logger.info("Flashing Magisk patched boot.img")
		await fastboot.flashBlob("boot", props.bootNew);

		props.logger.info("Reflashing PICO 4 ABL")
		// reflash original ABL
		await fastboot.flashBlob("abl", props.backups.abl);

		props.logger.info("PicoUnlock Web completed. Rebooting headset");
		await fastboot.reboot();
	});

	// download backup zip
	createEffect(async () => {
		if (moveOn() === "early" || installMagiskResource.state === "ready") {
			const finishedZip = await packOutputFiles(props.logger.exportLogsTxt(), unlockCode(),
				{
					abl4: props.backups.abl,
					abl3: props.backups.ablUnlock,
					devinfo: props.backups.devinfo,
					persist: props.backups.persist,
					bootOg: props.backups.boot,
					bootPatched: props.bootNew
				}
			);
			downloadZip(finishedZip);
		}
	});

	return <>
		<Show when={!moveOn()}>
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
				<p>Your PICO now has an unlocked bootloader, with working fastboot.</p>
				<p>
					Before your bootloader will accept fastboot commands, you must send it
					<code>fastboot oem {unlockCode()} unlock</code>.
				</p>
				<p>
					To root your headset (recommended), you can continue to installing Magisk.
					This will give you userspace `su`, ability to install Magisk modules, and will allow you to restore
					the original PICO 4 ABL, which resolves the slow and unreliable boot issue.
					You will lose fastboot flashing by doing that final step, but having root allows you to easily go
					back to the Pico Neo3 ABL to use it, or simply flash partitions from Android at any time.
				</p>

				<div>
					<button onclick={() => setMoveOn("magisk")}>Install Magisk (recommended)</button>
					<button onclick={() => setMoveOn("early")}>Leave with unlocked bootloader</button>
				</div>
			</Show>
		</Show>
		<Switch>
			<Match when={moveOn() === "early"}>
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
			<Match when={moveOn() === "magisk"}>
				<Show when={installMagiskResource.state === "pending"}>
					<p>Flashing Magisk and PICO 4 ABL...</p>
				</Show>
				<Show when={installMagiskResource.state === "errored"}>
					<p>Flashing Magisk and PICO 4 ABL back failed</p>
					<p>{installMagiskResource.error + ""}</p>
				</Show>
				<Show when={installMagiskResource.state === "ready"}>
					<p>
						Thank you for using PicoUnlock web!
					</p>
					<p>Made by pico4.wiki team.</p>
					<p>
						<code>picounlock-backup.zip</code>
						contains your unlock code and original boot image the log of this tool, for future reference.
					</p>
				</Show>
			</Match>
		</Switch>
	</>;
}
