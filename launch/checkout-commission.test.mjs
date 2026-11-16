import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Execute the real checkout handler with provider/database mocks; never move money.
const source = readFileSync('base44/functions/createStripeCheckout/entry.ts', 'utf8')
  .replace(/^import .*;\n/gm, '').replace('export default async function(req)', 'async function handler(req)');
async function checkout({price = 100, quantity = 1, tip = 0, active = true} = {}) {
  let captured;
  const store = {id:'store-test',name:'Test retailer',is_active:active,onboarding_status:'live',
    compliance_status:'compliant',stripe_connection_status:'connected',sales_tax_rate:0.085};
  const base44 = {auth:{me:async()=>({email:'customer@example.test'})},asServiceRole:{entities:{
    Store:{get:async()=>store},
    IDVerification:{get:async()=>({verification_type:'checkout',is_verified:true,customer_email:'customer@example.test',date_of_birth:'1990-01-01'})},
    Product:{get:async()=>({id:'p1',store_id:'store-test',name:'Test item',price,inventory_source:'manual',in_stock:true,stock_quantity:30})},
    DeliveryZone:{filter:async()=>[{is_active:true,is_wet:true,center_latitude:34,center_longitude:-92,radius_miles:10,min_order_amount:20,delivery_fee:3}]}
  }}};
  const context = vm.createContext({Response,console,Intl,createClientFromRequest:()=>base44,
    secrets:{get:()=> 'test-only'},resolveAppOrigin:()=> 'https://example.test',
    getRetailerStripeAccount:async()=>({id:'acct_test'}),retailerPaymentsReady:()=>true,
    geocodeDeliveryAddress:async()=>({latitude:34,longitude:-92}),verifyABCDeliveryArea:async()=>true,
    Stripe:class {checkout={sessions:{create:async(body,options)=>{captured={body,options};return {id:'cs_test',url:'https://example.test/pay'};}}};}
  });
  vm.runInContext(source,context);
  const response = await context.handler({method:'POST',json:async()=>({
    order_number:'TEST-1',store_id:'store-test',items:[{product_id:'p1',quantity,price:0.01}],
    tip,customer_name:'Test',customer_phone:'5555555555',delivery_address:'Test',
    date_of_birth:'1990-01-01',checkout_verification_id:'v1'
  })});
  return {response,captured};
}
test('customer pays 25% service fee; full merchandise and tax stay with retailer',async()=>{
  const {response,captured:{body,options}} = await checkout({tip:5});
  assert.equal(response.status,200);
  assert.equal(body.metadata.grand_total,'145.5'); // 100 goods + 25 service + 4 support + 3 delivery + 8.50 tax + 5 tip
  assert.equal(body.metadata.service_fee,'25');
  assert.equal(body.metadata.fee_model,'customer_service_fee_25_v1');
  assert.equal(body.payment_intent_data.application_fee_amount,3700);
  const charged = body.line_items.reduce((sum,x)=>sum+x.price_data.unit_amount*x.quantity,0);
  assert.equal(charged,14550);
  assert.equal(charged-body.payment_intent_data.application_fee_amount,10850); // 100 + 8.50 tax before processing
  assert.equal(options.stripeAccount,'acct_test');
  assert.ok(body.line_items.some(x=>x.price_data.product_data.name==='Service Fee'));
});
test('fractional merchandise prices round customer service fee to cents',async()=>{
  const {response,captured:{body}}=await checkout({price:19.99,quantity:3});
  assert.equal(response.status,200);
  assert.equal(body.metadata.subtotal,'59.97');
  assert.equal(body.metadata.service_fee,'14.99');
  assert.equal(body.metadata.grand_total,'85.46');
  assert.equal(body.payment_intent_data.application_fee_amount,2039);
});
test('inactive retailer is blocked before creating a payment',async()=>{
  const {response,captured}=await checkout({active:false});
  assert.equal(response.status,409);
  assert.equal(captured,undefined);
});
