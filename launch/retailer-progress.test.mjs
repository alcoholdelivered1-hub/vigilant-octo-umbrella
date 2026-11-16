import test from 'node:test';
import assert from 'node:assert/strict';
import { retailerProgress } from '../src/components/onboarding/retailerProgress.js';
const keys = ['business','license','operations','pos','inventory','device'];
const saved = () => ({
  steps: keys.map(key => ({ key })),
  submissions: keys.map(step => ({ step, status:'approved' })),
  agreements:[{ status:'submitted', review_status:'approved' }],
  documents:[],
});
test('new retailer starts with business details', () => {
  const data = saved(); data.submissions = [];
  assert.equal(retailerProgress(data).nextPanel, 'business');
});
test('agreement comes before operations and is preserved when uploaded', () => {
  const data = saved(); data.agreements = [];
  data.submissions = data.submissions.filter(s => ['business','license'].includes(s.step));
  assert.equal(retailerProgress(data).nextPanel, 'agreement');
  data.documents = [{kind:'signed_agreement',status:'pending_review'}];
  assert.equal(retailerProgress(data).nextPanel, 'connections');
});
test('older agreement cannot hide a correction on the latest agreement', () => {
  const data = saved();
  data.agreements = [{status:'submitted',review_status:'needs_correction'}, ...data.agreements];
  data.documents = [{kind:'signed_agreement',status:'approved'}];
  assert.equal(retailerProgress(data,true).nextPanel, 'agreement');
});
test('submitted steps wait for review instead of asking retailer to repeat them', () => {
  const data = saved(); data.submissions = keys.map(step => ({step,status:'submitted'}));
  assert.equal(retailerProgress(data).nextPanel, 'connections');
  assert.equal(retailerProgress(data,true).nextPanel, 'launch');
  assert.match(retailerProgress(data,true).stages[0].note, /waiting for John/);
});
test('provider confirmation is required before advancing past payments', () => {
  const data = saved(); data.submissions.find(s => s.step==='operations').status='draft';
  assert.equal(retailerProgress(data,false).nextPanel, 'connections');
  assert.equal(retailerProgress(data,true).nextPanel, 'operations');
});
test('only the correction returns to retailer attention', () => {
  const data = saved(); data.submissions.find(s=>s.step==='license').status='needs_correction';
  assert.equal(retailerProgress(data,true).nextPanel, 'license');
  assert.equal(retailerProgress(data,true).stages[0].note, '1 item needs your attention');
});

test('green checks require submission and disappear when the latest step needs correction', () => {
  const data = saved();
  data.submissions = [{step:'license',status:'needs_correction'}, ...data.submissions];
  data.submissions.find(s=>s.step==='business').status = 'draft';
  const progress = retailerProgress(data, true);
  assert.equal(progress.completed.business, false);
  assert.equal(progress.completed.license, false);
  assert.equal(progress.completed.inventory, true);
  assert.equal(progress.stages[0].completed, false);
});
test('submitted stages show progress while approval and final activation remain separate', () => {
  const data = saved();
  data.submissions = keys.map(step => ({step,status:'submitted'}));
  const progress = retailerProgress(data, true);
  assert.equal(progress.stages[0].completed, true);
  assert.equal(progress.stages[1].completed, true);
  assert.equal(progress.stages[2].completed, false);
  assert.equal(progress.completed.launch, false);
  data.submissions.unshift({step:'launch',status:'submitted'});
  assert.equal(retailerProgress(data,true).stages[2].completed, true);
});
test('saved payment flags cannot produce a green payment check without provider confirmation', () => {
  const data = saved();
  data.store = {stripe_connection_status:'connected'};
  assert.equal(retailerProgress(data,false).completed.connections, false);
  assert.equal(retailerProgress(data,false).stages[1].completed, false);
  assert.equal(retailerProgress(data,true).completed.connections, true);
});
test('successive submissions select the next outstanding task', () => {
  const data = saved();
  data.submissions = [];
  assert.equal(retailerProgress(data).nextPanel, 'business');
  data.submissions.push({step:'business',status:'submitted'});
  assert.equal(retailerProgress(data).nextPanel, 'license');
  data.submissions.push({step:'license',status:'submitted'});
  assert.equal(retailerProgress(data).nextPanel, 'connections');
  assert.equal(retailerProgress(data,true).nextPanel, 'operations');
  data.submissions.push({step:'operations',status:'submitted'});
  assert.equal(retailerProgress(data,true).nextPanel, 'pos');
});
