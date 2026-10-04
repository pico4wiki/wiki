import JSZip from "jszip";
import { type Component, createEffect, createMemo, createSignal, For, Show } from "solid-js";

interface App {
	name: string;
	package: string;
	desc: string;
	default: boolean;
}

const HEADSETS = {
	"4": { name: "PICO 4", supported: true, enterprise: false },
	"4e": { name: "PICO 4 Enterprise", supported: true, enterprise: true },
	"4p": { name: "PICO 4 Pro", supported: true, enterprise: false },
	"4u": { name: "PICO 4 Ultra", supported: false, enterprise: false },
	// "4ue": {name: "PICO 4 Ultra Enterprise", supported: false, enterprise: true },
} as const;

type HeadsetKey = keyof typeof HEADSETS;

const appListShared: App[] = [
	{
		name: "TeaTracker",
		package: "os.teatracker",
		desc:
			"Analytics and tracking service for sending data to ByteDance servers, does nothing in terms of functionality for the headset",
		default: true,
	},
	{
		name: "User Guide",
		package: "com.picovr.guide",
		desc: "PICO's own headset help / user guide, most users will not need this as it also contains limited information",
		default: true,
	},
	{
		name: "Feedback",
		package: "com.bytedance.os.feedback",
		desc:
			"Application for sending feedback back to PICO about your headset, as the PICO 4 is extremely old and barely receives updates, it is unlikely that this is needed anymore",
		default: true,
	},
];

const appListEnterprise: App[] = [
	{
		name: "Home",
		package: "com.pvr.tobhome",
		desc:
			"Startup UI when you boot your headset, alongside opening every time you close all your apps, making it quite undesirable",
		default: true,
	},
	{
		name: "Business Suite",
		package: "com.picovr.enterpriseassistant",
		desc: "An alternative home UI for business clients, not very useful for everyday use",
		default: true,
	},
	{
		name: "Business User Center",
		package: "com.picovr.tobvrusercenter",
		desc: "Logging in and management of enterprise PICO accounts",
		default: true,
	},
	{
		name: "Business Store",
		package: "com.picoxr.tobstore",
		desc:
			"Business version of the consumer PICO app store, it has nothing of note for normal non-business use. The recommended route is to sideload APKs",
		default: true,
	},
	{
		name: "Device Manager",
		package: "com.picoxr.tobmdm",
		desc:
			"Stands for Mobile Device Management, even if not enrolled it connects and sends a lot of data to PICO's servers on consumer ones",
		default: true,
	},
	{
		name: "Business Streaming Assistant",
		package: "com.picoxr.bstreamassistant",
		desc: "Outdated and worse version of PICO Connect, we recommend sideloading PICO Connect itself",
		default: true,
	},
];

const appListConsumer: App[] = [
	{
		name: "Explore",
		package: "com.pvr.home",
		desc:
			"Startup UI when you boot your headset, alongside opening every time you close all your apps, making it quite undesirable",
		default: true,
	},
	{
		name: "MdmProject",
		package: "com.picoxr.mdm",
		desc:
			"Stands for Mobile Device Management, it is only useful on Business headsets but still connects and sends a lot of data to PICO's servers on consumer ones",
		default: true,
	},
	{
		name: "Avatar Hub",
		package: "com.pvr.avatareditor",
		desc: "Avatar system specific to PICO, very few games if any that we are aware of use this",
		default: false,
	},
	{
		name: "Fitness",
		package: "com.pvr.pvrfit",
		desc: "Fuck fitness I lie in bed all day long",
		default: false,
	},
	{
		name: "Friends",
		package: "com.picopui.im",
		desc: "Friends and chatting system by PICO, unneeded for most common usecases",
		default: false,
	},
	{
		name: "Store",
		package: "com.picovr.store",
		desc: "PICO's own games and application store, sideloading APKs will still work when this is disabled",
		default: false,
	},
	{
		name: "User Center",
		package: "com.picovr.vrusercenter",
		desc: "Management and login for your PICO account, including account settings",
		default: false,
	},
];

