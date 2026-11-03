const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd(),bundle=process.env.WENJIAN_RELATION_APP,out=process.env.WENJIAN_RELATION_REPORT_DIR;
if(!bundle||!out)throw Error('Set an isolated candidate app and report directory explicitly.');
fs.mkdirSync(out,{recursive:true});const profile=fs.mkdtempSync('/tmp/wenjian-relation-regression-');
fs.cpSync(path.join(root,'tests/fixtures/reading-board'),profile,{recursive:true});
const {projectPaper,insertCitation,removeCitation}=require('../lib/reading-paper.cjs'),{flattenComposition,withComposition}=require('../lib/reading-composition.cjs');
const seed=JSON.parse(fs.readFileSync(path.join(profile,'notebook.json'))),sources=seed.data.libraryHighlights.slice(0,2).map((s,i)=>({...s,id:'s'+i,bookTitle:seed.data.libraryBooks[0].title,chapter:i?'第二章':'第一章'}));
sources[1]={...sources[1],libraryBookId:'reading-epub',bookTitle:'阅读联动 EPUB 样书',sourceLocation:'epubcfi(/6/4!/4/2/1:0)',chapter:'乙书第二章'};
let composition=projectPaper({schema:1,homeBookId:'reading-pdf',title:'共同笔记检索标题',paragraphs:[{id:'p',text:'',sourceIds:[]}]},{version:1,markerFormat:'square',body:'跨书检索正文词。',citations:[],relations:[]},sources);
for(const s of sources)composition=insertCitation(composition,s.id,composition.paper.body.length,sources).composition;
const note={id:'relation-test',libraryBookId:'reading-pdf',bookTitle:'阅读联动 PDF 样书',scope:'book',locator:'',composition,sources,text:flattenComposition(composition),questionIds:[],thoughts:[],tags:['主题检索专用词'],at:'2026-11-03T00:00:00Z'};
seed.data.bookThoughts=[note,{...note,id:'other-test',sources:[],composition:projectPaper({...composition,title:'另一篇虚构笔记'},{...composition.paper,body:'另一篇的正文。',citations:[],relations:[]},[]),text:'另一篇虚构笔记\n\n另一篇的正文。',at:'2026-10-01T00:00:00Z'}];
seed.data.libraryFolders=[{id:'folder-a',name:'甲书文件夹'},{id:'folder-b',name:'乙书文件夹'}];seed.data.libraryBooks[0].folderId='folder-a';seed.data.libraryBooks[1].folderId='folder-b';
fs.writeFileSync(path.join(profile,'notebook.json'),JSON.stringify(seed));
fs.writeFileSync(path.join(profile,'.wenjian-architecture-trial.json'),'{"isolated":true}');
fs.writeFileSync(path.join(profile,'drafts.json'),JSON.stringify({'author-letter:2026-10':{readAt:new Date().toISOString()},'update-guide:reading-save-346-2026-11-03':{seenAt:new Date().toISOString()}}));
let app,page;const errors=[],dialogs=[],checks=[];
const env={...process.env,WENJIAN_TEST_DATA_DIR:profile,WENJIAN_TEST_HEADLESS:'1',WENJIAN_TEST_DISABLE_EXTERNAL:'1'};
function pass(check){checks.push(check);console.log('PASS',check);}
const explanation='没有点保存也要保留的联系说明。';
async function until(job,check){for(let i=0;i<100;i++){const value=await job();if(check(value))return value;await new Promise(r=>setTimeout(r,80));}throw Error('Expected durable test state did not arrive.');}
const store=()=>page.evaluate(()=>fetch('/api/notebook').then(r=>r.json()));
const drafts=()=>page.evaluate(()=>fetch('/api/drafts').then(r=>r.json()));
const relation=()=>page.getByRole('textbox',{name:'关系解释',exact:true});
async function launch(){app=await _electron.launch({executablePath:path.join(bundle,'Contents/MacOS/问间'),env,timeout:30000});assert.equal(await app.evaluate(({app})=>app.getPath('userData')),profile);page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});}
async function enter(){const b=page.getByRole('button',{name:'进入问间',exact:true});if(await b.count())await b.click();}
async function openBook(){await page.getByRole('button',{name:'书库',exact:true}).click();await page.getByRole('button',{name:'读书',exact:true}).click();await page.getByRole('button').filter({has:page.getByText('阅读联动 PDF 样书',{exact:true})}).first().click();await page.getByRole('button',{name:'写笔记',exact:true}).click();await page.getByRole('textbox',{name:'笔记正文',exact:true}).waitFor();}
async function switchNote(id){await page.locator('.book-note-switcher summary').click();await page.locator('[data-book-note-id="'+id+'"]').click();await until(()=>page.getByRole('textbox',{name:'笔记标题',exact:true}).inputValue(),title=>title===(id==='other-test'?'另一篇虚构笔记':'共同笔记检索标题'));}
async function flush(){await page.evaluate(async()=>{const jobs=[];window.dispatchEvent(new CustomEvent('wenjian:flush-drafts',{detail:{jobs,recoveryOnly:false}}));await Promise.all(jobs);});}
(async()=>{try{
 await launch();await enter();await openBook();
 await page.getByRole('button',{name:'梳理联系',exact:true}).click();const refs=page.locator('.paper-text-mirror [data-citation-id]');await refs.nth(0).click();await refs.nth(1).click();
 await page.getByRole('textbox',{name:'关系名称',exact:true}).fill('尚未提交的关系');await relation().fill(explanation);
 // Navigate immediately, before the 300 ms debounce: the close/switch flush must win.
 await switchNote('other-test');assert.equal(await relation().count(),0);await switchNote('relation-test');await relation().waitFor();assert.equal(await relation().inputValue(),explanation);assert.equal(await page.locator('.paper-inline-citation.is-selected').count(),2);
 assert.equal((await store()).data.bookThoughts.find(n=>n.id==='relation-test').composition.paper.relations.length,0);
 pass('Immediate note switch preserves prose and citation choices without submitting a formal relation.');
 await page.getByRole('button',{name:'退出阅读',exact:true}).click();await app.close();app=null;
 await launch();await enter();await openBook();await relation().waitFor();assert.equal(await relation().inputValue(),explanation);assert.equal(await page.locator('.paper-inline-citation.is-selected').count(),2);
 pass('Normal reader exit and process restart restore the unfinished relation.');
 await page.getByRole('button',{name:'保存这条联系',exact:true}).click();await until(store,s=>s.data.bookThoughts.find(n=>n.id==='relation-test').composition.paper.relations.length===1);
 const saved=(await store()).data.bookThoughts.find(n=>n.id==='relation-test'),id=saved.composition.paper.relations[0].id;
 await until(drafts,d=>!JSON.stringify(d).includes('尚未提交的关系')||!Object.entries(d.drafts||{}).some(([k,v])=>k.startsWith('reading-relation:')&&v?.open));
 await page.getByRole('button',{name:'修改联系',exact:true}).click();await relation().fill('已经改写但暂时不提交。');await flush();await switchNote('other-test');await switchNote('relation-test');assert.equal(await relation().inputValue(),'已经改写但暂时不提交。');
 await page.getByRole('button',{name:'取消',exact:true}).click();await flush();assert.equal((await store()).data.bookThoughts.find(n=>n.id==='relation-test').composition.paper.relations[0].text,explanation);
 pass('Editing an existing relation has its own recoverable draft; explicit cancel leaves the formal relation untouched.');
 // Saved relation identity survives retries and remains a single relation.
 await page.locator('.paper-inline-chain').click();await page.getByRole('button',{name:'修改联系',exact:true}).click();await relation().fill('现在正式修改这条联系。');await page.getByRole('button',{name:'保存这条联系',exact:true}).click();await until(store,s=>s.data.bookThoughts.find(n=>n.id==='relation-test').composition.paper.relations[0].text==='现在正式修改这条联系。');const updated=(await store()).data.bookThoughts.find(n=>n.id==='relation-test');assert.equal(updated.composition.paper.relations.length,1);assert.equal(updated.composition.paper.relations[0].id,id);assert(updated.revisions.some(r=>r.composition?.paper?.relations.some(r=>r.text===explanation)));
 pass('Submitting an edit updates the same relation, preserves the earlier explanation in history, and clears the recovery draft.');
 // Fail only the tiny relation recovery write, without changing the real DB or cloud.
 await page.getByRole('button',{name:'修改联系',exact:true}).click();await page.route('**/api/drafts',route=>{const req=route.request();let data;try{data=req.postDataJSON();}catch{}return req.method()==='PUT'&&data?.key?.startsWith('reading-relation:')?route.fulfill({status:503,contentType:'application/json',body:'{"error":"fictional draft failure"}'}):route.continue();});
 await relation().fill('草稿保存失败后也不能假装成功。');await page.getByRole('alert').filter({hasText:'联系草稿未确认保存'}).waitFor();await page.unroute('**/api/drafts');await page.getByRole('button',{name:'重试保留草稿',exact:true}).click();await until(drafts,d=>JSON.stringify(d).includes('草稿保存失败后也不能假装成功。'));await page.getByRole('button',{name:'取消',exact:true}).click();await flush();
 pass('A recovery-write failure is visible; retry durably saves the exact text.');
 // Simulate a restored draft referring to a removed citation; it cannot silently submit.
 const state=await store(),current=state.data.bookThoughts.find(n=>n.id==='relation-test'),lost=current.composition.paper.citations[0].id;
 await page.locator('.paper-inline-chain').click();await page.getByRole('button',{name:'修改联系',exact:true}).click();await relation().fill('引用变更时仍保留解释。');await flush();
 const nextComposition=removeCitation(current.composition,lost,current.sources),next=withComposition(current,nextComposition,current.sources,new Date().toISOString(),'虚构测试解除引用');
 await page.evaluate(async({before,after})=>{const r=await fetch('/api/architecture/records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mutationId:crypto.randomUUID(),changes:[{collection:'bookThoughts',id:before.id,before,after}]})});if(!r.ok)throw Error(await r.text());},{before:current,after:next});
 await page.reload();await openBook();await relation().waitFor();assert.equal(await relation().inputValue(),'引用变更时仍保留解释。');await page.getByRole('alert').filter({hasText:'摘录已改变'}).waitFor();assert(await page.getByRole('button',{name:'保存这条联系',exact:true}).isDisabled());await page.getByRole('button',{name:'移除失效选择',exact:true}).click();assert.equal(await page.locator('.paper-inline-citation.is-selected').count(),1);await page.getByRole('button',{name:'取消',exact:true}).click();await flush();
 pass('Changed or removed source references keep the draft explanation and require review instead of silently dropping choices.');
 // Both folders must expose the same single authored note through their own source chapter.
 await page.getByRole('button',{name:'退出阅读',exact:true}).click();await page.getByRole('button',{name:'书库',exact:true}).click();await page.getByRole('button',{name:'读书',exact:true}).click();
 const expand=page.getByRole('button',{name:'展开书架',exact:true});if(await expand.count())await expand.click();
 const search=page.getByRole('textbox',{name:'搜索书名、作者或笔记',exact:true});
 await page.getByRole('button',{name:/切换图书文件夹/}).click();await page.locator('.folder-shelf-drawer .folder-shelf-folder').filter({hasText:'乙书文件夹'}).click();
 await search.fill('主题检索专用词');await page.getByRole('region',{name:'笔记搜索结果',exact:true}).waitFor();assert.equal(await page.locator('.library-note-result-book').count(),1);assert((await page.locator('.library-note-result-book').textContent()).includes('阅读联动 EPUB 样书'));assert((await page.locator('.library-note-result-book').textContent()).includes('乙书第二章'));
 await search.fill('跨书检索正文词');await until(()=>page.locator('.library-note-results button').count(),n=>n===1);await page.locator('.library-note-results button').click();await page.getByRole('textbox',{name:'笔记正文',exact:true}).waitFor();assert((await page.getByRole('textbox',{name:'笔记正文',exact:true}).inputValue()).includes('跨书检索正文词'));
 pass('Searching a topic or shared prose in the second book folder finds the original note under that book chapter and opens its writing board.');
 await page.getByRole('button',{name:'退出阅读',exact:true}).click();await page.getByRole('button',{name:'搜索',exact:true}).click();await page.locator('.search-dialog input').fill('主题检索专用词');await until(()=>page.locator('.search-results button').count(),n=>n>0);assert((await page.locator('.search-results').textContent()).includes('共同笔记检索标题'));await page.keyboard.press('Escape');pass('Global search also indexes the authored topic label.');
 assert.deepEqual(errors,[]);assert.deepEqual(dialogs,[]);await page.screenshot({path:path.join(out,'relation-search-final.png')});fs.writeFileSync(path.join(out,'relation-ui-results.json'),JSON.stringify({checks,errors,dialogs,isolated:true},null,2));console.log('PASS',JSON.stringify(checks,null,2));
}catch(e){if(page)await page.screenshot({path:path.join(out,'relation-ui-failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'relation-ui-failure.txt'),String(e)+'\n'+errors.join('\n'));throw e;}finally{if(app)await app.close();fs.rmSync(profile,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
