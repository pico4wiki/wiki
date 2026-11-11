import {Adb, AdbDaemonTransport} from "@yume-chan/adb"
import {AdbDaemonWebUsbDeviceManager} from "@yume-chan/adb-daemon-webusb";
import AdbWebCredentialStore from "@yume-chan/adb-credential-web"
// @ts-expect-error
import {FastbootDevice} from "android-fastboot"
import {qdlDevice} from "@andiradulescu/qdl"
import {usbClass} from "@andiradulescu/qdl/usblib";

const USB_MANAGER = AdbDaemonWebUsbDeviceManager.BROWSER;
const USB_CRED_STORE = new AdbWebCredentialStore("pico4.wiki");

export async function openAdb(): Promise<Adb | undefined> {
	const conn = await (await USB_MANAGER?.requestDevice({
		filters: [{
			vendorId: 0x2d40
		}]
	}))?.connect();
	if (!conn) return;

	const transport = await AdbDaemonTransport.authenticate({
		serial: conn.device.serial,
		connection: conn,
		credentialStore: USB_CRED_STORE,
	});

	return new Adb(transport);
}

export async function openFastboot(): Promise<FastbootDevice | undefined> {
	const device = new FastbootDevice();
	try {
		await device.connect();
		if (!device.device) return;
	} catch (e) {
		console.error(e);
		return;
	}

	return device;
}

const BUCKET_URL = "https://f004.backblazeb2.com/file/pico4wiki-ota-mirror/";
const URL_prog_firehose_ddr = BUCKET_URL + "p3/prog_firehose_ddr.elf"; // DDR4
const URL_prog_firehose_lite = BUCKET_URL + "p3/prog_firehose_lite.elf"; // DDR5
const URL_devinfo = BUCKET_URL + "p3/devinfo";
const URL_abl = BUCKET_URL + "p3/abl.bin";

export async function openQdl(firehoseType: "ddr" | "lite"): Promise<qdlDevice | undefined> {
	let firehoseUrl = firehoseType === "ddr" ? URL_prog_firehose_ddr : URL_prog_firehose_lite;
	const firehose = await fetch(firehoseUrl).then(r => r.arrayBuffer());
	const device = new qdlDevice(firehose);

	await device.connect(new usbClass());

	return device;
}

export async function qdlFlashRoot(device: qdlDevice): Promise<void> {
	const [abl, devinfo] = await Promise.all([
		fetch(URL_abl).then(r => r.blob()),
		fetch(URL_devinfo).then(r => r.blob())
	]);
	await qdlFlash(device, abl, devinfo);
}

export async function qdlFlash(device: qdlDevice, abl: Blob, devinfo: Blob): Promise<void> {
	await device.flashBlob("abl", abl);
	await device.flashBlob("devinfo", devinfo);
}

// similar to qdl.js flashBlob()
async function pullPartition(device: qdlDevice, name: string): Promise<Blob> {
	const [found, lun, partition, gpt] = await device.detectPartition(name);
	if (!found) throw new Error(`qdl: Cannot find partition ${name} to pull`);

	if (partition.sectors > BigInt(Number.MAX_SAFE_INTEGER))
		throw new Error(`qdl: this code is designed for small partitions like abl and devinfo, and does not implement partitions of bigint size`);

	return new Blob([await device.firehose.cmdReadBuffer(lun, partition.start, Number(partition.sectors)) as Uint8Array<ArrayBuffer>])
}

export async function qdlBackup(device: qdlDevice): Promise<{ abl: Blob, devinfo: Blob }> {
	const abl = await pullPartition(device, "abl");
	const devinfo = await pullPartition(device, "devinfo");

	return {abl, devinfo};
}
