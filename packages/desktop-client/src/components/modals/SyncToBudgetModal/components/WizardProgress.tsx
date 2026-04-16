import { useTranslation } from 'react-i18next';

import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import type { WizardStep } from '../types';

type WizardProgressProps = {
  currentStep: WizardStep;
  isNarrowWidth?: boolean;
};

const STEPS: WizardStep[] = ['accounts', 'transactions', 'preview', 'confirm'];

export function WizardProgress({
  currentStep,
  isNarrowWidth = false,
}: WizardProgressProps) {
  const { t } = useTranslation();

  const stepLabels: Record<WizardStep, string> = {
    accounts: t('Accounts'),
    transactions: t('Transactions'),
    preview: t('Preview'),
    confirm: t('Confirm'),
  };

  const currentIndex = STEPS.indexOf(currentStep);

  return (
    <View
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: isNarrowWidth ? 8 : 16,
        marginBottom: 20,
        padding: '12px 0',
        borderBottom: `1px solid ${theme.tableBorder}`,
      }}
    >
      {STEPS.map((step, index) => {
        const isActive = index === currentIndex;
        const isCompleted = index < currentIndex;
        const isUpcoming = index > currentIndex;

        return (
          <View
            key={step}
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {/* Step indicator */}
            <View
              style={{
                width: isNarrowWidth ? 24 : 28,
                height: isNarrowWidth ? 24 : 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isNarrowWidth ? 11 : 12,
                fontWeight: 600,
                backgroundColor: isCompleted
                  ? theme.pageTextPositive
                  : isActive
                    ? theme.buttonPrimaryBackground
                    : theme.tableHeaderBackground,
                color: isCompleted || isActive
                  ? theme.buttonPrimaryText
                  : theme.pageTextSubdued,
                transition: 'all 0.2s ease',
              }}
            >
              {isCompleted ? '✓' : index + 1}
            </View>

            {/* Step label (hidden on narrow screens) */}
            {!isNarrowWidth && (
              <View
                style={{
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive
                    ? theme.pageText
                    : isUpcoming
                      ? theme.pageTextSubdued
                      : theme.pageTextPositive,
                }}
              >
                {stepLabels[step]}
              </View>
            )}

            {/* Connector line */}
            {index < STEPS.length - 1 && (
              <View
                style={{
                  width: isNarrowWidth ? 16 : 32,
                  height: 2,
                  backgroundColor: isCompleted
                    ? theme.pageTextPositive
                    : theme.tableBorder,
                  marginLeft: isNarrowWidth ? 0 : 8,
                  transition: 'background-color 0.2s ease',
                }}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}
