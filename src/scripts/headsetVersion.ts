import {Adb} from "@yume-chan/adb"

export const getFirmwareString = async (adb: Adb) => await adb.getProp("ro.pvr.internal.version");

export const getHeadsetFamily = (firmwareString: string) => {
	for (const candidate of ["sparrow", "phoenix", "neo3", "merline"] as const)
		if (firmwareString.includes(candidate)) return candidate;
}

export const getPhoenixIsSeko = async (adb: Adb) => await adb.getProp("ro.oem.state") === "true"

export const getNeo3IsSek = async (adb: Adb) => await adb.getProp("ro.secure.boot.tag") === "true"

export const getHeadsetOverseas = async (adb: Adb) => await adb.getProp("ro.pvr.product.global") === "overseas";

export type Firmware = {
	family: "sparrow"; // PICO 4 Ultra
	variant: "SEK";
	version?: string;
	buildNo: number;
	buildDate?: string;
	region: "china" | "overseas";
} | {
	family: "phoenix"; // PICO 4
	variant: "SEK" | "SEKO";
	version?: string;
	buildNo: number;
	buildDate?: string;
	region: "china" | "overseas";
} | {
	family: "neo3"; // PICO Neo3
	variant: "SEK" | "K";
	version?: string;
	buildNo: number;
	buildDate?: string;
	region: "china" | "overseas";
} | {
	family: "merline"; // PICO G3
	variant: "SEK";
	version?: string;
	buildNo: number;
	buildDate?: string;
	region: "china" | "overseas";
}

// sparrow: testing TODO
// phoenix: tested
// neo3: waiting on a volunteer to test
// merline: waiting on a volunteer to test
export const getFullFirmwareInfo = async (adb: Adb): Promise<Firmware | undefined> => {
	const firmwareString = await getFirmwareString(adb);
	const family = getHeadsetFamily(firmwareString);
	const version = firmwareString.match(/(\d+\.\d+\.\d+)_/)?.[1]
	const buildNo = parseInt(firmwareString.match(/_b(\d+)_/)?.[1] ?? "guh");
	const buildDate = firmwareString.match(/_(20\d{10})_/)?.[1];
	const region = await getHeadsetOverseas(adb) ? "overseas" : "china";

	if (!version) return;
	if (!buildDate) return;
	if (isNaN(buildNo)) return;

	switch (family) {
		case "sparrow":
		case "merline":
			return { family, buildNo, buildDate, version, region, variant: "SEK" };

		case "phoenix":
			return { family, buildNo, buildDate, version, region, variant: await getPhoenixIsSeko(adb) ? "SEKO" : "SEK" }

		case "neo3":
			return { family, buildNo, buildDate, version, region, variant: await getNeo3IsSek(adb) ? "SEK" : "K" };
	}
}
