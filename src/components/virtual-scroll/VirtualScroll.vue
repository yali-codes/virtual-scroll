<template>
	<div class="v-container" style="position: relative; height: 100%; width: 100%; overflow: hidden">
		<div class="v-list" style="position: relative; height: 100%; width: 100%; overflow: auto" @scroll="onScrollHandler">
			<div :style="totalHeightStyle"></div>
			<div class="v-visible-items" :style="visibleStyle">
				<!--这里将是一个作用域插槽-->
				<div class="v-list-item" v-for="item in renderList">
					<div class="v-list-item-l">
						<p>
							<b>这是第{{ item.index }}项数据</b>
						</p>
						<p>{{ item.value }}</p>
					</div>
					<button class="v-list-item-r" @click="$emit('load', item.index)">加载数据</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
import '@/lib/faker.min.js';
import CustomScrollbar from '@/lib/custom-scrollbar';
import { computed, defineComponent, nextTick, reactive, toRefs, watch } from 'vue';
import { throttle, throttleByFrame, binarySearch, cacBuffer, $$ } from './helper';

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
			default: () => true,
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
	setup(props, { expose }) {
		const state = reactive({
			dataLen: 0,
			renderList: [],
			translateY: 0,
		});

		watch(
			() => props.dataSource,
			data => {
				if (!data.length) {
					state.renderList = [];
					return;
				}

				initBase(data);
			},
		);

		const visibleStyle = computed(() => {
			return `
				position: absolute; left: 0; right: 0; top: 0; z-index: 1;
				transform: translate3d(0px, ${state.translateY}px, 0px);
			`;
		});

		const totalHeightStyle = computed(() => {
			const dataLen = state.dataLen;
			const totalHeight = dataLen ? (props.isDynamicHeight ? state.itemsPosition[dataLen - 1].bottom : dataLen * props.itemHeight) : 1;
			return `
				position: absolute; left: 0; right: 0; top: 0; z-index: -1;
				height: ${totalHeight}px;
			`;
		});

		function initBase(dataSource) {
			state.dataSource = dataSource; // 缓存虚拟列表数据

			const dataLen = (state.dataLen = dataSource.length); // 缓存数据的长度
			setItemsPosition(dataLen); // 计算列表中每一个节点的累计高度

			/**获取节点并缓存，设置可见区域的数据记录数，以及总高度 */
			state.vListContainer = $$('.v-list');
			setTotalHeight(props.isDynamicHeight ? state.itemsPosition[dataLen - 1].bottom : props.itemHeight * dataLen);

			/**首次装载数据 */
			renderVirtualList();

			/**监听窗口改变事件 */
			window.addEventListener('resize', () => {
				setClientAmounts();
				renderVirtualList();
			});
		}

		function setTotalHeight(totalHeight) {
			setClientAmounts(); // 更新可显示的总记录数
			state.totalHeight = totalHeight; // 计算总高度
		}

		function setClientAmounts() {
			/**设置容器的可见虚拟节点数 */
			state.clientAmounts = Math.ceil(state.vListContainer.clientHeight / props.itemHeight);
		}

		function onScrollHandler(evt) {
			/**scroll事件的回调函数 */
			const updateOffset = e => {
				e.preventDefault();
				state.offset = e.target.scrollTop;
				/**更新自定义滚动条的位置 */
				if (props.isCustomScrollBar && state.scrollbarContainer) {
					state.scrollbarContainer.updateThumbTop(state.offset, state.totalHeight);
				}
				renderVirtualList(); // 装载数据
			};

			// 滚动事件节流处理
			props.useFrameOptimize ? throttleByFrame(updateOffset)(evt) : throttle(updateOffset)(evt);
		}

		function loadMoreData(data, idx) {
			state.dataSource = data;
			const dataLen = (state.dataLen = data.length);

			// 更新总高
			if (props.isDynamicHeight) {
				const currentItem = state.itemsPosition[idx - 1];
				setItemsPosition(dataLen - idx, idx, currentItem);
				setTotalHeight(state.itemsPosition[dataLen - 1].bottom);
			} else {
				setTotalHeight(dataLen * props.itemHeight);
			}

			/**如果增加数据是从最末尾开始，不需要刷新列表，即不执行 renderVirtualList 方法 */
			if (idx < state.renderList.length) {
				return renderVirtualList();
			}

			/**重新计算自定义滚动条滑块的位置 */
			const scrollbarContainer = state.scrollbarContainer;
			if (props.isCustomScrollBar && scrollbarContainer) {
				const totalHeight = state.totalHeight;
				scrollbarContainer.updateThumbHeight(totalHeight);
				scrollbarContainer.updateThumbTop(state.offset, totalHeight);
			}
		}

		function renderVirtualList() {
			/**开始渲染虚拟列表 */
			let sIndex = findFirstIndex(state.offset || 0);
			let eIndex = Math.min(findEndIndex(sIndex), state.dataLen);

			/**检测是否有需要保留缓存区域 */
			const bufferScale = props.bufferScale;
			if (props.bufferScale) {
				sIndex = cacBuffer('s', sIndex, state.clientAmounts, bufferScale);
				eIndex = cacBuffer('e', eIndex, state.clientAmounts, bufferScale, state.dataLen);
			}

			state.renderList = state.dataSource.slice(sIndex, eIndex); // 截取可渲染的数据列表

			/**Dom更新是异步更新，因此后面的计算需要等待dom更新后再执行 */
			nextTick(() => {
				if (props.isDynamicHeight) {
					updateItemsPotion(sIndex); // 更新位置信息
					updateTotalHeight(); // 立即先计算一次总高度
				}

				setVisibleTranslate(sIndex); // 设置内容的偏移量 visibleItemContainer 的 translate3d

				/**如果配置的是自定义滚动条，那么需要动态计算滑块的位置 */
				if (props.isCustomScrollBar) {
					if (!state.scrollbarContainer) {
						const { thumbBorderRadius, thumbWidth, thumbHeight } = props;
						state.scrollbarContainer = new CustomScrollbar('.v-container', { thumbBorderRadius, thumbWidth, thumbHeight });
					}
					state.scrollbarContainer.updateThumbHeight(state.totalHeight);
					state.scrollbarContainer.updateThumbTop(state.offset, state.totalHeight);
				}
			});
		}

		function setItemsPosition(dataLen, sIndex = 0, currItem) {
			if (!props.isDynamicHeight) return;
			let index = 0;
			let top = 0;
			let bottom = 0;
			let cachedPosition = [];

			if (sIndex && currItem) {
				const { top: currTop, bottom: currBottom } = currItem;
				top = currTop;
				bottom = currBottom;
				cachedPosition = state.itemsPosition.slice(0, sIndex);
			}

			const tempItemsPosition = [];
			const itemHeight = props.itemHeight;

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

		function updateItemsPotion(sIndex) {
			const children = $$('.v-visible-items').children;
			if (children.length) {
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

						/**并一次更新后续的节点 */
						for (let i = sIndex + 1; i < dataLen; i++) {
							itemsPosition[i].top = itemsPosition[i - 1].bottom;
							itemsPosition[i].bottom = Math.ceil(itemsPosition[i].bottom - _diffVal);
						}
					}
					sIndex++;
				});
			}
		}

		function updateTotalHeight() {
			const dataLen = state.dataLen;
			state.totalHeight = state.itemsPosition[dataLen - 1].bottom;
		}

		function setVisibleTranslate(sIndex) {
			/**根据是否处于动态高度模式来返回偏移结果 */
			state.translateY = props.isDynamicHeight ? state.itemsPosition[sIndex].top : sIndex * props.itemHeight;
		}

		function findFirstIndex(offset) {
			/**二分法查找 bottom */
			return props.isDynamicHeight ? binarySearch(state.itemsPosition, offset, 'bottom') : Math.floor(offset / props.itemHeight);
		}

		function findEndIndex(sIndex) {
			return sIndex + state.clientAmounts;
		}

		expose({ loadMoreData });

		return {
			onScrollHandler,
			totalHeightStyle,
			visibleStyle,
			...toRefs(state),
		};
	},
});
</script>
