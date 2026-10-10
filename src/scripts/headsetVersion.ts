import {Adb} from "@yume-chan/adb"

export const getFirmwareString = async (adb: Adb) => await adb.getProp("ro.pvr.internal.version");

export const getHeadsetFamily = (firmwareString: string) => {
	for (const candidate of ["sparrow", "phoenix", "neo3", "merline"] as const)
		if (firmwareString.includes(candidate)) return candidate;
}

export type Firmware = {
	buildNo: number;
	region: "china" | "overseas";
	md5: string;
	url: string;
	name?: string;
	version: string;
	buildDate: string;
	data?: string;
} & ({ product: "sparrow", variant: "sek" } |
	{ product: "phoenix", variant: "sek" | "seko" } |
	{ product: "neo3", variant: "sek" | "k" } |
	{ product: "merline", variant: "sek" })

export const getFamilyAndBuildNumber = async (adb: Adb) => {
	const firmwareString = await getFirmwareString(adb);
	const family = getHeadsetFamily(firmwareString);
	const buildNo = parseInt(firmwareString.match(/_b(\d+)_/)?.[1] ?? "guh");

	return !isNaN(buildNo) && family ? [family, buildNo] as const : undefined;
}
