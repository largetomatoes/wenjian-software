import {calculate,type Calculation,type Input} from './compute-tasks';
self.onmessage=(event:MessageEvent<{id:number;task:Calculation;input:Input<Calculation>}>)=>{
 const {id,task,input}=event.data;
 try{self.postMessage({id,result:calculate(task,input)});}catch(error){self.postMessage({id,error:error instanceof Error?error.message:'同步计算未完成'});}
};
