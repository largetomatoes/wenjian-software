'use strict';
// Local lexical candidates only: no network, generation model or inferred claims.
const words=s=>new Set(s.split(/\s+/).filter(Boolean));
const STOP=words('的 地 得 了 着 过 和 与 及 或 而 但 却 就 都 也 又 再 先 后 很 更 最 太 还 才 只 仅 并 且 是 在 有 没有 不 非 无 其 之 于 从 把 被 将 对 为 为了 因为 所以 如果 那么 可能 可以 应该 必须 需要 能够 不能 不会 怎么 如何 什么 为什么 这样 那样 这里 那里 这个 那个 这些 那些 一种 一个 一些 一切 我 你 他 她 它 我们 你们 他们 自己 本身 其中 以及 通过 随着 时候 当时 现在 后来 最初 逐渐 慢慢 一直 反过来 只是 a an the and or but of to in on at as for by with is are was were be been being this that these those it its we our they their he she you your i can could should would will may might must not no do does did has have had through again later first then');
const VERBS=words('保留 辨认 修正 修改 理解 认识 思考 处理 观察 发生 构成 表达 影响 形成 改变 产生 建立 解释 说明 发现 选择 判断 记录 阅读 连接 联系 区分 寻找 讨论 研究 分析 使用 创造 实现 反思 接受 拒绝 维持 调整 发展 证明 理清 确定 限定 追问 回应 询问 承认 要求 表现 体现 组织 呈现 导致 决定 依赖 指向 代表 意味着 涉及 包含 允许 提出 保存 突破 理解为 联系到 understand understands understanding think thinks thinking read reads reading write writes writing connect connects connecting change changes changing revise revises revising preserve preserves preserving start starts starting question questions questioning define defines explain explains explaining observe observes observing create creates creating form forms forming develop develops developing relate relates relating consider considers find finds choose chooses record records');
const NOUNS=words('疑问 条件 判断 理解 问题 世界 语言 言语 结构 动机 关系 思想 思路 思考 经验 事实 意义 认识 行为 行动 生活 人生 自我 主体 客体 社会 历史 资本 资本主义 诚实 自由 责任 权力 身体 感知 情感 记忆 逻辑 观念 信念 知识 价值 文化 制度 可能性 过程 理论 实践 位置 内容 概念 标准 语境 证据 表达方式 时间 空间 方法 人类 他人 个人 目的 原因 结果 文本 命题 thought thoughts question questions world language structure motive relationship meaning condition judgment history experience knowledge idea ideas theory practice evidence context');
const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('zh',{granularity:'word'}):null;
function keywordCandidates(input){
 const text=String(input||'').slice(0,12000),items=segmenter?[...segmenter.segment(text)].filter(w=>w.isWordLike).map(w=>({text:w.segment,index:w.index})):Array.from(text.matchAll(/[\p{L}\p{N}]+/gu),m=>({text:m[0],index:m.index}));
 const nouns=[],verbs=[],seenN=new Set(),seenV=new Set();
 for(let i=0;i<items.length;i++){
  const item=items[i],key=item.text.toLowerCase(),previous=items[i-1]?.text.toLowerCase()||'',following=items[i+1]?.text.toLowerCase()||'',nominal=['的','这个','一种','a','an','the','this','that','its','our','my','through','of'].includes(previous)||NOUNS.has(key)&&VERBS.has(following);
  if(STOP.has(key)||/^(我|你|他|她|它|我们|你们|他们|自己)的$/.test(key)||/^\p{N}+$/u.test(key)||Array.from(item.text).length<2||Array.from(item.text).length>20)continue;
  const isVerb=VERBS.has(key)&&!nominal;
  if(isVerb&&!seenV.has(key)){seenV.add(key);verbs.push({...item,key,score:3-i*.025});}
  if((!isVerb||NOUNS.has(key)&&nominal)&&!seenN.has(key)){
   seenN.add(key);const nearbyVerb=[items[i-1],items[i+1]].some(v=>v&&VERBS.has(v.text.toLowerCase()));
   nouns.push({...item,key,score:(NOUNS.has(key)?5:1)+(nominal?1:0)+(nearbyVerb?2:0)+Math.min(item.text.length,5)*.1-i*.025});
  }
 }
 nouns.sort((a,b)=>b.score-a.score);verbs.sort((a,b)=>b.score-a.score);
 const noun=nouns[0],verb=verbs.length?[...verbs].sort((a,b)=>noun?Math.abs(a.index-noun.index)-Math.abs(b.index-noun.index)||b.score-a.score:b.score-a.score)[0]:undefined;
 let parts=[noun?.text,verb?.text].filter((v,i,a)=>v&&a.indexOf(v)===i);
 if(!parts.length){const raw=items.find(w=>!STOP.has(w.text.toLowerCase()))?.text||text.replace(/[^\p{L}\p{N}]/gu,'');parts=[Array.from(raw).slice(0,10).join('')||'摘录'];}
 return {nouns:nouns.slice(0,10).map(w=>w.text),verbs:verbs.slice(0,10).map(w=>w.text),parts,label:parts.join('·')};
}
module.exports={keywordCandidates};
