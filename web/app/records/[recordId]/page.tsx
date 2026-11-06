import { notFound } from "next/navigation";
import { RecordView } from "@/components/RecordView";
import { ARKIV_IS_MOCK, getRecord } from "@/lib/arkiv";
import { parseRecordId } from "@/lib/verify";

export const dynamic = "force-dynamic";

// recordId = "<device address>-<nonce>", which uniquely identifies one reading on Arkiv.
export default async function RecordPage({ params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  const id = parseRecordId(decodeURIComponent(recordId));
  if (!id) notFound();
  const rec = await getRecord(id.device, id.nonce);
  if (!rec) notFound();
  return <RecordView rec={rec} isMock={ARKIV_IS_MOCK} />;
}
