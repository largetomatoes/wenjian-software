'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Maximize, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type Notebook, ROOT, numberOf, crossNumber, crossSignature } from '@/lib/notebook';
import { projectGraph } from '@/lib/graph-projection';
import { GRAPH_NODE_HEIGHT, GRAPH_NODE_WIDTH, layoutQuestionRows, expandCrossRows, CROSS_BADGE_WIDTH, CROSS_BADGE_HEIGHT, type GraphPosition } from '@/lib/graph-layout';
import { fitGraph, wheelCamera, zoomAt, type GraphCamera } from '@/lib/graph-camera';
import { pinchCamera, touchPair } from '@/lib/graph-touch';
import {CrossConnections} from './cross-connections';
import {crossRoutes} from '@/lib/graph-cross-routes';
import './question-map-rows.css';

const initialCamera: GraphCamera = { x: 40, y: 100, zoom: 1 };

function boundary(from: GraphPosition, to: GraphPosition) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const amount = 1 / Math.max(Math.abs(dx) / (GRAPH_NODE_WIDTH / 2), Math.abs(dy) / (GRAPH_NODE_HEIGHT / 2), 1);
  return { x: from.x + GRAPH_NODE_WIDTH / 2 + dx * amount, y: from.y + GRAPH_NODE_HEIGHT / 2 + dy * amount };
}

