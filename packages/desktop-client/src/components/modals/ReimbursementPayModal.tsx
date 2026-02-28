import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { FormError } from '@actual-app/components/form-error';
import { InlineField } from '@actual-app/components/inline-field';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';

import { send } from 'loot-core/platform/client/connection';

import { useFormat } from '@desktop-client/hooks/useFormat';

import {
  Modal,
  ModalButtons,
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '@desktop-client/components/common/Modal';
import { AccountAutocomplete } from '@desktop-client/components/autocomplete/AccountAutocomplete';
import { CategoryAutocomplete } from '@desktop-client/components/autocomplete/CategoryAutocomplete';
import { closeModal } from '@desktop-client/modals/modalsSlice';
import type { Modal as ModalType } from '@desktop-client/modals/modalsSlice';
import { useDispatch } from '@desktop-client/redux';

type ReimbursementPayModalProps = Extract<
  ModalType,
  { name: 'reimbursement-pay' }
>['options'];

export function ReimbursementPayModal({
  id,
  employeeName,
  amount,
  onPaid,
}: ReimbursementPayModalProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const format = useFormat();

  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePay = async () => {
    if (!accountId) {
      setError(t('Please select an account to pay from'));
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      await send('reimbursement/update-status', {
        id,
        status: 'paid',
        accountId,
        categoryId: categoryId ?? undefined,
      });
      onPaid();
      dispatch(closeModal());
    } catch (err) {
      console.error('Payment error:', err);
      setError(t('Failed to process payment'));
      setIsProcessing(false);
    }
  };

  return (
    <Modal name="reimbursement-pay">
      {({ state: { close } }) => (
        <>
          <ModalHeader
            title={<ModalTitle title={t('Pay Reimbursement')} shrinkOnOverflow />}
            rightContent={<ModalCloseButton onPress={close} />}
          />
          <View style={{ padding: '0 0 15px' }}>
            <Text style={{ marginBottom: 15 }}>
              <Trans>
                Pay <strong>{{ employeeName } as any}</strong> the amount of{' '}
                <strong>{{ amount: format(amount, 'financial') } as any}</strong>
              </Trans>
            </Text>

            <InlineField label={t('Pay from Account')} width="100%">
              <AccountAutocomplete
                value={accountId}
                onSelect={setAccountId}
                includeClosedAccounts={false}
              />
            </InlineField>

            <InlineField label={t('Category')} width="100%">
              <CategoryAutocomplete
                value={categoryId}
                onSelect={setCategoryId}
              />
            </InlineField>

            <Text
              style={{
                fontSize: 12,
                color: '#666',
                marginTop: 10,
              }}
            >
              <Trans>
                A transaction will be created in the selected account for this
                payment.
              </Trans>
            </Text>

            {error && <FormError style={{ marginTop: 10 }}>{error}</FormError>}
          </View>

          <ModalButtons>
            <Button onPress={close} isDisabled={isProcessing}>
              <Trans>Cancel</Trans>
            </Button>
            <Button
              variant="primary"
              onPress={handlePay}
              isDisabled={isProcessing || !accountId}
              style={{ marginLeft: 10 }}
            >
              {isProcessing ? <Trans>Processing...</Trans> : <Trans>Pay</Trans>}
            </Button>
          </ModalButtons>
        </>
      )}
    </Modal>
  );
}
