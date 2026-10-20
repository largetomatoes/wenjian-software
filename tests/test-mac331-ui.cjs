const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {PDFDocument,StandardFonts}=require('../work/mac-app/node_modules/pdf-lib');
const root=path.resolve(__dirname,'..'),out=path.join(root,'outputs/mac331');
async function run(){
 fs.mkdirSync(out,{recursive:true});const dir=path.join(out,'fictional-'+Date.now());fs.mkdirSync(path.join(dir,'library'),{recursive:true});
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);for(let i=1;i<=5;i++){const p=pdf.addPage([600,900]);for(let j=0;j<25;j++)p.drawText(`Page ${i} paragraph ${j}. Original words and thoughts.`,{x:40,y:850-j*30,size:15,font});}fs.writeFileSync(path.join(dir,'library/fixture.pdf'),await pdf.save());
 const seed=JSON.parse(fs.readFileSync(path.join(root,'work/mac-app/seed.json'))),d=seed.data,r=d.notes[0];d.setupCompleted=true;d.zoteroEnabled=false;r.title='Canvas A';
 for(let i=0;i<45;i++)d.notes.push({...structuredClone(r),id:'q'+i,parent:r.id,order:i+1,title:'Question '+i});
 d.notes.push({...structuredClone(r),id:'b',parent:null,title:'Canvas B'},{...structuredClone(r),id:'bq',parent:'b',title:'Question in B',order:1});
 d.questionPages=[{id:'page-world',rootId:r.id,kind:'question',order:1,members:[]},{id:'page-b',rootId:'b',kind:'question',order:2,members:[]}];
 d.crossThoughts=[{id:'xa',pageId:'page-world',title:'Cross A to B',order:7,anchorIds:['q0','bq'],text:'Original cross thought',anchorRevisions:[],origin:'Own',source:'',at:new Date().toISOString(),thoughts:[]},{id:'xb',pageId:'page-b',title:'Cross in B',order:9,anchorIds:['q1','bq'],text:'',anchorRevisions:[],origin:'Own',source:'',at:new Date().toISOString(),thoughts:[]}];
 d.notes.push({...structuredClone(r),id:'xc',parent:'xa',title:'Cross child',order:1});
 d.libraryBooks=[{id:'pdf331',title:'Reading Fixture',author:'Fixture',format:'pdf',storedFile:'fixture.pdf',originalName:'fixture.pdf',addedAt:new Date().toISOString(),progress:{}}];if(process.env.STRUCTURAL_SEED)seed.data=JSON.parse(fs.readFileSync(process.env.STRUCTURAL_SEED)).data;fs.writeFileSync(path.join(dir,'notebook.json'),JSON.stringify(seed));
 const boot=path.join(out,'bootstrap.cjs');fs.writeFileSync(boot,require('./windows-simulation.cjs').bootstrap(path.join(root,'work/mac-app/mac-resources'),path.join(root,'work/mac-app/mac-stage/main.js')));
 const app=await _electron.launch({executablePath:process.env.WENJIAN_PACKAGED_APP||process.env.WENJIAN_ELECTRON_RUNTIME,args:process.env.WENJIAN_PACKAGED_APP?[]:[boot],env:{...process.env,WENJIAN_TEST_DATA_DIR:dir},timeout:30000});const page=await app.firstWindow(),errors=[],report={dir,errors,checks:[]};page.on('pageerror',e=>errors.push(e.message));
 async function state(){return page.evaluate(()=>({overlays:[...document.querySelectorAll('[data-slot=dialog-overlay]')].map(e=>({state:e.dataset.state,rect:e.getBoundingClientRect().toJSON()})),map:document.querySelector('.graph-svg')?.getBoundingClientRect().toJSON(),nodes:document.querySelectorAll('[data-node]').length,camera:document.querySelector('.graph-svg>g')?.getAttribute('transform'),scrollY:scrollY,pointer:getComputedStyle(document.body).pointerEvents}));}
 try{
  await page.getByRole('button',{name:'进入问间',exact:true}).click();await page.locator('[data-node]').first().waitFor();
  if(!process.env.STRUCTURAL_SEED){await page.getByRole('button',{name:'交叉思考',exact:true}).click();await page.getByRole('button',{name:'展开Canvas A',exact:true}).click();
  const tree=page.locator('.question-picker-tree');await tree.hover();const before=await tree.evaluate(e=>e.scrollTop);await page.mouse.wheel(0,550);await page.waitForTimeout(200);report.pickerWheel={before,after:await tree.evaluate(e=>e.scrollTop)};
  await page.screenshot({path:path.join(out,'picker.png')});await page.locator('.block-picker').getByRole('button',{name:'取消',exact:true}).click();
  await page.getByRole('button',{name:'查看全图',exact:true}).click();await page.waitForTimeout(200);const graphBefore=await state();await page.locator('[data-cross-badge=xa] .cross-badge-label').click();await page.waitForTimeout(250);report.crossClicked=await state();
  if(await page.locator('.immersive-window').count())await page.locator('.immersive-window>[data-slot=dialog-close]').click();await page.waitForTimeout(250);
  }
  const graphBefore=await state();
  for(let i=0;i<3;i++){
   await page.getByRole('button',{name:'书库',exact:true}).click();await page.getByRole('button',{name:'读书',exact:true}).click();
   await page.getByRole('button').filter({has:page.getByText(process.env.STRUCTURAL_SEED?'Fixture Book 0':'Reading Fixture',{exact:true})}).first().click();await page.locator('.textLayer span').first().waitFor({timeout:20000});
   await page.locator('.textLayer span').first().evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);element.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));});
   await page.getByRole('button',{name:'做过程笔记',exact:true}).click();await page.getByPlaceholder('记录阅读当下的理解、疑问或提醒…').fill('A saved process note before leaving '+i);
   if(i===0&&!process.env.STRUCTURAL_SEED){await page.locator('.reader-note-dialog').getByRole('button',{name:'所有关联问题'}).click();await page.locator('.reader-note-dialog').getByRole('button',{name:'展开Canvas A',exact:true}).click();const inside=page.locator('.reader-note-dialog .question-picker-tree');await inside.hover();const top=await inside.evaluate(e=>e.scrollTop);await page.mouse.wheel(0,500);await page.waitForTimeout(150);assert(await inside.evaluate(e=>e.scrollTop)>top,'Mouse wheel must work inside process-note question selection');}
   await page.getByRole('button',{name:'保存过程笔记',exact:true}).click();await page.locator('.reader-note-dialog').waitFor({state:'detached'});
   if(i===0){await page.getByRole('button',{name:/查看 \d+ 条过程笔记/}).first().hover();await page.locator('.process-group-preview').waitFor();}
   if(i===1){await page.getByRole('button',{name:/本书笔记/}).first().click();await page.getByRole('button',{name:'写一条思考',exact:true}).click();await page.locator('.book-thought-create textarea').first().fill('Saved book thought before exit');const buttons=await page.locator('.book-thought-create button').allTextContents();console.log('THOUGHT BUTTONS',buttons);await page.locator('.book-thought-create button[type=submit]').click();}
   if(i===1)await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1050,820));
   if(i===2)await page.keyboard.press('Escape');else await page.locator('.library-dialog>[data-slot=dialog-close]').click();
   await page.waitForTimeout(500);const s=await state();const stored=await page.evaluate(()=>fetch('/api/notebook').then(r=>r.json()));assert(stored.data.readingNotes.length>=i+1);report.checks.push({exit:i,...s});await page.screenshot({path:path.join(out,'exit-'+i+'.png')});
   assert(s.nodes>0,'Reading exit must show graph nodes');assert.equal(s.overlays.length,0);assert.equal(s.pointer,'auto');assert.equal(s.scrollY,0,'Closing a reader must not scroll the page');assert.equal(s.camera,graphBefore.camera);
  }
  if(!process.env.STRUCTURAL_SEED){
   await page.getByRole('button',{name:'书库',exact:true}).click();await page.getByRole('button',{name:'读书',exact:true}).click();await page.getByRole('button',{name:'对照阅读',exact:true}).click();
   await page.locator('.comparison-picker').getByRole('button').filter({hasText:'Reading Fixture'}).click();await page.getByRole('button',{name:'共同笔记',exact:true}).click();await page.locator('.shared-question-trigger').click();
   await page.locator('.shared-question-popover').getByRole('button',{name:'展开Canvas A',exact:true}).click();const list=page.locator('.shared-question-popover .question-picker-tree');await list.hover();const before=await list.evaluate(e=>e.scrollTop);await page.mouse.wheel(0,600);await page.waitForTimeout(150);assert(await list.evaluate(e=>e.scrollTop)>before,'Wheel works in comparison nested question popover');report.checks.push('Nested comparison association picker scrolls');await page.keyboard.press('Escape');
   await page.locator('.comparison-header').getByRole('button',{name:'结束对照阅读',exact:true}).click();await page.locator('.library-dialog').waitFor();await page.locator('.library-dialog>[data-slot=dialog-close]').click();await page.waitForTimeout(400);assert.equal((await state()).overlays.length,0);assert((await state()).nodes>0);
  }
  if(!process.env.BASELINE&&!process.env.STRUCTURAL_SEED){assert(report.pickerWheel.after>report.pickerWheel.before);assert.equal(report.crossClicked.overlays.length,0,'Cross click should highlight without opening a modal');assert.equal(report.crossClicked.camera,graphBefore.camera);assert.equal(await page.locator('.edge.cross.is-cross-focus').count(),1);assert.deepEqual(errors,[]);}
 }catch(e){report.failure=e.stack;await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e;}finally{fs.writeFileSync(path.join(out,process.env.STRUCTURAL_SEED?'structural-report.json':process.env.BASELINE?'baseline.json':'report.json'),JSON.stringify(report,null,2));await app.evaluate(({app})=>app.exit(0)).catch(()=>{});console.log(JSON.stringify(report,null,2));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
