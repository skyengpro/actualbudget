import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Form } from 'react-aria-components';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { FormError } from '@actual-app/components/form-error';
import { InitialFocus } from '@actual-app/components/initial-focus';
import { InlineField } from '@actual-app/components/inline-field';
import { Input } from '@actual-app/components/input';
import { View } from '@actual-app/components/view';

import { send } from 'loot-core/platform/client/connection';
import * as monthUtils from 'loot-core/shared/months';
import { q } from 'loot-core/shared/query';
import type { ReimbursementEntity } from 'loot-core/types/models';

import { useFormat } from '@desktop-client/hooks/useFormat';

import {
  Modal,
  ModalButtons,
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '@desktop-client/components/common/Modal';
import { closeModal } from '@desktop-client/modals/modalsSlice';
import type { Modal as ModalType } from '@desktop-client/modals/modalsSlice';
import { useDispatch } from '@desktop-client/redux';

type ReimbursementEditModalProps = Extract<
  ModalType,
  { name: 'reimbursement-edit' }
>['options'];

export function ReimbursementEditModal({ id, onSave }: ReimbursementEditModalProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const format = useFormat();
  const adding = id == null;

  const [employeeName, setEmployeeName] = useState('');
  const [amount, setAmount] = useState('');
  const [dateSubmitted, setDateSubmitted] = useState(
    monthUtils.currentDay(),
  );
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!adding);

  useEffect(() => {
    if (id) {
      setIsLoading(true);
      send('query', q('reimbursements').filter({ id }).select('*').serialize()).then(
        ({ data }) => {
          if (data && data.length > 0) {
            const reimbursement = data[0] as ReimbursementEntity;
            setEmployeeName(reimbursement.employee_name);
            setAmount(
              reimbursement.amount != null
                ? format.forEdit(reimbursement.amount)
                : '',
            );
            setDateSubmitted(reimbursement.date_submitted);
            setDescription(reimbursement.description || '');
          }
          setIsLoading(false);
        },
      );
    }
  }, [id]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!employeeName.trim()) {
      setError(t('Employee name is required'));
      return;
    }

    if (!amount.trim()) {
      setError(t('Amount is required'));
      return;
    }

    const amountValue = format.fromEdit(amount, null);

    if (amountValue === null || amountValue <= 0) {
      setError(t('Please enter a valid amount'));
      return;
    }

    if (!dateSubmitted) {
      setError(t('Date submitted is required'));
      return;
    }

    const reimbursement = {
      employee_name: employeeName.trim(),
      amount: amountValue,
      date_submitted: dateSubmitted,
      description: description.trim() || null,
    };

    try {
      if (adding) {
        await send('reimbursement/create', { reimbursement });
      } else {
        await send('reimbursement/update', { id, fields: reimbursement });
      }
      onSave?.();
      dispatch(closeModal());
    } catch (err) {
      console.error('Reimbursement save error:', err);
      let errorMessage: string;
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'object' && err !== null) {
        errorMessage = (err as { error?: string; message?: string }).error
          || (err as { error?: string; message?: string }).message
          || JSON.stringify(err);
      } else {
        errorMessage = String(err);
      }
      setError(t('Error: {{message}}', { message: errorMessage }));
    }
  };

  if (isLoading) {
    return (
      <Modal name="reimbursement-edit">
        {() => (
          <View style={{ padding: 20 }}>
            <Trans>Loading...</Trans>
          </View>
        )}
      </Modal>
    );
  }

  return (
    <Modal name="reimbursement-edit">
      {({ state: { close } }) => (
        <>
          <ModalHeader
            title={
              <ModalTitle
                title={
                  adding ? t('New Reimbursement') : t('Edit Reimbursement')
                }
                shrinkOnOverflow
              />
            }
            rightContent={<ModalCloseButton onPress={close} />}
          />
          <View>
            <Form onSubmit={onSubmit}>
              <InlineField label={t('Employee Name')} width="100%">
                <InitialFocus>
                  <Input
                    name="employeeName"
                    value={employeeName}
                    onChangeValue={setEmployeeName}
                    style={{ flex: 1 }}
                    placeholder={t('Enter employee name')}
                  />
                </InitialFocus>
              </InlineField>

              <InlineField label={t('Amount')} width="100%">
                <Input
                  name="amount"
                  value={amount}
                  onChangeValue={setAmount}
                  style={{ flex: 1 }}
                  placeholder={t('0.00')}
                />
              </InlineField>

              <InlineField label={t('Date Submitted')} width="100%">
                <Input
                  name="dateSubmitted"
                  type="date"
                  value={dateSubmitted}
                  onChangeValue={setDateSubmitted}
                  style={{ flex: 1 }}
                />
              </InlineField>

              <InlineField label={t('Description')} width="100%">
                <Input
                  name="description"
                  value={description}
                  onChangeValue={setDescription}
                  style={{ flex: 1 }}
                  placeholder={t('e.g., Meals, Travel, Supplies')}
                />
              </InlineField>

              {error && <FormError style={{ marginTop: 10 }}>{error}</FormError>}

              <ModalButtons>
                <Button onPress={close}>
                  <Trans>Cancel</Trans>
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  style={{ marginLeft: 10 }}
                >
                  {adding ? <Trans>Create</Trans> : <Trans>Save</Trans>}
                </Button>
              </ModalButtons>
            </Form>
          </View>
        </>
      )}
    </Modal>
  );
}
