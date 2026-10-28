// Flush pending drafts and stop installation when sync or persistence cannot finish.
export async function prepareNativeUpdate(){
 const prepare=(window as unknown as {__wenjianPrepareClose?:()=>Promise<boolean>}).__wenjianPrepareClose;
 if(prepare&&await prepare()===false)throw Error('草稿尚未保存，请完成保存后再更新。');
}
