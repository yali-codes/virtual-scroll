console.log('============');
/**
 * 虚拟滚动列表构造函数
 * @param {*} el 列表挂载的节点
 * @param {*} dataSource 需要渲染的数据
 * @param {*} genItemCallback 生成每一项的回调函数
 * @param {*} options 配置项
 */
function VirtualScroll(el, dataSource, genItemCallback, options = {}) {
	if (typeof el === 'string') {
		el = document.querySelector(el);
	}

	this.el = el; // 容器元素
	this.dataSource = dataSource; // 列表数据
	this.dataLen = dataSource.length;
	this.genItemCallback = genItemCallback; // 生成列表DOM元素的回调函数

	// 默认参数配置
	this.configs = {
		itemHeight: 50,
		isDynamicHeight: false,
		itemHeight: 50,
		bufferScale: 0.5,
		useFrameOptimize: false,
		isCustomScrollBar: true,
	};

	// 合并参数
	Object.assign(this.configs, { ...options });

	// 计算列表中每一个节点的累计高度
	this.setItemsPosition();

	// 创建虚拟滚动容器
	this.createContainer();

	// 调用初始化方法
	this.initBase();

	// 绑定事件
	this.bindEvents();

	// 开始渲染
	this.render();
}

VirtualScroll.prototype.setItemsPosition = function () {
	if (!this.configs.isDynamicHeight) return;
	const { configs, dataLen } = this;
	let index = 0;

	const _itemsPosition = [];
	const _itemHeight = configs.itemHeight;
	while (index < dataLen) {
		_itemsPosition.push({
			index,
			height: _itemHeight,
			top: index * _itemHeight,
			bottom: (index + 1) * _itemHeight,
		});
		index++;
	}

	this.itemsPosition = _itemsPosition;
};

VirtualScroll.prototype.initBase = function () {
	// 解构参数
	const { vListContainer, configs, itemsPosition, dataLen, allItemContainer } = this;
	const { isDynamicHeight, itemHeight } = configs;

	// 计算总高度
	this.totalHeight = isDynamicHeight ? itemsPosition[itemsPosition.length - 1].bottom : itemHeight * dataLen;

	// 设置容器的可见虚拟节点数
	const _containerHeight = vListContainer.clientHeight;

	this.clientAmounts = Math.ceil(_containerHeight / itemHeight);

	// 将总高度更新到 allItemContainer 节点上
	allItemContainer.style.height = `${this.totalHeight}px`;

	// 更新自定义滚动条的高度
	this.updateVScrollbarThumElembHeight();
};

VirtualScroll.prototype.createContainer = function () {
	const _container = document.createElement('div');
	_container.classList.add('v-container');
	_container.style.cssText = `
		position: relative;
		height: 100%; overflow: hidden;
	`;

	this.creatVListContainer(_container);

	// 如果需要自定义滚动条，需要初始化
	if (this.configs.isCustomScrollBar) {
		this.createScrollbarContainer(_container);
	}

	if (this.el) {
		this.el.appendChild(_container);
	}
};

VirtualScroll.prototype.creatVListContainer = function (parent) {
	const _vListContainer = document.createElement('div');
	_vListContainer.classList.add('v-list');
	_vListContainer.style.cssText = `
		position: relative;
		height: 100%; overflow-y: auto;
	`;

	// 缓存创建的好DOM
	this.vListContainer = _vListContainer;

	// 创建所有的item的容器
	this.createAllItemContainer(_vListContainer);

	// 创建可见容器
	this.createVisibleItemContainer(_vListContainer);

	if (parent) {
		parent.appendChild(_vListContainer);
	}
};

VirtualScroll.prototype.createAllItemContainer = function (parent) {
	const _allItemContainer = document.createElement('div');
	_allItemContainer.classList.add('v-all-items');
	_allItemContainer.style.cssText = `
		position: absolute;
		left: 0; right: 0; top: 0;
		z-index: -1; height: 1px;
	`;

	this.allItemContainer = _allItemContainer;

	if (parent) {
		parent.appendChild(_allItemContainer);
	}
};

VirtualScroll.prototype.createVisibleItemContainer = function (parent) {
	// 创建可见的元素容器
	const _visibleItemContainer = document.createElement('div');
	_visibleItemContainer.classList.add('v-visible-items');
	_visibleItemContainer.style.cssText = `
		position: absolute;
		left: 0; right: 0; top: 0; z-index: 1;
		transform: translate3d(0px, 0px, 0px)
	`;

	// 缓存创建的好DOM
	this.visibleItemContainer = _visibleItemContainer;

	// 挂载到父级
	if (parent) {
		parent.appendChild(_visibleItemContainer);
	}
};

