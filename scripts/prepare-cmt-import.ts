/** Private conversion helper. Outputs only outside the source checkout. Never commit its output. */
import { readFileSync,mkdirSync,writeFileSync } from "node:fs";
import { resolve,dirname,relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCmtZip,bytesToBase64 } from "../lib/cmt-parser.ts";
const [zipPath,outputPath]=process.argv.slice(2);
if(!zipPath||!outputPath)throw new Error("Usage: node --experimental-strip-types scripts/prepare-cmt-import.ts /path/export.zip /outside/repo/private-imports");
const root=resolve(dirname(fileURLToPath(import.meta.url)),".."),output=resolve(outputPath);const rel=relative(root,output);if(!rel.startsWith("..")||resolve(zipPath).startsWith(root+"/"))throw new Error("Keep both the ZIP and converted data outside the source checkout");
const recipes=await parseCmtZip(new Uint8Array(readFileSync(zipPath)));mkdirSync(output,{recursive:true,mode:0o700});
for(let i=0;i<recipes.length;i+=10)writeFileSync(resolve(output,`batch-${i/10}.private.json`),JSON.stringify(recipes.slice(i,i+10).map(r=>({source:r.source,...(r.image?{imageBase64:bytesToBase64(r.image)}:{})}))),{mode:0o600});
console.log(JSON.stringify({recipes:recipes.length,images:recipes.filter(r=>r.image).length,batches:Math.ceil(recipes.length/10),titleFallbacks:recipes.filter(r=>r.source.identityQuality==="title-fallback").length}));
