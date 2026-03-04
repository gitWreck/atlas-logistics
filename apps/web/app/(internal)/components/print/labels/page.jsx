import PrintLabelsBundle from "./PrintLabelsBundle";
import PrintLabelsClient from "./PrintLabelsClient";

// Now this works because it's a Server Component
export const dynamic = "force-dynamic";

export default function Page() {
  return <PrintLabelsBundle />;
}