/**创建自定义滚动条 */
VirtualScroll.prototype.createScrollbarContainer = function (parent) {
	const { scrollbarWidth = 6 } = this.configs;
	const _scrollbarContainer = document.createElement('div');
	_scrollbarContainer.classList.add('v-scrollbar');
	_scrollbarContainer.style.cssText = `
		position: absolute;
		top: 0; bottom: 0; right: 0;
		width: ${scrollbarWidth}px;
	`;

	// 创建滚动条容器滑块
	const _scrollbarThumbContainer = document.createElement('div');
	_scrollbarThumbContainer.classList.add('v-scrollbar-tail-thumb');
	_scrollbarThumbContainer.style.cssText = `
		position: absolute; top: 0; left: 0; z-index: 10;
		width: 100%; height: 20px; background: rgba(100, 100, 100, 0.4);
		border-radius: 99px; cursor: pointer; user-select: none; transition: all 500;
	`;

	_scrollbarContainer.appendChild(_scrollbarThumbContainer);
	this.scrollbarContainer = _scrollbarContainer;
	this.scrollbarThumbContainer = _scrollbarThumbContainer;

	if (parent) {
		parent.appendChild(_scrollbarContainer);
	}
};

VirtualScroll.prototype.bindEvents = function () {
	const { vListContainer, allItemContainer, scrollbarContainer, scrollbarThumbContainer, configs } = this;
	const { useFrameOptimize, isCustomScrollBar } = configs;

	// scroll事件的回调函数
	const _updateOffset = e => {
		e.preventDefault();
		this.render(e.target.scrollTop);
	};

	// 绑定滚动事件，用节流函数包装 scroll 事件的回调函数
	const _scrollHandler = useFrameOptimize ? throttleByFrame(_updateOffset) : throttle(_updateOffset);
	vListContainer.addEventListener('scroll', _scrollHandler);

	// 如果有自定义滚动条，那么给自定义滚动条绑定拖拽事件
	if (isCustomScrollBar) {
		let _moveY = null;
		vListContainer.classList.add('is-custom-scrollbar');

		/**鼠标按下回调函数 */
		const mousedownHanlder = evt => {
			_moveY = evt.pageY - (parseInt(scrollbarThumbContainer.style.top) || 0);

			// 绑定事件
			document.addEventListener('mouseup', mouseupHandler);
			document.addEventListener('mousemove', mousemoveHandler);
		};

		/**鼠标移动回调函数 */
		const mousemoveHandler = evt => {
			// 获取相关的节点的高度
			const _totalHeight = allItemContainer.clientHeight;
			const _scrollbarHeight = scrollbarContainer.clientHeight;
			const _visibleHeight = vListContainer.clientHeight;
			const _thumbHeight = scrollbarThumbContainer.clientHeight;
			const _thumbRealHeight = scrollbarThumbContainer.getAttribute('real-height'); // 滑块的高度有需要特殊处理
			const _moveRealMaxHeight = _scrollbarHeight - (_thumbRealHeight < 20 ? _thumbRealHeight : 0) - _thumbHeight;

			let _moveDis = evt.pageY - _moveY;

			// 滑块只能在 0 ~ _moveRealMaxHeight 之间滑动
			if (_moveDis < 0 || _moveDis > _scrollbarHeight - _thumbHeight) {
				return;
			}

			// 设备自定义滚动条滑块的top值
			if (isCustomScrollBar) {
				scrollbarThumbContainer.style.top = `${_moveDis}px`;
			}

			// 触发容器的滚动事件
			const _scrollTop = Math.floor(((_totalHeight - _visibleHeight) * _moveDis) / _moveRealMaxHeight);
			vListContainer.scrollTop = _scrollTop;
		};

		/**鼠标弹起回调函数 */
		const mouseupHandler = () => {
			document.removeEventListener('mousedown', mousedownHanlder);
			document.removeEventListener('mousemove', mousemoveHandler);
		};

		scrollbarContainer.addEventListener('mousedown', mousedownHanlder);
	}
};

VirtualScroll.prototype.render = function (offset = 0) {
	const { dataLen, configs, clientAmounts, dataSource, itemHeight, visibleItemContainer, genItemCallback } = this;
	const { bufferScale, isDynamicHeight, isCustomScrollBar } = configs;

	// 开始渲染虚拟列表
	let _sIndex = this.findFirstIndex(offset);
	let _eIndex = Math.min(this.findEndIndex(_sIndex), dataLen);

	// 检测是否有需要保留缓存区域
	if (bufferScale) {
		_sIndex = this.cacBuffer('s', _sIndex, clientAmounts);
		_eIndex = this.cacBuffer('e', _eIndex, clientAmounts);
	}

	// 截取可渲染的数据列表
	this.renderList = dataSource.slice(_sIndex, _eIndex);

	const _itemRenderCallback = (item, i, arr) => {
		const _item = genItemCallback(item, i, arr);
		if (!isDynamicHeight) {
			_item.style.height = itemHeight;
		}
		return _item.outerHTML;
	};

	const _htmlString = this.renderList.map(_itemRenderCallback).join('');
	visibleItemContainer.innerHTML = _htmlString;

	// 如果是动态高度，需要重新计并更新 itemsPosition 的位置信息，以及 allItemContainer 高度
	if (isDynamicHeight) {
		this.updateItemsPotion(visibleItemContainer.children, _sIndex);
		this.updateAllItemContainerHeight();
	}

	// 设置内容的偏移量 visibleItemContainer 的 translate3d
	this.updateVisibleItemContainerTranslate(_sIndex);

	// 如果配置的是自定义滚动条，那么需要动态计算滑块的位置
	if (isCustomScrollBar) {
		this.updateVScrollbarThumElembHeight();
	}
};

