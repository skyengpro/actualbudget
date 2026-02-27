// @ts-strict-ignore
import React, { memo, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgDotsHorizontalTriple } from '@actual-app/components/icons/v1';
import { Menu } from '@actual-app/components/menu';
import { Popover } from '@actual-app/components/popover';
import { View } from '@actual-app/components/view';

import { MonthPicker } from './MonthPicker';
import { getScrollbarWidth } from './util';

import { useGlobalPref } from '@desktop-client/hooks/useGlobalPref';
import { pushModal } from '@desktop-client/modals/modalsSlice';
import { useDispatch } from '@desktop-client/redux';

type BudgetPageHeaderProps = {
  startMonth: string;
  onMonthSelect: (month: string) => void;
  numMonths: number;
  monthBounds: ComponentProps<typeof MonthPicker>['monthBounds'];
};

export const BudgetPageHeader = memo<BudgetPageHeaderProps>(
  ({ startMonth, onMonthSelect, numMonths, monthBounds }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [menuOpen, setMenuOpen] = useState(false);
    const triggerRef = useRef(null);
    const [categoryExpandedStatePref] = useGlobalPref('categoryExpandedState');
    const categoryExpandedState = categoryExpandedStatePref ?? 0;
    const offsetMultipleMonths = numMonths === 1 ? 4 : 0;

    const handleMenuSelect = (name: string) => {
      setMenuOpen(false);
      switch (name) {
        case 'budget-templates':
          dispatch(
            pushModal({
              modal: {
                name: 'budget-templates',
                options: { month: startMonth },
              },
            }),
          );
          break;
        case 'budget-scenarios':
          dispatch(
            pushModal({
              modal: {
                name: 'budget-scenarios',
                options: { month: startMonth },
              },
            }),
          );
          break;
      }
    };

    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <View
          style={{
            marginLeft:
              200 + 100 * categoryExpandedState + 5 - offsetMultipleMonths,
            flex: 1,
          }}
        >
          <View
            style={{
              marginRight: 5 + getScrollbarWidth() - offsetMultipleMonths,
            }}
          >
            <MonthPicker
              startMonth={startMonth}
              numDisplayed={numMonths}
              monthBounds={monthBounds}
              style={{ paddingTop: 5 }}
              onSelect={month => onMonthSelect(month)}
            />
          </View>
        </View>
        <View style={{ marginRight: 10 }}>
          <Button
            ref={triggerRef}
            variant="bare"
            onPress={() => setMenuOpen(true)}
            aria-label={t('Budget tools')}
          >
            <SvgDotsHorizontalTriple width={16} height={16} />
          </Button>
          <Popover
            triggerRef={triggerRef}
            isOpen={menuOpen}
            onOpenChange={() => setMenuOpen(false)}
            placement="bottom end"
          >
            <Menu
              onMenuSelect={handleMenuSelect}
              items={[
                {
                  name: 'budget-templates',
                  text: t('Budget templates'),
                },
                {
                  name: 'budget-scenarios',
                  text: t('Budget scenarios'),
                },
              ]}
            />
          </Popover>
        </View>
      </View>
    );
  },
);

BudgetPageHeader.displayName = 'BudgetPageHeader';
