import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertAdmin } from '../../shared/authGuard.ts';
import { setupSteps } from '../../shared/retailerSetupFields.ts';
import { sendRetailerEventEmail } from '../../shared/sendRetailerEventEmail.ts';

const documentLabels = { retail_license:'Retail license',signed_agreement:'Signed agreement',inventory_export:'Inventory export',pos_details:'POS details' };
export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error:'Method not allowed' },{ status:405 });
    const base44 = createClientFromRequest(req);
    const { authorized,response } = await assertAdmin(base44);
    if (!authorized) return response;
    const { entity,record_id,reviewed_at,decision,preview_only = false } = await req.json();
    if (!['StoreSetupDocument','RetailerAgreement','RetailerSetupSubmission'].includes(entity) || typeof record_id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(record_id) || typeof preview_only !== 'boolean') return Response.json({ error:'Choose a valid onboarding review record.' },{ status:400 });
    const record = await base44.asServiceRole.entities[entity].get(record_id);
    if (!record) return Response.json({ error:'Review record not found.' },{ status:404 });
    const status = entity === 'RetailerAgreement' ? record.review_status : record.status;
    if (!['approved','needs_correction'].includes(status) || !record.reviewed_at || !record.reviewed_by) return Response.json({ skipped:true,sent:false,reason:'This document has not received a recorded review decision.' });
    if ((reviewed_at !== undefined && reviewed_at !== record.reviewed_at) || (decision !== undefined && decision !== status)) return Response.json({ skipped:true,sent:false,reason:'This review event has been superseded.' });
    const store = await base44.asServiceRole.entities.Store.get(record.store_id);
    if (!store) return Response.json({ error:'Retailer not found.' },{ status:404 });
    const label = entity === 'RetailerAgreement' ? `Retailer agreement (${record.terms_version || 'submitted version'})` : entity === 'RetailerSetupSubmission' ? (setupSteps.find(step => step.key === record.step)?.title || 'Final launch review') : `${documentLabels[record.kind] || 'Setup document'}${record.filename ? `: ${String(record.filename).slice(0,200)}` : ''}`;
    const result = await sendRetailerEventEmail(base44,store,{ type:'review',status,label,note:record.review_note },`${entity}:${record.id}:${status}:${record.reviewed_at}`,{ preview:preview_only });
    return Response.json(result);
  } catch (error) {
    console.error('Retailer review email failed:',error.message);
    return Response.json({ error:error.message },{ status:500 });
  }
}