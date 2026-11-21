import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { restaurantsApi } from '@/lib/api/restaurants';
import type { RestaurantDocument } from '@/types/restaurants';
import { FileText, CheckCircle2, XCircle, Clock, ExternalLink, ShieldCheck, AlertCircle } from 'lucide-react';

interface KycDocumentReviewProps {
  restaurantId: string;
  documents: RestaurantDocument[];
}

export const KycDocumentReview: React.FC<KycDocumentReviewProps> = ({
  restaurantId,
  documents,
}) => {
  const queryClient = useQueryClient();
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);

  const verifyDocMutation = useMutation({
    mutationFn: ({ docId, status, notes }: { docId: string; status: 'verified' | 'rejected'; notes?: string }) =>
      restaurantsApi.verifyDocument(docId, { status, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'restaurant', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'restaurants'] });
      setRejectingDocId(null);
      setRejectReason('');
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to update document verification status');
    },
  });

  const getDocTypeLabel = (type: string) => {
    switch (type) {
      case 'fssai_license':
        return 'FSSAI Food License';
      case 'gst_certificate':
        return 'GSTIN Certificate';
      case 'pan_card':
        return 'Business PAN Card';
      case 'bank_cheque':
      case 'cancelled_cheque':
        return 'Cancelled Cheque / Bank Proof';
      default:
        return type.replace(/_/g, ' ').toUpperCase();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] tabular-nums font-semibold bg-[#24533F] text-white">
            <CheckCircle2 className="w-3 h-3" /> VERIFIED
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] tabular-nums font-semibold bg-[#9A431F]/20 text-[#9A431F] border border-[#9A431F]/40">
            <XCircle className="w-3 h-3" /> REJECTED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] tabular-nums font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/30">
            <Clock className="w-3 h-3" /> PENDING REVIEW
          </span>
        );
    }
  };

  if (!documents || documents.length === 0) {
    return (
      <div className="p-6 rounded-xl bg-[#F5F6F8] border border-[#E3E7EC] text-center">
        <FileText className="w-6 h-6 text-slate-600 mx-auto mb-2" />
        <p className="text-xs text-slate-600">No legal KYC documents uploaded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="p-3 rounded-lg bg-[#9A431F]/15 border border-[#9A431F]/30 text-xs text-[#9A431F] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {documents.map((doc) => {
          const isRejectModalOpen = rejectingDocId === doc.id;

          return (
            <div
              key={doc.id}
              className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E3E7EC] flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-[#171A21]">{getDocTypeLabel(doc.documentType)}</h4>
                    {doc.documentNumber && (
                      <span className="text-[11px] tabular-nums text-slate-600">
                        Doc No: {doc.documentNumber}
                      </span>
                    )}
                  </div>
                  {getStatusBadge(doc.verificationStatus)}
                </div>

                {doc.notes && (
                  <p className="text-[11px] text-slate-600 bg-[#F5F6F8] p-2 rounded border border-[#E3E7EC] tabular-nums">
                    Note: {doc.notes}
                  </p>
                )}

                <div className="pt-2">
                  <a
                    href={doc.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-[#24533F] hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Inspect Document Storage URL</span>
                  </a>
                </div>
              </div>

              {/* Action Controls for Super Admin */}
              <div className="pt-3 border-t border-[#E3E7EC]">
                {isRejectModalOpen ? (
                  <div className="space-y-2">
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Mandatory rejection notes (e.g. illegible scan, expired license)..."
                      rows={2}
                      className="w-full text-xs p-2 rounded bg-[#F5F6F8] border border-[#9A431F]/50 text-[#171A21] focus:outline-none focus:border-[#9A431F]"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setRejectingDocId(null);
                          setRejectReason('');
                        }}
                        className="px-2.5 py-1 text-xs text-slate-600 hover:text-[#171A21] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={!rejectReason.trim() || verifyDocMutation.isPending}
                        onClick={() =>
                          verifyDocMutation.mutate({
                            docId: doc.id,
                            status: 'rejected',
                            notes: rejectReason,
                          })
                        }
                        className="px-3 py-1 rounded bg-[#9A431F] text-black text-xs font-bold hover:bg-[#9A431F]/80 disabled:opacity-50 cursor-pointer"
                      >
                        {verifyDocMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setRejectingDocId(doc.id)}
                      className="px-2.5 py-1 rounded bg-[#F5F6F8] hover:bg-[#9A431F]/20 text-xs font-medium text-[#9A431F] border border-transparent hover:border-[#9A431F]/30 transition-colors cursor-pointer"
                    >
                      Reject
                    </button>
                    <button
                      disabled={doc.verificationStatus === 'verified' || verifyDocMutation.isPending}
                      onClick={() =>
                        verifyDocMutation.mutate({
                          docId: doc.id,
                          status: 'verified',
                          notes: 'Verified by Super Admin',
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#24533F] hover:bg-[#24533F]/80 text-xs font-semibold text-[#24533F] disabled:opacity-40 cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{doc.verificationStatus === 'verified' ? 'Verified' : 'Verify Document'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
