import { FileCheck2 } from 'lucide-react';
import type { RestaurantSelfApplication } from '@/types/restaurants';
import { fssaiExpiryNote } from '../fssaiExpiry';

const Field = ({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) => (
  <div>
    <span className="text-slate-600 text-[11px]">{label}</span>
    <div className={`text-[#171A21] mt-0.5 break-all ${mono ? 'tabular-nums font-mono text-[13px]' : 'font-semibold'}`}>
      {value}
    </div>
  </div>
);

/**
 * What the restaurant submitted when it registered from the app. Admin checks these numbers
 * (FSSAI on foscos.fssai.gov.in, PAN/GSTIN, the bank details against a cancelled cheque) before approving.
 */
export function ApplicationDetailsCard({ application }: { application: RestaurantSelfApplication }) {
  const expiry = fssaiExpiryNote(application.fssaiExpiry);
  const submitted = new Date(application.submittedAt);

  return (
    <div className="p-5 rounded-xl bg-[#F5F6F8] border border-[#E3E7EC] space-y-4" aria-label="Registration details">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileCheck2 className="w-4 h-4 text-[#205641]" />
          <h3 className="text-xs font-bold text-slate-600">Registration details to verify</h3>
        </div>
        {!Number.isNaN(submitted.getTime()) && (
          <span className="text-[11px] text-slate-600">Submitted {submitted.toLocaleDateString()}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Owner" value={application.ownerName} />
        <Field label="Outlet phone" value={application.contactPhone} mono />
        <Field label="Owner email" value={application.ownerEmail || 'Not given'} />
        <Field label="Cuisines" value={application.cuisines.join(', ') || 'Not given'} />
      </div>

      <div className="border-t border-[#E3E7EC] pt-4 grid grid-cols-2 gap-4">
        <Field label="FSSAI licence" value={application.fssaiNumber} mono />
        <Field
          label="FSSAI valid until"
          value={
            <span className={expiry === 'expired' ? 'text-[#B42318]' : expiry === 'soon' ? 'text-[#9A431F]' : undefined}>
              {application.fssaiExpiry ? application.fssaiExpiry.slice(0, 10) : 'Not given'}
              {expiry === 'expired' ? ' (expired)' : expiry === 'soon' ? ' (expires within 30 days)' : ''}
            </span>
          }
        />
        <Field label="PAN" value={application.panNumber} mono />
        <Field label="GSTIN" value={application.gstin || 'Not registered'} mono={!!application.gstin} />
      </div>

      <div className="border-t border-[#E3E7EC] pt-4 grid grid-cols-2 gap-4">
        <Field label="Account holder" value={application.bankAccountHolder} />
        <Field label="IFSC" value={application.bankIfsc} mono />
        <div className="col-span-2">
          <Field label="Account number" value={application.bankAccountNumber} mono />
        </div>
      </div>
    </div>
  );
}
