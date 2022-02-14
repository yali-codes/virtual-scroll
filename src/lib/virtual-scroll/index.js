import { throttle, throttleByFrame, binarySearch } from './helper';

/**
 * 虚拟滚动列表构造函数
 * @param {*} el 列表挂载的节点
 * @param {*} dataSource 需要渲染的数据
 * @param {*} genItemCallback 生成每一项的回调函数
 * @param {*} options 配置项
 */
export default function VirtualScroll(el, dataSource, genItemCallback, options = {}) {
	if (typeof el === 'string') {
		el = document.querySelector(el);
	}

	this.el = el; // 容器元素
	this.dataSource = dataSource; // 列表数据
	this.dataLen = dataSource.length;
	this.genItemCallback = genItemCallback; // 生成列表DOM元素的回调函数
	this.offset = 0;
	this.clientHeight = 0;
	this.clientAmounts = 0;

	// 默认参数配置
	this.configs = {
		itemHeight: 50,
		isDynamicHeight: false,
		bufferScale: 0.2,
		useFrameOptimize: false,
		isCustomScrollBar: true,
		borderRadius: 6,
		scrollthumbBarWidth: 6,
	};

	// 合并参数
	Object.assign(this.configs, { ...options });

	// 计算列表中每一个节点的累计高度
	this.setItemsPosition();

	// 创建虚拟滚动容器
	this.createContainer();

	// 创建虚拟列表
	this.createVListContainer();

	// 首次渲染虚拟列表
	this.render();

	// 注册滚动事件
	this.bindScrollbarEvent();

	// 注册窗口改变事件
	this.bindResizeEvent();

	// 如果需要自定义滚动条，需要创建滚动条, 这里要抽离成一个类
	this.createScrollbarContainer(this.configs);
}

VirtualScroll.prototype.setTotalHeight = function (totalHeight) {
	// 将总高度更新到 allItemContainer 节点上
	this.allItemContainer.style.height = `${totalHeight}px`;

	// 更新可显示的总记录数
	this.setClientAmounts();
};

VirtualScroll.prototype.setClientAmounts = function () {
	// 设置容器的可见虚拟节点数
	this.clientAmounts = Math.ceil(this.vListContainer.clientHeight / this.configs.itemHeight);
};

VirtualScroll.prototype.setItemsPosition = function (sIndex = 0, currItem) {
	if (!this.configs.isDynamicHeight) return;
	const itemsPosition = [];
	const itemHeight = this.configs.itemHeight;

	let index = 0;
	let top = 0;
	let bottom = 0;
	let cachedPosition = [];
	let dataLen = this.dataLen;

	if (sIndex && currItem) {
		const { top: currTop, bottom: currBottom } = currItem;
		top = currTop;
		bottom = currBottom;
		dataLen = this.dataLen - sIndex;
		cachedPosition = this.itemsPosition.slice(0, sIndex);
	}

	while (index < dataLen) {
		itemsPosition.push({
			index: index + sIndex,
			height: itemHeight,
			top: index * itemHeight + top,
			bottom: (index + 1) * itemHeight + bottom,
		});
		index++;
	}

	this.itemsPosition = [...cachedPosition, ...itemsPosition];
};

VirtualScroll.prototype.createContainer = function () {
	const vContainer = document.createElement('div');
	vContainer.classList.add('v-container');
	vContainer.style.cssText = `position: relative; height: 100%; overflow: hidden;`;

	if (this.el) {
		this.vContainer = vContainer; // 缓存虚拟列表节点
		this.el.appendChild(vContainer);
	}
};

VirtualScroll.prototype.createVListContainer = function () {
	const vListContainer = document.createElement('div');
	vListContainer.classList.add('v-list');
	vListContainer.style.cssText = `position: relative; height: 100%; overflow-y: auto;`;

	// 缓存创建的好DOM
	this.vListContainer = vListContainer;

	// 创建所有的item的容器
	this.createAllItemContainer();

	// 创建可见容器
	this.createVisibleItemContainer();

	if (this.vContainer) {
		this.vContainer.appendChild(vListContainer);
	}

	// 将总高度更新到 allItemContainer 节点上
	const dataLen = this.dataLen;
	this.setTotalHeight(this.configs.isDynamicHeight ? this.itemsPosition[dataLen - 1].bottom : this.itemHeight * dataLen);

	// 注册滚动事件
	this.bindScrollbarEvent();
};

