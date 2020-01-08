// Gets an index at which a value comparing with the result given by `compare` can be inserted to maintain order.
const binarySearch = (indexable, compare) => {
	let start = 0;
	let end = indexable.length;

	while (start < end) {
		const mid = Math.floor((start + end) / 2);
		const c = compare(indexable[mid]);

		if (c < 0) {
			end = mid;
		} else if (c > 0) {
			start = mid + 1;
		} else {
			return mid;
		}
	}

	return start;
};

export default binarySearch;
