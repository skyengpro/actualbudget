import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';

import {
  SvgChartArea,
  SvgChartBar,
  SvgCheveronDown,
  SvgCheveronRight,
  SvgCog,
  SvgCreditCard,
  SvgFileDouble,
  SvgReports,
  SvgStoreFront,
  SvgTag,
  SvgTuning,
  SvgWallet,
  SvgUserGroup,
} from '@actual-app/components/icons/v1';
import { SvgCalendar3 } from '@actual-app/components/icons/v2';
import { View } from '@actual-app/components/view';

import { Item } from './Item';
import { SecondaryItem } from './SecondaryItem';

import { useFilePermission } from '@desktop-client/hooks/useFilePermission';
import { useIsTestEnv } from '@desktop-client/hooks/useIsTestEnv';
import { useSyncServerStatus } from '@desktop-client/hooks/useSyncServerStatus';

export function PrimaryButtons() {
  const { t } = useTranslation();
  const [isOpen, setOpen] = useState(false);
  const onToggle = useCallback(() => setOpen(open => !open), []);
  const location = useLocation();

  const syncServerStatus = useSyncServerStatus();
  const isTestEnv = useIsTestEnv();
  const isUsingServer = syncServerStatus !== 'no-server' || isTestEnv;
  const { canAccessSettings } = useFilePermission();

  const isActive = [
    '/payees',
    '/rules',
    '/templates',
    '/reimbursements',
    '/reports/insights',
    '/reports/forecast',
    '/bank-sync',
    '/settings',
    '/tools',
  ].some(route => location.pathname.startsWith(route));

  useEffect(() => {
    if (isActive) {
      setOpen(true);
    }
  }, [isActive, location.pathname]);

  return (
    <View style={{ flexShrink: 0 }}>
      <Item title={t('Budget')} Icon={SvgWallet} to="/budget" />
      <Item
        title={t('Reports')}
        Icon={SvgReports}
        to="/reports"
        exact
        forceActive={
          location.pathname.startsWith('/reports') &&
          !location.pathname.startsWith('/reports/insights') &&
          !location.pathname.startsWith('/reports/forecast')
        }
      />
      <Item title={t('Schedules')} Icon={SvgCalendar3} to="/schedules" />
      <Item
        title={t('More')}
        Icon={isOpen ? SvgCheveronDown : SvgCheveronRight}
        onClick={onToggle}
        style={{ marginBottom: isOpen ? 8 : 0 }}
        forceActive={!isOpen && isActive}
      />
      {isOpen && (
        <>
          <SecondaryItem
            title={t('Payees')}
            Icon={SvgStoreFront}
            to="/payees"
            indent={15}
          />
          <SecondaryItem
            title={t('Rules')}
            Icon={SvgTuning}
            to="/rules"
            indent={15}
          />
          <SecondaryItem
            title={t('Templates')}
            Icon={SvgFileDouble}
            to="/templates"
            indent={15}
          />
          <SecondaryItem
            title={t('Reimbursements')}
            Icon={SvgUserGroup}
            to="/reimbursements"
            indent={15}
          />
          <SecondaryItem
            title={t('Insights')}
            Icon={SvgChartBar}
            to="/reports/insights"
            indent={15}
          />
          <SecondaryItem
            title={t('Forecast')}
            Icon={SvgChartArea}
            to="/reports/forecast"
            indent={15}
          />
          {isUsingServer && (
            <SecondaryItem
              title={t('Bank Sync')}
              Icon={SvgCreditCard}
              to="/bank-sync"
              indent={15}
            />
          )}
          <SecondaryItem
            title={t('Tags')}
            Icon={SvgTag}
            to="/tags"
            indent={15}
          />
          {canAccessSettings && (
            <SecondaryItem
              title={t('Settings')}
              Icon={SvgCog}
              to="/settings"
              indent={15}
            />
          )}
        </>
      )}
    </View>
  );
}