VirtualScroll.prototype.createAllItemContainer = function () {
	const allItemContainer = document.createElement('div');
	allItemContainer.classList.add('v-all-items');
	allItemContainer.style.cssText = `position: absolute; left: 0; right: 0; top: 0; z-index: -1; height: 1px;`;

	// 缓存创建的好的节点
	this.allItemContainer = allItemContainer;

	// 挂载到父级
	if (this.vListContainer) {
		this.vListContainer.appendChild(allItemContainer);
	}
};

VirtualScroll.prototype.createVisibleItemContainer = function () {
	// 创建可见的元素容器
	const visibleItemContainer = document.createElement('div');
	visibleItemContainer.classList.add('v-visible-items');
	visibleItemContainer.style.cssText = `
		position: absolute;	left: 0; right: 0; top: 0;
		z-index: 1;	transform: translate3d(0px, 0px, 0px)
	`;

	// 缓存创建的好的节点
	this.visibleItemContainer = visibleItemContainer;

	// 挂载到父级
	if (this.vListContainer) {
		this.vListContainer.appendChild(visibleItemContainer);
	}
};

/**创建自定义滚动条 */
VirtualScroll.prototype.createScrollbarContainer = function (configs) {
	// 如果没有开启自定义滚动条配置项直接返回
	if (!configs.isCustomScrollBar || this.scrollbarContainer) {
		return;
	}

	const scrollbarContainer = document.createElement('div');
	scrollbarContainer.classList.add('v-scrollbar');
	scrollbarContainer.style.cssText = `
		position: absolute;
		top: 0; bottom: 0; right: 0;
		width: ${configs.scrollthumbBarWidth}px;
	`;

	// 创建滚动条容器滑块
	const scrollbarThumbContainer = document.createElement('div');
	scrollbarThumbContainer.classList.add('v-scrollbar-thumb');
	scrollbarThumbContainer.style.cssText = `
		position: absolute; left: 0; top: 0; z-index: 10;
		width: 100%; background: rgba(100, 100, 100, 100); opacity: 0.4;
		border-radius: ${configs.borderRadius}px; cursor: pointer; user-select: none; transition: all 500;
	`;

	// 挂载到滚动条容器
	scrollbarContainer.appendChild(scrollbarThumbContainer);
	this.scrollbarContainer = scrollbarContainer;
	this.scrollbarThumbContainer = scrollbarThumbContainer;

	if (this.vContainer) {
		// 挂载到父级
		this.vContainer.appendChild(scrollbarContainer);

		// 设定滚动条的高度
		this.updateVScrollbarThumElemHeight();

		// 绑定事件
		this.bindCustomScrollbarEvents();
	}
};

VirtualScroll.prototype.bindScrollbarEvent = function () {
	// scroll事件的回调函数
	const updateOffsetHandler = e => {
		e.preventDefault();
		const scrollTop = (this.offset = e.target.scrollTop);
		// 更新自定义滚动条的位置
		if (this.configs.isCustomScrollBar && this.scrollbarContainer) {
			const totalHeight = this.allItemContainer.clientHeight;
			const visibleHeight = this.vListContainer.clientHeight;
			const moveMaximumHeight = this.scrollbarContainer.clientHeight - this.scrollbarThumbContainer.clientHeight;
			this.scrollbarThumbContainer.style.top = `${Math.floor((scrollTop * moveMaximumHeight) / (totalHeight - visibleHeight))}px`;
		}

		this.render(); // 渲染列表数据
	};

	// 绑定滚动事件，用节流函数包装 scroll 事件的回调函数
	const scrollHandler = this.configs.useFrameOptimize ? throttleByFrame(updateOffsetHandler) : throttle(updateOffsetHandler);
	this.vListContainer.addEventListener('scroll', scrollHandler);
};

VirtualScroll.prototype.bindResizeEvent = function () {
	// 监听窗口改变事件回调
	window.addEventListener('resize', () => {
		this.setClientAmounts();
		this.createScrollbarContainer(this.configs);
		this.render();
	});
};

