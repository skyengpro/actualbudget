import { useEffect, useRef, useState } from 'react';

import { q } from 'loot-core/shared/query';
import type { Query } from 'loot-core/shared/query';
import type { TransactionTemplateEntity } from 'loot-core/types/models';

import { liveQuery } from '@desktop-client/queries/liveQuery';
import type { LiveQuery } from '@desktop-client/queries/liveQuery';

export type UseTemplatesProps = {
  query?: Query;
};

export type UseTemplatesResult = {
  readonly isLoading: boolean;
  readonly error?: Error;
  readonly templates: readonly TransactionTemplateEntity[];
};

export function useTemplates({
  query,
}: UseTemplatesProps = {}): UseTemplatesResult {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [templates, setTemplates] = useState<
    readonly TransactionTemplateEntity[]
  >([]);

  const queryRef = useRef<LiveQuery<TransactionTemplateEntity> | null>(null);

  useEffect(() => {
    let isUnmounted = false;

    setError(undefined);

    const effectiveQuery =
      query ||
      q('transaction_templates')
        .filter({ tombstone: false, active: true })
        .select('*');

    if (effectiveQuery.state.table !== 'transaction_templates') {
      setError(new Error('Query must be a transaction_templates query.'));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    queryRef.current = liveQuery<TransactionTemplateEntity>(effectiveQuery, {
      onData: data => {
        if (!isUnmounted) {
          setTemplates(data);
          setIsLoading(false);
        }
      },
      onError: err => {
        if (!isUnmounted) {
          setError(err);
          setIsLoading(false);
        }
      },
    });

    return () => {
      isUnmounted = true;
      queryRef.current?.unsubscribe();
    };
  }, [query]);

  return {
    isLoading,
    error,
    templates,
  };
}

export function getTemplatesQuery() {
  return q('transaction_templates')
    .filter({ tombstone: false, active: true })
    .select('*')
    .orderBy('name');
}
