import http from 'node:http';
import worker from '../worker/index.mjs';
http.createServer(async(req,res)=>{
  try {
    const chunks=[];for await(const c of req) chunks.push(c);
    const r=await worker.fetch(new Request('http://127.0.0.1:4174'+req.url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})}),process.env);
    res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));
  }catch {res.writeHead(500);res.end('API error');}
}).listen(4174,'127.0.0.1',()=>console.log('ShipOne API ready on 127.0.0.1:4174'));
