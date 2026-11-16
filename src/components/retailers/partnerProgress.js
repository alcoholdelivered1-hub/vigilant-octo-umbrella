import { format } from 'date-fns';
export const documentKinds = [['retail_license', 'ABC license'], ['signed_agreement', 'Signed agreement'], ['inventory_export', 'Inventory export'], ['pos_details', 'POS instructions (optional)']];
export const informationSteps = ['business', 'license', 'operations', 'pos', 'inventory', 'device', 'launch'];
const labels = { missing: 'Missing', draft: 'Draft', pending_review: 'Awaiting review', submitted: 'Awaiting review', approved: 'Approved', needs_correction: 'Needs correction', countersign: 'Needs countersignature', expired: 'Expired' };
export function documentState(record) {
  const status = record?.file_uri ? record.status || 'pending_review' : 'missing';
  return { status, label: labels[status] || status.replaceAll('_', ' '), collected: Boolean(record?.file_uri), approved: status === 'approved' };
}
export default function partnerProgress(stores, submissions, documents, agreements) {
  const today = format(new Date(), 'yyyy-MM-dd');
  return stores.map(store => {
    const steps = submissions.filter(item => item.store_id === store.id);
    const files = documents.filter(item => item.store_id === store.id);
    const contracts = agreements.filter(item => item.store_id === store.id);
    const latestSteps = informationSteps.map(key => steps.find(item => item.step === key)).filter(Boolean);
    const contract = contracts[0];
    const states = Object.fromEntries(documentKinds.map(([kind]) => [kind, documentState(files.find(file => file.kind === kind))]));
    if (contract) {
      const approved = contract.status === 'submitted' && contract.review_status === 'approved' && Boolean(contract.file_uri && contract.countersigned_file_uri);
      const status = approved ? 'approved' : contract.review_status === 'needs_correction' ? 'needs_correction' : contract.status === 'draft' ? 'draft' : !contract.file_uri ? 'missing' : contract.review_status === 'approved' ? 'countersign' : 'pending_review';
      states.signed_agreement = { status, label: labels[status], collected: Boolean(contract.file_uri), approved };
    }
    if (states.retail_license.collected && store.license_expiration_date && store.license_expiration_date < today) states.retail_license = { ...states.retail_license, status: 'expired', label: 'Expired', approved: false };
    const required = documentKinds.slice(0, 3).map(([kind]) => states[kind]);
    const missing = required.filter(item => !item.collected).length;
    const corrections = Object.values(states).filter(item => ['needs_correction', 'expired', 'countersign'].includes(item.status)).length + latestSteps.filter(item => item.status === 'needs_correction').length;
    const reviewCount = files.filter(file => file.file_uri && file.status === 'pending_review').length + latestSteps.filter(item => item.status === 'submitted').length + Number(Boolean(contract?.status === 'submitted' && !['approved', 'needs_correction'].includes(contract.review_status)));
    const completed = latestSteps.filter(item => {
      if (item.status !== 'approved') return false;
      if (item.step === 'launch') return Boolean(item.reviewed_by);
      if (!item.mapped_at) return false;
      const kind = item.step === 'license' ? 'retail_license' : item.step === 'inventory' ? 'inventory_export' : '';
      return !kind || (states[kind].approved && item.document_ids?.includes(files.find(file => file.kind === kind)?.id));
    }).length + Number(states.signed_agreement.approved);
    const documentItems = files.filter(file => file.file_uri).map(file => ({ id: file.id, name: file.filename, kind: documentKinds.find(([kind]) => kind === file.kind)?.[1] || file.kind, uri: file.file_uri, status: documentState(file), date: file.created_date }));
    for (const [key, name] of [['file_uri', 'Retailer-signed agreement'], ['countersigned_file_uri', 'Countersigned agreement']]) if (contract?.[key]) documentItems.push({ id: `${contract.id}-${key}`, name, kind: 'Signed agreement', uri: contract[key], status: states.signed_agreement, date: contract.submitted_at || contract.created_date });
    const dates = [store, ...steps, ...files, ...contracts].map(item => item.updated_date || item.created_date).filter(Boolean).sort();
    return { store, states, documentItems, missing, corrections, reviewCount, completed, total: 8, percent: Math.round(completed / 8 * 100), latestSteps, contract, updated: dates.at(-1) };
  });
}