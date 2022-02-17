import CustomScrollbar from '../custom-scrollbar';
import { throttle, throttleByFrame, binarySearch, cacBuffer } from './helper';

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
	this.dataLen = dataSource.length; // 数据长度
	this.genItemCallback = genItemCallback; // 生成列表DOM元素的回调函数
	this.offset = 0; // 滚动条偏移量
	this.clientAmounts = 0; // 可见区域的数据记录数

	// 默认参数配置
	this.configs = {
		itemHeight: 50,
		isDynamicHeight: false,
		bufferScale: 0.1,
		useFrameOptimize: false,
		isCustomScrollBar: true,
		thumbBorderRadius: 6,
		thumbWidth: 6,
		thumbHeight: 150,
	};

	// 合并参数
	Object.assign(this.configs, { ...options });
	// 计算列表中每一个节点的累计高度
	this.setItemsPosition();
	// 创建虚拟列表节点
	this.createVContainer();
	// 首次渲染虚拟列表
	this.render();
}

VirtualScroll.prototype.setTotalHeight = function (totalHeight) {
	// 更新可显示的总记录数
	this.setClientAmounts();
	// 将总高度更新到 totalHeightContainer 节点上
	this.totalHeightContainer.style.height = `${totalHeight}px`;
};

VirtualScroll.prototype.setClientAmounts = function () {
	// 设置容器的可见虚拟节点数
	this.clientAmounts = Math.ceil(this.vListContainer.clientHeight / this.configs.itemHeight);
};

VirtualScroll.prototype.createVContainer = function () {
	const elementsTpl = `
		<div class="v-container" style="position: relative; height: 100%; overflow: hidden;">
			<div class="v-list" style="position: relative; height: 100%; overflow: auto">
				<div class="v-total-height" style="position: absolute; left: 0; right: 0; top: 0; z-index: -1; height: 1px;"></div>
				<div class="v-visible-items" style="position: absolute;	left: 0; right: 0; top: 0; z-index: 1; transform: translate3d(0px, 0px, 0px);"></div>
			</div>
		</div>
	`;

	if (this.el) {
		this.el.innerHTML = elementsTpl;
	}

	// 获取节点并缓存，后续操作需要用到
	this.vContainer = document.querySelector('.v-container');
	this.vListContainer = document.querySelector('.v-list');
	this.totalHeightContainer = document.querySelector('.v-total-height');
	this.visibleItemContainer = document.querySelector('.v-visible-items');

	// 将总高度更新到 totalHeightContainer 节点上
	const dataLen = this.dataLen;
	this.setTotalHeight(this.configs.isDynamicHeight ? this.itemsPosition[dataLen - 1].bottom : this.configs.itemHeight * dataLen);

	// 注册滚动事件
	this.bindVScrollbarEvent();

	// 注册窗口改变事件
	this.bindResizeEvent();
};

VirtualScroll.prototype.bindVScrollbarEvent = function () {
	// scroll事件的回调函数
	const updateOffsetHandler = e => {
		e.preventDefault();
		this.offset = e.target.scrollTop;

		// 更新自定义滚动条的位置
		if (this.configs.isCustomScrollBar && this.scrollbarContainer) {
			this.scrollbarContainer.updateVScrollbarThumElembTop(this.offset, this.totalHeightContainer.clientHeight);
		}

		// 渲染列表数据
		this.render();
	};

	// 绑定滚动事件，用节流函数包装 scroll 事件的回调函数
	const scrollHandler = this.configs.useFrameOptimize ? throttleByFrame(updateOffsetHandler) : throttle(updateOffsetHandler);
	this.vListContainer.addEventListener('scroll', scrollHandler);
};

