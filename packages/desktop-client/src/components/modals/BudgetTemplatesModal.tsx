import { useState, useMemo } from 'react';
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
import type { BudgetTemplateEntity, BudgetTemplateData } from 'loot-core/types/models';

import {
  Modal,
  ModalButtons,
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '@desktop-client/components/common/Modal';
import {
  useBudgetTemplates,
  useBudgetTemplateMutations,
} from '@desktop-client/hooks/useBudgetTemplates';
import { closeModal } from '@desktop-client/modals/modalsSlice';
import type { Modal as ModalType } from '@desktop-client/modals/modalsSlice';
import { useDispatch } from '@desktop-client/redux';

type BudgetTemplatesModalProps = Extract<
  ModalType,
  { name: 'budget-templates' }
>['options'];

type ViewMode = 'list' | 'save' | 'apply';

function TemplateListItem({
  template,
  onApply,
  onDelete,
}: {
  template: BudgetTemplateEntity;
  onApply: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  let categoryCount = 0;
  try {
    const data: BudgetTemplateData = JSON.parse(template.data);
    categoryCount = Object.keys(data.categories || {}).length;
  } catch {
    // Ignore parse errors
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: `1px solid ${theme.tableBorder}`,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: 600 }}>{template.name}</Text>
        {template.description && (
          <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
            {template.description}
          </Text>
        )}
        <Text style={{ fontSize: 11, color: theme.pageTextSubdued }}>
          {t('{{count}} categories', { count: categoryCount })}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button variant="primary" onPress={onApply}>
          <Trans>Apply</Trans>
        </Button>
        <Button variant="bare" onPress={onDelete}>
          <Trans>Delete</Trans>
        </Button>
      </View>
    </View>
  );
}

