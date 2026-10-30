import { test } from 'node:test';
import assert from 'node:assert/strict';
import { responseData } from '../web/src/api/validation';
import { ApiError } from '../web/src/api/errors';
const chef = { id: 1, name: 'An', specialty: 'Việt', dishes: [] };
const paged = {items:[chef],meta:{page:1,pageSize:6,total:1,pages:1,effectiveMode:'basic'}};
const technical = (error: unknown) => error instanceof ApiError && error.code === 'TECHNICAL';
test('reject list/detail shape mismatches before JSX', () => {
 assert.throws(() => responseData('/chefs', undefined, {ok:true,data:chef}), technical);
 for(const method of ['GET','POST','PATCH']) assert.throws(() => responseData('/chefs/1', method, {ok:true,data:[chef]}), technical);
 assert.deepEqual(responseData('/chefs?q=An',undefined,{ok:true,data:paged}),paged);
 assert.deepEqual(responseData('/chefs/1',undefined,{ok:true,data:chef}),chef);
 assert.equal(responseData('/chefs/1','delete',{ok:true,data:null}),null);
});
test('validate pagination metadata, options and facets', () => {
 for (const data of [[chef], {...paged, meta:{...paged.meta,total:-1}}, {...paged, meta:{...paged.meta,page:2}}, {...paged, items:[]}])
  assert.throws(()=>responseData('/chefs',undefined,{ok:true,data}),technical);
 const options={items:[{id:1,name:'An',specialty:'Việt'}],hasMore:true,nextCursor:1};
 assert.deepEqual(responseData('/chefs/options',undefined,{ok:true,data:options}),options);
 assert.throws(()=>responseData('/chefs/options',undefined,{ok:true,data:{...options,nextCursor:null}}),technical);
 assert.deepEqual(responseData('/dishes/facets',undefined,{ok:true,data:{categories:['Việt']}}),{categories:['Việt']});
 assert.throws(()=>responseData('/dishes/facets',undefined,{ok:true,data:{categories:[{}]}}),technical);
});
test('malformed business errors become technical errors, never unsafe render values', () => {
 for(const error of [{code:'VALIDATION_FAILED',message:{}},{code:'NOT_FOUND',message:'Missing',fields:{form:{}}},{code:'VALIDATION_FAILED',message:'Used',details:{dishes:{}}},{code:'VALIDATION_FAILED',message:'Used',details:{dishes:[null]}}]) assert.throws(()=>responseData('/chefs',undefined,{ok:false,error}),technical);
 assert.throws(()=>responseData('/chefs',undefined,{ok:false,error:{code:'VALIDATION_FAILED',message:'Used',fields:{form:'Used'},details:{dishes:[{id:1,name:'Dish'}]}}}),e=>e instanceof ApiError&&e.code==='VALIDATION_FAILED'&&e.dishes.length===1);
});