VirtualScroll.prototype.bindResizeEvent = function () {
	// 具体事件处理
	const handleResizing = () => {
		this.setClientAmounts();
		this.render();
	};

	// 事件处理器
	const resizeHandler = this.configs.useFrameOptimize ? throttleByFrame(handleResizing) : throttle(handleResizing);
	window.addEventListener('resize', resizeHandler);
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

	// 渲染, 如果增加数据是从最末尾开始，不需要刷新
	if (idx < this.renderList.length) {
		return this.render();
	}

	// 重新计算自定义滚动条滑块的位置
	const scrollbarContainer = this.scrollbarContainer;
	if (this.configs.isCustomScrollBar && scrollbarContainer) {
		const totalHeight = this.totalHeightContainer.clientHeight;
		scrollbarContainer.updateVScrollbarThumElemHeight(totalHeight);
		scrollbarContainer.updateVScrollbarThumElembTop(this.offset, totalHeight);
	}
};

VirtualScroll.prototype.render = function () {
	// 开始渲染虚拟列表
	let sIndex = this.findFirstIndex(this.offset);
	let eIndex = Math.min(this.findEndIndex(sIndex), this.dataLen);

	// 检测是否有需要保留缓存区域
	const bufferScale = this.configs.bufferScale;
	if (this.configs.bufferScale) {
		sIndex = cacBuffer('s', sIndex, this.clientAmounts, bufferScale);
		eIndex = cacBuffer('e', eIndex, this.clientAmounts, bufferScale, this.dataLen);
	}

	// 截取可渲染的数据列表
	this.renderList = this.dataSource.slice(sIndex, eIndex);

	const itemRenderCallback = item => {
		const itemNode = this.genItemCallback(item);
		if (!this.configs.isDynamicHeight) {
			itemNode.style.height = this.itemHeight;
		}
		const offset = this.configs.isDynamicHeight ? this.itemsPosition[sIndex].top : sIndex * this.configs.itemHeight;
		console.log(itemNode);
		itemNode.style.transform = `translate3d(0px, ${offset}px, 0px)`;
		return itemNode.outerHTML;
	};

	const htmlString = this.renderList.map(itemRenderCallback).join('');
	this.visibleItemContainer.innerHTML = htmlString;

	// 如果是动态高度，需要重新计并更新 itemsPosition 的位置信息，以及 totalHeightContainer 高度
	if (this.configs.isDynamicHeight) {
		this.updateItemsPotion(this.visibleItemContainer.children, sIndex);
		this.updateTotalHeight();
	}

	// 设置内容的偏移量 visibleItemContainer 的 translate3d
	// this.setVisibleItemContainerTranslate(sIndex);

	// 如果配置的是自定义滚动条，那么需要动态计算滑块的位置
	if (this.configs.isCustomScrollBar) {
		if (!this.scrollbarContainer) {
			const { thumbBorderRadius, thumbWidth, thumbHeight } = this.configs;
			this.scrollbarContainer = new CustomScrollbar(this.vContainer, { thumbBorderRadius, thumbWidth, thumbHeight });
		}
		this.scrollbarContainer.updateVScrollbarThumElemHeight(this.totalHeightContainer.clientHeight);
		this.scrollbarContainer.updateVScrollbarThumElembTop(this.offset, this.totalHeightContainer.clientHeight);
	}
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

VirtualScroll.prototype.updateTotalHeight = function () {
	const dataLen = this.dataLen;
	this.totalHeightContainer.style.height = `${this.itemsPosition[dataLen - 1].bottom}px`;
};

VirtualScroll.prototype.setVisibleItemContainerTranslate = function (sIndex) {
	// 根据是否处于动态高度模式来返回偏移结果
	const offset = this.configs.isDynamicHeight ? this.itemsPosition[sIndex].top : sIndex * this.configs.itemHeight;
	this.visibleItemContainer.style.transform = `translate3d(0px, ${offset}px, 0px)`;
};

VirtualScroll.prototype.findFirstIndex = function (offset) {
	// 二分法查找 bottom
	return this.configs.isDynamicHeight ? binarySearch(this.itemsPosition, offset, 'bottom') : Math.floor(offset / this.configs.itemHeight);
};

VirtualScroll.prototype.findEndIndex = function (sIndex) {
	return sIndex + this.clientAmounts;
};
