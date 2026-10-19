import {calculate,type Calculation,type Input,type Output} from './compute-tasks';
export type {Calculation,Input,Output} from './compute-tasks';
export async function compute<K extends Calculation>(task:K,input:Input<K>):Promise<Output<K>>{
 if(typeof document!=='undefined'&&typeof Worker!=='undefined')return (await import('./compute-bridge')).backgroundCompute(task,input);
 return calculate(task,input);
}