VirtualScroll.prototype.bindCustomScrollbarEvents = function () {
	// 如果有自定义滚动条，那么给自定义滚动条绑定拖拽事件
	let moveY = null;
	let vListContainer = null;

	/**鼠标按下回调函数 */
	const mousedownHanlder = evt => {
		moveY = evt.pageY - (parseInt(this.scrollbarThumbContainer.style.top) || 0);
		document.addEventListener('mouseup', mouseupHandler);
		document.addEventListener('mousemove', mousemoveHandler);
	};

	/**鼠标移动回调函数 */
	const mousemoveHandler = evt => {
		// 获取相关的节点的高度
		const totalHeight = this.allItemContainer.clientHeight;
		const scrollbarHeight = this.scrollbarContainer.clientHeight;
		const thumbBarHeight = this.scrollbarThumbContainer.clientHeight;
		const moveMaximumHeight = scrollbarHeight - thumbBarHeight;
		const _moveDis = evt.pageY - moveY;

		// 滑块只能在 0 ~ moveMaximumHeight 之间滑动
		if (_moveDis < 0 || _moveDis > moveMaximumHeight) {
			return;
		}

		// 设备自定义滚动条滑块的top值
		if (this.configs.isCustomScrollBar) {
			this.scrollbarThumbContainer.style.top = `${_moveDis}px`;
		}

		// 触发容器的滚动事件
		if (vListContainer) {
			vListContainer.scrollTop = Math.ceil(((totalHeight - scrollbarHeight) * _moveDis) / moveMaximumHeight);
		}
	};

	/**鼠标弹起回调函数 */
	const mouseupHandler = () => {
		document.removeEventListener('mousedown', mousedownHanlder);
		document.removeEventListener('mousemove', mousemoveHandler);
	};

	if (this.scrollbarContainer) {
		vListContainer = this.scrollbarContainer.previousSibling;
		vListContainer.classList.add('is-custom-scrollbar');
		this.scrollbarContainer.addEventListener('mousedown', mousedownHanlder);
	}
};

VirtualScroll.prototype.loadMoreData = function (data, idx) {
	this.dataSource = data;
	this.dataLen = data.length;

	// 更新总高
	if (this.configs.isDynamicHeight) {
		const currentItem = this.itemsPosition[idx - 1];
		this.setItemsPosition(idx, currentItem);
		this.setTotalHeight(this.itemsPosition[this.dataLen - 1].bottom);
	} else {
		this.setTotalHeight(this.dataLen * this.configs.itemHeight);
	}

	// 渲染
	this.render();

	// 重新计算自定义滚动条滑块的位置
	const scrollbarContainer = this.scrollbarContainer;
	if (this.configs.isCustomScrollBar && scrollbarContainer) {
		this.updateVScrollbarThumElemHeight();
		const scrollbarThumbContainer = this.scrollbarThumbContainer;
		const totalHeight = this.allItemContainer.clientHeight;
		const visibleHeight = this.vListContainer.clientHeight;
		const moveMaximumHeight = scrollbarContainer.clientHeight - scrollbarThumbContainer.clientHeight;
		const newTop = Math.floor((this.vListContainer.scrollTop * moveMaximumHeight) / (totalHeight - visibleHeight));
		scrollbarThumbContainer.style.top = `${newTop}px`;
	}
};

VirtualScroll.prototype.render = function () {
	// 开始渲染虚拟列表
	let sIndex = this.findFirstIndex(this.offset);
	let eIndex = Math.min(this.findEndIndex(sIndex), this.dataLen);

	// 检测是否有需要保留缓存区域
	if (this.configs.bufferScale) {
		sIndex = this.cacBuffer('s', sIndex, this.clientAmounts);
		eIndex = this.cacBuffer('e', eIndex, this.clientAmounts);
	}

	// 截取可渲染的数据列表
	this.renderList = this.dataSource.slice(sIndex, eIndex);

	const itemRenderCallback = item => {
		const itemNode = this.genItemCallback(item);
		if (!this.configs.isDynamicHeight) {
			itemNode.style.height = this.itemHeight;
		}
		return itemNode.outerHTML;
	};

	const htmlString = this.renderList.map(itemRenderCallback).join('');
	this.visibleItemContainer.innerHTML = htmlString;

	// 如果是动态高度，需要重新计并更新 itemsPosition 的位置信息，以及 allItemContainer 高度
	if (this.configs.isDynamicHeight) {
		this.updateItemsPotion(this.visibleItemContainer.children, sIndex);
		this.updateAllItemContainerHeight();
	}

	// 设置内容的偏移量 visibleItemContainer 的 translate3d
	this.updateVisibleItemContainerTranslate(sIndex);

	// 如果配置的是自定义滚动条，那么需要动态计算滑块的位置
	if (this.configs.isCustomScrollBar) {
		this.updateVScrollbarThumElemHeight();
	}
};

