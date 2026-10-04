import {type Component, createEffect, createSignal, For, Show} from "solid-js";
import JSZip from "jszip";

interface App {
	name: string;
	package: string;
	desc: string;
	default: boolean;
}

const HEADSETS = {
	"4": {name: "PICO 4", supported: true, enterprise: false },
	"4e": {name: "PICO 4 Enterprise", supported: true, enterprise: true },
	"4p": {name: "PICO 4 Pro", supported: true, enterprise: false },
	"4u": {name: "PICO 4 Ultra", supported: false, enterprise: false },
	"4ue": {name: "PICO 4 Ultra Enterprise", supported: false, enterprise: true },
} as const;

type HeadsetKey = keyof typeof HEADSETS;

const appListShared: App[] = [
	{
		name: "TeaTracker",
		package: "os.teatracker",
		desc: "PICO Analytics service - collects data and sends it back to ByteDance. (TODO:) May break store if blocked",
		default: true
	},
	{
		name: "User Guide",
		package: "com.picovr.guide",
		desc: "Help Guide that most users won't need",
		default: true
	},
	{
		name: "Feedback",
		package: "com.bytedance.os.feedback",
		desc: "Bytedance are unlikely to bother with feedback for a two-gens-old headset",
		default: true,
	}
];

const appListEnterprise: App[] = [
	{
		name: "Home",
		package: "com.pvr.tobhome",
		desc: "Annoying 'Home' UI which pops up when you first start the headset, and intermittently while using it",
		default: true
	},
	{
		name: "Business Suite",
		package: "com.picovr.enterpriseassistant",
		desc: "Alternative home UI for enterprise use - essentially useless",
		default: true
	}, {
		name: "Business User Center",
		package: "com.picovr.tobvrusercenter",
		desc: "Accounts login and management for enterprise acccounts",
		default: true
	}, {
		name: "Business Store",
		package: "com.picoxr.tobstore",
		desc: "The Business Store does not contain many useful things - just sideload APKs",
		default: true
	}, {
		name: "Device Manager",
		package: "com.picoxr.tobmdm",
		desc: "Mobile Device Management allows businesses to remotely manage their devices. This service sends a lot of sensitive data to PICO servers",
		default: true
	}, {
		name: "Business Streaming Assistant",
		package: "com.picoxr.bstreamassistant",
		desc: "Significantly older and worse than PICO Connect, sideload that instead",
		default: true
	},
]

const appListConsumer: App[] = [
	{
		name: "Explore",
		package: "com.pvr.home",
		desc: "Annoying 'Explore' UI which pops up when you first start the headset, and intermittently while using it",
		default: true
	},
	{
		name: "MdmProject",
		package: "com.picoxr.mdm",
		desc: "Mobile Device Management is relevant only to businesses. This service sends a lot of sensitive data to PICO servers",
		default: true
	},
	{
		name: "Avatar Hub",
		package: "com.pvr.avatareditor",
		desc: "PICO's own avatar system, I'm unaware of any games that use this but some probably exist",
		default: false
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
		desc: "PICO Friends and Chat system",
		default: false
	},
	{
		name: "Store",
		package: "com.picovr.store",
		desc: "Game and software store",
		default: false
	},
	{
		name: "User Center",
		package: "com.picovr.vrusercenter",
		desc: "Account login and management",
		default: false,
	}
]

function generateConfig(headset: HeadsetKey, packages: string[]) {
	const generateFragment = (pkgs: string[]) => `<!-- added by debloat module -->\n` + pkgs.map(p => `<package name="${p}" />\n`).join("");

	const isEnterprise = HEADSETS[headset].enterprise;

	const consumerPackages = !isEnterprise ? packages : [...appListShared, ...appListConsumer].filter(a => a.default).map(a => a.package);
	const enterprisePackages = isEnterprise ? packages : [...appListShared, ...appListEnterprise].filter(a => a.default).map(a => a.package);

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
	zip.file("META-INF/com/google/android/update-binary", `#!/sbin/sh

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
`);
	zip.file("system/etc/pvrprovision/disablepackageslist_default.xml", config);
	zip.file("module.prop", `id=wiki.pico4.debloat
name=PICO 4 Debloat
version=1.0
versionCode=1
author=pico4.wiki
description=Disables unwanted services. Custom-generated by https://pico4.wiki/debloat
`);

	return await zip.generateAsync({ compression: "STORE", type: "blob" });
}

const HeadsetPicker: Component<{ setHeadset: (h: HeadsetKey) => void }> = (props) => (
	<div>
		<For each={Object.entries(HEADSETS)}>
			{([key, {name}]) => <button onclick={() => props.setHeadset(key as HeadsetKey)}>
				<div>{name}</div>
			</button>}
		</For>
	</div>
);

const HeadsetNotSupported: Component<{ headset: HeadsetKey, back: () => void }> = (props) => <div>
	<div>The {HEADSETS[props.headset].name} is not supported by this tool. This tool only works with the PICO 4, PICO 4 Enterprise, and PICO 4 Pro.</div>
	<button onclick={props.back}>Back</button>
</div>

const AppPicker: Component<{ headset: HeadsetKey }> = (props) => {

	const relevantApps = [...appListShared, ...(HEADSETS[props.headset].enterprise ? appListEnterprise : appListConsumer)];

	const [selectedApps, setSelectedApps] = createSignal(relevantApps.filter(a => a.default));

	const setSelected = (app: App, enabled: boolean) => {
		if (enabled) {
			setSelectedApps([...selectedApps(), app])
		} else {
			setSelectedApps(selectedApps().filter(a => a !== app))
		}
	}

	const finalize = async () => {
		const packageList = selectedApps().map(a => a.package);
		const module = await generateModule(props.headset, packageList);

		const a = document.createElement("a");
		a.href = URL.createObjectURL(module);
		a.download = "pico4-debloat-v1.0-custom.zip"
		a.click();

		URL.revokeObjectURL(a.href); // memory leak i guess
	}

	return <div>
		<For each={relevantApps}>
			{(app) =>
				<div>
					<div>
						<input type="checkbox" checked={selectedApps().includes(app)} oninput={(ev) => setSelected(app, ev.target.checked)} />
						{app.name}
					</div>
					<div>{app.desc}</div>
				</div>
			}
		</For>

		<button onclick={finalize}>Download Magisk Module</button>
	</div>
}

export default () => {
	const [headset, setHeadset] = createSignal<HeadsetKey | undefined>(undefined);

	return (
		<>
			<Show when={!!headset()} fallback={<HeadsetPicker setHeadset={setHeadset} />}>
				<Show when={HEADSETS[headset()!].supported} fallback={<HeadsetNotSupported headset={headset()!} back={() => setHeadset(undefined)} />}>
					<button onclick={() => setHeadset(undefined)}>Back to headset selector</button>

					<AppPicker headset={headset()!} />
				</Show>
			</Show>
		</>
	);
};
