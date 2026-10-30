import {defineConfig} from 'vite';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
// Keep history fallback for SPA routes, but never return HTML for missing assets.
export default defineConfig({plugins:[{name:'preview-asset-404',configurePreviewServer(server){server.middlewares.use((req,res,next)=>{let path:string;try{path=decodeURIComponent(new URL(req.url??'/','http://localhost').pathname);}catch{res.statusCode=400;res.end('Bad URL');return;}
if(/\.[^/]+$/.test(path)&&!existsSync(fileURLToPath(new URL('./dist'+path,import.meta.url)))){res.statusCode=404;res.setHeader('Content-Type','text/plain; charset=utf-8');res.end('Asset not found');return;}next();});}}]});
