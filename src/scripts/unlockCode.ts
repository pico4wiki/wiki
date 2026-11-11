export function generateUnlock(serial: number) {
	// chaixshot/more-picohaxx
	const key = "0XD9J6FB3ATQIHNM46XYZZZOPQRSTUVWXYZ";

	let val = BigInt(serial) & 0xF7F3F37Fn;

	if (val === 0n)  return "pico0";

	const encoded_chars = [];
	while (val > 0n) {
		encoded_chars.push(key[Number(val & 0xFn)]);
		val >>= 4n;
	}
	return `pico${encoded_chars.reverse().join("")}`;
}
