export function throttle(callback, delay = 10) {
	let id = null;
	return function () {
		if (id) clearTimeout(id);
		id = setTimeout(() => callback.apply(this, arguments), delay);
	};
}

export function throttleByFrame(callback) {
	let id = null;
	return function () {
		if (id) window.cancelAnimationFrame(id);
		id = window.requestAnimationFrame(() => callback.apply(this, arguments));
	};
}

export function binarySearch(arr, value, key) {
	let _left = 0;
	let _right = arr.length - 1;
	let _index = null;
	let _midVal = null;
	while (_left <= _right) {
		const _midIdx = Math.floor((_left + _right) / 2);
		_midVal = arr[_midIdx];

		key && (_midVal = _midVal[key]);

		if (value === _midVal) {
			return _midIdx;
		} else if (value > _midVal) {
			// 往右边查找
			_left = _midIdx + 1;
		} else if (value < _midVal) {
			// 往左边查找
			if (_index === null || _index > _midIdx) {
				_index = _midIdx;
			}
			_right--;
		}
	}
	return _index;
}
