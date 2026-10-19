// Stable policy, not fluctuating process counters: changing the budget invalidates canvases.
function readerBudget({totalKB,availableKB,onBattery=false,cpuLimit=100}){
 const constrained=availableKB<1024*1024||cpuLimit<70;
 const roomy=totalKB>=14*1024*1024&&!constrained;
 return {canvasPixels:constrained?4_000_000:roomy?8_000_000:6_000_000,cachePixels:constrained?6_000_000:roomy?16_000_000:12_000_000,
  ocrIdleMs:constrained?30000:180000,allowPrefetch:!onBattery&&!constrained&&availableKB>=2*1024*1024,
  onBattery:!!onBattery,cpuLimit:cpuLimit<70?50:100};
}
module.exports={readerBudget};
