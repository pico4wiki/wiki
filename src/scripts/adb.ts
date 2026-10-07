import {Adb, AdbDaemonTransport} from "@yume-chan/adb"
import {AdbDaemonWebUsbDeviceManager} from "@yume-chan/adb-daemon-webusb";
import AdbWebCredentialStore from "@yume-chan/adb-credential-web"

const USB_MANAGER = AdbDaemonWebUsbDeviceManager.BROWSER;
const USB_CRED_STORE = new AdbWebCredentialStore("pico4.wiki");

export async function openAdb(): Promise<Adb | undefined> {
	const conn = await (await USB_MANAGER?.requestDevice())?.connect();
	if (!conn) return;

	const transport = await AdbDaemonTransport.authenticate({
		serial: conn.device.serial,
		connection: conn,
		credentialStore: USB_CRED_STORE,
	});

	return new Adb(transport);
}