export function BudgetTemplatesModal({
  month,
}: BudgetTemplatesModalProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { data: templates = [], isLoading } = useBudgetTemplates();
  const {
    saveCurrentAsTempate,
    applyTemplate,
    deleteTemplate,
    isSaving,
    isApplying,
  } = useBudgetTemplateMutations();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<BudgetTemplateEntity | null>(null);
  const [applyMonth, setApplyMonth] = useState<string>(month || monthUtils.currentMonth());
  const [sourceMonth, setSourceMonth] = useState<string>(month || monthUtils.currentMonth());

  // Generate list of current and future months (next 12 months) for applying
  const futureMonths = useMemo(() => {
    const currentMonth = monthUtils.currentMonth();
    const months: Array<{ value: string; label: string }> = [];

    for (let i = 0; i < 12; i++) {
      const m = monthUtils.addMonths(currentMonth, i);
      months.push({
        value: m,
        label: monthUtils.format(m, 'MMMM yyyy'),
      });
    }

    return months;
  }, []);

  // Generate list of past months (last 12 months including current) for saving
  const pastMonths = useMemo(() => {
    const currentMonth = monthUtils.currentMonth();
    const months: Array<{ value: string; label: string }> = [];

    for (let i = 0; i < 12; i++) {
      const m = monthUtils.subMonths(currentMonth, i);
      months.push({
        value: m,
        label: monthUtils.format(m, 'MMMM yyyy'),
      });
    }

    return months;
  }, []);

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) {
      setError(t('Template name is required'));
      return;
    }

    setError(null);
    saveCurrentAsTempate(
      {
        name: newTemplateName.trim(),
        description: newTemplateDescription.trim() || undefined,
        month: sourceMonth,
      },
      {
        onSuccess: () => {
          setNewTemplateName('');
          setNewTemplateDescription('');
          setSourceMonth(month || monthUtils.currentMonth());
          setViewMode('list');
        },
        onError: () => {
          setError(t('Failed to save template'));
        },
      },
    );
  };

  const handleSelectTemplateToApply = (template: BudgetTemplateEntity) => {
    setSelectedTemplate(template);
    setApplyMonth(month || monthUtils.currentMonth());
    setViewMode('apply');
    setError(null);
  };

  const handleApplyTemplate = () => {
    if (!selectedTemplate) return;

    // Validate that the selected month is not in the past
    const currentMonth = monthUtils.currentMonth();
    if (applyMonth < currentMonth) {
      setError(t('Cannot apply template to past months'));
      return;
    }

    applyTemplate(
      { id: selectedTemplate.id, month: applyMonth },
      {
        onSuccess: () => {
          dispatch(closeModal());
        },
        onError: () => {
          setError(t('Failed to apply template'));
        },
      },
    );
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (window.confirm(t('Are you sure you want to delete this template?'))) {
      deleteTemplate(templateId);
    }
  };

  return (
    <Modal name="budget-templates">
      {({ state: { close } }) => (
        <>
          <ModalHeader
            title={<ModalTitle title={t('Budget Templates')} />}
            rightContent={<ModalCloseButton onPress={close} />}
          />

          <View style={{ padding: 20, minWidth: 400 }}>
            {error && <FormError>{error}</FormError>}

            {viewMode === 'list' && (
              <>
                <View style={{ marginBottom: 16 }}>
                  <Button
                    variant="primary"
                    onPress={() => setViewMode('save')}
                    style={{ width: '100%' }}
                  >
                    <Trans>Save Current Budget as Template</Trans>
                  </Button>
                </View>

                {isLoading ? (
                  <View style={{ padding: 20, textAlign: 'center' }}>
                    <Trans>Loading templates...</Trans>
                  </View>
                ) : templates.length === 0 ? (
                  <View
                    style={{
                      padding: 20,
                      textAlign: 'center',
                      color: theme.pageTextSubdued,
                    }}
                  >
                    <Trans>
                      No templates yet. Save your current budget as a template
                      to reuse it later.
                    </Trans>
                  </View>
                ) : (
                  <View
                    style={{
                      border: `1px solid ${theme.tableBorder}`,
                      borderRadius: 4,
                      maxHeight: 300,
                      overflow: 'auto',
                    }}
                  >
                    {templates.map(template => (
                      <TemplateListItem
                        key={template.id}
                        template={template}
                        onApply={() => handleSelectTemplateToApply(template)}
                        onDelete={() => handleDeleteTemplate(template.id)}
                      />
                    ))}
                  </View>
                )}
              </>
            )}

            {viewMode === 'apply' && selectedTemplate && (
              <>
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontWeight: 600, marginBottom: 4 }}>
                    <Trans>Applying template:</Trans> {selectedTemplate.name}
                  </Text>
                  {selectedTemplate.description && (
                    <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
                      {selectedTemplate.description}
                    </Text>
                  )}
                </View>

                <InlineField label={t('Apply to month')} width="100%">
                  <Select
                    value={applyMonth}
                    onChange={(value: string) => setApplyMonth(value)}
                    options={futureMonths.map(m => [m.value, m.label])}
                    style={{ flex: 1 }}
                  />
                </InlineField>

                <Text
                  style={{
                    fontSize: 12,
                    color: theme.pageTextSubdued,
                    marginTop: 8,
                  }}
                >
                  <Trans>
                    Note: Templates can only be applied to the current month or
                    future months.
                  </Trans>
                </Text>

                <ModalButtons style={{ marginTop: 20 }}>
                  <Button
                    variant="bare"
                    onPress={() => {
                      setViewMode('list');
                      setSelectedTemplate(null);
                      setError(null);
                    }}
                  >
                    <Trans>Cancel</Trans>
                  </Button>
                  <Button
                    variant="primary"
                    isDisabled={isApplying}
                    onPress={handleApplyTemplate}
                  >
                    {isApplying ? (
                      <Trans>Applying...</Trans>
                    ) : (
                      <Trans>Apply Template</Trans>
                    )}
                  </Button>
                </ModalButtons>
              </>
            )}

            {viewMode === 'save' && (
              <>
                <InlineField label={t('Source Month')} width="100%">
                  <Select
                    value={sourceMonth}
                    onChange={(value: string) => setSourceMonth(value)}
                    options={pastMonths.map(m => [m.value, m.label])}
                    style={{ flex: 1 }}
                  />
                </InlineField>

                <Text
                  style={{
                    fontSize: 12,
                    color: theme.pageTextSubdued,
                    marginTop: 4,
                    marginBottom: 12,
                  }}
                >
                  <Trans>
                    Select the month whose budget you want to save as a template.
                  </Trans>
                </Text>

                <InlineField label={t('Template Name')} width="100%">
                  <InitialFocus>
                    <Input
                      value={newTemplateName}
                      onChangeValue={setNewTemplateName}
                      placeholder={t('e.g., Normal Month, Holiday Budget')}
                    />
                  </InitialFocus>
                </InlineField>

                <InlineField
                  label={t('Description (optional)')}
                  width="100%"
                  style={{ marginTop: 12 }}
                >
                  <Input
                    value={newTemplateDescription}
                    onChangeValue={setNewTemplateDescription}
                    placeholder={t('Brief description of this template')}
                  />
                </InlineField>

                <ModalButtons style={{ marginTop: 20 }}>
                  <Button
                    variant="bare"
                    onPress={() => {
                      setViewMode('list');
                      setError(null);
                    }}
                  >
                    <Trans>Cancel</Trans>
                  </Button>
                  <Button
                    variant="primary"
                    isDisabled={isSaving}
                    onPress={handleSaveTemplate}
                  >
                    {isSaving ? <Trans>Saving...</Trans> : <Trans>Save Template</Trans>}
                  </Button>
                </ModalButtons>
              </>
            )}
          </View>
        </>
      )}
    </Modal>
  );
}
