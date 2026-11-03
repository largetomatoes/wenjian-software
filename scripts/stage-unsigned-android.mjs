// Optional CI transfer only; the official signing key remains on the author's Mac.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const id=process.env.DRAFT_RELEASE_ID,repo=process.env.GITHUB_REPOSITORY,commit=process.env.GITHUB_SHA;
if(!/^\d+$/.test(id||'')||repo!=='largetomatoes/wenjian-software'||!commit)throw Error('Invalid staging identity');
const pkg=JSON.parse(fs.readFileSync('work/mac-app/asar-src/package.json','utf8'));
const release=JSON.parse(execFileSync('gh',['api',`repos/${repo}/releases/${id}`],{encoding:'utf8'}));
if(!release.draft||release.tag_name!==`v${pkg.releaseVersion}`||release.target_commitish!==commit)throw Error('Unsigned staging requires the matching unpublished release and exact source commit');
const meta=JSON.parse(fs.readFileSync('unsigned-release/output-metadata.json','utf8'));
if(meta.applicationId!=='com.wenjian.reader'||meta.elements[0].versionCode!==Number(pkg.buildVersion)||meta.elements[0].versionName!==pkg.releaseVersion)throw Error('Unexpected APK identity');
const allowed=['aligned-unsigned.apk','badging.txt','output-metadata.json','apksigner.jar','unsigned-sha256.txt'];
if(fs.readdirSync('unsigned-release').some(n=>!allowed.includes(n))||allowed.some(n=>!fs.statSync('unsigned-release/'+n).isFile()))throw Error('Unexpected staging content');
const archive=`ci-android-${pkg.buildVersion}-unsigned.zip`;
execFileSync('zip',['-j',archive,...allowed.map(n=>'unsigned-release/'+n)],{stdio:'inherit'});
execFileSync('gh',['release','upload',release.tag_name,archive,'--repo',repo,'--clobber'],{stdio:'inherit'});
console.log('Unsigned intermediate staged only in the unpublished matching release; remove it before publishing.');
