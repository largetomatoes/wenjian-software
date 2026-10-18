// Signing is intentionally separate from building. The private key stays outside
// the repository and must match the public key shipped in older applications.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const publicKey=require('../work/mac-app/asar-src/update-public-key.cjs');
const [payloadFile,outputFile]=process.argv.slice(2);
if(!payloadFile||!outputFile||!process.env.WENJIAN_UPDATE_SIGNING_KEY)throw Error('Usage: WENJIAN_UPDATE_SIGNING_KEY=/private/key.pem node scripts/sign-desktop-release.mjs payload.json update-manifest-N.json');
const payload=await fs.readFile(path.resolve(payloadFile),'utf8'),manifest=JSON.parse(payload);
if(manifest.schema!==1||!Number.isSafeInteger(manifest.build)||manifest.build<1||manifest.tag!==`v${manifest.version}-build${manifest.build}`||!Array.isArray(manifest.assets))throw Error('Invalid update identity');
const key=await fs.readFile(process.env.WENJIAN_UPDATE_SIGNING_KEY),signature=crypto.sign('sha256',Buffer.from(payload,'utf8'),key);
if(!crypto.verify('sha256',Buffer.from(payload,'utf8'),publicKey,signature))throw Error('The signing key does not match the installed applications');
await fs.writeFile(outputFile,JSON.stringify({payload,signature:signature.toString('base64')},null,2)+'\n');
console.log('Signed and verified update manifest for build '+manifest.build);
