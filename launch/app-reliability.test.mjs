import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { publicStore, isPublicStore, isOrderingStore } from '../base44/shared/publicStore.ts';

test('public storefront omits private retailer and payment fields', () => {
  const row = {id:'a',name:'Store',is_browsable:true,email:'private',contact_emails:['private'],stripe_connect_account_id:'acct_private',onboarding_notes:'private',license_number:'private',sales_tax_rate:0.1};
  assert.deepEqual(publicStore(row), {id:'a',name:'Store',is_browsable:true,sales_tax_rate:0.1});
  assert.equal(isPublicStore(row),true);
  assert.equal(isPublicStore({is_active:false,is_browsable:false}),false);
  assert.equal(isOrderingStore(row),false);
});
test('preview or payment-pending stores never become ordering stores', () => {
  const live={is_active:true,onboarding_status:'live',compliance_status:'compliant',stripe_connection_status:'connected'};
  assert.equal(isOrderingStore(live),true);
  for(const patch of [{is_active:false},{onboarding_status:'pending'},{compliance_status:'flagged'},{stripe_connection_status:'pending'}]) assert.equal(isOrderingStore({...live,...patch}),false);
});
const source=readFileSync(new URL('../base44/functions/public-store-directory/entry.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export default async function(req)','return async function(req)');
const rows=[{id:'preview',name:'Preview',is_browsable:true},{id:'hidden',name:'Hidden',is_active:false,is_browsable:false},{id:'live',name:'Live',is_active:true,onboarding_status:'live',compliance_status:'compliant',stripe_connection_status:'connected',stripe_connect_account_id:'secret'}];
const handler=new Function('createClientFromRequest','isPublicStore','isOrderingStore','publicStore',source)(()=>({asServiceRole:{entities:{Store:{filter:async()=>rows}}}}),isPublicStore,isOrderingStore,publicStore);
test('anonymous directory respects visibility, store ID and live filter',async()=>{
  for(const [body,ids] of [[{},['preview','live']],[{store_id:'hidden'},[]],[{store_id:'preview'},['preview']],[{live_only:true},['live']]]) {
    const response=await handler(new Request('https://example.test',{method:'POST',body:JSON.stringify(body)}));
    assert.equal(response.status,200);
    const data=await response.json();
    assert.deepEqual(data.stores.map(s=>s.id),ids);
    assert.equal(JSON.stringify(data).includes('secret'),false);
  }
});
test('auth timeout rejects stalled requests and clears timers',async()=>{
  const source=readFileSync(new URL('../src/lib/AuthContext.jsx',import.meta.url),'utf8');
  const helper=source.slice(source.indexOf('const withAuthTimeout ='),source.indexOf('export const AuthProvider'));
  let callback,cleared=0;
  const timed=new Function('setTimeout','clearTimeout',helper+'return withAuthTimeout;')((fn)=>{callback=fn;return 1;},()=>cleared++);
  assert.equal(await timed(Promise.resolve('ok')),'ok');
  const pending=timed(new Promise(()=>{})); callback();
  await assert.rejects(pending,/timed out/);
  assert.equal(cleared,2);
});