function generateConfig(headset: HeadsetKey, packages: string[]) {
	const generateFragment = (pkgs: string[]) =>
		`<!-- added by debloat module -->\n` + pkgs.map(p => `<package name="${p}" />\n`).join("");

	const isEnterprise = HEADSETS[headset].enterprise;

	const consumerPackages = !isEnterprise
		? packages
		: [...appListShared, ...appListConsumer].filter(a => a.default).map(a => a.package);
	const enterprisePackages = isEnterprise
		? packages
		: [...appListShared, ...appListEnterprise].filter(a => a.default).map(a => a.package);

	const consumerFrag = generateFragment(consumerPackages);
	const enterpriseFrag = generateFragment(enterprisePackages);

	return `<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<pxrprovision_disablepackages version="1">
<!-- DEFAULT DISABLE LIST : /system/etc/pvrprovision/disablepackageslist_default.xml -->
<!-- Disable packages according to product, countrycode and edition. -->
<!-- You need to ensure that the format is correct. -->
    <product name="NEO3">
        <countrycode name="default" >
            <edition name="TOB" >
                <package name="com.iqiyi.ivrcinema.pico" />
                <package name="com.picopui.im" />
                <package name="com.picovr.lbplayer" />
                <package name="com.picovr.send.lbplayer" />
                <package name="com.pvr.assistanthmd" />
                <package name="com.pvr.avatareditor" />
                <package name="com.pvr.pvrfit" />
                <package name="com.pvr.socialhome" />
                <package name="com.ss.android.ttvr" />
                <package name="com.pvr.home" />
                <package name="com.picovr.store" />
                <package name="com.picovr.vrusercenter" />
                <package name="com.ss.android.ttvr.global" />
                <package name="com.picovr.activitycenter" />
                <package name="com.bytedance.os.feedback" />
                <package name="com.pvr.btperipheral" />
                <package name="com.picovr.mdm" />
                <package name="com.smartisanos.appstore" />
            </edition>
            <edition name="TOC" >
                <package name="com.picovr.enterpriseassistant" />
                <package name="com.pvr.tobhome" />
                <package name="com.pvr.tobservice" />
                <package name="com.picovr.tobvrusercenter" />
                <package name="com.picoxr.tobstore" />
                <package name="com.picoxr.tobmdm" />
            </edition>
        </countrycode>
    </product>
    <product name="PHX">
        <countrycode name="default" >
            <edition name="TOB" >
                <package name="com.iqiyi.ivrcinema.pico" />
                <package name="com.picopui.im" />
                <package name="com.picovr.lbplayer" />
                <package name="com.picovr.send.lbplayer" />
                <package name="com.pvr.assistanthmd" />
                <package name="com.pvr.avatareditor" />
                <package name="com.pvr.pvrfit" />
                <package name="com.pvr.socialhome" />
                <package name="com.ss.android.ttvr" />
                <package name="com.pvr.home" />
                <package name="com.picovr.store" />
                <package name="com.picovr.vrusercenter" />
                <package name="com.ss.android.ttvr.global" />
                <package name="com.picovr.activitycenter" />
                <package name="com.picovr.PicoEyeTracking" />
                <package name="com.tobii.tobiiblinkdemo" />
                <package name="com.tobii.usercalibration.neo3" />
                <package name="com.pvr.btperipheral" />
                <package name="com.picovr.mdm" />
                <package name="com.picovr.picolinkassistant" />
                <package name="com.pvr.voiceassistant" />
                <package name="com.smartisanos.appstore" />
${enterpriseFrag}
            </edition>
            <edition name="TOC" >
                <package name="com.picovr.enterpriseassistant" />
                <package name="com.pvr.tobhome" />
                <package name="com.pvr.tobservice" />
                <package name="com.picovr.tobvrusercenter" />
                <package name="com.picovr.PicoEyeTracking" />
                <package name="com.picoxr.tobstore" />
                <package name="com.picoxr.tobmdm" />
                <package name="com.tobii.tobiiblinkdemo" />
                <package name="com.tobii.usercalibration.neo3" />
                <package name="com.bytedance.pico.tob.userservice" />
                <package name="com.picoxr.bstreamassistant" />
                <package name="com.pvr.assistanthmd" />
${consumerFrag}
            </edition>
        </countrycode>
    </product>
    <product name="PHXPRO">
        <countrycode name="default" >
            <edition name="TOB" >
                <package name="com.iqiyi.ivrcinema.pico" />
                <package name="com.picopui.im" />
                <package name="com.picovr.lbplayer" />
                <package name="com.picovr.send.lbplayer" />
                <package name="com.pvr.assistanthmd" />
                <package name="com.pvr.avatareditor" />
                <package name="com.pvr.pvrfit" />
                <package name="com.pvr.socialhome" />
                <package name="com.ss.android.ttvr" />
                <package name="com.pvr.home" />
                <package name="com.picovr.store" />
                <package name="com.picovr.vrusercenter" />
                <package name="com.ss.android.ttvr.global" />
                <package name="com.picovr.activitycenter" />
                <package name="com.tobii.tobiiblinkdemo" />
                <package name="com.tobii.usercalibration.neo3" />
                <package name="com.pvr.btperipheral" />
                <package name="com.picovr.mdm" />
                <package name="com.picovr.picolinkassistant" />
                <package name="com.pvr.voiceassistant" />
                <package name="com.smartisanos.appstore" />
${enterpriseFrag}
            </edition>
            <edition name="TOC" >
                <package name="com.picovr.enterpriseassistant" />
                <package name="com.pvr.tobhome" />
                <package name="com.pvr.tobservice" />
                <package name="com.picovr.tobvrusercenter" />
                <package name="com.picoxr.tobstore" />
                <package name="com.picoxr.tobmdm" />
                <package name="com.tobii.tobiiblinkdemo" />
                <package name="com.tobii.usercalibration.neo3" />
                <package name="com.bytedance.pico.tob.userservice" />
                <package name="com.picoxr.bstreamassistant" />
                <package name="com.pvr.assistanthmd" />
${consumerFrag}
            </edition>
        </countrycode>
    </product>
</pxrprovision_disablepackages>
`;
}

