import { useReducer } from 'react';
import { useTranslation } from 'react-i18next';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { View } from '@actual-app/components/view';

import {
  Modal,
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '@desktop-client/components/common/Modal';
import { closeModal } from '@desktop-client/modals/modalsSlice';
import type { Modal as ModalType } from '@desktop-client/modals/modalsSlice';
import { useDispatch } from '@desktop-client/redux';

import { WizardProgress } from './components/WizardProgress';
import { AccountSelectionStep } from './steps/AccountSelectionStep';
import { ConfirmStep } from './steps/ConfirmStep';
import { PreviewStep } from './steps/PreviewStep';
import { TransactionStep } from './steps/TransactionStep';
import { initialWizardState, wizardReducer } from './types';

type SyncToBudgetModalProps = Extract<
  ModalType,
  { name: 'sync-to-budget' }
>['options'];

export function SyncToBudgetModal({ accountId }: SyncToBudgetModalProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { isNarrowWidth } = useResponsive();

  const [state, wizardDispatch] = useReducer(wizardReducer, {
    ...initialWizardState,
    fromAccountId: accountId || null,
  });

  const handleClose = () => {
    dispatch(closeModal());
  };

  const handleNext = () => {
    const steps = ['accounts', 'transactions', 'preview', 'confirm'] as const;
    const currentIndex = steps.indexOf(state.step);
    if (currentIndex < steps.length - 1) {
      wizardDispatch({ type: 'SET_STEP', step: steps[currentIndex + 1] });
    }
  };

  const handleBack = () => {
    const steps = ['accounts', 'transactions', 'preview', 'confirm'] as const;
    const currentIndex = steps.indexOf(state.step);
    if (currentIndex > 0) {
      wizardDispatch({ type: 'SET_STEP', step: steps[currentIndex - 1] });
    }
  };

  const renderStep = () => {
    switch (state.step) {
      case 'accounts':
        return (
          <AccountSelectionStep
            state={state}
            dispatch={wizardDispatch}
            onNext={handleNext}
            onClose={handleClose}
          />
        );
      case 'transactions':
        return (
          <TransactionStep
            state={state}
            dispatch={wizardDispatch}
            onNext={handleNext}
            onBack={handleBack}
            onClose={handleClose}
          />
        );
      case 'preview':
        return (
          <PreviewStep
            state={state}
            dispatch={wizardDispatch}
            onNext={handleNext}
            onBack={handleBack}
            onClose={handleClose}
          />
        );
      case 'confirm':
        return (
          <ConfirmStep
            state={state}
            dispatch={wizardDispatch}
            onBack={handleBack}
            onClose={handleClose}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Modal
      name="sync-to-budget"
      containerProps={{
        style: isNarrowWidth
          ? {
              width: '100vw',
              maxWidth: '100vw',
              height: '100vh',
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
            }
          : { width: 750 },
      }}
    >
      {({ state: { close } }) => (
        <View
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            maxHeight: isNarrowWidth ? '100vh' : '80vh',
          }}
        >
          <ModalHeader
            title={
              <ModalTitle title={t('Sync to Budget')} shrinkOnOverflow />
            }
            rightContent={<ModalCloseButton onPress={close} />}
          />

          <WizardProgress
            currentStep={state.step}
            isNarrowWidth={isNarrowWidth}
          />

          <View
            style={{
              flex: 1,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              padding: isNarrowWidth ? '0 16px' : '0 20px',
            }}
          >
            {renderStep()}
          </View>
        </View>
      )}
    </Modal>
  );
}
