import { useCallback, useEffect, useState } from 'react';

import { send } from 'loot-core/platform/client/connection';
import type {
  PriorityItemEntity,
  PriorityItemStatus,
} from 'loot-core/types/models';

export type UsePriorityItemsProps = {
  status?: PriorityItemStatus;
};

export type UsePriorityItemsResult = {
  readonly items: readonly PriorityItemEntity[];
  readonly isLoading: boolean;
  readonly error?: Error;
  readonly refresh: () => void;
};

/**
 * Fetches priority items by calling the server handler directly. This is
 * safer than `send('query', ...)` because the handler's `ensureTable()` guard
 * creates the table on first call, so the hook works even when the
 * migration hasn't been applied yet to an in-memory DB.
 */
export function usePriorityItems({
  status,
}: UsePriorityItemsProps = {}): UsePriorityItemsResult {
  const [items, setItems] = useState<readonly PriorityItemEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  useEffect(() => {
    let isUnmounted = false;

    setError(undefined);
    setIsLoading(true);

    send('priority-item/list', status ? { status } : {})
      .then(data => {
        if (isUnmounted) return;
        setItems((data as PriorityItemEntity[]) || []);
        setIsLoading(false);
      })
      .catch((err: Error) => {
        if (isUnmounted) return;
        setError(err);
        setIsLoading(false);
      });

    return () => {
      isUnmounted = true;
    };
  }, [status, refreshKey]);

  return { items, isLoading, error, refresh };
}
