import { Redirect } from "expo-router";

/** Staff (admin/manager) now use the checker last-mile app. */
export default function StaffIndex() {
  return <Redirect href="/(checker)" />;
}
