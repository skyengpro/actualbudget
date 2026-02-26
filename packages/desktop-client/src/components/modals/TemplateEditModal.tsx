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
import { q } from 'loot-core/shared/query';
import type { TransactionTemplateEntity } from 'loot-core/types/models';

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
import { PayeeAutocomplete } from '@desktop-client/components/autocomplete/PayeeAutocomplete';
import { closeModal } from '@desktop-client/modals/modalsSlice';
import type { Modal as ModalType } from '@desktop-client/modals/modalsSlice';
import { useDispatch } from '@desktop-client/redux';

type TemplateEditModalProps = Extract<
  ModalType,
  { name: 'template-edit' }
>['options'];

export function TemplateEditModal({ id }: TemplateEditModalProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const format = useFormat();
  const adding = id == null;

  const [name, setName] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [payeeId, setPayeeId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!adding);

  useEffect(() => {
    if (id) {
      setIsLoading(true);
      send('query', q('transaction_templates').filter({ id }).select('*').serialize())
        .then(({ data }) => {
          if (data && data.length > 0) {
            const template = data[0] as TransactionTemplateEntity;
            setName(template.name);
            setAccountId(template.account || null);
            setPayeeId(template.payee || null);
            setCategoryId(template.category || null);
            setAmount(
              template.amount != null ? format.forEdit(template.amount) : '',
            );
            setNotes(template.notes || '');
          }
          setIsLoading(false);
        })
        .catch(() => {
          setIsLoading(false);
        });
    }
  }, [id]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(t('Name is required'));
      return;
    }

    const amountValue = amount.trim()
      ? format.fromEdit(amount, null)
      : null;

    const template = {
      name: name.trim(),
      account: accountId,
      payee: payeeId,
      category: categoryId,
      amount: amountValue,
      notes: notes.trim() || null,
    };

    try {
      if (adding) {
        await send('template/create', { template });
      } else {
        await send('template/update', { id, fields: template });
      }
      dispatch(closeModal());
    } catch (err) {
      setError(t('An error occurred while saving the template'));
    }
  };

  if (isLoading) {
    return (
      <Modal name="template-edit">
        {() => (
          <View style={{ padding: 20 }}>
            <Trans>Loading...</Trans>
          </View>
        )}
      </Modal>
    );
  }

  return (
    <Modal name="template-edit">
      {({ state: { close } }) => (
        <>
          <ModalHeader
            title={
              <ModalTitle
                title={adding ? t('New Template') : t('Edit Template')}
                shrinkOnOverflow
              />
            }
            rightContent={<ModalCloseButton onPress={close} />}
          />
          <View>
            <Form onSubmit={onSubmit}>
              <InlineField label={t('Name')} width="100%">
                <InitialFocus>
                  <Input
                    name="name"
                    value={name}
                    onChangeValue={setName}
                    style={{ flex: 1 }}
                    placeholder={t('Template name')}
                  />
                </InitialFocus>
              </InlineField>

              <InlineField label={t('Account')} width="100%">
                <AccountAutocomplete
                  value={accountId}
                  onSelect={setAccountId}
                />
              </InlineField>

              <InlineField label={t('Payee')} width="100%">
                <PayeeAutocomplete
                  value={payeeId}
                  onSelect={setPayeeId}
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
                  placeholder={t('0.00')}
                />
              </InlineField>

              <InlineField label={t('Notes')} width="100%">
                <Input
                  name="notes"
                  value={notes}
                  onChangeValue={setNotes}
                  style={{ flex: 1 }}
                  placeholder={t('Optional notes')}
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
