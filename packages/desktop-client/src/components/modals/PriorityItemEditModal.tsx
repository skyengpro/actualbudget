import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Form } from 'react-aria-components';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { FormError } from '@actual-app/components/form-error';
import { InitialFocus } from '@actual-app/components/initial-focus';
import { InlineField } from '@actual-app/components/inline-field';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { View } from '@actual-app/components/view';

import { send } from 'loot-core/platform/client/connection';
import type {
  PriorityItemEntity,
  PriorityItemFrequency,
  PriorityItemKind,
} from 'loot-core/types/models';

import { useFormat } from '@desktop-client/hooks/useFormat';

import { CategoryAutocomplete } from '@desktop-client/components/autocomplete/CategoryAutocomplete';
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

type PriorityItemEditModalProps = Extract<
  ModalType,
  { name: 'priority-item-edit' }
>['options'];

export function PriorityItemEditModal({
  id,
  onSaved,
}: PriorityItemEditModalProps = {} as PriorityItemEditModalProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const format = useFormat();
  const adding = id == null;

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<PriorityItemKind>('purchase');
  const [amount, setAmount] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState('');
  const [frequency, setFrequency] = useState<PriorityItemFrequency>('once');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!adding);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    send('priority-item/get', { id })
      .then(item => {
        if (item) {
          const typed = item as PriorityItemEntity;
          setTitle(typed.title);
          setKind(typed.kind);
          setAmount(
            typed.amount != null
              ? format.forEdit(Math.abs(typed.amount))
              : '',
          );
          setPayeeName(typed.payee_name ?? '');
          setCategoryId(typed.category_id ?? null);
          setTargetDate(typed.target_date ?? '');
          setFrequency(typed.frequency ?? 'once');
          setNotes(typed.notes ?? '');
        }
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [id, format]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError(t('Title is required'));
      return;
    }

    // For todo items, amount is optional (defaults to 0). For purchase /
    // recurring, require a numeric amount so the follow-up schedule has data.
    let amountValue = 0;
    if (amount.trim()) {
      amountValue = format.fromEdit(amount, null) || 0;
      // Convention: priority list holds planned expenses as negative amounts.
      amountValue = -Math.abs(amountValue);
    } else if (kind !== 'todo') {
      setError(t('Amount is required for purchases and recurring items'));
      return;
    }

    const payload = {
      title: title.trim(),
      kind,
      amount: amountValue,
      payee_name: payeeName.trim() || null,
      category_id: categoryId,
      target_date: targetDate.trim() || null,
      frequency: kind === 'recurring' ? frequency : null,
      notes: notes.trim() || null,
    };

    try {
      if (adding) {
        await send('priority-item/create', { item: payload });
      } else {
        await send('priority-item/update', { id, fields: payload });
      }
      onSaved?.();
      dispatch(closeModal());
    } catch (err) {
      setError(t('An error occurred while saving the priority item'));
    }
  };

  if (isLoading) {
    return (
      <Modal name="priority-item-edit">
        {() => (
          <View style={{ padding: 20 }}>
            <Trans>Loading...</Trans>
          </View>
        )}
      </Modal>
    );
  }

  const modalTitle = adding
    ? t('New Priority Item')
    : t('Edit Priority Item');

  return (
    <Modal name="priority-item-edit">
      {({ state: { close } }) => (
        <>
          <ModalHeader
            title={<ModalTitle title={modalTitle} shrinkOnOverflow />}
            rightContent={<ModalCloseButton onPress={close} />}
          />
          <View style={{ minWidth: 400 }}>
            <Form onSubmit={onSubmit}>
              <InlineField label={t('Type')} width="100%">
                <Select
                  value={kind}
                  onChange={(value: string) => {
                    setKind(value as PriorityItemKind);
                  }}
                  options={[
                    ['purchase', t('One-time purchase')],
                    ['recurring', t('Recurring commitment')],
                    ['todo', t('Financial todo')],
                  ]}
                  style={{ flex: 1 }}
                />
              </InlineField>

              <InlineField label={t('Title')} width="100%">
                <InitialFocus>
                  <Input
                    name="title"
                    value={title}
                    onChangeValue={setTitle}
                    style={{ flex: 1 }}
                    placeholder={t('e.g., New laptop')}
                  />
                </InitialFocus>
              </InlineField>

              <InlineField label={t('Payee')} width="100%">
                <Input
                  name="payee"
                  value={payeeName}
                  onChangeValue={setPayeeName}
                  style={{ flex: 1 }}
                  placeholder={t('Optional payee name')}
                />
              </InlineField>

              <InlineField label={t('Category')} width="100%">
                <CategoryAutocomplete
                  value={categoryId}
                  onSelect={setCategoryId}
                />
              </InlineField>

              <InlineField label={t('Amount')} width="100%">
                <Input
                  name="amount"
                  value={amount}
                  onChangeValue={setAmount}
                  style={{ flex: 1 }}
                  placeholder={
                    kind === 'todo' ? t('Optional') : t('0.00')
                  }
                />
              </InlineField>

              <InlineField label={t('Target date')} width="100%">
                <Input
                  type="date"
                  name="target_date"
                  value={targetDate}
                  onChangeValue={setTargetDate}
                  style={{ flex: 1 }}
                />
              </InlineField>

              {kind === 'recurring' && (
                <InlineField label={t('Frequency')} width="100%">
                  <Select
                    value={frequency}
                    onChange={(value: string) =>
                      setFrequency(value as PriorityItemFrequency)
                    }
                    options={[
                      ['weekly', t('Weekly')],
                      ['biweekly', t('Biweekly')],
                      ['monthly', t('Monthly')],
                    ]}
                    style={{ flex: 1 }}
                  />
                </InlineField>
              )}

              <InlineField label={t('Notes')} width="100%">
                <Input
                  name="notes"
                  value={notes}
                  onChangeValue={setNotes}
                  style={{ flex: 1 }}
                  placeholder={t('Optional notes')}
                />
              </InlineField>

              {error && (
                <FormError style={{ marginTop: 10 }}>{error}</FormError>
              )}

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
