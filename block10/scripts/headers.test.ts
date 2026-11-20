import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestHeaders} from '../web/src/api/headers';
test('bodyless GET/DELETE omit content type; JSON writes retain application/json',()=>{
 for(const method of ['GET','DELETE'])assert.equal(requestHeaders({method}).has('Content-Type'),false);
 for(const method of ['POST','PATCH'])assert.equal(requestHeaders({method,body:'{}'}).get('Content-Type'),'application/json');
 assert.equal(requestHeaders({}).has('Content-Type'),false);
});
test('HeadersInit variants preserve caller values and normalize casing',()=>{
 for(const headers of [{'content-type':'application/custom','Accept':'application/json'},[['content-type','application/custom'],['Accept','application/json']],new Headers({'CONTENT-TYPE':'application/custom','Accept':'application/json'})] as HeadersInit[]){
 const result=requestHeaders({body:'{}',headers});assert.equal(result.get('Content-Type'),'application/custom');assert.equal(result.get('Accept'),'application/json');assert.equal([...result.keys()].filter(k=>k==='content-type').length,1);
 }
});
test('non-JSON body types leave content type to fetch; explicit bodyless headers survive',()=>{
 assert.equal(requestHeaders({body:new FormData()}).has('Content-Type'),false);
 assert.equal(requestHeaders({headers:new Headers({'Accept':'application/json'})}).get('Accept'),'application/json');
 assert.equal(requestHeaders({headers:{'Content-Type':'application/custom'}}).get('Content-Type'),'application/custom');
});
