import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { queueRetailerLaunchReview } from '../base44/shared/queueRetailerLaunchReview.ts';
import { setupSteps } from '../base44/shared/retailerSetupFields.ts';
import { retailerReviewFingerprint } from '../base44/shared/retailerDocumentGates.ts';

function fixture(status = 'submitted') {
  const store = { id:'store-a',name:'Test retailer',onboarding_status:'pending',is_active:false };
  const rows = setupSteps.map((step,i) => ({ id:'step-'+i,store_id:store.id,step:step.key,status,revision:0 }));
  const created = [];
  const table = {
    filter: async (query,sort,limit=100,skip=0) => rows.filter(r => Object.entries(query).every(([k,v]) => r[k] === v)).slice(skip,skip+limit),
    create: async data => { const row = { id:'launch-'+created.length,...data }; rows.unshift(row); created.push(row); return row; },
  };
  const empty = { filter:async () => [] };
  const base44 = { asServiceRole:{ entities:{ RetailerSetupSubmission:table,StoreSetupDocument:empty,RetailerAgreement:empty } } };
  return {store,rows,created,base44,user:{email:'owner@example.test'}};
}
test('missing, draft and correction steps never queue launch', async () => {
  for (const status of ['draft','needs_correction','missing']) {
    const f=fixture(); if(status==='missing') f.rows.pop(); else f.rows[0].status=status;
    const result=await queueRetailerLaunchReview(f.base44,f.user,f.store);
    assert.equal(result.queued,false); assert.equal(f.created.length,0);
  }
});
test('all submitted steps queue review for the right store, never approval', async () => {
  const f=fixture(); const result=await queueRetailerLaunchReview(f.base44,f.user,f.store);
  assert.equal(result.queued,true); assert.equal(f.created[0].store_id,f.store.id);
  assert.equal(f.created[0].status,'submitted'); assert.equal(f.created[0].submitted_by,f.user.email);
  assert.equal(f.store.is_active,false);
  const again=await queueRetailerLaunchReview(f.base44,f.user,f.store);
  assert.equal(again.duplicate,true); assert.equal(f.created.length,1);
});
test('other retailer submissions cannot satisfy missing steps', async () => {
  const f=fixture(); f.rows[0].store_id='other-store';
  assert.equal((await queueRetailerLaunchReview(f.base44,f.user,f.store)).queued,false);
});
test('current approval and already live store are preserved', async () => {
  const f=fixture('approved'); const fingerprint=await retailerReviewFingerprint(f.base44,f.store);
  f.rows.unshift({id:'approved-launch',store_id:f.store.id,step:'launch',status:'approved',fields:{fingerprint}});
  assert.equal((await queueRetailerLaunchReview(f.base44,f.user,f.store)).queued,false);
  f.store.is_active=true;
  assert.equal((await queueRetailerLaunchReview(f.base44,f.user,f.store)).queued,false);
  assert.equal(f.created.length,0);
});
test('changed information queues a new review instead of reusing stale approval', async () => {
  const f=fixture(); f.rows.unshift({id:'old-launch',store_id:f.store.id,step:'launch',status:'approved',version:1,fields:{fingerprint:'stale'}});
  await queueRetailerLaunchReview(f.base44,f.user,f.store);
  assert.equal(f.created[0].status,'submitted'); assert.equal(f.created[0].supersedes_id,'old-launch');
});

// Exercise the actual handler with isolated providers; no live records or payments.
const handlerSource=readFileSync(new URL('../base44/functions/retailerSetup/entry.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export default async function(req)','return async function(req)');
function approvalFixture({role='admin',blockers=[],throws=false}={}) {
  const store={id:'store-a'}, record={id:'review-a',step:'launch',status:'submitted'};
  let saved=false,invoked=0;
  const db={ RetailerSetupSubmission:{ update:async () => {saved=true;} } };
  const base44={auth:{me:async()=>({role,email:'admin@example.test'}),isAuthenticated:async()=>true},asServiceRole:{entities:db},functions:{invoke:async(name,args)=>{
    invoked++; assert.equal(saved,true); assert.equal(name,'retailerGoLive'); assert.equal(args.store_id,store.id);
    if(throws) throw new Error('Provider unavailable'); return {data:{activated:true,blockers:[]}};
  }}};
  const deps={createClientFromRequest:()=>base44,setupStore:async()=>store,setupError:(message,status=400)=>Object.assign(new Error(message),{status}),retailerDocumentState:async()=>({submissions:[record]}),requireUnambiguousRetailer:async()=>{},readRetailerLaunchEvidence:async()=>[...blockers],retailerProviderChecks:async()=>({blockers:[]}),retailerReviewFingerprint:async()=>'fresh'};
  const handler=new Function(...Object.keys(deps),handlerSource)(...Object.values(deps));
  return {run:async()=>{const response=await handler(new Request('https://example.test',{method:'POST',body:JSON.stringify({action:'approve_launch',store_id:store.id,consent:true})}));return {status:response.status,...await response.json()};},saved:()=>saved,invoked:()=>invoked};
}
test('retailer cannot approve or initiate automatic activation',async()=>{
  const f=approvalFixture({role:'user'}); assert.equal((await f.run()).status,403); assert.equal(f.saved(),false); assert.equal(f.invoked(),0);
});
test('failed gates block approval and activation',async()=>{
  const f=approvalFixture({blockers:['License not verified']}); const result=await f.run();
  assert.equal(result.activated,false); assert.equal(f.saved(),false); assert.equal(f.invoked(),0);
});
test('final approval immediately calls existing gated activation',async()=>{
  const f=approvalFixture(); assert.equal((await f.run()).activated,true); assert.equal(f.saved(),true); assert.equal(f.invoked(),1);
});
test('provider error preserves approval and reports pending activation',async()=>{
  const f=approvalFixture({throws:true}); const result=await f.run();
  assert.equal(f.saved(),true); assert.equal(result.activated,false); assert.equal(result.activation_error,'Provider unavailable');
});
