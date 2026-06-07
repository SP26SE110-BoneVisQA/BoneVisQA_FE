'use client';

import { Modal } from '@/components/ui/modal';
import { CreateExpertCaseForm } from '@/features/expert/components/CreateExpertCaseForm';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (caseId: string | undefined) => void;
};

export default function CreateExpertCaseModal({ open, onClose, onCreated }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create teaching case"
      size="2xl"
      dismissible={false}
      forceMount
    >
      <CreateExpertCaseForm
        onCancel={onClose}
        onCreated={(caseId) => {
          onCreated(caseId);
          onClose();
        }}
      />
    </Modal>
  );
}
