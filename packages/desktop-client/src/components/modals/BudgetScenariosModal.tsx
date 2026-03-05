import { useState } from 'react';
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

import * as monthUtils from 'loot-core/shared/months';
import type { BudgetScenarioEntity, ScenarioComparison, MultiMonthComparison } from 'loot-core/types/models';

import {
  Modal,
  ModalButtons,
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '@desktop-client/components/common/Modal';
import { useFormat } from '@desktop-client/hooks/useFormat';
import {
  useBudgetScenarios,
  useBudgetScenarioMutations,
  useScenarioComparison,
  useMultiMonthComparison,
} from '@desktop-client/hooks/useBudgetScenarios';
import type { Modal as ModalType } from '@desktop-client/modals/modalsSlice';

type BudgetScenariosModalProps = Extract<
  ModalType,
  { name: 'budget-scenarios' }
>['options'];

type MainView = 'menu' | 'snapshots' | 'compare-months';
type SnapshotView = 'list' | 'create' | 'select-month' | 'compare';

// Calendar-style month picker component
function MonthCalendar({
  selectedMonths,
  onToggleMonth,
}: {
  selectedMonths: string[];
  onToggleMonth: (month: string) => void;
}) {
  const currentMonth = monthUtils.currentMonth();
  const currentYear = parseInt(currentMonth.split('-')[0]);
  const [viewYear, setViewYear] = useState(currentYear);

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const getMonthKey = (year: number, monthIndex: number) => {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  };

  const isCurrentMonth = (year: number, monthIndex: number) => {
    return getMonthKey(year, monthIndex) === currentMonth;
  };

  const isFutureMonth = (year: number, monthIndex: number) => {
    return getMonthKey(year, monthIndex) > currentMonth;
  };

  return (
    <View>
      {/* Year Navigation */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          marginBottom: 12,
        }}
      >
        <Button
          variant="bare"
          onPress={() => setViewYear(y => y - 1)}
          style={{ padding: '4px 12px' }}
        >
          <Text style={{ fontSize: 16 }}>←</Text>
        </Button>
        <Text style={{ fontSize: 16, fontWeight: 600, minWidth: 60, textAlign: 'center' }}>
          {viewYear}
        </Text>
        <Button
          variant="bare"
          onPress={() => setViewYear(y => y + 1)}
          style={{ padding: '4px 12px' }}
        >
          <Text style={{ fontSize: 16 }}>→</Text>
        </Button>
      </View>

      {/* Month Grid */}
      <View
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 6,
        }}
      >
        {monthNames.map((name, idx) => {
          const monthKey = getMonthKey(viewYear, idx);
          const isSelected = selectedMonths.includes(monthKey);
          const isCurrent = isCurrentMonth(viewYear, idx);
          const isFuture = isFutureMonth(viewYear, idx);

          return (
            <Button
              key={monthKey}
              variant={isSelected ? 'primary' : 'bare'}
              onPress={() => onToggleMonth(monthKey)}
              style={{
                padding: '10px 8px',
                border: isCurrent
                  ? `2px solid ${theme.pageTextLink}`
                  : `1px solid ${isSelected ? 'transparent' : theme.tableBorder}`,
                opacity: isFuture ? 0.6 : 1,
                borderRadius: 6,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: isCurrent ? 600 : 400 }}>
                {name}
              </Text>
            </Button>
          );
        })}
      </View>
    </View>
  );
}

// Generate list of months for selection (for dropdowns)
function getMonthOptions(): Array<readonly [string, string]> {
  const months: Array<readonly [string, string]> = [];
  const currentMonth = monthUtils.currentMonth();

  for (let i = 24; i >= 0; i--) {
    const month = monthUtils.subMonths(currentMonth, i);
    months.push([month, monthUtils.format(month, 'MMMM yyyy')] as const);
  }

  for (let i = 1; i <= 12; i++) {
    const month = monthUtils.addMonths(currentMonth, i);
    months.push([month, monthUtils.format(month, 'MMMM yyyy')] as const);
  }

  return months;
}

function ScenarioListItem({
  scenario,
  onCompare,
  onDelete,
}: {
  scenario: BudgetScenarioEntity;
  onCompare: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        borderBottom: `1px solid ${theme.tableBorder}`,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: 600, fontSize: 13 }}>{scenario.name}</Text>
        <Text style={{ fontSize: 11, color: theme.pageTextSubdued }}>
          {t('From {{month}}', { month: monthUtils.format(scenario.base_month, 'MMM yyyy') })}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Button variant="primary" onPress={onCompare} style={{ padding: '4px 12px' }}>
          <Trans>Compare</Trans>
        </Button>
        <Button variant="bare" onPress={onDelete} style={{ padding: '4px 8px' }}>
          <Trans>Delete</Trans>
        </Button>
      </View>
    </View>
  );
}

