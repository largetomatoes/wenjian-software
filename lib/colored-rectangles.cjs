// Geometry-only export: later/higher-priority marks replace overlapping paint,
// keeping every original annotation record independent of its visible color.
function resolveColoredRectangles(input){let result=[];const ordered=input.filter(r=>[r.x,r.y,r.width,r.height].every(Number.isFinite)&&r.width>0&&r.height>0).map((r,i)=>({...r,_order:i})).sort((a,b)=>(a.priority||0)-(b.priority||0)||a._order-b._order);
 for(const rect of ordered){result=result.flatMap(old=>{const left=Math.max(old.x,rect.x),top=Math.max(old.y,rect.y),right=Math.min(old.x+old.width,rect.x+rect.width),bottom=Math.min(old.y+old.height,rect.y+rect.height);if(right<=left||bottom<=top)return [old];const pieces=[];if(top>old.y)pieces.push({...old,height:top-old.y});if(bottom<old.y+old.height)pieces.push({...old,y:bottom,height:old.y+old.height-bottom});if(left>old.x)pieces.push({...old,y:top,width:left-old.x,height:bottom-top});if(right<old.x+old.width)pieces.push({...old,x:right,y:top,width:old.x+old.width-right,height:bottom-top});return pieces;});result.push(rect);}
 return result.map(({_order,...r})=>r);
}
module.exports={resolveColoredRectangles};
