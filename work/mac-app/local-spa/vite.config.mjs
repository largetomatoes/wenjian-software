import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cp, mkdir, rm } from 'node:fs/promises';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { defineConfig } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '../../..');
function localReaderAssets(){return{name:'wenjian-local-reader-assets',async buildStart(){const publicRoot=path.join(here,'public','reader'),pdfRoot=path.join(publicRoot,'pdf'),ocrRoot=path.join(publicRoot,'ocr');await mkdir(pdfRoot,{recursive:true});await mkdir(ocrRoot,{recursive:true});await cp(path.join(projectRoot,'node_modules','pdfjs-dist','build','pdf.worker.min.mjs'),path.join(pdfRoot,'pdf.worker.min.mjs'));await cp(path.join(projectRoot,'node_modules','pdfjs-dist','wasm'),path.join(pdfRoot,'wasm'),{recursive:true});for(const directory of ['cmaps','standard_fonts'])await cp(path.join(projectRoot,'node_modules','pdfjs-dist',directory),path.join(pdfRoot,directory),{recursive:true});await cp(path.join(projectRoot,'node_modules','tesseract.js','dist','worker.min.js'),path.join(ocrRoot,'worker.min.js'));await cp(path.join(projectRoot,'node_modules','tesseract.js-core'),ocrRoot,{recursive:true,filter:source=>!source.endsWith('LICENSE')&&!source.endsWith('README.md')&&!source.endsWith('package.json')&&!source.endsWith('index.js')});const windows=process.env.WENJIAN_BUILD_PLATFORM==='windows',destination=windows?path.join(ocrRoot,'lstm-v1'):ocrRoot;await mkdir(destination,{recursive:true});for(const lang of ['chi_sim','eng']){await cp(path.join(projectRoot,'node_modules','@tesseract.js-data',lang,windows?'4.0.0_best_int':'4.0.0',lang+'.traineddata.gz'),path.join(destination,lang+'.traineddata.gz'));if(windows)await rm(path.join(ocrRoot,lang+'.traineddata.gz'),{force:true});}}};}
export default defineConfig({ root: here, plugins: [localReaderAssets(),react()], resolve: { alias: { '@': projectRoot } }, css: { postcss: { plugins: [tailwindcss()] } }, build: { outDir: path.join(here, 'dist'), emptyOutDir: true } });
