import { useAuth } from "../../../contexts/AuthContext";
import CheckerChatScreen from "../../../components/checker/CheckerChatScreen";
import StaffChatScreen from "../../../components/staff/StaffChatScreen";

export default function CheckerMessagesTab() {
  const { isStaff } = useAuth();
  // Admin/manager need the customer support inbox as well as team chat.
  if (isStaff) {
    return (
      <StaffChatScreen chatPathname="/(checker)/chat/[conversationId]" />
    );
  }
  return <CheckerChatScreen />;
}
