// Vector source is the editable master; generate every Windows icon size explicitly.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sizes=[16,20,24,32,48,64,128,256],images=[];
for(const size of sizes){
 const source=sharp(path.join(root,'installer-icon.svg')).resize(size,size);
 if(size>=64){images.push(await source.png().toBuffer());continue;}
 const pixels=await source.ensureAlpha().raw().toBuffer(),stride=Math.ceil(size/32)*4,header=Buffer.alloc(40),bitmap=Buffer.alloc(size*size*4),mask=Buffer.alloc(stride*size);
 header.writeUInt32LE(40);header.writeInt32LE(size,4);header.writeInt32LE(size*2,8);header.writeUInt16LE(1,12);header.writeUInt16LE(32,14);header.writeUInt32LE(bitmap.length+mask.length,20);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const from=(y*size+x)*4,to=((size-1-y)*size+x)*4;bitmap[to]=pixels[from+2];bitmap[to+1]=pixels[from+1];bitmap[to+2]=pixels[from];bitmap[to+3]=pixels[from+3];if(!pixels[from+3])mask[(size-1-y)*stride+(x>>3)]|=0x80>>(x%8);}
 images.push(Buffer.concat([header,bitmap,mask]));
}
const directory=Buffer.alloc(6+16*sizes.length);directory.writeUInt16LE(1,2);directory.writeUInt16LE(sizes.length,4);let offset=directory.length;
sizes.forEach((size,i)=>{const entry=6+16*i;directory[entry]=directory[entry+1]=size===256?0:size;directory.writeUInt16LE(1,entry+4);directory.writeUInt16LE(32,entry+6);directory.writeUInt32LE(images[i].length,entry+8);directory.writeUInt32LE(offset,entry+12);offset+=images[i].length;});
await fs.writeFile(path.join(root,'InstallerIcon-win.ico'),Buffer.concat([directory,...images]));
console.log('Generated Wenjian installer icon: '+sizes.join(', ')+' px');
