import React, { createContext, useContext } from 'react';
import useRetailerAgreement from '@/components/onboarding/useRetailerAgreement';

const AgreementContext = createContext(null);
export const useAgreement = () => useContext(AgreementContext);
export default function RetailerAgreementContext({ initialStoreId, children }) {
  const agreement = useRetailerAgreement(initialStoreId);
  return <AgreementContext.Provider value={agreement}>{children}</AgreementContext.Provider>;
}