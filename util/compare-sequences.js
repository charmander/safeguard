const compareSequences = (a, b) => {
	const aIterator = a[Symbol.iterator]();
	const bIterator = b[Symbol.iterator]();

	for (;;) {
		const aNext = aIterator.next();
		const bNext = bIterator.next();

		if (aNext.done) {
			return bNext.done ? 0 : -1;
		}

		if (bNext.done) {
			return 1;
		}

		if (aNext.value < bNext.value) {
			return -1;
		}

		if (aNext.value > bNext.value) {
			return 1;
		}
	}
};

export default compareSequences;
