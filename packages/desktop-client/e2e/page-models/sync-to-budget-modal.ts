import type { Locator, Page } from '@playwright/test';

export class SyncToBudgetModal {
  readonly page: Page;
  readonly locator: Locator;
  readonly heading: Locator;
  readonly closeButton: Locator;

  // Step indicators
  readonly stepIndicators: Locator;

  // Step 1: Account Selection
  readonly fromAccountSelect: Locator;
  readonly toAccountSelect: Locator;

  // Step 2: Transaction Selection
  readonly transactionTable: Locator;
  readonly transactionRows: Locator;
  readonly selectAllButton: Locator;
  readonly transactionCountBadge: Locator;

  // Step 3: Preview
  readonly budgetImpactSection: Locator;

  // Step 4: Confirm
  readonly syncSummary: Locator;
  readonly successNotification: Locator;

  // Common buttons
  readonly nextButton: Locator;
  readonly backButton: Locator;
  readonly cancelButton: Locator;
  readonly previewButton: Locator;
  readonly confirmButton: Locator;
  readonly syncButton: Locator;
  readonly doneButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // Modal has data-testid="sync-to-budget-modal"
    this.locator = page.locator('[data-testid="sync-to-budget-modal"]');

    this.heading = this.locator.getByRole('heading', { name: 'Sync to Budget' });
    this.closeButton = this.locator.getByRole('button', { name: 'Close' });

    // Step indicators (numbered circles)
    this.stepIndicators = this.locator.locator('[class*="step"]');

    // Step 1: Account Selection - use role selectors for Select components
    this.fromAccountSelect = this.locator.getByRole('button').filter({
      has: page.locator('text=/Select off-budget account|Investment Account|Savings Account|Vanguard 401k|Roth IRA|Mortgage|House Asset/'),
    }).first();
    this.toAccountSelect = this.locator.getByRole('button').filter({
      has: page.locator('text=/Select on-budget account|Bank of America|Ally Savings|Capital One Checking|HSBC/'),
    }).first();

    // Step 2: Transaction Selection
    this.transactionTable = this.locator.locator('table');
    this.transactionRows = this.transactionTable.locator('tbody tr');
    this.selectAllButton = this.locator.getByRole('button', {
      name: /Select All|Deselect All/,
    });
    this.transactionCountBadge = this.locator.locator(
      'span[style*="pageTextPositive"]',
    );

    // Step 3: Preview
    this.budgetImpactSection = this.locator.getByText('Budget Impact');

    // Step 4: Confirm
    this.syncSummary = this.locator.getByText('Transactions to sync');
    this.successNotification = this.locator.getByText(/successfully synced/i);

