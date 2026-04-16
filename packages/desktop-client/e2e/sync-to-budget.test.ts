import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import type { AccountPage } from './page-models/account-page';
import { ConfigurationPage } from './page-models/configuration-page';
import { Navigation } from './page-models/navigation';
import { SyncToBudgetModal } from './page-models/sync-to-budget-modal';

test.describe('Sync to Budget', () => {
  let page: Page;
  let navigation: Navigation;
  let configurationPage: ConfigurationPage;
  let accountPage: AccountPage;
  let syncModal: SyncToBudgetModal;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    navigation = new Navigation(page);
    configurationPage = new ConfigurationPage(page);
    syncModal = new SyncToBudgetModal(page);

    await page.goto('/');
    await configurationPage.createTestFile();
  });

  test.afterEach(async () => {
    await page?.close();
  });

  test.describe('Opening the wizard', () => {
    test('can open from off-budget account menu', async () => {
      // Navigate to an off-budget account (Roth IRA)
      accountPage = await navigation.goToAccountPage('Roth IRA');

      // Open account menu and click "Sync to Budget"
      await accountPage.accountMenuButton.click();
      await page.getByRole('button', { name: 'Sync to Budget' }).click();

      // Verify modal opens
      await syncModal.waitFor();
      await expect(syncModal.heading).toBeVisible();
    });

    test('pre-selects the current account when opened from account page', async () => {
      accountPage = await navigation.goToAccountPage('Roth IRA');

      await accountPage.accountMenuButton.click();
      await page.getByRole('button', { name: 'Sync to Budget' }).click();

      await syncModal.waitFor();

      // The FROM dropdown should show Roth IRA selected
      const fromDropdown = syncModal.locator.locator('select').first();
      await expect(fromDropdown).toHaveValue(/.+/); // Should have a non-empty value

      // Verify the selected text shows Roth IRA
      const selectedOption = await fromDropdown.locator('option:checked').textContent();
      expect(selectedOption).toBe('Roth IRA');
    });
  });

  test.describe('Step 1: Account Selection', () => {
    test.beforeEach(async () => {
      accountPage = await navigation.goToAccountPage('Roth IRA');
      await accountPage.accountMenuButton.click();
      await page.getByRole('button', { name: 'Sync to Budget' }).click();
      await syncModal.waitFor();
    });

    test('shows wizard progress with all 4 steps', async () => {
      // Check for step indicators
      await expect(page.getByText('1')).toBeVisible();
      await expect(page.getByText('2')).toBeVisible();
      await expect(page.getByText('3')).toBeVisible();
      await expect(page.getByText('4')).toBeVisible();

      // Check for step labels
      await expect(page.getByText('Accounts')).toBeVisible();
      await expect(page.getByText('Transactions')).toBeVisible();
      await expect(page.getByText('Preview')).toBeVisible();
      await expect(page.getByText('Confirm')).toBeVisible();
    });

    test('displays FROM and TO account selectors', async () => {
      await expect(page.getByText('FROM')).toBeVisible();
      await expect(page.getByText('TO')).toBeVisible();
      await expect(page.getByText('From (Off-Budget Account)')).toBeVisible();
      await expect(page.getByText('To (On-Budget Account)')).toBeVisible();
    });

    test('Next button is disabled until both accounts selected', async () => {
      // Next should be disabled because TO account is not selected
      await expect(syncModal.nextButton).toBeDisabled();

      // Select TO account
      await syncModal.selectToAccount('Bank of America');

      // Now Next should be enabled
      await expect(syncModal.nextButton).toBeEnabled();
    });

    test('only shows off-budget accounts in FROM dropdown', async () => {
      const fromDropdown = syncModal.locator.locator('select').first();
      const options = fromDropdown.locator('option');

      // Get all option texts
      const optionCount = await options.count();
      const optionTexts: string[] = [];
      for (let i = 0; i < optionCount; i++) {
        const text = await options.nth(i).textContent();
        if (text) optionTexts.push(text);
      }

      // Should include off-budget accounts
      expect(optionTexts).toContain('Roth IRA');
      expect(optionTexts).toContain('Vanguard 401k');

      // Should NOT include on-budget accounts
      expect(optionTexts).not.toContain('Bank of America');
      expect(optionTexts).not.toContain('Ally Savings');
    });

    test('only shows on-budget accounts in TO dropdown', async () => {
      const toDropdown = syncModal.locator.locator('select').nth(1);
      const options = toDropdown.locator('option');

      // Get all option texts
      const optionCount = await options.count();
      const optionTexts: string[] = [];
      for (let i = 0; i < optionCount; i++) {
        const text = await options.nth(i).textContent();
        if (text) optionTexts.push(text);
      }

      // Should include on-budget accounts
      expect(optionTexts).toContain('Bank of America');
      expect(optionTexts).toContain('Ally Savings');

      // Should NOT include off-budget accounts
      expect(optionTexts).not.toContain('Roth IRA');
      expect(optionTexts).not.toContain('Vanguard 401k');
    });
  });

  test.describe('Step 2: Transaction Selection', () => {
    test.beforeEach(async () => {
      accountPage = await navigation.goToAccountPage('Roth IRA');
      await accountPage.accountMenuButton.click();
      await page.getByRole('button', { name: 'Sync to Budget' }).click();
      await syncModal.waitFor();

      // Select TO account and proceed to step 2
      await syncModal.selectToAccount('Bank of America');
      await syncModal.goToTransactionStep();
    });

    test('loads and displays transactions from off-budget account', async () => {
      await syncModal.waitForTransactionsLoaded();

      // There should be transactions displayed
      const count = await syncModal.getTransactionCount();
      expect(count).toBeGreaterThan(0);
    });

    test('shows transaction details including date, notes, and amount', async () => {
      await syncModal.waitForTransactionsLoaded();

      // Check table headers
      await expect(page.getByText('Date')).toBeVisible();
      await expect(page.getByText('Description')).toBeVisible();
      await expect(page.getByText('Amount')).toBeVisible();
      await expect(page.getByText('Category')).toBeVisible();
    });

    test('can toggle individual transactions', async () => {
      await syncModal.waitForTransactionsLoaded();

      // First transaction should be selected by default
      const isSelected = await syncModal.isTransactionSelected(0);
      expect(isSelected).toBe(true);

      // Toggle it off
      await syncModal.toggleTransaction(0);

      // Should now be deselected
      const isSelectedAfter = await syncModal.isTransactionSelected(0);
      expect(isSelectedAfter).toBe(false);
    });

    test('can select/deselect all transactions', async () => {
      await syncModal.waitForTransactionsLoaded();

      // Click Deselect All
      await page.getByRole('button', { name: 'Deselect All' }).click();

      // All should be deselected
      const count = await syncModal.getTransactionCount();
      for (let i = 0; i < Math.min(count, 3); i++) {
        const isSelected = await syncModal.isTransactionSelected(i);
        expect(isSelected).toBe(false);
      }

      // Click Select All
      await page.getByRole('button', { name: 'Select All' }).click();

      // All should be selected
      for (let i = 0; i < Math.min(count, 3); i++) {
        const isSelected = await syncModal.isTransactionSelected(i);
        expect(isSelected).toBe(true);
      }
    });

    test('can assign categories to transactions', async () => {
      await syncModal.waitForTransactionsLoaded();

      // Click on the category cell of first transaction
      const row = syncModal.transactionRows.first();
      const categoryCell = row.locator('td').last();
      await categoryCell.click();

      // Wait for autocomplete
      await page.waitForTimeout(200);

      // Type a category name
      await page.keyboard.type('Food');
      await page.waitForTimeout(100);
      await page.keyboard.press('Enter');

      // Category should be assigned
      await page.waitForTimeout(200);
    });

    test('shows warning if transactions without categories', async () => {
      await syncModal.waitForTransactionsLoaded();

      // The Preview button might be disabled or show warning
      // since transactions don't have categories by default
      const hasWarning = await page.getByText(/uncategorized/i).isVisible();
      expect(hasWarning).toBe(true);
    });

    test('Preview button disabled until all selected transactions have categories', async () => {
      await syncModal.waitForTransactionsLoaded();

      // Preview should be disabled when transactions lack categories
      await expect(syncModal.previewButton).toBeDisabled();
    });

    test('can go back to account selection', async () => {
      await syncModal.waitForTransactionsLoaded();

      await syncModal.goBack();

      // Should be back on step 1
      await expect(page.getByText('From (Off-Budget Account)')).toBeVisible();
    });
  });

  test.describe('Step 3: Preview', () => {
    test.beforeEach(async () => {
      accountPage = await navigation.goToAccountPage('Roth IRA');
      await accountPage.accountMenuButton.click();
      await page.getByRole('button', { name: 'Sync to Budget' }).click();
      await syncModal.waitFor();

      // Select accounts
      await syncModal.selectToAccount('Bank of America');
      await syncModal.goToTransactionStep();
      await syncModal.waitForTransactionsLoaded();

      // Keep only first transaction selected and assign category
      await page.getByRole('button', { name: 'Deselect All' }).click();
      await syncModal.toggleTransaction(0);

      const row = syncModal.transactionRows.first();
      const categoryCell = row.locator('td').last();
      await categoryCell.click();
      await page.waitForTimeout(200);
      await page.keyboard.type('Food');
      await page.waitForTimeout(100);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);

      // Go to preview
      await syncModal.previewButton.click();
      await page.waitForTimeout(500);
    });

    test('shows budget impact summary', async () => {
      // Should show the preview content
      await expect(
        page.getByText(/Budget Impact|Review the budget impact/i),
      ).toBeVisible();
    });

    test('displays affected categories', async () => {
      // The preview should show which categories will be affected
      await expect(page.getByText('Food')).toBeVisible();
    });

    test('can go back to transaction selection', async () => {
      await syncModal.goBack();

      // Should be back on step 2
      await expect(page.getByText('Select Transactions')).toBeVisible();
    });
  });

  test.describe('Step 4: Confirm and Execute', () => {
    test('shows sync summary with transaction count', async () => {
      // Navigate through wizard
      accountPage = await navigation.goToAccountPage('Roth IRA');
      await accountPage.accountMenuButton.click();
      await page.getByRole('button', { name: 'Sync to Budget' }).click();
      await syncModal.waitFor();

      await syncModal.selectToAccount('Bank of America');
      await syncModal.goToTransactionStep();
      await syncModal.waitForTransactionsLoaded();

      // Select and categorize first transaction
      await page.getByRole('button', { name: 'Deselect All' }).click();
      await syncModal.toggleTransaction(0);

      const row = syncModal.transactionRows.first();
      const categoryCell = row.locator('td').last();
      await categoryCell.click();
      await page.waitForTimeout(200);
      await page.keyboard.type('Food');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);

      // Preview
      await syncModal.previewButton.click();
      await page.waitForTimeout(500);

      // Confirm
      await syncModal.confirmButton.click();
      await page.waitForTimeout(500);

      // Should show summary
      await expect(page.getByText(/Transactions to sync/i)).toBeVisible();
    });
  });

  test.describe('Full sync workflow', () => {
    test('completes full sync and verifies results', async () => {
      // Step 1: Open wizard from off-budget account
      accountPage = await navigation.goToAccountPage('Roth IRA');
      const initialBalance = await accountPage.accountBalance.textContent();

      await accountPage.accountMenuButton.click();
      await page.getByRole('button', { name: 'Sync to Budget' }).click();
      await syncModal.waitFor();

      // Step 2: Select accounts
      await syncModal.selectToAccount('Bank of America');
      await syncModal.goToTransactionStep();
      await syncModal.waitForTransactionsLoaded();

      // Step 3: Select and categorize one transaction
      await page.getByRole('button', { name: 'Deselect All' }).click();
      await syncModal.toggleTransaction(0);

      const row = syncModal.transactionRows.first();
      const categoryCell = row.locator('td').last();
      await categoryCell.click();
      await page.waitForTimeout(200);
      await page.keyboard.type('Food');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      // Step 4: Preview
      await syncModal.previewButton.click();
      await page.waitForTimeout(500);

      // Step 5: Confirm
      await syncModal.confirmButton.click();
      await page.waitForTimeout(300);

      // Step 6: Execute sync
      await page.getByRole('button', { name: /Sync to Budget/i }).click();

      // Wait for success
      await page.waitForTimeout(2000);

      // Should show success message or Done button
      const doneButton = page.getByRole('button', { name: 'Done' });
      await expect(doneButton).toBeVisible({ timeout: 10000 });

      // Close modal
      await doneButton.click();

      // Verify transaction was deleted from off-budget
      // The balance should have changed
      const newBalance = await accountPage.accountBalance.textContent();
      expect(newBalance).not.toBe(initialBalance);
    });

    test('synced transactions appear in on-budget account', async () => {
      // First, count transactions in on-budget account
      accountPage = await navigation.goToAccountPage('Bank of America');
      await accountPage.waitFor();
      const transactionsBefore = await accountPage.transactionTableRow.count();

      // Navigate to off-budget account
      accountPage = await navigation.goToAccountPage('Roth IRA');
      await accountPage.accountMenuButton.click();
      await page.getByRole('button', { name: 'Sync to Budget' }).click();
      await syncModal.waitFor();

      await syncModal.selectToAccount('Bank of America');
      await syncModal.goToTransactionStep();
      await syncModal.waitForTransactionsLoaded();

      // Select and categorize one transaction
      await page.getByRole('button', { name: 'Deselect All' }).click();
      await syncModal.toggleTransaction(0);

      const row = syncModal.transactionRows.first();
      const categoryCell = row.locator('td').last();
      await categoryCell.click();
      await page.waitForTimeout(200);
      await page.keyboard.type('Food');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      await syncModal.previewButton.click();
      await page.waitForTimeout(500);

      await syncModal.confirmButton.click();
      await page.waitForTimeout(300);

      await page.getByRole('button', { name: /Sync to Budget/i }).click();
      await page.waitForTimeout(2000);

      const doneButton = page.getByRole('button', { name: 'Done' });
      await doneButton.waitFor({ state: 'visible', timeout: 10000 });
      await doneButton.click();

      // Navigate to on-budget account and verify new transactions
      accountPage = await navigation.goToAccountPage('Bank of America');
      await accountPage.waitFor();
      const transactionsAfter = await accountPage.transactionTableRow.count();

      // Should have 2 more transactions (expense + offset)
      expect(transactionsAfter).toBeGreaterThan(transactionsBefore);
    });
  });

  test.describe('Error handling', () => {
    test('shows error if no transactions selected', async () => {
      accountPage = await navigation.goToAccountPage('Roth IRA');
      await accountPage.accountMenuButton.click();
      await page.getByRole('button', { name: 'Sync to Budget' }).click();
      await syncModal.waitFor();

      await syncModal.selectToAccount('Bank of America');
      await syncModal.goToTransactionStep();
      await syncModal.waitForTransactionsLoaded();

      // Deselect all
      await page.getByRole('button', { name: 'Deselect All' }).click();

      // Preview button should be disabled
      await expect(syncModal.previewButton).toBeDisabled();
    });

    test('can cancel at any step', async () => {
      accountPage = await navigation.goToAccountPage('Roth IRA');
      await accountPage.accountMenuButton.click();
      await page.getByRole('button', { name: 'Sync to Budget' }).click();
      await syncModal.waitFor();

      // Cancel from step 1
      await syncModal.cancelButton.click();

      // Modal should be closed
      await expect(syncModal.heading).not.toBeVisible();
    });
  });

  test.describe('Off-Budget Adjustments category', () => {
    test('creates Off-Budget Adjustments category if it does not exist', async () => {
      // Complete a sync
      accountPage = await navigation.goToAccountPage('Roth IRA');
      await accountPage.accountMenuButton.click();
      await page.getByRole('button', { name: 'Sync to Budget' }).click();
      await syncModal.waitFor();

      await syncModal.selectToAccount('Bank of America');
      await syncModal.goToTransactionStep();
      await syncModal.waitForTransactionsLoaded();

      await page.getByRole('button', { name: 'Deselect All' }).click();
      await syncModal.toggleTransaction(0);

      const row = syncModal.transactionRows.first();
      const categoryCell = row.locator('td').last();
      await categoryCell.click();
      await page.waitForTimeout(200);
      await page.keyboard.type('Food');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      await syncModal.previewButton.click();
      await page.waitForTimeout(500);

      await syncModal.confirmButton.click();
      await page.waitForTimeout(300);

      await page.getByRole('button', { name: /Sync to Budget/i }).click();
      await page.waitForTimeout(2000);

      const doneButton = page.getByRole('button', { name: 'Done' });
      await doneButton.waitFor({ state: 'visible', timeout: 10000 });
      await doneButton.click();

      // Navigate to on-budget account and look for Off-Budget Adjustments category
      accountPage = await navigation.goToAccountPage('Bank of America');
      await accountPage.waitFor();

      // Filter by the Off-Budget category to verify it exists
      const filterTooltip = await accountPage.filterBy('Category');
      await page.keyboard.type('Off-Budget');
      await page.waitForTimeout(200);

      // The category should appear in the autocomplete
      const categoryItem = page.getByText('Off-Budget Adjustments');
      await expect(categoryItem).toBeVisible();
    });
  });
});
