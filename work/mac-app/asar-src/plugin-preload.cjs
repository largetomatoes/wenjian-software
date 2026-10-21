const {contextBridge,ipcRenderer}=require('electron');
const invoke=async(method,payload)=>{const reply=await ipcRenderer.invoke('wenjian-plugin:v2',method,payload);if(!reply.ok)throw Error(reply.error);return reply.value;};
contextBridge.exposeInMainWorld('wenjian',{
 info:()=>invoke('info'),
 notebook:{read:()=>invoke('notebook.read')},
 graph:{read:()=>invoke('graph.read')},
 changes:{preview:(operations,reason)=>invoke('changes.preview',{operations,reason}),apply:token=>invoke('changes.apply',{token})},
 storage:{get:key=>invoke('storage.get',{key}),set:(key,value)=>invoke('storage.set',{key,value})},
 network:{request:options=>invoke('network.request',options)},
 files:{open:()=>invoke('files.open'),save:(name,text)=>invoke('files.save',{name,text})},
 system:{run:(args=[],input='')=>invoke('system.run',{args,input})}
});