export const QuestionMap = memo(function QuestionMap({ data, loading, onOpen, onAddRoot, onAddQuestion, rootId = ROOT, viewKey = 'page-world', mobile = false }: { data: Notebook; loading: boolean; onOpen: (id: string) => void; onAddRoot?: () => void; onAddQuestion?:(id:string)=>void; rootId?:string;viewKey?:string;mobile?: boolean }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const savedCamera = useMemo(()=>{try{const value=JSON.parse(localStorage.getItem('wenjian-camera:rows-v3:'+viewKey)||'null');return value&&[value.x,value.y,value.zoom].every(Number.isFinite)&&value.zoom>0?value as GraphCamera:null;}catch{return null;}},[viewKey]);
  const initialized = useRef(!!savedCamera);
  const cameraRef = useRef(savedCamera||initialCamera);
  const frameRef = useRef<number | null>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; camera: GraphCamera } | null>(null);
  const [camera, setCamera] = useState(savedCamera||initialCamera);
  const [viewport, setViewport] = useState({ width: 900, height: 650 });
  const [dragging, setDragging] = useState(false);
  const [crossFocus,setCrossFocus]=useState<string|null>(null);
  const [expandedCrosses,setExpandedCrosses]=useState<Set<string>>(()=>new Set()),[showSources,setShowSources]=useState(false);
  const activateNode=(id:string)=>{if(data.crossThoughts.some(c=>c.id===id)){setCrossFocus(id);setShowSources(false);}else onOpen(id);};
  const focusedCross=data.crossThoughts.find(c=>c.id===crossFocus);
  const relatedIds=useMemo(()=>{
    const ids=new Set<string>();
    if(focusedCross)for(let id of [focusedCross.id,...focusedCross.anchorIds]){
      const seen=new Set<string>();while(id&&!seen.has(id)){seen.add(id);ids.add(id);id=data.notes.find(n=>n.id===id)?.parent||data.crossThoughts.find(c=>c.id===id)?.placementParentId||'';}
    }
    return ids;
  },[focusedCross,data.notes,data.crossThoughts]);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ camera: GraphCamera; pair: ReturnType<typeof touchPair> } | null>(null);
  const tap = useRef<{ id: string | null; x: number; y: number; moved: boolean } | null>(null);
  const ignoreClickUntil = useRef(0);
  const { notes, cards, crossThoughts, links } = data;
  const structure = useMemo(() => ({ notes, cards, crossThoughts, links }), [notes, cards, crossThoughts, links]);
  const projection = useMemo(() => projectGraph(structure), [structure]);
  const layout = useMemo(() => layoutQuestionRows(structure, projection), [structure, projection]);
  const expandedLayout=useMemo(()=>expandCrossRows(layout,expandedCrosses),[layout,expandedCrosses]);
  const {positions}=expandedLayout;
  const routePositions=useMemo(()=>Object.fromEntries(Object.entries(positions).map(([id,p])=>[id,layout.crossOwners[id]&&!expandedLayout.expanded.has(layout.crossOwners[id])?positions[layout.crossOwners[id]]:p])),[layout,positions,expandedLayout]);
  const routeSizes=useMemo(()=>Object.fromEntries([...data.crossThoughts.map(c=>c.id),...Object.keys(layout.crossOwners)].map(id=>[id,expandedLayout.sizes[id]||{width:CROSS_BADGE_WIDTH,height:CROSS_BADGE_HEIGHT}])),[layout,data.crossThoughts,expandedLayout]);
  const routedCrosses=useMemo(()=>crossRoutes(projection.edges,routePositions,routeSizes),[projection,routePositions,routeSizes]);
  const openBranch=(id:string)=>setExpandedCrosses(current=>{
    const next=new Set(current),visit=(key:string)=>{if(next.has(key))return;next.add(key);for(const e of projection.edges)if(e.kind==='cross'&&e.to===key){const source=layout.crossOwners[e.from];if(source&&source!==key)visit(source);}};visit(id);return next;
  });
  const toggleCross=(id:string)=>{if(!layout.lanes[id])return;setCrossFocus(id);setShowSources(false);if(expandedCrosses.has(id))setExpandedCrosses(current=>{const next=new Set(current);next.delete(id);return next;});else openBranch(id);};
  const items = useMemo(() => {
    const visible = new Set(projection.visibleIds);
    return [
      ...data.notes.map(note => ({ id: note.id, text: note.title, kind: note.kind, label: note.id === rootId ? '核心问题' : note.kind === 'question' ? numberOf(note, data.notes, data.crossThoughts) : '回答' })),
      ...data.crossThoughts.map(cross => ({ id: cross.id, text: cross.title || cross.text || '交叉思考', kind: 'cross', label: `${crossNumber(cross)}〔${crossSignature(cross, data)}〕` })),
      ...data.cards.map(card => ({ id: card.id, text: card.text, kind: 'card', label: '卡片' })),
    ].filter(item => visible.has(item.id));
  }, [data, projection]);
  const hiddenSources=useMemo(()=>{
    const groups=new Map<string,string[]>();if(focusedCross)for(const edge of projection.edges)if(edge.kind==='cross'&&edge.to===focusedCross.id&&layout.crossOwners[edge.from]&&!expandedLayout.displayIds.has(edge.from)){const owner=layout.crossOwners[edge.from];groups.set(owner,[...(groups.get(owner)||[]),edge.from]);}return [...groups].map(([owner,ids])=>({owner,ids,label:ids.map(id=>items.find(n=>n.id===id)?.label||'子问题').join('、')}));
  },[focusedCross,projection,layout,expandedLayout,items]);
  const bounds = useMemo(() => {
    const values = [...expandedLayout.displayIds].map(id=>positions[id]).filter(Boolean);
    return { left: Math.min(0, ...values.map(p => p.x)), top: Math.min(0, ...values.map(p => p.y)), right: Math.max(GRAPH_NODE_WIDTH, ...values.map(p => p.x + GRAPH_NODE_WIDTH)), bottom: Math.max(GRAPH_NODE_HEIGHT, ...values.map(p => p.y + GRAPH_NODE_HEIGHT)) };
  }, [positions,layout,data.crossThoughts,expandedLayout]);
  const viewBounds={left:-camera.x/camera.zoom-GRAPH_NODE_WIDTH,top:-camera.y/camera.zoom-GRAPH_NODE_HEIGHT,right:(viewport.width-camera.x)/camera.zoom+GRAPH_NODE_WIDTH,bottom:(viewport.height-camera.y)/camera.zoom+GRAPH_NODE_HEIGHT};
  const inView=(p:GraphPosition)=>p.x+GRAPH_NODE_WIDTH>=viewBounds.left&&p.x<=viewBounds.right&&p.y+GRAPH_NODE_HEIGHT>=viewBounds.top&&p.y<=viewBounds.bottom;

  // Coalesce only active gestures. There is no idle animation or layout loop.
  const moveCamera = useCallback((next: GraphCamera) => {
    cameraRef.current = next;
    if (frameRef.current === null) frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      setCamera(cameraRef.current);try{localStorage.setItem('wenjian-camera:rows-v3:'+viewKey,JSON.stringify(cameraRef.current));}catch{}
    });
  }, [viewKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      if(entry.contentRect.width<=0||entry.contentRect.height<=0)return;
      if (mobile) initialized.current = false;
      setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(canvas);
    const resume=()=>{const rect=canvas.getBoundingClientRect();if(rect.width>0&&rect.height>0)setViewport({width:rect.width,height:rect.height});};
    window.addEventListener('wenjian:reader-closed',resume);
    const onWheel = (event: WheelEvent) => {
      if(event.target instanceof Element&&event.target.closest('.graph-cross-stack,.graph-cross-focus,.graph-cross-info,.map-controls,button,input,textarea,select,[role=dialog]'))return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1;
      moveCamera(wheelCamera(cameraRef.current, { x: event.deltaX * unit, y: event.deltaY * unit }, { x: event.clientX - rect.left, y: event.clientY - rect.top }, event.ctrlKey));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      observer.disconnect();
      window.removeEventListener('wenjian:reader-closed',resume);
      canvas.removeEventListener('wheel', onWheel);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [moveCamera, mobile]);

  useEffect(() => {
    if (initialized.current || loading || !positions[rootId] || viewport.height <= 0) return;
    initialized.current = true;
    const rect = canvasRef.current?.getBoundingClientRect();
    moveCamera(fitGraph(bounds, rect && rect.width > 0 && rect.height > 0 ? { width: rect.width, height: rect.height } : viewport));
  }, [loading, positions, viewport, moveCamera, mobile, bounds]);

  const resize = (zoom: number) => moveCamera(zoomAt(cameraRef.current, zoom, { x: viewport.width / 2, y: viewport.height / 2 }));
  const endDrag = () => { dragRef.current = null; setDragging(false); };
  const endTouch = (event: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    touches.current.delete(event.pointerId);
    ignoreClickUntil.current = Date.now() + 500;
    if (!cancelled && !tap.current?.moved && tap.current?.id) activateNode(tap.current.id);
    tap.current = null;
    pinch.current = null;
    const remaining = [...touches.current.entries()][0];
    if (remaining) { const rect = event.currentTarget.getBoundingClientRect(); dragRef.current = { pointerId: remaining[0], x: remaining[1].x + rect.left, y: remaining[1].y + rect.top, camera: cameraRef.current }; }
    else endDrag();
  };
  return <div className={'map-canvas' + (dragging ? ' is-dragging' : '') + (mobile ? ' mobile-map-canvas' : '')} ref={canvasRef} tabIndex={0} aria-label={mobile ? '全部问题关系图，单指移动、双指缩放，点击问题查看内容' : '问题关系图，可用触控板滚动或拖动平移'}
    onPointerDown={event => {
      if (mobile && event.pointerType === 'touch') {
        if ((event.target as Element).closest('button,.graph-cross-focus,.graph-cross-info')) return;
        const rect = event.currentTarget.getBoundingClientRect();
        touches.current.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top });
        event.currentTarget.setPointerCapture(event.pointerId);
        if (touches.current.size === 1) {
          const id = (event.target as Element).closest('[data-node]')?.getAttribute('data-node') || null;
          tap.current = { id, x: event.clientX, y: event.clientY, moved: false };
          dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, camera: cameraRef.current };
        } else {
          if (tap.current) tap.current.moved = true;
          pinch.current = { camera: cameraRef.current, pair: touchPair([...touches.current.values()]) };
          dragRef.current = null;
        }
        setDragging(true);
        return;
      }
      if (event.button !== 0 || (event.target as Element).closest('[data-node],button,input,textarea,select,.graph-cross-focus,.graph-cross-info')) return;
      dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, camera: cameraRef.current };
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }}
    onPointerMove={event => {
      if (mobile && touches.current.has(event.pointerId)) {
        const rect = event.currentTarget.getBoundingClientRect();
        touches.current.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top });
        if (tap.current && Math.hypot(event.clientX - tap.current.x, event.clientY - tap.current.y) > 8) tap.current.moved = true;
        if (pinch.current && touches.current.size > 1) {
          moveCamera(pinchCamera(pinch.current.camera, pinch.current.pair, touchPair([...touches.current.values()])));
          return;
        }
      }
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      moveCamera({ ...drag.camera, x: drag.camera.x + event.clientX - drag.x, y: drag.camera.y + event.clientY - drag.y });
    }}
    onPointerUp={event => mobile && touches.current.has(event.pointerId) ? endTouch(event) : endDrag()}
    onPointerCancel={event => mobile && touches.current.has(event.pointerId) ? endTouch(event, true) : endDrag()}
    onLostPointerCapture={event => { if (touches.current.has(event.pointerId)) endTouch(event, true); else if (!touches.current.size) endDrag(); }}
    onKeyDown={event => {
      if (event.target !== event.currentTarget) return;
      const offsets: Record<string, [number, number]> = { ArrowUp: [0, 80], ArrowDown: [0, -80], ArrowLeft: [80, 0], ArrowRight: [-80, 0] };
      const offset = offsets[event.key];
      if (offset) { event.preventDefault(); moveCamera({ ...cameraRef.current, x: cameraRef.current.x + offset[0], y: cameraRef.current.y + offset[1] }); }
    }}>
    {onAddRoot && <Button type="button" variant="outline" size="sm" className="map-add-root" disabled={loading} onClick={onAddRoot}><Plus/>添加一级问题</Button>}
    <svg className="graph-svg" width="100%" height="100%" viewBox={`0 0 ${viewport.width} ${viewport.height}`} role="group" aria-label="全部问题与联系">
      <g transform={`translate(${camera.x} ${camera.y}) scale(${camera.zoom})`}>
        {expandedLayout.bands.map(band=><rect key={'band:'+band.id} className="cross-canvas-band" x={band.x} y={band.y} width={band.width} height={band.height} rx="11" pointerEvents="none"/>)}
        {projection.edges.map(edge => {
          if(edge.kind==='hierarchy'&&(!expandedLayout.displayIds.has(edge.from)||!expandedLayout.displayIds.has(edge.to)||(data.crossThoughts.some(c=>c.id===edge.to))))return null;
          const a = routePositions[edge.from], b = routePositions[edge.to];
          if (!a || !b || edge.from === edge.to) return null;
          if(Math.max(a.x,b.x)+GRAPH_NODE_WIDTH<viewBounds.left||Math.min(a.x,b.x)>viewBounds.right||Math.max(a.y,b.y)+GRAPH_NODE_HEIGHT<viewBounds.top||Math.min(a.y,b.y)>viewBounds.bottom)return null;
          let path: string;
          if (edge.kind === 'hierarchy') {
            const ax = a.x + GRAPH_NODE_WIDTH, bx = b.x, ay = a.y + GRAPH_NODE_HEIGHT / 2, by = b.y + GRAPH_NODE_HEIGHT / 2;
            const mid = (ax + bx) / 2;
            if(layout.crossOwners[edge.to]){const joint=bx-36;path=ay===by?`M${ax} ${ay} L${bx} ${by}`:`M${ax} ${ay} L${joint} ${ay} L${joint} ${by} L${bx} ${by}`;}else path = `M${ax} ${ay} C${mid} ${ay},${mid} ${by},${bx} ${by}`;
          } else if(edge.kind==='cross'&&routedCrosses.has(edge.id)){
            path=routedCrosses.get(edge.id)!;
          } else {
            const start = boundary(a, b), end = boundary(b, a);
            path = `M${start.x} ${start.y} L${end.x} ${end.y}`;
          }
          return <path key={edge.id} data-edge-from={edge.from} data-edge-to={edge.to} d={path} className={`edge ${edge.kind}${edge.kind==='hierarchy'&&layout.crossOwners[edge.to]?' is-cross-tree':''}${focusedCross?((edge.kind==='cross'&&edge.to===focusedCross.id)||(edge.kind==='hierarchy'&&relatedIds.has(edge.from)&&relatedIds.has(edge.to))?' is-cross-focus':' is-cross-muted'):''}`} fill="none" pointerEvents="none"><title>{edge.type}</title></path>;
        })}
        {hiddenSources.map(source=>{const p=positions[source.owner];if(!p||!inView(p))return null;return <foreignObject key={'source:'+source.owner} x={p.x} y={p.y+CROSS_BADGE_HEIGHT+6} width={Math.max(CROSS_BADGE_WIDTH,220)} height="25"><button type="button" className="cross-hidden-source" title={`关联的是 ${source.label}；点击展开所属分支`} aria-label={`展开来源 ${source.label}`} onClick={()=>openBranch(source.owner)}>{source.label}<span>展开来源 ↗</span></button></foreignObject>;})}
        {items.map(item => {
          const position = positions[item.id];
          if (!position||!inView(position)||!expandedLayout.displayIds.has(item.id)) return null;
          if(item.kind==='cross'&&!expandedLayout.expanded.has(item.id)){const c=data.crossThoughts.find(c=>c.id===item.id)!,expanded=expandedCrosses.has(c.id);return <foreignObject key={item.id} x={position.x} y={position.y} width={CROSS_BADGE_WIDTH} height={CROSS_BADGE_HEIGHT} overflow="visible"><div className={'cross-badge'+(crossFocus===c.id?' is-focused':'')} data-cross-badge={c.id}><button type="button" className="cross-badge-label" aria-label={`${crossNumber(c)} 关联 ${c.anchorIds.length} 个问题`} aria-pressed={crossFocus===c.id} title={c.title||c.text||'交叉思考'} onClick={()=>activateNode(c.id)}><i/>{crossNumber(c)}<span>关联 {c.anchorIds.length} 个问题</span></button><button type="button" className="cross-badge-expand" aria-label={`${expanded?'收起':'展开'} ${crossNumber(c)} 交叉分支`} aria-expanded={expanded} onClick={()=>toggleCross(c.id)}>{expanded?'收起':'展开'}</button></div></foreignObject>;}
          return <g key={item.id} data-node={item.id} data-cross-node={(layout.crossOwners[item.id]||expandedLayout.expanded.has(item.id))?item.id:undefined} role="button" tabIndex={0} aria-label={`${item.label}：${item.text}`}
            className={`map-node ${item.kind}${item.id === rootId ? ' root-node' : ''}${relatedIds.has(item.id)?' is-cross-related':''}${layout.crossOwners[item.id]?' cross-descendant':''}`} transform={`translate(${position.x} ${position.y})`}
            aria-pressed={item.kind==='cross'?crossFocus===item.id:undefined}
            onClick={() => { if (Date.now() > ignoreClickUntil.current) onOpen(item.id); }} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onOpen(item.id); } }}>
            <title>{item.label} · {item.text}</title>
            <rect className="node-surface" width={GRAPH_NODE_WIDTH} height={GRAPH_NODE_HEIGHT} rx="10" />
            {camera.zoom>=.25&&<><foreignObject x="16" y="9" width={GRAPH_NODE_WIDTH-32} height="18"><div className="node-tag">{item.kind==='cross'?crossNumber(data.crossThoughts.find(c=>c.id===item.id)!):item.label}</div></foreignObject><foreignObject x="16" y="30" width={GRAPH_NODE_WIDTH-32} height="46"><div className="node-words">{item.text}</div></foreignObject>{onAddQuestion&&item.kind!=='card'&&item.kind!=='answer'&&<foreignObject x={GRAPH_NODE_WIDTH-112} y={GRAPH_NODE_HEIGHT-23} width="104" height="20"><button type="button" className="map-node-add" aria-label={`为 ${item.kind==='cross'?crossNumber(data.crossThoughts.find(c=>c.id===item.id)!):item.label} 添加子问题`} onClick={e=>{e.stopPropagation();onAddQuestion(item.id);}}>＋ 子问题</button></foreignObject>}</>}
            {item.kind==='cross'&&<foreignObject x={GRAPH_NODE_WIDTH-65} y="6" width="55" height="24"><button type="button" className="cross-node-collapse" aria-label={`收起 ${crossNumber(data.crossThoughts.find(c=>c.id===item.id)!)} 交叉分支`} onClick={e=>{e.stopPropagation();toggleCross(item.id);}}>收起</button></foreignObject>}

          </g>;
        })}
      </g>
    </svg>

    {focusedCross&&<div className="graph-cross-stack"><div className="graph-cross-info"><strong>{crossNumber(focusedCross)} · {focusedCross.anchorIds.length} 个关联</strong><button type="button" onClick={()=>setShowSources(v=>!v)}>查看来源</button><button type="button" onClick={()=>onOpen(focusedCross.id)}>打开思考</button><button type="button" aria-label="取消交叉高亮" onClick={()=>{setCrossFocus(null);setShowSources(false);}}>×</button></div>
    {showSources&&<aside className="graph-cross-focus"><header><strong>{focusedCross.title||'交叉思考'}</strong><button type="button" aria-label="关闭交叉路径预览" onClick={()=>setShowSources(false)}>×</button></header><CrossConnections data={data} cross={focusedCross} onOpen={onOpen}/></aside>}</div>}

    {loading && <div className="map-loading"><Loader2 className="spin" />读取中</div>}
    <div className="map-controls">
      <Button variant="ghost" size="icon" aria-label="缩小关系图" title="缩小" onClick={() => resize(cameraRef.current.zoom / 1.2)}><Minus /></Button>
      <button type="button" className="map-zoom-value" aria-label="恢复百分之百大小" title="恢复 100%" onClick={() => resize(1)}>{Math.round(camera.zoom * 100)}%</button>
      <Button variant="ghost" size="icon" aria-label="放大关系图" title="放大" onClick={() => resize(cameraRef.current.zoom * 1.2)}><Plus /></Button>
      <Button variant="ghost" size="icon" aria-label="查看全图" title="查看全图" onClick={() => moveCamera(fitGraph(bounds, viewport))}><Maximize /></Button>
      {mobile && <button type="button" onClick={() => { const root = positions[rootId]; if (root) moveCamera({ zoom: 1, x: viewport.width / 2 - root.x - GRAPH_NODE_WIDTH / 2, y: viewport.height / 2 - root.y - GRAPH_NODE_HEIGHT / 2 }); }}>核心</button>}
    </div>
  </div>;
});
