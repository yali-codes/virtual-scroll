<template>
	<div class="v-container" style="position: relative; height: 100%; width: 100%; overflow: hidden">
		<div class="v-list" style="position: relative; height: 100%; width: 100%; overflow: auto">
			<div class="v-total-height" style="position: absolute; left: 0; right: 0; top: 0; z-index: -1; height: 1px"></div>
			<div class="v-visible-items" style="position: absolute; left: 0; right: 0; top: 0; z-index: 1; transform: translate3d(0px, 0px, 0px)">
				<div class="v-list-item" v-for="item in renderList">
					<div class="v-list-item-l">
						<p>
							<b>这是第{{ item.index }}项数据</b>
						</p>
						<p>{{ item.value }}</p>
					</div>
					<!--这里将是一个作用域插槽-->
					<button class="v-list-item-r" @click="loadMoreDataHandler(item.index)">加载数据</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
import '@/lib/faker.min.js';
import { defineComponent, reactive, toRefs, watch } from 'vue';
import { throttle, throttleByFrame, binarySearch, cacBuffer } from './helper';

export default defineComponent({
	name: 'VirtualScrollList',
	emits: ['load'],
	props: {
		dataSource: {
			type: Array,
			default: () => [],
		},
		itemHeight: {
			type: Number,
			default: () => 50,
		},
		isDynamicHeight: {
			type: Boolean,
			default: () => true,
		},
		bufferScale: {
			type: Number,
			default: () => 0.1,
		},
		useFrameOptimize: {
			type: Boolean,
			default: () => true,
		},
		isCustomScrollBar: {
			type: Boolean,
			default: () => false,
		},
		thumbBorderRadius: {
			type: Number,
			default: () => 6,
		},
		thumbWidth: {
			type: Number,
			default: () => 6,
		},
		thumbHeight: {
			type: Number,
			default: () => 150,
		},
	},
	setup(props, { emit, expose }) {
		const state = reactive({
			dataLen: 0,
			renderList: [],
		});

		watch(
			() => props.dataSource,
			val => {
				if (!val.length) {
					state.renderList = [];
					return;
				}

				// 缓存数据
				state.dataSource = val;
				state.dataLen = val.length;

				// 计算列表中每一个节点的累计高度
				setItemsPosition();

				initBase();

				// 首次渲染虚拟列表
				render();
			},
		);

		function initBase() {
			// 获取节点并缓存，后续操作需要用到
			state.vContainer = document.querySelector('.v-container');
			state.vListContainer = document.querySelector('.v-list');
			state.totalHeightContainer = document.querySelector('.v-total-height');
			state.visibleItemContainer = document.querySelector('.v-visible-items');

			// 将总高度更新到 totalHeightContainer 节点上
			const dataLen = state.dataLen;
			setTotalHeight(props.isDynamicHeight ? state.itemsPosition[dataLen - 1].bottom : props.itemHeight * dataLen);

			// 注册滚动事件
			bindVScrollbarEvent();

			// 注册窗口改变事件
			bindResizeEvent();
		}

		function setTotalHeight(totalHeight) {
			// 更新可显示的总记录数
			setClientAmounts();
			// 将总高度更新到 totalHeightContainer 节点上
			state.totalHeightContainer.style.height = `${totalHeight}px`;
		}

		function setClientAmounts() {
			// 设置容器的可见虚拟节点数
			state.clientAmounts = Math.ceil(state.vListContainer.clientHeight / props.itemHeight);
		}

		function bindVScrollbarEvent() {
			// scroll事件的回调函数
			const updateOffsetHandler = e => {
				e.preventDefault();
				state.offset = e.target.scrollTop;

				// 更新自定义滚动条的位置
				if (props.isCustomScrollBar && state.scrollbarContainer) {
					scrollbarContainer.updateVScrollbarThumElembTop(state.offset, state.totalHeightContainer.clientHeight);
				}

				// 渲染列表数据
				render();
			};

			// 绑定滚动事件，用节流函数包装 scroll 事件的回调函数
			const scrollHandler = props.useFrameOptimize ? throttleByFrame(updateOffsetHandler) : throttle(updateOffsetHandler);
			state.vListContainer.addEventListener('scroll', scrollHandler);
		}

		function bindResizeEvent() {
			// 具体事件处理
			const handleResizing = () => {
				setClientAmounts();
				render();
			};

			// 事件处理器
			const resizeHandler = props.useFrameOptimize ? throttleByFrame(handleResizing) : throttle(handleResizing);
			window.addEventListener('resize', resizeHandler);
		}

		function loadMoreDataHandler(idx) {
			emit('load', idx);
		}

		function loadMoreData(data, idx) {
			state.dataSource = data;
			state.dataLen = data.length;

			// 更新总高
			if (props.isDynamicHeight) {
				const currentItem = state.itemsPosition[idx - 1];
				setItemsPosition(idx, currentItem);
				setTotalHeight(state.itemsPosition[state.dataLen - 1].bottom);
			} else {
				setTotalHeight(state.dataLen * props.itemHeight);
			}

			// 渲染
			render();

			// 重新计算自定义滚动条滑块的位置
			const scrollbarContainer = state.scrollbarContainer;
			if (props.isCustomScrollBar && scrollbarContainer) {
				const totalHeight = state.totalHeightContainer.clientHeight;
				scrollbarContainer.updateVScrollbarThumElemHeight(totalHeight);
				scrollbarContainer.updateVScrollbarThumElembTop(state.offset, totalHeight);
			}
		}

		function render() {
			// 开始渲染虚拟列表
			let sIndex = findFirstIndex(state.offset || 0);
			let eIndex = Math.min(findEndIndex(sIndex), state.dataLen);

			// 检测是否有需要保留缓存区域
			const bufferScale = props.bufferScale;
			if (props.bufferScale) {
				sIndex = cacBuffer('s', sIndex, state.clientAmounts, bufferScale);
				eIndex = cacBuffer('e', eIndex, state.clientAmounts, bufferScale, state.dataLen);
			}

			// 截取可渲染的数据列表
			state.renderList = state.dataSource.slice(sIndex, eIndex);

			// 如果是动态高度，需要重新计并更新 itemsPosition 的位置信息，以及 totalHeightContainer 高度
			if (props.isDynamicHeight) {
				updateItemsPotion(state.visibleItemContainer.children, sIndex);
				updatetotalHeightContainerHeight();
			}

			// 设置内容的偏移量 visibleItemContainer 的 translate3d
			setVisibleItemContainerTranslate(sIndex);

			// 如果配置的是自定义滚动条，那么需要动态计算滑块的位置
			if (props.isCustomScrollBar) {
				if (!state.scrollbarContainer) {
					const { thumbBorderRadius, thumbWidth, thumbHeight } = props;
					scrollbarContainer = new CustomScrollbar(state.vContainer, { thumbBorderRadius, thumbWidth, thumbHeight });
				}
				scrollbarContainer.updateVScrollbarThumElemHeight(state.totalHeightContainer.clientHeight);
			}
		}

		function setItemsPosition(sIndex = 0, currItem) {
			if (!props.isDynamicHeight) return;
			const tempItemsPosition = [];
			const itemHeight = props.itemHeight;

			let index = 0;
			let top = 0;
			let bottom = 0;
			let cachedPosition = [];
			let dataLen = state.dataLen;

			if (sIndex && currItem) {
				const { top: currTop, bottom: currBottom } = currItem;
				top = currTop;
				bottom = currBottom;
				dataLen = state.dataLen - sIndex;
				cachedPosition = state.itemsPosition.slice(0, sIndex);
			}

			while (index < dataLen) {
				tempItemsPosition.push({
					index: index + sIndex,
					height: itemHeight,
					top: index * itemHeight + top,
					bottom: (index + 1) * itemHeight + bottom,
				});
				index++;
			}

			state.itemsPosition = [...cachedPosition, ...tempItemsPosition];
		}

		function updateItemsPotion(children, sIndex) {
			// 遍历 children，获取每一个 child 的 rect -> child.getBoundingClientRect()
			if (!children.length) return;
			[...children].forEach(chidNode => {
				const rect = chidNode.getBoundingClientRect();
				const dataLen = state.dataLen;
				const itemsPosition = state.itemsPosition;

				const { height } = rect;
				const { height: oldHeight, bottom: oldBottom } = itemsPosition[sIndex] || {};
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
		}

		function updatetotalHeightContainerHeight() {
			const dataLen = state.dataLen;
			state.totalHeightContainer.style.height = `${state.itemsPosition[dataLen - 1].bottom}px`;
		}

		function setVisibleItemContainerTranslate(sIndex) {
			// 根据是否处于动态高度模式来返回偏移结果
			const offset = (state.offset = props.isDynamicHeight ? state.itemsPosition[sIndex].top : sIndex * props.itemHeight);
			state.visibleItemContainer.style.transform = `translate3d(0px, ${state.offset}px, 0px)`;
		}

		function findFirstIndex(offset) {
			// 二分法查找 bottom
			return props.isDynamicHeight ? binarySearch(state.itemsPosition, offset, 'bottom') : Math.floor(offset / props.itemHeight);
		}

		function findEndIndex(sIndex) {
			return sIndex + state.clientAmounts;
		}

		expose({ loadMoreData });

		return {
			loadMoreData,
			loadMoreDataHandler,
			...toRefs(state),
		};
	},
});
</script>
