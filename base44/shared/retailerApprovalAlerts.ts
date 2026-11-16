import { setupSteps } from './retailerSetupFields.ts';
const recipientId = '69cf025b60e5f22c0c72f043';
export async function retailerApprovalAlert(base44, entity, id, dryRun = false) {
  if (!['RetailerSetupSubmission','StoreSetupDocument','RetailerAgreement'].includes(entity) || typeof id !== 'string' || !id || id.length > 100) throw new Error('Choose a valid retailer submission.');
  const db = base44.asServiceRole.entities;
  const record = await db[entity].get(id);
  const pending = entity === 'StoreSetupDocument' ? record?.status === 'pending_review' : record?.status === 'submitted' && (entity !== 'RetailerAgreement' || !['approved','needs_correction'].includes(record.review_status));
  if (!pending || !record.store_id) return { skipped:true,reason:'Submission is not awaiting review.' };
  const store = await db.Store.get(record.store_id);
  const recipient = await db.User.get(recipientId);
  if (!store || recipient?.role !== 'admin') throw new Error('The retailer or authorized approval recipient is unavailable.');
  const step = entity === 'RetailerAgreement' ? 'Signed agreement' : entity === 'StoreSetupDocument' ? record.kind.replaceAll('_',' ') : setupSteps.find(s => s.key === record.step)?.title || 'Final launch review';
  const eventKey = `${entity}:${record.id}:${record.submitted_at || record.created_date}`;
  if (dryRun) return { preview:true,store_name:store.name,step,recipient_user_id:recipientId,notification_sent:false };
  let alert = (await db.RetailerApprovalAlert.filter({ event_key:eventKey },'created_date',1))[0];
  if (!alert) {
    await db.RetailerApprovalAlert.create({ event_key:eventKey,recipient_user_id:recipientId,store_id:store.id,store_name:store.name,source_entity:entity,source_id:record.id,step_label:step,push_status:'pending' });
    alert = (await db.RetailerApprovalAlert.filter({ event_key:eventKey },'created_date',1))[0];
  }
  const claimId = crypto.randomUUID();
  const claimed = await db.RetailerApprovalAlert.updateMany({ id:alert.id,push_status:{ $in:['pending','failed'] } },{ $set:{ push_status:'sending',claim_id:claimId,push_error:'' } });
  if (claimed.updated !== 1) return { duplicate:true,push_status:alert.push_status };
  try {
    const response = await base44.asServiceRole.functions.invoke('sendFCMPush',{user_emails:[recipient.email],title:'Retailer step ready for approval',body:`${store.name.slice(0,150)} submitted ${step.slice(0,100)}. Open Final Approvals to review and apply it.`,data:{url:'/admin/final-approvals',event_key:eventKey}});
    const delivery = response.data;
    if (delivery.error || delivery.skipped || !delivery.results?.some(result => result.ok)) throw new Error(delivery.error || delivery.reason || 'No registered phone or laptop accepted this push request.');
    await db.RetailerApprovalAlert.update(alert.id,{ push_status:'sent',push_sent_at:new Date().toISOString() });
    return { push_status:'sent',store_id:store.id };
  } catch (error) {
    await db.RetailerApprovalAlert.update(alert.id,{ push_status:'failed',push_error:String(error.message).slice(0,1000) });
    console.error('Retailer approval push failed:',store.id,error.message);
    return { push_status:'failed',error:error.message };
  }
}