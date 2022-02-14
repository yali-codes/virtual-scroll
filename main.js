import '@/lib/faker.min.js';
import VirtualScroll from '@/lib/virtual-scroll';
import App from '@/view/App.vue';
import { createApp } from 'vue';

createApp(App).mount('.app-vue');

const dataSource = [];
for (let i = 0; i < 10; i++) {
	dataSource.push({ index: i, value: faker.lorem.sentences() });
}

window.loadMoreData = function (idx) {
	// 插入的数据
	const _moreData = [];
	let _newIdx = idx;
	for (let i = 0; i < 10; i++) {
		_newIdx++;
		_moreData.push({ index: _newIdx, value: faker.lorem.sentences() });
	}

	// 截取插入数据后的数据，这里需要判断是否是在最后一个元素后插入，如果是就不需要处理
	const _idx = idx + 1;
	const _len = dataSource.length; // 保存一下原数据的长度
	dataSource.splice(_idx, 0, ..._moreData);
	if (idx < _len - 1) {
		// 截取需要更新的数据
		const _tempdata = dataSource.splice(_idx + _moreData.length);
		let _sIdx = _moreData[_moreData.length - 1].index;
		for (let i = 0; i < _tempdata.length; i++) {
			_sIdx++;
			_tempdata[i].index = _sIdx;
		}
		dataSource.push(..._tempdata);
	}

	virtualVm.loadMoreData(dataSource, _idx);
};

const virtualVm = new VirtualScroll(
	'.virtual-scroll-wrapper',
	dataSource,
	item => {
		const _div = document.createElement('div');
		_div.classList.add('v-list-item');

		_div.innerHTML = `
			<div class="v-list-item-l">
				<p><b>这是第${item.index}项数据</b></p>
				<p>${item.value}</p>
			</div>
			<button class="v-list-item-r" onclick="loadMoreData(${item.index})">加载数据</button>
		`;

		return _div;
	},
	{ isDynamicHeight: true, isCustomScrollBar: true, bufferScale: 0.1, useFrameOptimize: true },
);
