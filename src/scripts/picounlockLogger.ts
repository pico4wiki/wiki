import {createEffect, createSignal, type Resource, untrack} from "solid-js";

type Log = {
	content: any[];
	time: Date,
	stack?: string;
	severity?: "verbose" | "info" | "warn" | "error";
}

export class PicounlockLogger {
	#logSig = createSignal<Log[]>([], {equals: false /* update array in place */});

	get logs() {
		return this.#logSig[0]();
	}

	log(severity: Log["severity"], ...content: any[]) {
		const stack = new Error().stack?.split("\n").slice(1).map(l => l.trim()).join("\n");

		const arr = this.#logSig[0]();
		arr.push({
			severity,
			stack,
			content,
			time: new Date()
		});
		this.#logSig[1](arr); // update reactivity
	}

	exportLogsTxt() {
		return untrack(this.#logSig[0]).map(l => (l.severity !== "info" ? `[${l.severity}]` : "") + l.content.map(c => c + "").join("; ")).join("\n")
	}

	// make these getters for functions to automatically bind them
	get verbose() {
		return (...content: any) => this.log("verbose", content);
	}

	get info() {
		return (...content: any) => this.log("info", content);
	}

	get warn() {
		return (...content: any) => this.log("warn", content);
	}

	get error() {
		return (...content: any) => this.log("error", content);
	}

	// we're assuming only one of this class exists at once, which is probably true.
	// honestly our use case probably doesnt need to handle concurrent promise shim()s, but do it just in case.
	#shimCount = 0;
	#shimOrigConsole = {...console};

	shim<T extends (...args: any) => any>(fn: T): ReturnType<T> {
		const reset = () => {
			if (--this.#shimCount > 0) return;
			
			console.log = this.#shimOrigConsole.log;
			console.warn = this.#shimOrigConsole.warn;
			console.error = this.#shimOrigConsole.error;
			console.debug = this.#shimOrigConsole.debug;
		}

		if (this.#shimCount++ === 0) {
			console.log = this.info;
			console.warn = this.warn;
			console.error = this.error;
			console.debug = this.verbose;
		}

		try {
			const res = fn();
			const isPromise = "then" in res;
			return !isPromise ? res : res.then(result => (reset(), result), error => (reset(), error));
		} finally {
			if (!isPromise) reset();
		}
	}

	logResourceErrors<T>(res: Resource<T>) {
		createEffect(() => {
			if (res.state === "errored")
				this.log("error", res.error)
		});
	}
}
