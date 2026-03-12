import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import * as monthUtils from 'loot-core/shared/months';
import type { DetectedPattern } from 'loot-core/types/models';

import { useFormat } from '@desktop-client/hooks/useFormat';

type PatternsListProps = {
  patterns: DetectedPattern[];
  confidenceThreshold: number;
  onTogglePattern?: (patternId: string, enabled: boolean) => void;
  enabledPatterns?: Set<string>;
};

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const { t } = useTranslation();

  const level =
    confidence >= 0.8 ? 'high' : confidence >= 0.6 ? 'medium' : 'low';
  const color =
    level === 'high'
      ? theme.noticeTextLight
      : level === 'medium'
        ? theme.warningText
        : theme.pageTextSubdued;

  return (
    <View
      style={{
        backgroundColor: `${color}20`,
        paddingLeft: 6,
        paddingRight: 6,
        paddingTop: 2,
        paddingBottom: 2,
        borderRadius: 4,
      }}
    >
      <Text style={{ fontSize: 11, color, fontWeight: 500 }}>
        {(confidence * 100).toFixed(0)}%
      </Text>
    </View>
  );
}

function FrequencyBadge({
  frequency,
}: {
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
}) {
  const { t } = useTranslation();

  const labels = {
    weekly: t('Weekly'),
    biweekly: t('Bi-weekly'),
    monthly: t('Monthly'),
    quarterly: t('Quarterly'),
  };

  return (
    <View
      style={{
        backgroundColor: `${theme.pageTextPositive}20`,
        paddingLeft: 6,
        paddingRight: 6,
        paddingTop: 2,
        paddingBottom: 2,
        borderRadius: 4,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          color: theme.pageTextPositive,
          fontWeight: 500,
        }}
      >
        {labels[frequency]}
      </Text>
    </View>
  );
}

export function PatternsList({
  patterns,
  confidenceThreshold,
  onTogglePattern,
  enabledPatterns,
}: PatternsListProps) {
  const { t } = useTranslation();
  const format = useFormat();

  // Sort by confidence (highest first)
  const sortedPatterns = [...patterns].sort((a, b) => b.confidence - a.confidence);

  if (sortedPatterns.length === 0) {
    return (
      <View
        style={{
          padding: 20,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: theme.pageTextSubdued }}>
          {t('No recurring patterns detected')}
        </Text>
        <Text
          style={{
            color: theme.pageTextSubdued,
            fontSize: 12,
            marginTop: 8,
          }}
        >
          {t('Patterns are detected from your transaction history')}
        </Text>
      </View>
    );
  }

  const meetsThreshold = sortedPatterns.filter(
    p => p.confidence >= confidenceThreshold,
  );
  const belowThreshold = sortedPatterns.filter(
    p => p.confidence < confidenceThreshold,
  );

  return (
    <View style={{ gap: 16 }}>
      {/* Patterns that meet threshold */}
      {meetsThreshold.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: theme.pageTextSubdued,
              textTransform: 'uppercase',
            }}
          >
            {t('Included in Forecast')} ({meetsThreshold.length})
          </Text>
          <View style={{ gap: 0 }}>
            {meetsThreshold.map((pattern, index) => {
              const isEnabled = enabledPatterns
                ? enabledPatterns.has(pattern.id)
                : true;

              return (
                <View
                  key={pattern.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: '10px 12px',
                    backgroundColor:
                      index % 2 === 0
                        ? theme.tableBackground
                        : theme.tableRowBackgroundHover,
                    borderRadius: index === 0 ? '4px 4px 0 0' : 0,
                    borderBottomLeftRadius:
                      index === meetsThreshold.length - 1 ? 4 : 0,
                    borderBottomRightRadius:
                      index === meetsThreshold.length - 1 ? 4 : 0,
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 2 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        color: theme.pageText,
                        fontWeight: 500,
                      }}
                    >
                      {pattern.payeeName}
                    </Text>
                    {pattern.categoryName && (
                      <Text
                        style={{
                          fontSize: 11,
                          color: theme.pageTextSubdued,
                          marginTop: 2,
                        }}
                      >
                        {pattern.categoryName}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text
                      style={{
                        fontSize: 13,
                        color:
                          pattern.averageAmount > 0
                            ? theme.noticeTextLight
                            : theme.errorText,
                        fontWeight: 500,
                        ...styles.monoText,
                      }}
                    >
                      {pattern.averageAmount > 0 ? '+' : ''}
                      {format(pattern.averageAmount, 'financial')}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <FrequencyBadge frequency={pattern.frequency} />
                    <ConfidenceBadge confidence={pattern.confidence} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 11,
                        color: theme.pageTextSubdued,
                      }}
                    >
                      {t('Next:')} {monthUtils.format(pattern.nextPredicted, 'MMM d')}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        color: theme.pageTextSubdued,
                      }}
                    >
                      {t('{{count}} occurrences', {
                        count: pattern.occurrenceCount,
                      })}
                    </Text>
                  </View>
                  {onTogglePattern && (
                    <Button
                      variant={isEnabled ? 'normal' : 'bare'}
                      onPress={() => onTogglePattern(pattern.id, !isEnabled)}
                      style={{ padding: '4px 8px' }}
                    >
                      <Text style={{ fontSize: 11 }}>
                        {isEnabled ? t('Exclude') : t('Include')}
                      </Text>
                    </Button>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Patterns below threshold */}
      {belowThreshold.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: theme.pageTextSubdued,
              textTransform: 'uppercase',
            }}
          >
            {t('Below Confidence Threshold')} ({belowThreshold.length})
          </Text>
          <View style={{ gap: 0, opacity: 0.6 }}>
            {belowThreshold.slice(0, 5).map((pattern, index) => (
              <View
                key={pattern.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: '8px 12px',
                  backgroundColor:
                    index % 2 === 0
                      ? theme.tableBackground
                      : theme.tableRowBackgroundHover,
                  borderRadius: index === 0 ? '4px 4px 0 0' : 0,
                  borderBottomLeftRadius:
                    index === Math.min(belowThreshold.length - 1, 4) ? 4 : 0,
                  borderBottomRightRadius:
                    index === Math.min(belowThreshold.length - 1, 4) ? 4 : 0,
                  gap: 12,
                }}
              >
                <View style={{ flex: 2 }}>
                  <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
                    {pattern.payeeName}
                  </Text>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: theme.pageTextSubdued,
                      ...styles.monoText,
                    }}
                  >
                    {format(pattern.averageAmount, 'financial')}
                  </Text>
                </View>
                <FrequencyBadge frequency={pattern.frequency} />
                <ConfidenceBadge confidence={pattern.confidence} />
              </View>
            ))}
            {belowThreshold.length > 5 && (
              <Text
                style={{
                  fontSize: 11,
                  color: theme.pageTextSubdued,
                  padding: 8,
                  textAlign: 'center',
                }}
              >
                {t('And {{count}} more...', {
                  count: belowThreshold.length - 5,
                })}
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}