VirtualScroll.prototype.updateItemsPotion = function (children, sIndex) {
	// 遍历children，获取每一个child的rect -> child.getBoundingClientRect()
	if (!children.length) return;
	let _sIndex = sIndex;
	[...children].forEach(chidNode => {
		const _rect = chidNode.getBoundingClientRect();
		const { height } = _rect;
		const { itemsPosition } = this;
		const { height: oldHeight, bottom: oldBottom } = itemsPosition[_sIndex];
		const _diffVal = oldHeight - height;
		if (_diffVal) {
			itemsPosition[_sIndex].height = height;
			itemsPosition[_sIndex].bottom = Math.ceil(oldBottom - _diffVal);

			// 并一次更新后续的节点
			for (let i = _sIndex + 1, len = itemsPosition.length; i < len; i++) {
				itemsPosition[i].top = itemsPosition[i - 1].bottom;
				itemsPosition[i].bottom = Math.ceil(itemsPosition[i].bottom - _diffVal);
			}
		}
		_sIndex++;
	});
};

VirtualScroll.prototype.updateAllItemContainerHeight = function () {
	const { allItemContainer, itemsPosition } = this;
	allItemContainer.style.height = `${itemsPosition[itemsPosition.length - 1].bottom}px`;
};

VirtualScroll.prototype.updateVisibleItemContainerTranslate = function (sIndex) {
	const { visibleItemContainer, itemsPosition, configs } = this;
	const { isDynamicHeight, itemHeight } = configs;
	// 根据是否处于动态高度模式来返回偏移结果

	let _offset = null;
	if (isDynamicHeight) {
		_offset = itemsPosition[sIndex].top;
	} else {
		_offset = sIndex * itemHeight;
	}
	visibleItemContainer.style.transform = `translate3d(0px, ${_offset}px, 0px)`;
};

VirtualScroll.prototype.updateVScrollbarThumElembHeight = function () {
	if (this.configs.isCustomScrollBar) {
		const { allItemContainer, vListContainer, scrollbarThumbContainer } = this;
		const _visibleHeight = vListContainer.clientHeight;
		const _totalHeight = allItemContainer.clientHeight;
		const _height = Math.ceil((_visibleHeight * _visibleHeight) / _totalHeight);

		// 设置真实的高度
		scrollbarThumbContainer.setAttribute('real-height', _height);
		scrollbarThumbContainer.style.height = `${_height > 20 ? _height : 20}px`;
	}
};

VirtualScroll.prototype.findFirstIndex = function (offset) {
	const { isDynamicHeight, itemHeight } = this.configs;
	// 二分法查找 top
	return isDynamicHeight ? binarySearch(this.itemsPosition, offset, 'bottom') : Math.floor(offset / itemHeight);
};

VirtualScroll.prototype.findEndIndex = function (sIndex) {
	const { clientAmounts } = this;
	return sIndex + clientAmounts;
};

VirtualScroll.prototype.cacBuffer = function (type, index, count) {
	const { configs, dataLen } = this;
	const { bufferScale } = configs;

	if (typeof bufferScale !== 'number') {
		return console.warn(`请检查输入的缓冲区数据类型是否正确`);
	}

	const _sBufferHandler = () => {
		const _index = index - Math.ceil(count * bufferScale);
		return _index > 0 ? _index : 0;
	};

	const _eBufferHandler = () => {
		const _index = index + Math.ceil(count * bufferScale);
		return _index < dataLen ? _index : dataLen;
	};

	return type === 's' ? _sBufferHandler() : _eBufferHandler();
};

function throttle(callback, delay = 10) {
	let id = null;
	return function () {
		if (id) clearTimeout(id);
		id = setTimeout(() => callback.apply(this, arguments), delay);
	};
}

function throttleByFrame(callback) {
	let id = null;
	return function () {
		if (id) window.cancelAnimationFrame(id);
		id = window.requestAnimationFrame(() => callback.apply(this, arguments));
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
