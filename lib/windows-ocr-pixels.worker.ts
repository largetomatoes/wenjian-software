// Dedicated short-lived worker: never run an entire scanned page's pixel loop
// on the UI thread. Transfer ownership, rather than copying the pixel buffer.
import {ocrPixelGray} from './reader-text';
self.onmessage=(event:MessageEvent<{pixels?:ArrayBuffer;bitmap?:ImageBitmap;width:number;height:number}>)=>{
 const {pixels,bitmap,width,height}=event.data;let data:Uint8ClampedArray;
 if(bitmap){const canvas=new OffscreenCanvas(width,height),context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw Error('OCR canvas unavailable');try{context.drawImage(bitmap,0,0);data=context.getImageData(0,0,width,height).data;}finally{bitmap.close();canvas.width=canvas.height=1;}}else data=new Uint8ClampedArray(pixels!);
 const header=new TextEncoder().encode(`P5\n${width} ${height}\n255\n`),image=new Uint8Array(header.length+width*height);image.set(header);
 // Leptonica accepts lossless PGM. One byte per pixel avoids converting this
 // back into a four-channel canvas and encoding/decoding another full PNG.
 for(let i=0,j=header.length;i<data.length;i+=4,j++)image[j]=ocrPixelGray(data[i],data[i+1],data[i+2]);
 (self as unknown as {postMessage:(data:ArrayBuffer,transfer:Transferable[])=>void}).postMessage(image.buffer,[image.buffer]);
};
