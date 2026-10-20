const {test}=require('node:test'),assert=require('node:assert/strict'),{load,plain}=require('./load-ts.cjs');
const m=load('lib/notebook.ts'),org=load('lib/page-organization.cjs'),{questionChoices,questionPath,crossConnections}=load('lib/question-links.ts'),{projectGraph}=load('lib/graph-projection.ts'),{layoutGraph}=load('lib/graph-layout.ts');
function fixture(){let d=m.normalize(m.changeCoreQuestion(plain(m.initialNotebook),'Page A'));d=m.addQuestionPage(d,'Page B',[],'b').data;const note=(id,parent)=>({...d.notes[0],id,parent,title:id,order:1});d=org.registerPageAdditions(d,{...d,notes:[...d.notes,note('aq','world')]},'page-world');d=org.registerPageAdditions(d,{...d,notes:[...d.notes,note('bq','b')]},'page-b');const cross=(id,pageId,order)=>({id,pageId,title:id,order,anchorIds:['aq','bq'],text:'original',at:'2026-10-20',thoughts:[],anchorRevisions:[]});d=org.registerPageAdditions(d,{...d,crossThoughts:[cross('xa','page-world',7)]},'page-world');d=org.registerPageAdditions(d,{...d,crossThoughts:[...d.crossThoughts,cross('xb','page-b',9)]},'page-b');d=org.registerPageAdditions(d,{...d,notes:[...d.notes,note('xa-child','xa')]},'page-world');return d;}
test('crosses belong to their canvas, local numbering does not rewrite records/history',()=>{
 const d=fixture(),before=JSON.stringify(d),a=m.pageView(d,'page-world'),b=m.pageView(d,'page-b'),choices=questionChoices(d);
 assert.equal(a.crossThoughts.length,1);assert.equal(b.crossThoughts.length,1);assert.equal(a.crossThoughts[0].pageId,'page-world');assert.equal(m.crossNumber(a.crossThoughts[0]),'X1');assert.equal(m.crossNumber(b.crossThoughts[0]),'X1');assert.equal(m.crossNumber(d.crossThoughts[0],d),'X1');assert.equal(m.numberOf(a.notes.find(n=>n.id==='xa-child'),a.notes,a.crossThoughts),'X1.1');
 assert(choices[0].children.some(n=>n.id==='xa'&&n.children[0].id==='xa-child'));assert(!choices[0].children.some(n=>n.id==='xb'));assert(choices[1].children.some(n=>n.id==='xb'));assert(!choices.some(n=>n.key==='crosses'));
 assert(questionPath(d,'xa-child').includes('Page A / xa / xa-child'));assert(questionPath(a,'bq').includes('Page B / bq'));assert.equal(new Set(crossConnections(d,d.crossThoughts[0]).map(a=>a.pageId)).size,2);
 const graph=projectGraph(a),positions=layoutGraph(a,graph);assert(graph.edges.some(e=>e.kind==='hierarchy'&&e.from==='world'&&e.to==='xa'));assert(!graph.visibleIds.includes('bq'));assert(positions['xa-child'].x>positions.xa.x);assert(Object.values(positions).every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));assert.equal(JSON.stringify(d),before);assert.equal(d.crossThoughts[0].order,7);
});
test('aggregate can organize a cross without changing source canvas or ownership',()=>{
 const original=fixture(),copy=m.addQuestionPage(original,'Aggregate',['page-world','page-b'],'all');let d=copy.data;const source=JSON.stringify(m.pageView(d,'page-world'));
 d=org.movePlacement(d,copy.page.id,'xa','bq');const view=m.pageView(d,copy.page.id),cross=view.crossThoughts.find(c=>c.id==='xa');assert.equal(cross.placementParentId,'bq');assert.equal(cross.pageId,'page-world');assert.equal(m.crossNumber(cross),'2.1.X1');assert.equal(m.numberOf(view.notes.find(n=>n.id==='xa-child'),view.notes,view.crossThoughts),'2.1.X1.1');
 assert.equal(JSON.stringify(m.pageView(d,'page-world').notes),JSON.stringify(m.pageView(original,'page-world').notes));assert.equal(m.crossNumber(m.pageView(d,'page-world').crossThoughts[0]),'X1');
 const reordered={...d,questionPages:[copy.page,...d.questionPages.filter(p=>p.id!==copy.page.id)]};assert.equal(m.pageForRecord(reordered,'xa-child').id,'page-world');assert.equal(m.pageForRecord(reordered,'xa').id,'page-world');assert(questionChoices(d).find(c=>c.id==='all').children.some(c=>c.id==='b'));
 assert.equal(org.validateOrganization(d),'');assert(source.includes('"displayCode":"X1"'));
});
test('legacy cross uses its original placement, not the first external anchor',()=>{
 const d=fixture();delete d.crossThoughts.find(c=>c.id==='xb').pageId;
 assert.equal(m.pageForRecord(d,'xb').id,'page-b');assert.equal(m.crossNumber(d.crossThoughts.find(c=>c.id==='xb'),d),'X1');
 assert(questionChoices(d).find(p=>p.id==='b').children.some(c=>c.id==='xb'));
});
