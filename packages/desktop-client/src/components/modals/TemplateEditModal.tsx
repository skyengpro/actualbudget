import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Form } from 'react-aria-components';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { FormError } from '@actual-app/components/form-error';
import { InitialFocus } from '@actual-app/components/initial-focus';
import { InlineField } from '@actual-app/components/inline-field';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { send } from 'loot-core/platform/client/connection';
import { q } from 'loot-core/shared/query';
import type { TransactionTemplateEntity } from 'loot-core/types/models';

import { useAccounts } from '@desktop-client/hooks/useAccounts';
import { useFormat } from '@desktop-client/hooks/useFormat';
import { usePayees } from '@desktop-client/hooks/usePayees';

import {
  Modal,
  ModalButtons,
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '@desktop-client/components/common/Modal';
import { CategoryAutocomplete } from '@desktop-client/components/autocomplete/CategoryAutocomplete';
import { PayeeAutocomplete } from '@desktop-client/components/autocomplete/PayeeAutocomplete';
import { closeModal } from '@desktop-client/modals/modalsSlice';
import type { Modal as ModalType } from '@desktop-client/modals/modalsSlice';
import { useDispatch } from '@desktop-client/redux';

type TemplateEditModalProps = Extract<
  ModalType,
  { name: 'template-edit' }
>['options'];

type TemplateType = 'payment' | 'deposit' | 'transfer';

export function TemplateEditModal({ id }: TemplateEditModalProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const format = useFormat();
  const adding = id == null;

  const [name, setName] = useState('');
  const [payeeId, setPayeeId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [templateType, setTemplateType] = useState<TemplateType>('payment');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!adding);
  const [fromAccountId, setFromAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);

  // Get payees and accounts
  const { data: payees = [] } = usePayees();
  const { data: accounts = [] } = useAccounts();

  // Get active accounts for dropdowns
  const activeAccounts = useMemo(() => {
    return accounts.filter(a => !a.closed);
  }, [accounts]);

  // Get "from" account options (exclude selected "to" account)
  const fromAccountOptions = useMemo(() => {
    return activeAccounts
      .filter(a => a.id !== toAccountId)
      .map(a => [a.id, a.name] as const);
  }, [activeAccounts, toAccountId]);

  // Get "to" account options (exclude selected "from" account)
  const toAccountOptions = useMemo(() => {
    return activeAccounts
      .filter(a => a.id !== fromAccountId)
      .map(a => [a.id, a.name] as const);
  }, [activeAccounts, fromAccountId]);

  // Find the transfer payee for the selected "to" account
  const transferPayee = useMemo(() => {
    if (!toAccountId) return null;
    return payees.find(p => p.transfer_acct === toAccountId);
  }, [payees, toAccountId]);

  useEffect(() => {
    if (id) {
      setIsLoading(true);
      send('query', q('transaction_templates').filter({ id }).select('*').serialize())
        .then(({ data }) => {
          if (data && data.length > 0) {
            const template = data[0] as TransactionTemplateEntity;
            setName(template.name);
            setPayeeId(template.payee || null);
            setCategoryId(template.category || null);
            setFromAccountId(template.account || null);
            setNotes(template.notes || '');

            // Check if this is a transfer template
            const payee = payees.find(p => p.id === template.payee);
            if (payee?.transfer_acct) {
              setTemplateType('transfer');
              setToAccountId(payee.transfer_acct);
            } else if (template.amount != null) {
              setTemplateType(template.amount < 0 ? 'payment' : 'deposit');
            }

            if (template.amount != null) {
              setAmount(format.forEdit(Math.abs(template.amount)));
            } else {
              setAmount('');
            }
          }
          setIsLoading(false);
        })
        .catch(() => {
          setIsLoading(false);
        });
    }
  }, [id, payees]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(t('Name is required'));
      return;
    }

    // Validate transfer has both accounts selected
    if (templateType === 'transfer') {
      if (!fromAccountId) {
        setError(t('Please select a "From" account'));
        return;
      }
      if (!toAccountId) {
        setError(t('Please select a "To" account'));
        return;
      }
      if (fromAccountId === toAccountId) {
        setError(t('From and To accounts must be different'));
        return;
      }
    }

    let amountValue = amount.trim()
      ? format.fromEdit(amount, null)
      : null;

    // Apply sign based on template type
    if (amountValue != null) {
      if (templateType === 'transfer' || templateType === 'payment') {
        amountValue = -Math.abs(amountValue);
      } else {
        amountValue = Math.abs(amountValue);
      }
    }

    // For transfers, use the transfer payee
    const finalPayeeId = templateType === 'transfer' ? transferPayee?.id || null : payeeId;

    const template = {
      name: name.trim(),
      account: templateType === 'transfer' ? fromAccountId : null,
      payee: finalPayeeId,
      category: templateType === 'transfer' ? null : categoryId,
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

  const isTransfer = templateType === 'transfer';

  const modalTitle = adding
    ? isTransfer
      ? t('New Transfer Template')
      : t('New Template')
    : isTransfer
      ? t('Edit Transfer Template')
      : t('Edit Template');

  return (
    <Modal name="template-edit">
      {({ state: { close } }) => (
        <>
          <ModalHeader
            title={
              <ModalTitle
                title={modalTitle}
                shrinkOnOverflow
              />
            }
            rightContent={<ModalCloseButton onPress={close} />}
          />
          <View style={{ minWidth: 400 }}>
            <Form onSubmit={onSubmit}>
              {/* Type Selection - Always First */}
              <InlineField label={t('Type')} width="100%">
                <Select
                  value={templateType}
                  onChange={(value: string) => {
                    setTemplateType(value as TemplateType);
                    // Clear fields when switching types
                    if (value === 'transfer') {
                      setPayeeId(null);
                      setCategoryId(null);
                    } else {
                      setFromAccountId(null);
                      setToAccountId(null);
                    }
                  }}
                  options={[
                    ['payment', t('Payment (Expense)')],
                    ['deposit', t('Deposit (Income)')],
                    ['transfer', t('Transfer (Between Accounts)')],
                  ]}
                  style={{ flex: 1 }}
                />
              </InlineField>

              <InlineField label={t('Name')} width="100%">
                <InitialFocus>
                  <Input
                    name="name"
                    value={name}
                    onChangeValue={setName}
                    style={{ flex: 1 }}
                    placeholder={isTransfer ? t('e.g., Monthly savings transfer') : t('Template name')}
                  />
                </InitialFocus>
              </InlineField>

              {isTransfer ? (
                // Transfer Template UI
                <>
                  <View
                    style={{
                      backgroundColor: theme.tableRowBackgroundHover,
                      borderRadius: 8,
                      padding: 16,
                      marginTop: 8,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, color: theme.pageTextSubdued }}>
                      <Trans>Transfer Details</Trans>
                    </Text>

                    <InlineField label={t('From')} width="100%">
                      <Select
                        value={fromAccountId || ''}
                        onChange={(value: string) => setFromAccountId(value || null)}
                        options={[
                          ['', t('Select account...')],
                          ...fromAccountOptions,
                        ]}
                        style={{ flex: 1 }}
                      />
                    </InlineField>

                    <View style={{ textAlign: 'center', padding: 8 }}>
                      <Text style={{ fontSize: 18, color: theme.pageTextSubdued }}>↓</Text>
                    </View>

                    <InlineField label={t('To')} width="100%">
                      <Select
                        value={toAccountId || ''}
                        onChange={(value: string) => setToAccountId(value || null)}
                        options={[
                          ['', t('Select account...')],
                          ...toAccountOptions,
                        ]}
                        style={{ flex: 1 }}
                      />
                    </InlineField>
                  </View>

                  <InlineField label={t('Category')} width="100%">
                    <View
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        backgroundColor: theme.tableBackground,
                        borderRadius: 4,
                        border: `1px solid ${theme.tableBorder}`,
                      }}
                    >
                      <Text style={{ fontStyle: 'italic', color: theme.pageTextSubdued }}>
                        <Trans>Transfer</Trans>
                      </Text>
                    </View>
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
                </>
              ) : (
                // Regular Transaction Template UI
                <>
                  <InlineField label={t('Payee')} width="100%">
                    <PayeeAutocomplete
                      value={payeeId}
                      onSelect={setPayeeId}
                      showMakeTransfer={false}
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
                </>
              )}

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