async function generateModule(headset: HeadsetKey, packages: string[]) {
	const config = generateConfig(headset, packages);

	const zip = new JSZip();
	zip.file("META-INF/com/google/android/updater-script", `#MAGISK`);
	zip.file(
		"META-INF/com/google/android/update-binary",
		`#!/sbin/sh

#################
# Initialization
#################

umask 022

# echo before loading util_functions
ui_print() { echo "$1"; }

require_new_magisk() {
  ui_print "*******************************"
  ui_print " Please install Magisk v20.4+! "
  ui_print "*******************************"
  exit 1
}

#########################
# Load util_functions.sh
#########################

OUTFD=$2
ZIPFILE=$3

mount /data 2>/dev/null

[ -f /data/adb/magisk/util_functions.sh ] || require_new_magisk
. /data/adb/magisk/util_functions.sh
[ $MAGISK_VER_CODE -lt 20400 ] && require_new_magisk

install_module
exit 0
`,
	);
	zip.file("system/etc/pvrprovision/disablepackageslist_default.xml", config);
	zip.file(
		"module.prop",
		`id=wiki.pico4.debloat
name=PICO 4 Debloat
version=1.0
versionCode=1
author=pico4.wiki
description=Disables unwanted services. Custom-generated by https://pico4.wiki/debloat
`,
	);

	return await zip.generateAsync({ compression: "STORE", type: "blob" });
}

const HeadsetPicker: Component<{ headset: HeadsetKey | undefined; setHeadset: (h: HeadsetKey) => void }> = (props) => (
	<div style={{ display: "flex", gap: ".5rem", "flex-wrap": "wrap" }}>
		<For each={Object.entries(HEADSETS)}>
			{([key, { name }]) => (
				<button
					style={{ margin: "0" }}
					class={`p4w-custom ${props.headset === key ? "primary" : ""}`}
					onclick={() => props.setHeadset(key as HeadsetKey)}
				>
					<div>{name}</div>
				</button>
			)}
		</For>
	</div>
);

const AppPicker: Component<{ headset: HeadsetKey }> = (props) => {
	const relevantApps = createMemo(
		() => [...appListShared, ...(HEADSETS[props.headset].enterprise ? appListEnterprise : appListConsumer)],
	);
	const [selectedApps, setSelectedApps] = createSignal(relevantApps().filter(a => a.default));

	createEffect(() => {
		setSelectedApps(relevantApps().filter(a => a.default));
	});

	const setSelected = (app: App, enabled: boolean) => {
		if (enabled) {
			setSelectedApps([...selectedApps(), app]);
		} else {
			setSelectedApps(selectedApps().filter(a => a !== app));
		}
	};

	const finalize = async () => {
		const packageList = selectedApps().map(a => a.package);
		const module = await generateModule(props.headset, packageList);

		const a = document.createElement("a");
		a.href = URL.createObjectURL(module);
		a.download = "pico4-debloat-v1.0-custom.zip";
		a.click();

		URL.revokeObjectURL(a.href); // memory leak i guess
	};

	return (
		<div>
			<For each={relevantApps()}>
				{(app) => (
					<div
						style={{ "padding-top": "2rem", "padding-bottom": "2rem", cursor: "pointer" }}
						onClick={(e) => {
							e.preventDefault();
							setSelected(app, !selectedApps().includes(app));
						}}
						class={`p4w-custom card${selectedApps().includes(app) ? " primary" : ""}`}
					>
						<div
							style={{
								display: "flex",
								"line-height": "0px",
								gap: "6px",
								"align-items": "center",
								"font-size": "1.3rem",
								"font-weight": "bold",
							}}
						>
							<input
								type="checkbox"
								class="p4w-custom"
								checked={selectedApps().includes(app)}
								oninput={(ev) => setSelected(app, ev.target.checked)}
							/>
							{app.name}
						</div>
						<div>{app.desc}</div>
					</div>
				)}
			</For>

			<button class="p4w-custom primary" onclick={finalize}>Download Magisk Module</button>
		</div>
	);
};

export default () => {
	const [headset, setHeadset] = createSignal<HeadsetKey | undefined>(undefined);

	return (
		<>
			<HeadsetPicker headset={headset()} setHeadset={setHeadset} />
			<Show when={!!headset()}>
				<Show
					when={HEADSETS[headset()!].supported}
					fallback={
						<aside aria-label={"Unsupported Headset"} class={`starlight-aside starlight-aside--caution`}>
							{/* we cannot import this from starlight as it is a astro component which cannot render in the client */}
							<p class="starlight-aside__title" aria-hidden="true">
								Unsupported Headset
							</p>
							<div class="starlight-aside__content">
								The {HEADSETS[headset() ?? "4u"].name}{" "}
								is not supported by this tool. This tool only works with the PICO 4, PICO 4 Enterprise, and PICO 4 Pro
							</div>
						</aside>
					}
				>
					<AppPicker headset={headset()!} />
				</Show>
			</Show>
		</>
	);
};
