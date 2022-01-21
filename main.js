import '@/lib/faker.min.js';
import VirtualScroll from '@/lib/virtual-scroll';
import App from '@/view/App.vue';
import { createApp } from 'vue';

createApp(App).mount('.app-vue');

const dataSource = [];
for (let i = 0; i < 3000; i++) {
	dataSource.push({ index: i, value: faker.lorem.sentences() });
}

const virtualVm = new VirtualScroll(
	'.virtual-scroll-wrapper',
	dataSource,
	item => {
		const _div = document.createElement('div');
		_div.classList.add('v-list-item');
		_div.innerHTML = `
		<p><b>这是第${item.index + 1}项数据</b></p>
		<p>${item.value}</p>
	`;

		return _div;
	},
	{ isDynamicHeight: true, isCustomScrollBar: true, bufferScale: 0.1, useFrameOptimize: true },
);

console.log('devie::', virtualVm);
