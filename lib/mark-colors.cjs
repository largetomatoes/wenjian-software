const MARK_COLORS=[{id:'yellow',label:'淡黄',hex:'#ecd37a'},{id:'green',label:'浅绿',hex:'#9ccba5'},{id:'blue',label:'浅蓝',hex:'#91bddb'},{id:'purple',label:'浅紫',hex:'#bba4d4'},{id:'orange',label:'浅橙',hex:'#e7b482'},{id:'pink',label:'浅粉',hex:'#dda9bb'}];
function markColor(value){return MARK_COLORS.find(c=>c.id===value)||MARK_COLORS[0];}
function markRgba(value,opacity=.34){const h=markColor(value).hex;return `rgba(${parseInt(h.slice(1,3),16)},${parseInt(h.slice(3,5),16)},${parseInt(h.slice(5,7),16)},${opacity})`;}
module.exports={MARK_COLORS,markColor,markRgba};
