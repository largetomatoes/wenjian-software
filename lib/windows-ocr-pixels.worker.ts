// Dedicated short-lived worker: never run an entire scanned page's pixel loop
// on the UI thread. Transfer ownership, rather than copying the pixel buffer.
import {ocrPixelGray} from './reader-text';
self.onmessage=(event:MessageEvent<{pixels:ArrayBuffer;width:number;height:number}>)=>{
 const {pixels,width,height}=event.data,data=new Uint8ClampedArray(pixels),header=new TextEncoder().encode(`P5\n${width} ${height}\n255\n`),image=new Uint8Array(header.length+width*height);image.set(header);
 // Leptonica accepts lossless PGM. One byte per pixel avoids converting this
 // back into a four-channel canvas and encoding/decoding another full PNG.
 for(let i=0,j=header.length;i<data.length;i+=4,j++)image[j]=ocrPixelGray(data[i],data[i+1],data[i+2]);
 (self as unknown as {postMessage:(data:ArrayBuffer,transfer:Transferable[])=>void}).postMessage(image.buffer,[image.buffer]);
};
