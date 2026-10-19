export function isOptimizedReader(){return typeof document!=='undefined'&&(document.documentElement.dataset.wenjianOptimized==='true'||document.documentElement.dataset.wenjianPlatform==='windows');}
export function isDesktopReader(){return typeof document!=='undefined'&&['windows','mac'].includes(document.documentElement.dataset.wenjianPlatform||'');}
