import React from 'react';
import { Button } from '@/components/ui/button';
import { useAgreement } from '@/components/onboarding/RetailerAgreementContext';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
export default function FreshRetailerAgreementButton() {
  const a = useAgreement();
  return <AlertDialog><AlertDialogTrigger asChild><Button type="button" variant="outline" disabled={a.busy || !!a.details.ambiguity.length}>Start fresh agreement</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Fresh agreement for {a.details.store.name}?</AlertDialogTitle><AlertDialogDescription>Only this retailer’s saved business details and approved commercial terms will be included. Representative details, signatures and all other answers will be blank. Previous versions stay preserved. No email will be sent.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => a.adminAction('fresh',{ confirmed:true,expected_store_name:a.details.store.name }).catch(() => {})}>Create fresh agreement</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}