'use strict';
// JSON semantics: omit undefined object fields, preserve array order and null.
function stableJson(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(v=>stableJson(v)??'null').join(',')+']';return '{'+Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>JSON.stringify(k)+':'+stableJson(value[k])).join(',')+'}';}
function sameJson(a,b){return a===b||stableJson(a)===stableJson(b);}
module.exports={stableJson,sameJson};
