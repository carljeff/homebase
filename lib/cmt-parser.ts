import { unzipSync } from "fflate";
import { parseHTML } from "linkedom/worker";
import { type CmtSource,sha256,imageType,safeUrl } from "./cmt-model.ts";
export type ParsedRecipe={source:CmtSource;image?:Uint8Array};
const text=(el:Element|null):string=>{if(!el)return "";const walk=(n:Node):string=>{if(n.nodeType===3)return n.textContent??"";const name=(n as Element).tagName?.toLowerCase();if(name==="br")return "\n";return Array.from(n.childNodes).map(walk).join("")+(["div","p","li"].includes(name)?"\n":"");};return walk(el).replace(/\r/g,"").replace(/\u00a0/g," ").trim();};
function normalizedUrl(value:string){const safe=safeUrl(value);if(!safe)return "";const u=new URL(safe);u.hash="";for(const key of [...u.searchParams.keys()])if(/^utm_|^fbclid$|^gclid$/i.test(key))u.searchParams.delete(key);return u.href.replace(/\/$/,"");}
export async function parseCmtZip(bytes:Uint8Array):Promise<ParsedRecipe[]>{
 if(bytes.length>32*1024*1024)throw new Error("ZIP exceeds 32 MB limit. Split larger exports before import.");let total=0;
 const files=unzipSync(bytes,{filter:file=>{if(file.name.startsWith("/")||file.name.split("/").includes(".."))throw new Error("Unsafe ZIP path");total+=file.originalSize;if(file.originalSize>8*1024*1024||total>64*1024*1024)throw new Error("ZIP expanded size exceeds import limits");return !file.name.endsWith("/");}});
 const htmlPath=Object.keys(files).find(n=>/(^|\/)recipes\.html$/i.test(n));if(!htmlPath)throw new Error("ZIP must contain recipes.html");
 const html=new TextDecoder().decode(files[htmlPath]);const {document}=parseHTML(html);const blocks=Array.from(document.querySelectorAll(".recipe"));if(!blocks.length||blocks.length>5000)throw new Error("Expected 1–5000 recipe entries");
 const sourceCounts=new Map<string,number>();for(const b of blocks){const u=normalizedUrl(b.querySelector('[id="original_link"]')?.getAttribute("href")??"");if(u)sourceCounts.set(u,(sourceCounts.get(u)??0)+1);}
 const output:ParsedRecipe[]=[];const keys=new Set<string>();
 for(const block of blocks){const title=text(block.querySelector('[id="name"]'));if(!title)throw new Error("Recipe without a title; import stopped without dropping it");const sourceUrl=block.querySelector('[id="original_link"]')?.getAttribute("href")??"";const url=normalizedUrl(sourceUrl);const providerId=block.getAttribute("data-recipe-id")??block.querySelector('a[href*="copymethat.com/r/"]')?.getAttribute("href")?.match(/\/r\/([^/]+)/)?.[1];const normalizedTitle=title.normalize("NFKC").toLowerCase().replace(/\s+/g," ").trim();
 const identityQuality=providerId?"provider-id":url?(sourceCounts.get(url)===1?"source-url":"source-url-title"):"title-fallback";
 const identity=providerId?"id:"+providerId:url?"url:"+url+(sourceCounts.get(url)!>1?"|title:"+normalizedTitle:""):"title:"+normalizedTitle;const importKey="cmt:"+await sha256(identity);
 if(keys.has(importKey))throw new Error("Ambiguous duplicate recipe identities. Import stopped; resolve duplicate titles/source links first.");keys.add(importKey);
 const imagePath=block.querySelector("img.recipeImage")?.getAttribute("src");let image:Uint8Array|undefined;
 if(imagePath){let decoded:string;try{decoded=decodeURIComponent(imagePath)}catch{decoded=imagePath}const relative=htmlPath.includes("/")?htmlPath.slice(0,htmlPath.lastIndexOf("/")+1):"";image=files[relative+decoded]??files[decoded];if(!image)throw new Error("A referenced recipe image is missing from the ZIP");if(!imageType(image))throw new Error("Unsupported recipe image format; use JPEG, PNG, GIF or WebP");}
 const ingredientSections=Array.from(block.querySelectorAll('.recipeIngredient, .recipeIngredient_subheader, .recipeIngredient_spacer, .recipeIngredient_note')).map(e=>({text:text(e as unknown as Element),kind:e.getAttribute("class")??"recipeIngredient"}));
 const instructionSections=Array.from(block.querySelectorAll('.instruction, .instruction_subheader, .instruction_next')).map(e=>({text:text(e as unknown as Element),kind:e.getAttribute("class")??"instruction"}));
 const source:CmtSource={provider:"copymethat",importKey,identityQuality,title,description:text(block.querySelector('[id="description"]') as unknown as Element),sourceUrl,ingredients:ingredientSections.filter(i=>i.kind.split(" ").includes("recipeIngredient")).map(i=>i.text),ingredientSections,instructions:instructionSections.map(i=>i.text).join("\n\n"),instructionSections,servingsText:text(block.querySelector('[id="recipeYield"]') as unknown as Element),timesText:text(block.querySelector('[id="recipeTimes"], [id="times"], [id="cookTime"], [id="totalTime"]') as unknown as Element),tags:Array.from(block.querySelectorAll(".recipeCategory")).map(e=>text(e as unknown as Element)),sourceNotes:text(block.querySelector('[id="recipeNotes"]') as unknown as Element),extraText:text(block.querySelector('[id="extra_info"]') as unknown as Element),rawHtml:block.outerHTML,imageHash:image?await sha256(image):null,imageType:image?imageType(image):null};output.push({source,...(image?{image}: {})});
 }
 return output;
}
export function bytesToBase64(bytes:Uint8Array){let s="";for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
