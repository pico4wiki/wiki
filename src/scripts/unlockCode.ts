export function generateUnlock(serial: number) {
	// chaixshot/more-picohaxx
	const key = "0XD9J6FB3ATQIHNM46XYZZZOPQRSTUVWXYZ";

	let val = serial & 0xF7F3F37F;

	if (val === 0)  return "pico0";

	const encoded_chars = [];
	while (val > 0) {
		encoded_chars.push(key[val & 0xF]);
		val >>= 4;
	}
	return `pico${encoded_chars.reverse().join("")}`;
}
