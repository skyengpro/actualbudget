import { useState, useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { FormError } from '@actual-app/components/form-error';
import { InlineField } from '@actual-app/components/inline-field';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { send } from 'loot-core/platform/client/connection';
import * as monthUtils from 'loot-core/shared/months';

import {
  Modal,
  ModalButtons,
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '@desktop-client/components/common/Modal';
import { useAccounts } from '@desktop-client/hooks/useAccounts';
import { closeModal } from '@desktop-client/modals/modalsSlice';
import type { Modal as ModalType } from '@desktop-client/modals/modalsSlice';
import { useDispatch } from '@desktop-client/redux';

type TemplateApplyModalProps = Extract<
  ModalType,
  { name: 'template-apply' }
>['options'];

export function TemplateApplyModal({ templateId }: TemplateApplyModalProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { data: accounts = [] } = useAccounts();

  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [date, setDate] = useState<string>(monthUtils.currentDay());
  const [error, setError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  // Filter to only on-budget accounts
  const onBudgetAccounts = useMemo(
    () => accounts.filter(a => !a.closed && !a.offbudget),
    [accounts],
  );

  const handleApply = async () => {
    if (!selectedAccount) {
      setError(t('Please select an account'));
      return;
    }

    if (!date) {
      setError(t('Please select a date'));
      return;
    }

    setError(null);
    setIsApplying(true);

    try {
      await send('template/apply', {
        id: templateId,
        accountId: selectedAccount,
        date: date, // Keep YYYY-MM-DD format
      });
      dispatch(closeModal());
    } catch (e) {
      setError(t('Failed to apply template'));
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Modal name="template-apply">
      {({ state: { close } }) => (
        <>
          <ModalHeader
            title={<ModalTitle title={t('Apply Template')} />}
            rightContent={<ModalCloseButton onPress={close} />}
          />

          <View style={{ padding: 20, minWidth: 350 }}>
            {error && <FormError style={{ marginBottom: 12 }}>{error}</FormError>}

            <Text style={{ marginBottom: 16, color: theme.pageTextSubdued }}>
              <Trans>
                This will create a new transaction from the template.
              </Trans>
            </Text>

            <InlineField label={t('Account')} width="100%">
              <Select
                value={selectedAccount}
                onChange={(value: string) => setSelectedAccount(value)}
                options={[
                  ['', t('Select an account...')],
                  ...onBudgetAccounts.map(a => [a.id, a.name]),
                ]}
                style={{ flex: 1 }}
              />
            </InlineField>

            <InlineField label={t('Date')} width="100%" style={{ marginTop: 12 }}>
              <Input
                type="date"
                value={date}
                onChangeValue={setDate}
                style={{ flex: 1 }}
              />
            </InlineField>

            <ModalButtons style={{ marginTop: 20 }}>
              <Button variant="bare" onPress={close}>
                <Trans>Cancel</Trans>
              </Button>
              <Button
                variant="primary"
                isDisabled={isApplying}
                onPress={handleApply}
              >
                {isApplying ? (
                  <Trans>Creating...</Trans>
                ) : (
                  <Trans>Create Transaction</Trans>
                )}
              </Button>
            </ModalButtons>
          </View>
        </>
      )}
    </Modal>
  );
}
