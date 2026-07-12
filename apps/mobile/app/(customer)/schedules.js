import React, { useCallback } from "react";
import CustomerOperationsList from "../../components/customer/CustomerOperationsList";
import { getMySchedules } from "../../components/utilities/FirebaseFunctions";

export default function CustomerSchedulesScreen() {
  const loadRecords = useCallback(async () => {
    const result = await getMySchedules();
    return result.data?.schedules || [];
  }, []);

  return <CustomerOperationsList type="schedule" loadRecords={loadRecords} />;
}
