import { mkdirSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const NUM = 15_020;
const SPLIT = 5;
const BOX = NUM / SPLIT;


let all = join(import.meta.dirname, 'src/all.js')
let modules = join(import.meta.dirname, 'src/modules');

let allContent = '';

let external = `
import 'lodash';
import 'd3';
import '@babel/standalone';
import 'react';
import 'vue';
import 'jquery';
import 'chart.js';
import 'd3-force';
import 'echarts';
import 'highcharts';
import 'mermaid';
import 'recharts';
import 'codemirror';
import 'monaco/build/vs/editor/editor.main.js';
`

if (existsSync(modules)) {
  rmSync(modules, { recursive: true });
  mkdirSync(modules);
} else {
  mkdirSync(modules);
}

let content = '';
let box = 0;
let boxI = 0;
for (let i = 0; i < NUM; i++) {
  let path = join(modules, `module-${i}.js`);

  writeFileSync(path, `export default { value: ${i} };` + external);

  content += `\nimport './modules/module-${i}.js';`;

  box++;

  if (box >= BOX) {
    writeFileSync(`src/box-${boxI}.js`, content);
    allContent += `\nimport './box-${boxI}.js';`;
    boxI++;
    content = '';
    box = 0;
  }
}

writeFileSync(all, allContent);
