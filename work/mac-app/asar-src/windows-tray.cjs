// Keep the same live window for instant restore. Never destroy it to bypass
// beforeunload: saving and the existing editor guards own the exit decision.
const fs=require('node:fs');const path=require('node:path');
function createWindowsTray({app,Tray,Menu,nativeImage,dialog,getWindow,isUpdating,prepareQuit}){
 let tray=null,quitting=false,pending=false,prompting=false;
 const file=path.join(app.getPath('userData'),'tray-config.json');
 function preference(){try{const config=JSON.parse(fs.readFileSync(file,'utf8'));return config.choiceVersion===2?config.closeToTray:undefined;}catch{return undefined;}}
 function remember(value){try{fs.writeFileSync(file,JSON.stringify({choiceVersion:2,closeToTray:value}),{mode:0o600});}catch(error){console.error('Tray preference could not be saved',error.code);}}
 function show(){const win=getWindow();if(!win||win.isDestroyed())return;if(win.isMinimized())win.restore();win.show();win.focus();}
 function hide(){const win=getWindow();if(tray&&win&&!win.isDestroyed())win.hide();}
 async function quit(){if(pending||quitting)return;pending=true;try{await prepareQuit();quitting=true;app.quit();}catch(error){quitting=false;show();const win=getWindow();if(win&&!win.isDestroyed())await dialog.showMessageBox(win,{type:'error',title:'尚未退出',message:'草稿、保存或同步尚未完成。',detail:'问间已保留在运行状态，请检查保存提示后再退出。',buttons:['返回问间']});console.error('Exit preparation failed',error.message);}finally{pending=false;}}
 function install(){if(tray)return true;try{const image=nativeImage.createFromPath(path.join(__dirname,'AppIcon.ico'));if(image.isEmpty())throw Error('Missing tray icon');tray=new Tray(image);tray.setToolTip('问间');tray.setContextMenu(Menu.buildFromTemplate([{label:'显示问间',click:show},{label:'收起到托盘',click:hide},{type:'separator'},{label:'关闭按钮行为',submenu:[{label:'收起到托盘（快速恢复）',click:()=>remember(true)},{label:'退出软件',click:()=>remember(false)}]},{type:'separator'},{label:'退出问间',click:()=>void quit()}]));tray.on('click',show);tray.on('double-click',show);return true;}catch(error){tray=null;console.error('Tray unavailable',error.message);return false;}}
 function attach(win){install();win.on('close',event=>{
  if(quitting||isUpdating())return;event.preventDefault();if(pending||prompting)return;
  const choice=preference();if(choice===true&&tray){hide();return;}if(choice===false){void quit();return;}
  prompting=true;const canHide=!!tray;void dialog.showMessageBox(win,{type:'question',title:'关闭问间',message:'请选择关闭方式',detail:canHide?'退出软件会释放应用资源；最小化到托盘会保留阅读位置和窗口，后台识别暂停。':'系统托盘暂不可用，可以退出软件或返回继续使用。',buttons:canHide?['退出软件','最小化到托盘','取消']:['退出软件','取消'],defaultId:canHide?2:1,cancelId:canHide?2:1,noLink:true,checkboxLabel:'记住我的选择，下次不再询问',checkboxChecked:false}).then(result=>{
   if(result.response===0){if(result.checkboxChecked)remember(false);void quit();}
   else if(result.response===1&&canHide){if(result.checkboxChecked)remember(true);hide();}
  }).catch(console.error).finally(()=>{prompting=false;});
 });}

 return{attach,show,quit,isQuitting:()=>quitting,cancelQuit:()=>{quitting=false;},dispose:()=>{tray?.destroy();tray=null;}};
}
module.exports={createWindowsTray};