    // Common navigation buttons
    this.nextButton = this.locator.getByRole('button', { name: 'Next' });
    this.backButton = this.locator.getByRole('button', { name: 'Back' });
    this.cancelButton = this.locator.getByRole('button', { name: 'Cancel' });
    this.previewButton = this.locator.getByRole('button', { name: 'Preview' });
    this.confirmButton = this.locator.getByRole('button', { name: 'Confirm' });
    this.syncButton = this.locator.getByRole('button', {
      name: /Sync to Budget|Syncing/,
    });
    this.doneButton = this.locator.getByRole('button', { name: 'Done' });
  }

  async waitFor() {
    await this.heading.waitFor({ state: 'visible' });
  }

  // Step 1: Account Selection methods
  async selectFromAccount(accountName: string) {
    // The Select component uses a Button + Popover + Menu pattern
    // Click the FROM dropdown button (it's the button that contains the placeholder text or current value)
    const fromDropdownButton = this.locator.getByRole('button').filter({
      hasText: /Select off-budget account|Roth IRA|Vanguard 401k|Investment Account|Mortgage|House Asset/,
    }).first();
    await fromDropdownButton.click();

    // Wait for popover menu and click the account - menu items are buttons
    await this.page.waitForTimeout(100);
    await this.page.getByRole('button', { name: accountName, exact: true }).click();
  }

  async selectToAccount(accountName: string) {
    // The Select component uses a Button + Popover + Menu pattern
    // Click the TO dropdown button
    const toDropdownButton = this.locator.getByRole('button').filter({
      hasText: /Select on-budget account|Bank of America|Ally Savings|Capital One Checking|HSBC/,
    }).first();
    await toDropdownButton.click();

    // Wait for popover menu and click the account - menu items are buttons
    await this.page.waitForTimeout(100);
    await this.page.getByRole('button', { name: accountName, exact: true }).click();
  }

  async goToTransactionStep() {
    await this.nextButton.click();
    // Wait for transactions to load
    await this.page.waitForTimeout(500);
  }

  // Step 2: Transaction Selection methods
  async waitForTransactionsLoaded() {
    // Wait for table to be visible
    await this.transactionTable.waitFor({ state: 'visible', timeout: 10000 });
  }

  async getTransactionCount(): Promise<number> {
    return await this.transactionRows.count();
  }

  async toggleTransaction(index: number) {
    const row = this.transactionRows.nth(index);
    const checkbox = row.locator('input[type="checkbox"]');
    await checkbox.click();
  }

  async toggleAllTransactions() {
    await this.selectAllButton.click();
  }

  async isTransactionSelected(index: number): Promise<boolean> {
    const row = this.transactionRows.nth(index);
    const checkbox = row.locator('input[type="checkbox"]');
    return await checkbox.isChecked();
  }

  async assignCategoryToTransaction(index: number, categoryName: string) {
    const row = this.transactionRows.nth(index);
    // Click on the last cell (category cell)
    const categoryCell = row.locator('td').last();
    await categoryCell.click();

    // Wait for autocomplete to open
    await this.page.waitForTimeout(100);

    // Type the category name and select it
    await this.page.keyboard.type(categoryName);
    await this.page.keyboard.press('Enter');
  }

  async goToPreviewStep() {
    await this.previewButton.click();
    // Wait for preview to calculate
    await this.page.waitForTimeout(500);
  }

  // Step 3: Preview methods
  async waitForPreviewLoaded() {
    // Wait for the budget impact to be visible
    await this.page.getByText(/Budget Impact|Calculating/i).waitFor({
      state: 'visible',
      timeout: 10000,
    });
  }

  async getCategoryImpacts(): Promise<Array<{ category: string; amount: string }>> {
    const impacts: Array<{ category: string; amount: string }> = [];
    // Find category impact rows in the preview
    const impactRows = this.locator.locator('[data-testid="budget-impact-row"]');
    const count = await impactRows.count();

    for (let i = 0; i < count; i++) {
      const row = impactRows.nth(i);
      const category = (await row.locator('[data-testid="category-name"]').textContent()) || '';
      const amount = (await row.locator('[data-testid="impact-amount"]').textContent()) || '';
      impacts.push({ category, amount });
    }

    return impacts;
  }

  async goToConfirmStep() {
    await this.confirmButton.click();
  }

  // Step 4: Confirm methods
  async waitForConfirmStep() {
    await this.syncSummary.waitFor({ state: 'visible', timeout: 10000 });
  }

  async executeSync() {
    await this.syncButton.click();
    // Wait for sync to complete
    await this.successNotification.waitFor({ state: 'visible', timeout: 30000 });
  }

  async close() {
    await this.doneButton.click();
  }

  async cancel() {
    await this.cancelButton.click();
  }

  // Navigation helpers
  async goBack() {
    await this.backButton.click();
  }

  // Get current step from progress indicator
  async getCurrentStep(): Promise<string> {
    // Find the step that is marked as current/active
    const steps = ['Accounts', 'Transactions', 'Preview', 'Confirm'];
    for (const step of steps) {
      const stepElement = this.locator.getByText(step, { exact: true });
      if (await stepElement.isVisible()) {
        // Check if it has active styling (this is a simplified check)
        const parent = stepElement.locator('..');
        const styles = await parent.getAttribute('style');
        if (styles && styles.includes('pageTextPositive')) {
          return step.toLowerCase();
        }
      }
    }
    return 'accounts'; // Default to first step
  }

  // Check if the Next/Preview button is enabled
  async canProceed(): Promise<boolean> {
    // Check which button is visible and if it's enabled
    if (await this.nextButton.isVisible()) {
      return await this.nextButton.isEnabled();
    }
    if (await this.previewButton.isVisible()) {
      return await this.previewButton.isEnabled();
    }
    if (await this.confirmButton.isVisible()) {
      return await this.confirmButton.isEnabled();
    }
    if (await this.syncButton.isVisible()) {
      return await this.syncButton.isEnabled();
    }
    return false;
  }

  // Get error message if displayed
  async getErrorMessage(): Promise<string | null> {
    const errorDiv = this.locator.locator('div').filter({
      hasText: /^[^]*$/,
    }).locator('[style*="error"], [style*="warning"]');

    if ((await errorDiv.count()) > 0) {
      return await errorDiv.first().textContent();
    }
    return null;
  }

  // Get summary info from confirm step
  async getSyncSummary(): Promise<{
    transactionCount: string;
    totalExpenses: string;
    categoriesAffected: string;
  }> {
    const transactionCount = await this.locator
      .getByText(/Transactions to sync/)
      .locator('..')
      .locator('span[style*="fontWeight: 600"]')
      .last()
      .textContent();

    const totalExpenses = await this.locator
      .getByText(/Total expenses/)
      .locator('..')
      .locator('span[style*="fontWeight: 600"]')
      .last()
      .textContent();

    const categoriesAffected = await this.locator
      .getByText(/Categories affected/)
      .locator('..')
      .locator('span[style*="fontWeight: 600"]')
      .last()
      .textContent();

    return {
      transactionCount: transactionCount || '0',
      totalExpenses: totalExpenses || '0',
      categoriesAffected: categoriesAffected || '0',
    };
  }
}
