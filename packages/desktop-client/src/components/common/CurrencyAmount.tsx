import React from 'react';

import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { integerToCurrency, getNumberFormat } from 'loot-core/shared/util';

import { useFormat } from '@desktop-client/hooks/useFormat';

type CurrencyAmountProps = {
  value: number;
  showSign?: boolean;
  style?: React.CSSProperties;
  amountStyle?: React.CSSProperties;
  symbolStyle?: React.CSSProperties;
  colorize?: boolean;
};

/**
 * Displays an amount with the currency symbol in a smaller font size.
 * Use this component when you want the currency indicator to be less prominent.
 */
export function CurrencyAmount({
  value,
  showSign = false,
  style,
  amountStyle,
  symbolStyle,
  colorize = false,
}: CurrencyAmountProps) {
  const format = useFormat();
  const currency = format.currency;

  // Get the formatted number without currency symbol
  // Use currency.decimalPlaces for display formatting, but always divide by 100
  // since Actual stores all amounts internally as cents (2 decimal places)
  const formatter = getNumberFormat({
    format: undefined,
    decimalPlaces: currency.decimalPlaces,
  }).formatter;
  const formattedNumber = integerToCurrency(value, formatter, 2);

  // Determine sign
  const isPositive = value > 0;
  const isNegative = value < 0;
  let displayNumber = formattedNumber;
  if (isNegative) {
    displayNumber = formattedNumber.replace('-', '');
  }

  // Determine color
  let textColor = theme.pageText;
  if (colorize) {
    if (isPositive) textColor = theme.noticeTextLight;
    if (isNegative) textColor = theme.errorText;
  }

  const sign = isNegative ? '-' : showSign && isPositive ? '+' : '';

  const defaultSymbolStyle: React.CSSProperties = {
    fontSize: '0.7em',
    opacity: 0.7,
    marginLeft: currency.symbolFirst ? 0 : 3,
    marginRight: currency.symbolFirst ? 3 : 0,
  };

  if (!currency.symbol) {
    // No currency configured, just show the number
    return (
      <Text style={{ ...styles.monoText, color: textColor, ...style, ...amountStyle }}>
        {sign}{formattedNumber}
      </Text>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', ...style }}>
      {currency.symbolFirst && (
        <Text style={{ color: textColor, ...defaultSymbolStyle, ...symbolStyle }}>
          {currency.symbol}
        </Text>
      )}
      <Text style={{ ...styles.monoText, color: textColor, ...amountStyle }}>
        {sign}{displayNumber}
      </Text>
      {!currency.symbolFirst && (
        <Text style={{ color: textColor, ...defaultSymbolStyle, ...symbolStyle }}>
          {currency.symbol}
        </Text>
      )}
    </View>
  );
}
