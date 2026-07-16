import React, { useCallback } from "react";
import CustomerOperationsList from "../../components/customer/CustomerOperationsList";
import { getMyInvoices } from "../../components/utilities/FirebaseFunctions";

export default function CustomerInvoicesScreen() {
  const loadRecords = useCallback(async () => {
    const result = await getMyInvoices();
    return result.data?.invoices || [];
  }, []);

  return <CustomerOperationsList type="invoice" loadRecords={loadRecords} />;
}
