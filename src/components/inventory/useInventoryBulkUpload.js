import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function useInventoryBulkUpload(storeId) {
  const client = useQueryClient();
  const [state,setState] = useState({ busy:false,error:'',preview:null,file:null,result:null });
  const refresh = () => Promise.all(['retailer-inventory','store-products','portal-products','products'].map(key => client.invalidateQueries({ queryKey:[key,storeId] })));
  const call = async payload => (await base44.functions.invoke('uploadAndSyncInventory',{ ...payload,store_id:storeId })).data;
  const select = async file => {
    setState({ busy:true,error:'',preview:null,file:null,result:null });
    try {
      if (!file || !/\.(csv|xlsx|xls)$/i.test(file.name)) throw new Error('Choose a CSV or Excel file.');
      if (file.size > 5*1024*1024) throw new Error('Choose a file no larger than 5 MB.');
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      const uploaded = { file_uri,filename:file.name };
      const preview = await call({ ...uploaded,action:'preview' });
      if (!preview.success) throw new Error(preview.error || 'The upload could not be previewed.');
      setState({ busy:false,error:'',preview,file:uploaded,result:null });
    } catch (error) { setState({ busy:false,error:error.response?.data?.error || error.message,preview:null,file:null,result:null }); }
  };
  const apply = async () => {
    setState(current => ({ ...current,busy:true,error:'' }));
    try {
      const result = await call({ ...state.file,action:'import' });
      await refresh();
      if (!result.success && !result.summary) throw new Error(result.error || 'The import could not be saved.');
      setState(current => ({ ...current,busy:false,result,preview:null,file:null }));
    } catch (error) { await refresh(); setState(current => ({ ...current,busy:false,error:error.response?.data?.error || error.message })); }
  };
  const download = async currentInventory => {
    setState(current => ({ ...current,busy:true,error:'' }));
    try {
      const data = currentInventory ? await call({ action:'export' }) : { success:true,csv:'product_id,product_name,category,brand,price,volume,abv,stock_quantity,in_stock,sku,upc,external_id\r\n' };
      if (!data.success) throw new Error(data.error || 'Could not export inventory.');
      const url = URL.createObjectURL(new Blob(['\uFEFF'+data.csv],{ type:'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href=url; link.download=currentInventory ? 'store-inventory.csv' : 'inventory-template.csv';
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url),1000);
      setState(current => ({ ...current,busy:false }));
    } catch (error) { setState(current => ({ ...current,busy:false,error:error.response?.data?.error || error.message })); }
  };
  return { ...state,select,apply,download };
}