function MultiMonthComparisonView({
  comparison,
  onBack,
}: {
  comparison: MultiMonthComparison;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();

  const { months, best_month, worst_month, average_expenses, average_income } = comparison;

  return (
    <View>
      {/* Summary Cards */}
      <View
        style={{
          flexDirection: 'row',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <View
          style={{
            flex: 1,
            padding: 12,
            backgroundColor: theme.tableRowBackgroundHover,
            borderRadius: 6,
            textAlign: 'center',
          }}
        >
          <Text style={{ fontSize: 11, color: theme.pageTextSubdued }}>
            <Trans>Best Month</Trans>
          </Text>
          <Text style={{ fontWeight: 600, color: theme.noticeTextLight }}>
            {best_month ? monthUtils.format(best_month, 'MMM yyyy') : '-'}
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            padding: 12,
            backgroundColor: theme.tableRowBackgroundHover,
            borderRadius: 6,
            textAlign: 'center',
          }}
        >
          <Text style={{ fontSize: 11, color: theme.pageTextSubdued }}>
            <Trans>Avg Expenses</Trans>
          </Text>
          <Text style={{ fontWeight: 600 }}>
            {format(average_expenses, 'financial')}
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            padding: 12,
            backgroundColor: theme.tableRowBackgroundHover,
            borderRadius: 6,
            textAlign: 'center',
          }}
        >
          <Text style={{ fontSize: 11, color: theme.pageTextSubdued }}>
            <Trans>Avg Income</Trans>
          </Text>
          <Text style={{ fontWeight: 600 }}>
            {format(average_income, 'financial')}
          </Text>
        </View>
      </View>

      {/* Table Header */}
      <View
        style={{
          flexDirection: 'row',
          padding: '8px 10px',
          backgroundColor: theme.tableHeaderBackground,
          borderRadius: '4px 4px 0 0',
          border: `1px solid ${theme.tableBorder}`,
          borderBottom: 'none',
        }}
      >
        <View style={{ width: 90 }}>
          <Text style={{ fontSize: 10, fontWeight: 600, color: theme.tableHeaderText }}>
            <Trans>Month</Trans>
          </Text>
        </View>
        <View style={{ flex: 1, textAlign: 'right' }}>
          <Text style={{ fontSize: 10, fontWeight: 600, color: theme.tableHeaderText }}>
            <Trans>Budgeted</Trans>
          </Text>
        </View>
        <View style={{ flex: 1, textAlign: 'right' }}>
          <Text style={{ fontSize: 10, fontWeight: 600, color: theme.tableHeaderText }}>
            <Trans>Expenses</Trans>
          </Text>
        </View>
        <View style={{ flex: 1, textAlign: 'right' }}>
          <Text style={{ fontSize: 10, fontWeight: 600, color: theme.tableHeaderText }}>
            <Trans>Income</Trans>
          </Text>
        </View>
        <View style={{ flex: 1, textAlign: 'right' }}>
          <Text style={{ fontSize: 10, fontWeight: 600, color: theme.tableHeaderText }}>
            <Trans>Net</Trans>
          </Text>
        </View>
        <View style={{ width: 50, textAlign: 'right' }}>
          <Text style={{ fontSize: 10, fontWeight: 600, color: theme.tableHeaderText }}>
            <Trans>Save%</Trans>
          </Text>
        </View>
      </View>

      {/* Table Body */}
      <View
        style={{
          border: `1px solid ${theme.tableBorder}`,
          borderRadius: '0 0 4px 4px',
          maxHeight: 300,
          overflow: 'auto',
        }}
      >
        {months.map((m, idx) => (
          <View
            key={m.month}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: '8px 10px',
              borderBottom: idx < months.length - 1 ? `1px solid ${theme.tableBorder}` : 'none',
              backgroundColor: m.month === best_month
                ? 'rgba(76, 175, 80, 0.1)'
                : m.month === worst_month
                  ? 'rgba(244, 67, 54, 0.1)'
                  : 'transparent',
            }}
          >
            <View style={{ width: 90 }}>
              <Text style={{ fontSize: 12, fontWeight: 500 }}>
                {monthUtils.format(m.month, 'MMM yyyy')}
              </Text>
            </View>
            <View style={{ flex: 1, textAlign: 'right' }}>
              <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
                {format(m.expenses_budgeted, 'financial')}
              </Text>
            </View>
            <View style={{ flex: 1, textAlign: 'right' }}>
              <Text style={{ fontSize: 12 }}>
                {format(m.expenses_actual, 'financial')}
              </Text>
            </View>
            <View style={{ flex: 1, textAlign: 'right' }}>
              <Text style={{ fontSize: 12, color: theme.noticeTextLight }}>
                {format(m.income_actual, 'financial')}
              </Text>
            </View>
            <View style={{ flex: 1, textAlign: 'right' }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: m.net_actual >= 0 ? theme.noticeTextLight : theme.errorText,
                }}
              >
                {m.net_actual >= 0 ? '+' : ''}{format(m.net_actual, 'financial')}
              </Text>
            </View>
            <View style={{ width: 50, textAlign: 'right' }}>
              <Text
                style={{
                  fontSize: 11,
                  color: m.savings_rate >= 20
                    ? theme.noticeTextLight
                    : m.savings_rate >= 0
                      ? theme.pageText
                      : theme.errorText,
                }}
              >
                {m.savings_rate}%
              </Text>
            </View>
          </View>
        ))}
      </View>

      <ModalButtons style={{ marginTop: 16 }}>
        <Button variant="bare" onPress={onBack}>
          <Trans>Back</Trans>
        </Button>
      </ModalButtons>
    </View>
  );
}

