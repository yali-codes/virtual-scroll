<template>
	<h1 class="app-title">Hello, Virtual Scroll List !</h1>
	<VirtualScroll ref="vsRef" :data-source="dataSource" @load="loadMoreDataHanler" />
	<!-- <div class="virtual-scroll-wrapper"></div> -->
</template>

<script>
// import '@/lib/virtual-scroll/index.js';
import VirtualScroll from '@/components/virtual-scroll';
import { defineComponent, onMounted, ref } from 'vue';

export default defineComponent({
	name: 'App',
	components: { VirtualScroll },
	setup() {
		const vsRef = ref(null);
		const dataSource = ref([]);

		onMounted(() => {
			const data = [];
			for (let i = 0; i < 30; i++) {
				data.push({ index: i, value: faker.lorem.sentences() });
			}
			dataSource.value = data;
		});

		function loadMoreDataHanler(idx) {
			// 插入的数据
			const _moreData = [];
			let _newIdx = idx;
			for (let i = 0; i < 30; i++) {
				_newIdx++;
				_moreData.push({ index: _newIdx, value: faker.lorem.sentences() });
			}

			// 截取插入数据后的数据，这里需要判断是否是在最后一个元素后插入，如果是就不需要处理
			const _idx = idx + 1;
			const _len = dataSource.value.length; // 保存一下原数据的长度
			dataSource.value.splice(_idx, 0, ..._moreData);
			if (idx < _len - 1) {
				// 截取需要更新的数据
				const _tempdata = dataSource.value.splice(_idx + _moreData.length);
				let _sIdx = _moreData[_moreData.length - 1].index;
				for (let i = 0; i < _tempdata.length; i++) {
					_sIdx++;
					_tempdata[i].index = _sIdx;
				}
				dataSource.value.push(..._tempdata);
			}

			vsRef.value.loadMoreData(dataSource.value, _idx);
		}

		return {
			vsRef,
			dataSource,
			loadMoreDataHanler,
		};
	},
});
</script>

<style>
@import '../css/app.css';
@import '../css/virtual-scroll.css';
</style>