VirtualScroll.prototype.updateItemsPotion = function (children, sIndex) {
	// 遍历 children，获取每一个 child 的 rect -> child.getBoundingClientRect()
	if (!children.length) return;
	[...children].forEach(chidNode => {
		const rect = chidNode.getBoundingClientRect();
		const dataLen = this.dataLen;
		const itemsPosition = this.itemsPosition;

		const { height } = rect;
		const { height: oldHeight, bottom: oldBottom } = itemsPosition[sIndex];
		const _diffVal = oldHeight - height;
		if (_diffVal) {
			itemsPosition[sIndex].height = height;
			itemsPosition[sIndex].bottom = Math.ceil(oldBottom - _diffVal);

			// 并一次更新后续的节点
			for (let i = sIndex + 1; i < dataLen; i++) {
				itemsPosition[i].top = itemsPosition[i - 1].bottom;
				itemsPosition[i].bottom = Math.ceil(itemsPosition[i].bottom - _diffVal);
			}
		}
		sIndex++;
	});
};

VirtualScroll.prototype.updateAllItemContainerHeight = function () {
	const dataLen = this.dataLen;
	this.allItemContainer.style.height = `${this.itemsPosition[dataLen - 1].bottom}px`;
};

VirtualScroll.prototype.updateVisibleItemContainerTranslate = function (sIndex) {
	// 根据是否处于动态高度模式来返回偏移结果
	let offset = null;
	if (this.configs.isDynamicHeight) {
		offset = this.itemsPosition[sIndex].top;
	} else {
		offset = sIndex * this.configs.itemHeight;
	}
	this.visibleItemContainer.style.transform = `translate3d(0px, ${offset}px, 0px)`;
};

VirtualScroll.prototype.updateVScrollbarThumElemHeight = function () {
	if (this.configs.isCustomScrollBar && this.scrollbarContainer) {
		const totalHeight = this.allItemContainer.clientHeight;
		const visibleHeight = this.scrollbarContainer.clientHeight;
		const thumbHeight = totalHeight > visibleHeight ? Math.ceil((visibleHeight * visibleHeight) / totalHeight) : null;

		if (!thumbHeight) {
			this.scrollbarContainer.parentNode.removeChild(this.scrollbarContainer);
			this.scrollbarContainer = null;
			return;
		}
		this.scrollbarThumbContainer.style.height = `${thumbHeight > 150 ? thumbHeight : 150}px`;
	}
};

VirtualScroll.prototype.findFirstIndex = function (offset) {
	// 二分法查找 bottom
	return this.configs.isDynamicHeight ? binarySearch(this.itemsPosition, offset, 'bottom') : Math.floor(offset / this.configs.itemHeight);
};

VirtualScroll.prototype.findEndIndex = function (sIndex) {
	return sIndex + this.clientAmounts;
};

VirtualScroll.prototype.cacBuffer = function (type, index, count) {
	if (typeof this.configs.bufferScale !== 'number') {
		return console.warn(`请检查输入的缓冲区数据类型是否正确`);
	}

	const sBufferHandler = () => {
		const idx = index - Math.ceil(count * this.configs.bufferScale);
		return idx > 0 ? idx : 0;
	};

	const eBufferHandler = () => {
		const idx = index + Math.ceil(count * this.configs.bufferScale);
		return idx < this.dataLen ? idx : this.dataLen;
	};

	return type === 's' ? sBufferHandler() : eBufferHandler();
};