function ComparisonView({
  comparison,
  compareMonth,
  onBack,
  onChangeMonth,
}: {
  comparison: ScenarioComparison;
  compareMonth: string;
  onBack: () => void;
  onChangeMonth: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();

  const { scenario, differences, total_current, total_scenario, total_difference } = comparison;

  return (
    <View>
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontWeight: 600, fontSize: 14 }}>{scenario.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: theme.pageTextSubdued }}>
            {monthUtils.format(scenario.base_month, 'MMM yyyy')} vs {monthUtils.format(compareMonth, 'MMM yyyy')}
          </Text>
          <Button variant="bare" onPress={onChangeMonth} style={{ padding: '2px 6px' }}>
            <Text style={{ fontSize: 10, color: theme.pageTextLink }}>Change</Text>
          </Button>
        </View>
      </View>

      {/* Summary */}
      <View
        style={{
          flexDirection: 'row',
          gap: 12,
          padding: 10,
          backgroundColor: theme.tableBackground,
          borderRadius: 4,
          marginBottom: 12,
        }}
      >
        <View style={{ flex: 1, textAlign: 'center' }}>
          <Text style={{ fontSize: 10, color: theme.pageTextSubdued }}>Scenario</Text>
          <Text style={{ fontWeight: 600, fontSize: 13 }}>{format(total_scenario, 'financial')}</Text>
        </View>
        <View style={{ flex: 1, textAlign: 'center' }}>
          <Text style={{ fontSize: 10, color: theme.pageTextSubdued }}>Budget</Text>
          <Text style={{ fontWeight: 600, fontSize: 13 }}>{format(total_current, 'financial')}</Text>
        </View>
        <View style={{ flex: 1, textAlign: 'center' }}>
          <Text style={{ fontSize: 10, color: theme.pageTextSubdued }}>Diff</Text>
          <Text
            style={{
              fontWeight: 600,
              fontSize: 13,
              color: total_difference > 0 ? theme.noticeTextLight : total_difference < 0 ? theme.errorText : theme.pageText,
            }}
          >
            {total_difference > 0 ? '+' : ''}{format(total_difference, 'financial')}
          </Text>
        </View>
      </View>

      {/* Differences List */}
      {differences.length === 0 ? (
        <View style={{ padding: 16, textAlign: 'center' }}>
          <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
            <Trans>No differences found.</Trans>
          </Text>
        </View>
      ) : (
        <View
          style={{
            border: `1px solid ${theme.tableBorder}`,
            borderRadius: 4,
            maxHeight: 200,
            overflow: 'auto',
          }}
        >
          {differences.slice(0, 10).map(diff => (
            <View
              key={diff.category_id}
              style={{
                flexDirection: 'row',
                padding: '6px 10px',
                borderBottom: `1px solid ${theme.tableBorder}`,
              }}
            >
              <View style={{ flex: 2 }}>
                <Text style={{ fontSize: 12 }}>{diff.category_name}</Text>
              </View>
              <View style={{ flex: 1, textAlign: 'right' }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: diff.difference > 0 ? theme.noticeTextLight : theme.errorText,
                  }}
                >
                  {diff.difference > 0 ? '+' : ''}{format(diff.difference, 'financial')}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <ModalButtons style={{ marginTop: 16 }}>
        <Button variant="bare" onPress={onBack}>
          <Trans>Back</Trans>
        </Button>
      </ModalButtons>
    </View>
  );
}

export function BudgetScenariosModal({ month }: BudgetScenariosModalProps) {
  const { t } = useTranslation();
  const { data: scenarios = [], isLoading } = useBudgetScenarios();
  const { cloneCurrentBudget, deleteScenario, isCloning } = useBudgetScenarioMutations();

  const [mainView, setMainView] = useState<MainView>('menu');
  const [snapshotView, setSnapshotView] = useState<SnapshotView>('list');
  const [newScenarioName, setNewScenarioName] = useState('');
  const [newScenarioDescription, setNewScenarioDescription] = useState('');
  const [captureMonth, setCaptureMonth] = useState(month || monthUtils.currentMonth());
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [compareMonth, setCompareMonth] = useState(month || monthUtils.currentMonth());
  const [error, setError] = useState<string | null>(null);

  // Multi-month comparison state
  const [selectedMonths, setSelectedMonths] = useState<string[]>(() => {
    const current = monthUtils.currentMonth();
    return [
      monthUtils.subMonths(current, 2),
      monthUtils.subMonths(current, 1),
      current,
    ];
  });
  const [showMultiMonthResults, setShowMultiMonthResults] = useState(false);

  const { data: comparison } = useScenarioComparison(selectedScenarioId, compareMonth);
  const { data: multiComparison } = useMultiMonthComparison(
    showMultiMonthResults ? selectedMonths : []
  );

  const monthOptions = getMonthOptions();

  const handleCreateScenario = async () => {
    if (!newScenarioName.trim()) {
      setError(t('Scenario name is required'));
      return;
    }
    setError(null);
    cloneCurrentBudget(
      { name: newScenarioName.trim(), description: newScenarioDescription.trim() || undefined, month: captureMonth },
      {
        onSuccess: () => {
          setNewScenarioName('');
          setNewScenarioDescription('');
          setSnapshotView('list');
        },
        onError: () => setError(t('Failed to create snapshot')),
      },
    );
  };

  const handleDeleteScenario = (scenarioId: string) => {
    if (window.confirm(t('Delete this snapshot?'))) {
      deleteScenario(scenarioId);
    }
  };

  const toggleMonth = (m: string) => {
    setSelectedMonths(prev => {
      if (prev.includes(m)) {
        return prev.filter(x => x !== m);
      }
      return [...prev, m].sort();
    });
  };

  return (
    <Modal name="budget-scenarios">
      {({ state: { close } }) => (
        <>
          <ModalHeader
            title={<ModalTitle title={t('Budget Analysis')} />}
            rightContent={<ModalCloseButton onPress={close} />}
          />

          <View style={{ padding: 20, minWidth: 700, minHeight: 450 }}>
            {error && <FormError>{error}</FormError>}

            {/* Main Menu */}
            {mainView === 'menu' && (
              <View style={{ gap: 12 }}>
                <Text style={{ fontSize: 12, color: theme.pageTextSubdued, marginBottom: 8 }}>
                  <Trans>Analyze your budget across different time periods.</Trans>
                </Text>

                <Button
                  variant="primary"
                  onPress={() => setMainView('compare-months')}
                  style={{ width: '100%', padding: 12 }}
                >
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontWeight: 600 }}><Trans>Compare Multiple Months</Trans></Text>
                    <Text style={{ fontSize: 11, opacity: 0.8 }}>
                      <Trans>See budgeted vs actual expenses across months</Trans>
                    </Text>
                  </View>
                </Button>

                <Button
                  variant="normal"
                  onPress={() => { setMainView('snapshots'); setSnapshotView('list'); }}
                  style={{ width: '100%', padding: 12 }}
                >
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontWeight: 600 }}><Trans>Budget Snapshots</Trans></Text>
                    <Text style={{ fontSize: 11, color: theme.pageTextSubdued }}>
                      <Trans>Save & compare budget configurations</Trans>
                    </Text>
                  </View>
                </Button>
              </View>
            )}

            {/* Multi-Month Comparison */}
            {mainView === 'compare-months' && !showMultiMonthResults && (
              <View>
                <Text style={{ fontSize: 12, color: theme.pageTextSubdued, marginBottom: 12 }}>
                  <Trans>Select months to compare (click to toggle):</Trans>
                </Text>

                <MonthCalendar
                  selectedMonths={selectedMonths}
                  onToggleMonth={toggleMonth}
                />

                <View style={{ marginTop: 16, marginBottom: 12 }}>
                  <Text style={{ fontSize: 11, color: theme.pageTextSubdued }}>
                    {t('{{count}} months selected', { count: selectedMonths.length })}
                    {selectedMonths.length > 0 && (
                      <>: {selectedMonths.sort().map(m => monthUtils.format(m, 'MMM yyyy')).join(', ')}</>
                    )}
                  </Text>
                </View>

                <ModalButtons>
                  <Button variant="bare" onPress={() => setMainView('menu')}>
                    <Trans>Back</Trans>
                  </Button>
                  <Button
                    variant="primary"
                    isDisabled={selectedMonths.length < 2}
                    onPress={() => setShowMultiMonthResults(true)}
                  >
                    <Trans>Compare</Trans>
                  </Button>
                </ModalButtons>
              </View>
            )}

            {mainView === 'compare-months' && showMultiMonthResults && multiComparison && (
              <MultiMonthComparisonView
                comparison={multiComparison}
                onBack={() => setShowMultiMonthResults(false)}
              />
            )}

            {/* Snapshots Views */}
            {mainView === 'snapshots' && snapshotView === 'list' && (
              <>
                <View style={{ marginBottom: 12 }}>
                  <Button
                    variant="primary"
                    onPress={() => setSnapshotView('create')}
                    style={{ width: '100%' }}
                  >
                    <Trans>Capture New Snapshot</Trans>
                  </Button>
                </View>

                {isLoading ? (
                  <Text style={{ padding: 16, textAlign: 'center' }}><Trans>Loading...</Trans></Text>
                ) : scenarios.length === 0 ? (
                  <Text style={{ padding: 16, textAlign: 'center', color: theme.pageTextSubdued, fontSize: 12 }}>
                    <Trans>No snapshots yet.</Trans>
                  </Text>
                ) : (
                  <View style={{ border: `1px solid ${theme.tableBorder}`, borderRadius: 4, maxHeight: 250, overflow: 'auto' }}>
                    {scenarios.map(s => (
                      <ScenarioListItem
                        key={s.id}
                        scenario={s}
                        onCompare={() => {
                          setSelectedScenarioId(s.id);
                          setSnapshotView('select-month');
                        }}
                        onDelete={() => handleDeleteScenario(s.id)}
                      />
                    ))}
                  </View>
                )}

                <ModalButtons style={{ marginTop: 12 }}>
                  <Button variant="bare" onPress={() => setMainView('menu')}>
                    <Trans>Back</Trans>
                  </Button>
                </ModalButtons>
              </>
            )}

            {mainView === 'snapshots' && snapshotView === 'create' && (
              <>
                <InlineField label={t('Name')} width="100%">
                  <InitialFocus>
                    <Input value={newScenarioName} onChangeValue={setNewScenarioName} placeholder={t('e.g., December Budget')} />
                  </InitialFocus>
                </InlineField>
                <InlineField label={t('From Month')} width="100%" style={{ marginTop: 10 }}>
                  <Select value={captureMonth} onChange={(v: string) => setCaptureMonth(v)} options={monthOptions} />
                </InlineField>
                <ModalButtons style={{ marginTop: 16 }}>
                  <Button variant="bare" onPress={() => setSnapshotView('list')}><Trans>Cancel</Trans></Button>
                  <Button variant="primary" isDisabled={isCloning} onPress={handleCreateScenario}>
                    {isCloning ? <Trans>Saving...</Trans> : <Trans>Save Snapshot</Trans>}
                  </Button>
                </ModalButtons>
              </>
            )}

            {mainView === 'snapshots' && snapshotView === 'select-month' && (
              <>
                <InlineField label={t('Compare with')} width="100%">
                  <Select value={compareMonth} onChange={(v: string) => setCompareMonth(v)} options={monthOptions} />
                </InlineField>
                <ModalButtons style={{ marginTop: 16 }}>
                  <Button variant="bare" onPress={() => setSnapshotView('list')}><Trans>Cancel</Trans></Button>
                  <Button variant="primary" onPress={() => setSnapshotView('compare')}><Trans>Compare</Trans></Button>
                </ModalButtons>
              </>
            )}

            {mainView === 'snapshots' && snapshotView === 'compare' && comparison && (
              <ComparisonView
                comparison={comparison}
                compareMonth={compareMonth}
                onBack={() => setSnapshotView('list')}
                onChangeMonth={() => setSnapshotView('select-month')}
              />
            )}
          </View>
        </>
      )}
    </Modal>
  );
}
