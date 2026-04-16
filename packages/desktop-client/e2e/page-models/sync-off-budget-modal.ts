import type { Locator, Page } from '@playwright/test';

export class SyncOffBudgetModal {
  readonly page: Page;
  readonly locator: Locator;
  readonly heading: Locator;
  readonly fromSelect: Locator;
  readonly toSelect: Locator;
  readonly transactionTable: Locator;
  readonly transactionRows: Locator;
  readonly selectAllButton: Locator;
  readonly syncButton: Locator;
  readonly cancelButton: Locator;
  readonly errorMessage: Locator;
  readonly transactionCount: Locator;

  constructor(locator: Locator) {
    this.locator = locator;
    this.page = locator.page();

    this.heading = locator.getByRole('heading');
    this.fromSelect = locator.locator('select').first();
    this.toSelect = locator.locator('select').last();
    this.transactionTable = locator.locator('table');
    this.transactionRows = this.transactionTable.locator('tbody tr');
    this.selectAllButton = locator.getByRole('button', {
      name: /Select All|Deselect All/,
    });
    this.syncButton = locator.getByRole('button', {
      name: /Sync Transactions|Syncing/,
    });
    this.cancelButton = locator.getByRole('button', { name: 'Cancel' });
    this.errorMessage = locator.locator('[style*="errorText"]');
    this.transactionCount = locator.locator(
      'span[style*="pageTextPositive"]',
    );
  }

  async selectFromAccount(accountName: string) {
    await this.fromSelect.selectOption({ label: accountName });
  }

  async selectToAccount(accountName: string) {
    await this.toSelect.selectOption({ label: accountName });
  }

  async selectTransaction(index: number) {
    const row = this.transactionRows.nth(index);
    const checkbox = row.locator('input[type="checkbox"]');
    await checkbox.click();
  }

  async assignCategory(index: number, categoryName: string) {
    const row = this.transactionRows.nth(index);
    // Click the category cell to open the autocomplete
    const categoryCell = row.locator('td').last();
    await categoryCell.click();

    // Type in the category autocomplete
    const autocompleteInput = this.page.getByRole('textbox');
    await autocompleteInput.fill(categoryName);
    await this.page.keyboard.press('Enter');
  }

  async sync() {
    await this.syncButton.click();
  }

  async cancel() {
    await this.cancelButton.click();
  }

  async getTransactionCount(): Promise<number> {
    const countText = await this.transactionCount.textContent();
    return parseInt(countText || '0', 10);
  }

  async getError(): Promise<string | null> {
    const errorLocator = this.locator.locator('div').filter({
      hasText: /^[^]*$/,
    }).locator('[style*="errorText"], [style*="error"]');

    if (await errorLocator.count() > 0) {
      return await errorLocator.first().textContent();
    }
    return null;
  }

  async close() {
    await this.heading.getByRole('button', { name: 'Close' }).click();
  }

  async toggleSelectAll() {
    await this.selectAllButton.click();
  }

  async waitForTransactionsLoaded() {
    await this.transactionTable.waitFor({ state: 'visible' });
  }
}
