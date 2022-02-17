function $$(selector) {
	return document.querySelector(selector);
}

function throttle(callback, delay = 0) {
	let id = null;
	return function () {
		if (id) clearTimeout(id);
		id = setTimeout(() => callback.apply(this, [...arguments]), delay);
	};
}

function throttleByFrame(callback) {
	let id = null;
	return function () {
		if (id) window.cancelAnimationFrame(id);
		id = window.requestAnimationFrame(() => callback.apply(this, [...arguments]));
	};
}

function binarySearch(arr, value, key) {
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

function cacBuffer(type, index, count, cacBuffer, dataLen) {
	if (typeof cacBuffer !== 'number') {
		return console.warn(`请检查输入的缓冲区数据类型是否正确`);
	}

	const sBufferHandler = () => {
		const idx = index - Math.ceil(count * cacBuffer);
		return idx > 0 ? idx : 0;
	};

	const eBufferHandler = () => {
		const idx = index + Math.ceil(count * cacBuffer);
		return idx < dataLen ? idx : dataLen;
	};

	return type === 's' ? sBufferHandler() : eBufferHandler();
}
