import type {Release} from './app-updates';
export type UpdateCheck={at:number;successAt?:number;releases?:Release[];error?:string};
export function reusableUpdateCheck(value:UpdateCheck|undefined,now=Date.now()){
 if(!value||now<value.at)return false;
 // Retry failed checks soon; do not carry forward the old one-hour error cache.
 return now-value.at<(value.error?120000:86400000);
}
export function failedUpdateCheck(old:UpdateCheck|undefined,error:string,now=Date.now()):UpdateCheck{
 return {at:now,error,...old?.releases?{releases:old.releases,successAt:old.successAt||old.at}:{}};
}
