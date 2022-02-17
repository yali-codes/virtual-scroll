export default function CustomScrollbar(parent, configs) {
	this.thumbBorderRadius = 6;
	this.thumbWidth = 6;
	this.thumbHeight = 150;

	// 处理需要挂载的父节点
	this.vContainer = parent;
	if (typeof parent === 'string') {
		this.vContainer = document.querySelector(parent);
	}

	// 参数合并到实例中
	Object.assign(this, { ...configs });

	// 创建滚动条节点元素
	this.createScrollbarContainer();
}

CustomScrollbar.prototype.createScrollbarContainer = function () {
	// 如果没有开启自定义滚动条配置项直接返回
	if (this.scrollbarContainer) {
		return;
	}

	const scrollbarContainer = document.createElement('div');
	scrollbarContainer.classList.add('v-scrollbar');
	scrollbarContainer.style.cssText = `
		position: absolute;
		top: 0; bottom: 0; right: 14px;
		width: ${this.thumbWidth}px;
	`;

	// 创建滚动条容器滑块
	const scrollbarThumbContainer = document.createElement('div');
	scrollbarThumbContainer.classList.add('v-scrollbar-thumb');
	scrollbarThumbContainer.style.cssText = `
		position: absolute; left: 0; top: 0; z-index: 10;
		width: 100%; background-color: rgba(100, 100, 100, 100); opacity: 0.4;
		border-radius: ${this.thumbBorderRadius}px; cursor: pointer; user-select: none;
	`;

	// 挂载到滚动条容器
	scrollbarContainer.appendChild(scrollbarThumbContainer);
	this.scrollbarContainer = scrollbarContainer;
	this.scrollbarThumbContainer = scrollbarThumbContainer;

	if (this.vContainer) {
		// 挂载到父级
		this.vContainer.appendChild(scrollbarContainer);

		// 绑定事件
		this.bindEvents();
	}
};

CustomScrollbar.prototype.updateThumbHeight = function (totalHeight) {
	if (!this.scrollbarContainer) {
		this.createScrollbarContainer();
	}

	const visibleHeight = this.scrollbarContainer.clientHeight;
	const thumbHeight = totalHeight > visibleHeight ? Math.floor((visibleHeight * visibleHeight) / totalHeight) : null;
	if (thumbHeight === null) {
		this.scrollbarContainer.parentNode.removeChild(this.scrollbarContainer);
		this.scrollbarContainer = null;
	} else {
		const initialthumbHeight = this.thumbHeight;
		this.scrollbarThumbContainer.style.height = `${thumbHeight > initialthumbHeight ? thumbHeight : initialthumbHeight}px`;
	}
};

CustomScrollbar.prototype.updateThumbTop = function (offset, totalHeight) {
	if (!this.scrollbarContainer) return;
	const visibleHeight = this.scrollbarContainer.clientHeight;
	const moveMaximumHeight = this.scrollbarContainer.clientHeight - this.scrollbarThumbContainer.clientHeight;
	this.scrollbarThumbContainer.style.top = `${Math.ceil((offset * moveMaximumHeight) / (totalHeight - visibleHeight))}px`;
};

CustomScrollbar.prototype.bindEvents = function () {
	// 如果有自定义滚动条，那么给自定义滚动条绑定拖拽事件
	let moveY = null;
	let vListContainer = null;
	let vTotalContainer = null;

	/**鼠标按下回调函数 */
	const mousedownHanlder = evt => {
		moveY = evt.pageY - (parseInt(this.scrollbarThumbContainer.style.top) || 0);
		document.addEventListener('mouseup', mouseupHandler);
		document.addEventListener('mousemove', mousemoveHandler);
	};

	/**鼠标移动回调函数 */
	const mousemoveHandler = evt => {
		// 获取相关的节点的高度
		const totalHeight = vTotalContainer.clientHeight;
		const scrollbarHeight = this.scrollbarContainer.clientHeight;
		const thumbBarHeight = this.scrollbarThumbContainer.clientHeight;
		const moveMaximumHeight = scrollbarHeight - thumbBarHeight;
		const _moveDis = evt.pageY - moveY;

		// 滑块只能在 0 ~ moveMaximumHeight 之间滑动
		if (_moveDis < 0 || _moveDis > moveMaximumHeight) {
			return;
		}

		// 设备自定义滚动条滑块的top值
		this.scrollbarThumbContainer.style.top = `${_moveDis}px`;

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
		vListContainer = this.scrollbarContainer.previousElementSibling;
		vTotalContainer = vListContainer.firstElementChild;
		vListContainer.classList.add('is-custom-scrollbar');
		this.scrollbarContainer.addEventListener('mousedown', mousedownHanlder);
	}
};
