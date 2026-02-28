import { useCallback, useEffect, useRef, useState } from 'react';

import { send } from 'loot-core/platform/client/connection';
import { q } from 'loot-core/shared/query';
import type { Query } from 'loot-core/shared/query';
import type { ReimbursementEntity } from 'loot-core/types/models';

export type UseReimbursementsProps = {
  query?: Query;
};

export type UseReimbursementsResult = {
  readonly isLoading: boolean;
  readonly error?: Error;
  readonly reimbursements: readonly ReimbursementEntity[];
  readonly refresh: () => void;
};

export function useReimbursements({
  query,
}: UseReimbursementsProps = {}): UseReimbursementsResult {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [reimbursements, setReimbursements] = useState<
    readonly ReimbursementEntity[]
  >([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  useEffect(() => {
    let isUnmounted = false;

    setError(undefined);
    setIsLoading(true);

    const effectiveQuery =
      query ||
      q('reimbursements')
        .filter({ tombstone: false })
        .select('*');

    if (effectiveQuery.state.table !== 'reimbursements') {
      setError(new Error('Query must be a reimbursements query.'));
      setIsLoading(false);
      return;
    }

    // Use direct query instead of liveQuery since we bypassed sync system
    send('query', effectiveQuery.serialize()).then(
      ({ data }) => {
        if (isUnmounted) return;

        setReimbursements(data || []);
        setIsLoading(false);
      },
    ).catch(err => {
      if (!isUnmounted) {
        setError(err);
        setIsLoading(false);
      }
    });

    return () => {
      isUnmounted = true;
    };
  }, [query, refreshKey]);

  return {
    isLoading,
    error,
    reimbursements,
    refresh,
  };
}

export function getReimbursementsQuery() {
  return q('reimbursements')
    .filter({ tombstone: false })
    .select('*')
    .orderBy({ date_submitted: 'desc' });
}
