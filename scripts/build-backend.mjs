import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const paths={'/index.html':'text/html; charset=utf-8','/style.css':'text/css; charset=utf-8','/app.js':'text/javascript; charset=utf-8','/random.mjs':'text/javascript; charset=utf-8','/sync.js':'text/javascript; charset=utf-8'};
const assets={};
for(const [path,type] of Object.entries(paths))assets[path]={type,body:await readFile(new URL('web'+path,root),'utf8')};
const source=await readFile(new URL('worker/index.js',root),'utf8');
const match=assets['/app.js'].body.match(/const defaults = (\[[^;]+\]);/);
if(!match)throw new Error('Default member list not found.');
// The authored default list contains string literals only.
const names=Function('return '+match[1])();
const output=source.replace('/*__ASSETS__*/ {}',JSON.stringify(assets)).replace('/*__DEFAULT_NAMES__*/ []',JSON.stringify(names));
await rm(new URL('dist/',root),{recursive:true,force:true});
await mkdir(new URL('dist/server/',root),{recursive:true});await mkdir(new URL('dist/.openai/',root),{recursive:true});
await writeFile(new URL('dist/server/index.js',root),output);
await writeFile(new URL('dist/.openai/hosting.json',root),await readFile(new URL('.openai/hosting.json',root)));
console.log('Built the shared-state Worker and embedded management page.');
