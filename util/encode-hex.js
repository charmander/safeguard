const encodeByteHex = byte => byte.toString(16).padStart(2, '0');

const encodeHex = arrayBuffer =>
	Array.from(new Uint8Array(arrayBuffer), encodeByteHex).join('');

export default encodeHex;
