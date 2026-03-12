import { send } from 'loot-core/platform/client/connection';
import type { ForecastConfig, ForecastData } from 'loot-core/types/models';

export function createForecastSpreadsheet({
  accountIds,
  forecastDays,
  lowBalanceThreshold,
  baseCurrency,
  includePatterns,
  patternConfidenceThreshold,
  scenario,
}: ForecastConfig) {
  return async (
    _spreadsheet: unknown,
    setData: (data: ForecastData) => void,
  ) => {
    const result = await send('forecast/calculate', {
      config: {
        accountIds,
        forecastDays,
        lowBalanceThreshold,
        baseCurrency,
        includePatterns,
        patternConfidenceThreshold,
        scenario,
      },
    });

    setData(result);
  };
}
