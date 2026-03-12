import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { Tooltip } from '@actual-app/components/tooltip';

import * as monthUtils from 'loot-core/shared/months';
import type {
  CategoryEntity,
  HypotheticalItem,
  WhatIfScenario,
} from 'loot-core/types/models';

import { AmountInput } from '@desktop-client/components/util/AmountInput';
import { useCategories } from '@desktop-client/hooks/useCategories';
import { useFormat } from '@desktop-client/hooks/useFormat';
import { pushModal } from '@desktop-client/modals/modalsSlice';
import { useDispatch } from '@desktop-client/redux';

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

function InsightCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        backgroundColor: theme.tableBackground,
        borderRadius: 8,
        padding: 16,
        border: `1px solid ${theme.tableBorder}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: `1px solid ${theme.tableBorder}`,
        }}
      >
        <div style={{ flex: 1 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: theme.pageText,
              letterSpacing: 0.3,
            }}
          >
            {title}
          </span>
          {subtitle && (
            <div
              style={{
                fontSize: 11,
                color: theme.pageTextSubdued,
                marginTop: 4,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
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
  const dispatch = useDispatch();
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

  const handleCreateSchedule = (item: HypotheticalItem) => {
    dispatch(
      pushModal({
        modal: {
          name: 'schedule-edit',
          options: {
            template: {
              id: item.id,
              name: item.payeeName,
              amount: item.amount,
              payee: null,
              category: item.categoryId,
              notes: item.isRecurring
                ? `${item.frequency} from ${item.startDate}`
                : `One-time on ${item.startDate}`,
              active: true,
              tombstone: false,
            },
          },
        },
      }),
    );
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Scenario Impact Summary */}
      {scenarioComparison && hasChanges && (
        <InsightCard title={t('Scenario Impact')}>
          <div style={{ display: 'flex', flexDirection: 'row', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 140 }}>
              <div style={{ fontSize: 11, color: theme.pageTextSubdued, marginBottom: 4 }}>
                {t('Current Forecast')}
              </div>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: theme.pageText,
                  ...styles.monoText,
                }}
              >
                {format(scenarioComparison.baseline.endingBalance, 'financial')}
              </span>
            </div>
            <div style={{ minWidth: 140 }}>
              <div style={{ fontSize: 11, color: theme.pageTextSubdued, marginBottom: 4 }}>
                {t('With Scenario')}
              </div>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: theme.pageText,
                  ...styles.monoText,
                }}
              >
                {format(scenarioComparison.scenario.endingBalance, 'financial')}
              </span>
            </div>
            <div style={{ minWidth: 140 }}>
              <div style={{ fontSize: 11, color: theme.pageTextSubdued, marginBottom: 4 }}>
                {t('Difference')}
              </div>
              <span
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
              </span>
            </div>
          </div>
        </InsightCard>
      )}

      {/* Introduction when no scenario */}
      {!hasChanges && (
        <InsightCard title={t('Simulate Financial Scenarios')}>
          <span style={{ fontSize: 12, color: theme.pageTextSubdued, lineHeight: 1.5 }}>
            {t('Add hypothetical transactions or toggle existing schedules to see how they would affect your forecast.')}
          </span>
        </InsightCard>
      )}

      {/* Add Hypothetical Transaction */}
      <InsightCard title={t('Add Hypothetical Transaction')}>
        {/* Row 1: Payee, Amount, Category */}
        <div style={{ display: 'flex', flexDirection: 'row', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '2 1 200px', minWidth: 150 }}>
            <div style={{ fontSize: 11, color: theme.pageTextSubdued, marginBottom: 6 }}>
              {t('Payee Name')}
            </div>
            <Input
              value={newPayeeName}
              onChange={e => setNewPayeeName(e.target.value)}
              placeholder={t('e.g., Netflix, Gym membership')}
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ flex: '1 1 120px', minWidth: 100 }}>
            <div style={{ fontSize: 11, color: theme.pageTextSubdued, marginBottom: 6 }}>
              {t('Amount')}
            </div>
            <AmountInput
              value={newAmount}
              onUpdate={setNewAmount}
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ flex: '1 1 150px', minWidth: 120 }}>
            <div style={{ fontSize: 11, color: theme.pageTextSubdued, marginBottom: 6 }}>
              {t('Category')}
            </div>
            <Select
              options={categoryOptions}
              value={newCategoryId}
              onChange={setNewCategoryId}
            />
          </div>
        </div>

        {/* Row 2: Recurring, Frequency, Start Date, Add Button */}
        <div style={{ display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div
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
            <div
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
                <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>✓</span>
              )}
            </div>
            <span style={{ fontSize: 12, color: theme.pageText }}>{t('Recurring')}</span>
          </div>

          {newIsRecurring && (
            <div style={{ minWidth: 100 }}>
              <div style={{ fontSize: 11, color: theme.pageTextSubdued, marginBottom: 6 }}>
                {t('Frequency')}
              </div>
              <Select
                options={frequencyOptions}
                value={newFrequency}
                onChange={v => setNewFrequency(v as 'weekly' | 'biweekly' | 'monthly')}
              />
            </div>
          )}

          <div style={{ minWidth: 130 }}>
            <div style={{ fontSize: 11, color: theme.pageTextSubdued, marginBottom: 6 }}>
              {t('Start Date')}
            </div>
            <Input
              type="date"
              value={newStartDate}
              onChange={e => setNewStartDate(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ flex: 1 }} />

          <Button
            variant="primary"
            onPress={handleAddItem}
            isDisabled={!newPayeeName.trim() || newAmount === 0}
          >
            {t('Add to Scenario')}
          </Button>
        </div>
      </InsightCard>

      {/* Hypothetical Items List */}
      {currentScenario.hypotheticalItems.length > 0 && (
        <InsightCard title={t('Your Hypothetical Transactions')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {currentScenario.hypotheticalItems.map(item => (
              <div
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
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, color: theme.pageText, fontWeight: 500 }}>
                    {item.payeeName}
                  </span>
                  <div style={{ fontSize: 11, color: theme.pageTextSubdued, marginTop: 2 }}>
                    {item.isRecurring ? t('{{frequency}} from {{date}}', {
                      frequency: item.frequency,
                      date: monthUtils.format(item.startDate, 'MMM d'),
                    }) : monthUtils.format(item.startDate, 'MMM d')}
                    {item.categoryName && ` · ${item.categoryName}`}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 14,
                    color: item.amount > 0 ? theme.noticeTextLight : theme.errorText,
                    fontWeight: 600,
                    ...styles.monoText,
                  }}
                >
                  {item.amount > 0 ? '+' : ''}
                  {format(item.amount, 'financial')}
                </span>
                <Tooltip content={t('Create as scheduled transaction')} placement="top">
                  <Button
                    variant="bare"
                    onPress={() => handleCreateSchedule(item)}
                    style={{ padding: 6 }}
                  >
                    <span style={{ color: theme.pageTextLink, fontSize: 14 }}>📅</span>
                  </Button>
                </Tooltip>
                <Button
                  variant="bare"
                  onPress={() => handleRemoveItem(item.id)}
                  style={{ padding: 6 }}
                >
                  <span style={{ color: theme.errorText, fontSize: 16 }}>×</span>
                </Button>
              </div>
            ))}
          </div>
        </InsightCard>
      )}

      {/* Toggle Scheduled Transactions */}
      {uniqueSchedules.length > 0 && (
        <InsightCard
          title={t('Toggle Existing Schedules')}
          subtitle={t('Uncheck to see what happens if you remove a recurring transaction')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {uniqueSchedules.slice(0, 10).map(item => {
              const isEnabled = !currentScenario.disabledScheduleIds.includes(item.scheduleId);
              return (
                <div
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
                  <div
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
                      <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>✓</span>
                    )}
                  </div>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: theme.pageText,
                      textDecoration: !isEnabled ? 'line-through' : 'none',
                    }}
                  >
                    {item.payeeName}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: item.amount > 0 ? theme.noticeTextLight : theme.errorText,
                      fontWeight: 500,
                      ...styles.monoText,
                    }}
                  >
                    {item.amount > 0 ? '+' : ''}
                    {format(item.amount, 'financial')}
                  </span>
                </div>
              );
            })}
            {uniqueSchedules.length > 10 && (
              <span
                style={{
                  fontSize: 11,
                  color: theme.pageTextSubdued,
                  padding: '8px 12px',
                }}
              >
                {t('And {{count}} more...', { count: uniqueSchedules.length - 10 })}
              </span>
            )}
          </div>
        </InsightCard>
      )}

      {/* Reset Button */}
      {hasChanges && (
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center' }}>
          <Button variant="bare" onPress={handleReset}>
            <span style={{ color: theme.errorText, fontSize: 13 }}>
              {t('Reset Scenario')}
            </span>
          </Button>
        </div>
      )}
    </div>
  );
}
