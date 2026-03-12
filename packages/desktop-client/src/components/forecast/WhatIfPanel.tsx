import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import * as monthUtils from 'loot-core/shared/months';
import type {
  CategoryEntity,
  HypotheticalItem,
  WhatIfScenario,
} from 'loot-core/types/models';

import { AmountInput } from '@desktop-client/components/util/AmountInput';
import { useCategories } from '@desktop-client/hooks/useCategories';
import { useFormat } from '@desktop-client/hooks/useFormat';

type WhatIfPanelProps = {
  scenario: WhatIfScenario | null;
  onScenarioChange: (scenario: WhatIfScenario | null) => void;
  scheduledItems: Array<{
    scheduleId: string;
    payeeName: string;
    amount: number;
  }>;
  scenarioComparison?: {
    baseline: { endingBalance: number; totalExpenses: number };
    scenario: { endingBalance: number; totalExpenses: number };
    difference: number;
  } | null;
};

function generateId() {
  return `hypothetical-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function Checkbox({
  checked,
  onChange,
  label,
  sublabel,
  strikethrough,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  sublabel?: string;
  strikethrough?: boolean;
}) {
  return (
    <View
      onClick={() => onChange(!checked)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        backgroundColor: theme.tableRowBackgroundHover,
        borderRadius: 6,
        cursor: 'pointer',
        opacity: strikethrough ? 0.6 : 1,
        transition: 'all 0.15s ease',
      }}
    >
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          border: `2px solid ${checked ? theme.pageTextLink : theme.tableBorder}`,
          backgroundColor: checked ? theme.pageTextLink : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
        }}
      >
        {checked && (
          <Text style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>✓</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 13,
            color: theme.pageText,
            textDecoration: strikethrough ? 'line-through' : 'none',
          }}
        >
          {label}
        </Text>
        {sublabel && (
          <Text style={{ fontSize: 11, color: theme.pageTextSubdued }}>
            {sublabel}
          </Text>
        )}
      </View>
    </View>
  );
}

export function WhatIfPanel({
  scenario,
  onScenarioChange,
  scheduledItems,
  scenarioComparison,
}: WhatIfPanelProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const { data: categoriesData } = useCategories();

  const categories = categoriesData?.list || [];
  const expenseCategories = categories.filter(
    (c: CategoryEntity) => !c.is_income && !c.hidden,
  );

  // Form state for new hypothetical item
  const [newPayeeName, setNewPayeeName] = useState('');
  const [newAmount, setNewAmount] = useState(0);
  const [newCategoryId, setNewCategoryId] = useState<string>('');
  const [newIsRecurring, setNewIsRecurring] = useState(false);
  const [newFrequency, setNewFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('monthly');
  const [newStartDate, setNewStartDate] = useState(monthUtils.currentDay());

  // Initialize scenario if needed
  const currentScenario: WhatIfScenario = scenario || {
    id: generateId(),
    name: t('What-If Scenario'),
    hypotheticalItems: [],
    disabledScheduleIds: [],
  };

  const hasChanges =
    currentScenario.hypotheticalItems.length > 0 ||
    currentScenario.disabledScheduleIds.length > 0;

  const handleAddItem = () => {
    if (!newPayeeName.trim() || newAmount === 0) return;

    const category = categories.find((c: CategoryEntity) => c.id === newCategoryId);

    const newItem: HypotheticalItem = {
      id: generateId(),
      payeeName: newPayeeName.trim(),
      amount: newAmount,
      categoryId: newCategoryId || null,
      categoryName: category?.name || null,
      isRecurring: newIsRecurring,
      frequency: newIsRecurring ? newFrequency : undefined,
      startDate: newStartDate,
    };

    onScenarioChange({
      ...currentScenario,
      hypotheticalItems: [...currentScenario.hypotheticalItems, newItem],
    });

    // Reset form
    setNewPayeeName('');
    setNewAmount(0);
    setNewCategoryId('');
  };

  const handleRemoveItem = (itemId: string) => {
    onScenarioChange({
      ...currentScenario,
      hypotheticalItems: currentScenario.hypotheticalItems.filter(
        i => i.id !== itemId,
      ),
    });
  };

  const handleToggleSchedule = (scheduleId: string, enabled: boolean) => {
    if (!enabled) {
      onScenarioChange({
        ...currentScenario,
        disabledScheduleIds: [...currentScenario.disabledScheduleIds, scheduleId],
      });
    } else {
      onScenarioChange({
        ...currentScenario,
        disabledScheduleIds: currentScenario.disabledScheduleIds.filter(
          id => id !== scheduleId,
        ),
      });
    }
  };

  const handleReset = () => {
    onScenarioChange(null);
  };

  const categoryOptions: Array<[string, string]> = [
    ['', t('No Category')],
    ...expenseCategories.map((c: CategoryEntity) => [c.id, c.name] as [string, string]),
  ];

  const frequencyOptions: Array<[string, string]> = [
    ['weekly', t('Weekly')],
    ['biweekly', t('Bi-weekly')],
    ['monthly', t('Monthly')],
  ];

  // Get unique schedules from items
  const uniqueSchedules = Array.from(
    new Map(
      scheduledItems
        .filter(item => !item.scheduleId.startsWith('hypothetical-') && !item.scheduleId.startsWith('predicted-'))
        .map(item => [item.scheduleId, item]),
    ).values(),
  );

  return (
    <View style={{ gap: 16 }}>
      {/* Scenario Impact Summary */}
      {scenarioComparison && hasChanges && (
        <View
          style={{
            backgroundColor: theme.pageTextLink + '15',
            borderRadius: 8,
            padding: 16,
            border: `1px solid ${theme.pageTextLink}40`,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: theme.pageTextLink,
              marginBottom: 12,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {t('Scenario Impact')}
          </Text>
          <View style={{ display: 'flex', flexDirection: 'row', gap: 24, flexWrap: 'wrap' }}>
            <View style={{ minWidth: 140 }}>
              <Text style={{ fontSize: 11, color: theme.pageTextSubdued, marginBottom: 4 }}>
                {t('Current Forecast')}
              </Text>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: theme.pageText,
                  ...styles.monoText,
                }}
              >
                {format(scenarioComparison.baseline.endingBalance, 'financial')}
              </Text>
            </View>
            <View style={{ minWidth: 140 }}>
              <Text style={{ fontSize: 11, color: theme.pageTextSubdued, marginBottom: 4 }}>
                {t('With Scenario')}
              </Text>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: theme.pageText,
                  ...styles.monoText,
                }}
              >
                {format(scenarioComparison.scenario.endingBalance, 'financial')}
              </Text>
            </View>
            <View style={{ minWidth: 140 }}>
              <Text style={{ fontSize: 11, color: theme.pageTextSubdued, marginBottom: 4 }}>
                {t('Difference')}
              </Text>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color:
                    scenarioComparison.difference >= 0
                      ? theme.noticeTextLight
                      : theme.errorText,
                  ...styles.monoText,
                }}
              >
                {scenarioComparison.difference >= 0 ? '+' : ''}
                {format(scenarioComparison.difference, 'financial')}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Introduction when no scenario */}
      {!hasChanges && (
        <View
          style={{
            backgroundColor: theme.tableBackground,
            borderRadius: 8,
            padding: 20,
            border: `1px solid ${theme.tableBorder}`,
            textAlign: 'center',
          }}
        >
          <Text style={{ fontSize: 14, color: theme.pageText, marginBottom: 8 }}>
            {t('Simulate Financial Scenarios')}
          </Text>
          <Text style={{ fontSize: 12, color: theme.pageTextSubdued, lineHeight: 1.5 }}>
            {t('Add hypothetical transactions or toggle existing schedules to see how they would affect your forecast.')}
          </Text>
        </View>
      )}

      {/* Add Hypothetical Transaction */}
      <View
        style={{
          backgroundColor: theme.tableBackground,
          borderRadius: 8,
          padding: 16,
          border: `1px solid ${theme.tableBorder}`,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: theme.pageText,
            marginBottom: 16,
          }}
        >
          {t('Add Hypothetical Transaction')}
        </Text>

        {/* Row 1: Payee, Amount, Category */}
        <View style={{ display: 'flex', flexDirection: 'row', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <View style={{ flex: '2 1 200px', minWidth: 150 }}>
            <Text style={{ fontSize: 11, color: theme.pageTextSubdued, marginBottom: 6 }}>
              {t('Payee Name')}
            </Text>
            <Input
              value={newPayeeName}
              onChange={e => setNewPayeeName(e.target.value)}
              placeholder={t('e.g., Netflix, Gym membership')}
              style={{ width: '100%' }}
            />
          </View>
          <View style={{ flex: '1 1 120px', minWidth: 100 }}>
            <Text style={{ fontSize: 11, color: theme.pageTextSubdued, marginBottom: 6 }}>
              {t('Amount')}
            </Text>
            <AmountInput
              value={newAmount}
              onUpdate={setNewAmount}
              style={{ width: '100%' }}
            />
          </View>
          <View style={{ flex: '1 1 150px', minWidth: 120 }}>
            <Text style={{ fontSize: 11, color: theme.pageTextSubdued, marginBottom: 6 }}>
              {t('Category')}
            </Text>
            <Select
              options={categoryOptions}
              value={newCategoryId}
              onChange={setNewCategoryId}
            />
          </View>
        </View>

        {/* Row 2: Recurring, Frequency, Start Date, Add Button */}
        <View style={{ display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <View
            onClick={() => setNewIsRecurring(!newIsRecurring)}
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              backgroundColor: newIsRecurring ? theme.pageTextLink + '15' : theme.tableRowBackgroundHover,
              borderRadius: 6,
              cursor: 'pointer',
              border: `1px solid ${newIsRecurring ? theme.pageTextLink : 'transparent'}`,
            }}
          >
            <View
              style={{
                width: 16,
                height: 16,
                borderRadius: 3,
                border: `2px solid ${newIsRecurring ? theme.pageTextLink : theme.tableBorder}`,
                backgroundColor: newIsRecurring ? theme.pageTextLink : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {newIsRecurring && (
                <Text style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>✓</Text>
              )}
            </View>
            <Text style={{ fontSize: 12, color: theme.pageText }}>{t('Recurring')}</Text>
          </View>

          {newIsRecurring && (
            <View style={{ minWidth: 100 }}>
              <Text style={{ fontSize: 11, color: theme.pageTextSubdued, marginBottom: 6 }}>
                {t('Frequency')}
              </Text>
              <Select
                options={frequencyOptions}
                value={newFrequency}
                onChange={v => setNewFrequency(v as 'weekly' | 'biweekly' | 'monthly')}
              />
            </View>
          )}

          <View style={{ minWidth: 130 }}>
            <Text style={{ fontSize: 11, color: theme.pageTextSubdued, marginBottom: 6 }}>
              {t('Start Date')}
            </Text>
            <Input
              type="date"
              value={newStartDate}
              onChange={e => setNewStartDate(e.target.value)}
              style={{ width: '100%' }}
            />
          </View>

          <View style={{ flex: 1 }} />

          <Button
            variant="primary"
            onPress={handleAddItem}
            isDisabled={!newPayeeName.trim() || newAmount === 0}
          >
            {t('Add to Scenario')}
          </Button>
        </View>
      </View>

      {/* Hypothetical Items List */}
      {currentScenario.hypotheticalItems.length > 0 && (
        <View
          style={{
            backgroundColor: theme.tableBackground,
            borderRadius: 8,
            padding: 16,
            border: `1px solid ${theme.tableBorder}`,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: theme.pageText,
              marginBottom: 12,
            }}
          >
            {t('Your Hypothetical Transactions')}
          </Text>
          <View style={{ gap: 8 }}>
            {currentScenario.hypotheticalItems.map(item => (
              <View
                key={item.id}
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: '12px 14px',
                  backgroundColor: theme.tableRowBackgroundHover,
                  borderRadius: 6,
                  gap: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, color: theme.pageText, fontWeight: 500 }}>
                    {item.payeeName}
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.pageTextSubdued, marginTop: 2 }}>
                    {item.isRecurring ? t('{{frequency}} from {{date}}', {
                      frequency: item.frequency,
                      date: monthUtils.format(item.startDate, 'MMM d'),
                    }) : monthUtils.format(item.startDate, 'MMM d')}
                    {item.categoryName && ` · ${item.categoryName}`}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 14,
                    color: item.amount > 0 ? theme.noticeTextLight : theme.errorText,
                    fontWeight: 600,
                    ...styles.monoText,
                  }}
                >
                  {item.amount > 0 ? '+' : ''}
                  {format(item.amount, 'financial')}
                </Text>
                <Button
                  variant="bare"
                  onPress={() => handleRemoveItem(item.id)}
                  style={{ padding: 6 }}
                >
                  <Text style={{ color: theme.errorText, fontSize: 16 }}>×</Text>
                </Button>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Toggle Scheduled Transactions */}
      {uniqueSchedules.length > 0 && (
        <View
          style={{
            backgroundColor: theme.tableBackground,
            borderRadius: 8,
            padding: 16,
            border: `1px solid ${theme.tableBorder}`,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: theme.pageText,
              marginBottom: 4,
            }}
          >
            {t('Toggle Existing Schedules')}
          </Text>
          <Text
            style={{
              fontSize: 11,
              color: theme.pageTextSubdued,
              marginBottom: 12,
            }}
          >
            {t('Uncheck to see what happens if you remove a recurring transaction')}
          </Text>
          <View style={{ gap: 6 }}>
            {uniqueSchedules.slice(0, 10).map(item => {
              const isEnabled = !currentScenario.disabledScheduleIds.includes(item.scheduleId);
              return (
                <View
                  key={item.scheduleId}
                  onClick={() => handleToggleSchedule(item.scheduleId, !isEnabled)}
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    backgroundColor: theme.tableRowBackgroundHover,
                    borderRadius: 6,
                    cursor: 'pointer',
                    opacity: isEnabled ? 1 : 0.5,
                  }}
                >
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: `2px solid ${isEnabled ? theme.pageTextLink : theme.tableBorder}`,
                      backgroundColor: isEnabled ? theme.pageTextLink : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isEnabled && (
                      <Text style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>✓</Text>
                    )}
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: theme.pageText,
                      textDecoration: !isEnabled ? 'line-through' : 'none',
                    }}
                  >
                    {item.payeeName}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: item.amount > 0 ? theme.noticeTextLight : theme.errorText,
                      fontWeight: 500,
                      ...styles.monoText,
                    }}
                  >
                    {item.amount > 0 ? '+' : ''}
                    {format(item.amount, 'financial')}
                  </Text>
                </View>
              );
            })}
            {uniqueSchedules.length > 10 && (
              <Text
                style={{
                  fontSize: 11,
                  color: theme.pageTextSubdued,
                  padding: '8px 12px',
                }}
              >
                {t('And {{count}} more...', { count: uniqueSchedules.length - 10 })}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Reset Button */}
      {hasChanges && (
        <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center' }}>
          <Button variant="bare" onPress={handleReset}>
            <Text style={{ color: theme.errorText, fontSize: 13 }}>
              {t('Reset Scenario')}
            </Text>
          </Button>
        </View>
      )}
    </View>
  );
}
