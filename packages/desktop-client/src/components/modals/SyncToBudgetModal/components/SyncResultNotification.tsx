import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import type { SyncExecuteResult } from '../types';

type SyncResultNotificationProps = {
  result: SyncExecuteResult;
};

export function SyncResultNotification({ result }: SyncResultNotificationProps) {
  const { t } = useTranslation();

  if (result.success) {
    return (
      <View
        style={{
          padding: '20px',
          backgroundColor: theme.pageTextPositive + '15',
          borderRadius: 8,
          border: `1px solid ${theme.pageTextPositive}40`,
          textAlign: 'center',
        }}
      >
        <View
          style={{
            fontSize: 48,
            marginBottom: 12,
          }}
        >
          ✓
        </View>
        <Text
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: theme.pageTextPositive,
            marginBottom: 8,
          }}
        >
          <Trans>Sync Complete!</Trans>
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: theme.pageTextSubdued,
          }}
        >
          {t('{{count}} transactions synced to budget', {
            count: result.syncedCount,
          })}
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: theme.pageTextSubdued,
            marginTop: 12,
          }}
        >
          <Trans>
            You can undo this operation using Cmd/Ctrl + Z
          </Trans>
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        padding: '20px',
        backgroundColor: theme.errorText + '15',
        borderRadius: 8,
        border: `1px solid ${theme.errorText}40`,
      }}
    >
      <View
        style={{
          fontSize: 48,
          marginBottom: 12,
          textAlign: 'center',
        }}
      >
        ✗
      </View>
      <Text
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: theme.errorText,
          marginBottom: 8,
          textAlign: 'center',
        }}
      >
        <Trans>Sync Failed</Trans>
      </Text>
      {result.errors.length > 0 && (
        <View style={{ marginTop: 12 }}>
          {result.errors.map((error, index) => (
            <Text
              key={index}
              style={{
                fontSize: 13,
                color: theme.errorText,
                marginBottom: 4,
              }}
            >
              • {error}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
