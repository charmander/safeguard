const decodeHex = hex => {
	const bytes = new Uint8Array(hex.length >>> 1);

	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(hex.substr(2 * i, 2), 16);
	}

	return bytes;
};

export default decodeHex;
