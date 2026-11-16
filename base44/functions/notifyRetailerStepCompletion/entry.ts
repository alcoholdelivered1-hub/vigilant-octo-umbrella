import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { retailerApprovalAlert } from '../../shared/retailerApprovalAlerts.ts';
export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({error:'Method not allowed'},{status:405});
    const base44 = createClientFromRequest(req), user = await base44.auth.me();
    if (!user || !(await base44.auth.isAuthenticated()) || user.role !== 'admin') return Response.json({error:'Administrator access required.'},{status:403});
    const {source_entity,record_id,dry_run = false} = await req.json();
    if (typeof dry_run !== 'boolean') return Response.json({error:'Invalid preview selection.'},{status:400});
    return Response.json(await retailerApprovalAlert(base44,source_entity,record_id,dry_run));
  } catch (error) { console.error('Retailer step notification:',error.message); return Response.json({error:error.message},{status:400}); }
}