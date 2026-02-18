import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

// locators cheetsheet:

// getByLabel('New chat')
// getByRole('button', { name: 'New folder' })

// getByRole('tab', { name: 'Chat' })
// getByRole('tab', { name: 'Text' })


// page.getByRole('textbox', { name: 'Message input' })
// page.getByRole('button', { name: 'Send message' })

// page.locator('[data-role="user"] [data-status="complete"]', { hasText: 'hello' })

test.beforeEach(async ({ page }, testInfo) => {
  const sessionId = randomUUID();

  (testInfo as unknown as { sessionId: string }).sessionId = sessionId;

  await page.setExtraHTTPHeaders({
    'x-test-session': sessionId
  })

  await page.goto('http://localhost:3000')
})

test.afterEach(async ({ request }, testInfo) => {
  const sessionId = (testInfo as unknown as { sessionId: string }).sessionId;
  await request.delete('/api/test-cleanup', {
    headers: { 'x-test-session': sessionId }
  })
})

test('test - start a chat', async ({ page }) => {
  // assert we start clean
  await expect(page.getByRole('navigation')
    .filter({ hasText: 'This folder is empty' })
    .getByRole('paragraph'))
    .toBeVisible();

  await expect(page.getByLabel('New chat')).toBeVisible();
  // await expect(page.getByRole('button', { name: 'New thread' })).toBeVisible();
  await page.getByLabel('New chat').click();

  await page.getByRole('textbox', { name: 'Message input' }).click();
  await page.getByRole('textbox', { name: 'Message input' }).fill('hello');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.locator('[data-role="user"] [data-status="complete"]', {
    hasText: 'hello'
  })).toBeVisible();
});

test('test - start two chats', async ({ page }) => {
  // assert we start clean
  await expect(page.getByRole('navigation')
    .filter({ hasText: 'This folder is empty' })
    .getByRole('paragraph'))
    .toBeVisible();

  // start a chat
  await expect(page.getByLabel('New chat')).toBeVisible();
  await page.getByLabel('New chat').click();

  // New chat appear with name "New chat" by default
  await expect(page.getByTestId('sidebar-explorer')
    .getByRole('button', { name: 'New chat' }))
    .toBeVisible();

  await page.getByRole('textbox', { name: 'Message input' }).click();
  await page.getByRole('textbox', { name: 'Message input' }).fill('hello');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.locator('[data-role="user"] [data-status="complete"]', {
    hasText: 'hello'
  })).toBeVisible();

  // the chat button shold have been renamed by the first message exchange
  await expect(page.getByTestId('sidebar-explorer')
    .getByRole('button', { name: 'New chat' }))
    .not.toBeVisible();

  // start second chat
  await page.getByLabel('New chat').click();

  await expect(page.getByTestId('sidebar-explorer')
    .getByRole('button', { name: 'New chat' }))
    .toBeVisible();

  await page.getByRole('textbox', { name: 'Message input' }).click();
  await page.getByRole('textbox', { name: 'Message input' }).fill('second chat');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.locator('[data-role="user"] [data-status="complete"]', {
    hasText: 'second chat'
  })).toBeVisible();

  await expect(page.getByTestId('sidebar-explorer')
    .getByRole('button', { name: 'New chat' }))
    .not.toBeVisible();

  // switch between the chats - not using names, because the LLM may return whatever

  // swtich to the first chat
  await page.getByTestId('sidebar-explorer')
    .locator('button[data-type="file"]')
    .nth(0)
    .click();

  await expect(page.locator('[data-role="user"] [data-status="complete"]', {
    hasText: 'hello'
  })).toBeVisible();

  // swtich to the second chat
  await page.getByTestId('sidebar-explorer')
    .locator('button[data-type="file"]')
    .nth(1)
    .click();

  await expect(page.locator('[data-role="user"] [data-status="complete"]', {
    hasText: 'second chat'
  })).toBeVisible();

});

test('test - text view', async ({ page }) => {
  // assert we start clean
  await expect(page.getByRole('navigation')
    .filter({ hasText: 'This folder is empty' })
    .getByRole('paragraph'))
    .toBeVisible();

  await expect(page.getByLabel('New chat')).toBeVisible();

  // start new thread
  await page.getByLabel('New chat').click();

  // send a message
  await page.getByRole('textbox', { name: 'Message input' }).click();
  await page.getByRole('textbox', { name: 'Message input' }).fill('hello');
  await page.getByRole('button', { name: 'Send message' }).click();

  // assert the message is visible in the thread
  await expect(page.locator('[data-role="user"] [data-status="complete"]', {
    hasText: 'hello'
  })).toBeVisible();

  // switch to text view
  await page.getByRole('tab', { name: 'Text' }).click();

  // assrt the text view contains hello on the 4-th line
  await expect(page.locator('.view-lines > div:nth-child(4)', {
    hasText: 'hello'
  })).toBeVisible();

  // change the editor text
  await page.evaluate(() => {
    (window as any).monaco.editor.getModels()[0].setValue(
      `--- message ---
role: user
---
modified msg

--- message ---
role: assistant
---
modified response

`
    );
  });

  // the editor has 500 ms debouncing on change
  await new Promise((resolve) => setTimeout(resolve, 600));

  // switch to chat view
  await page.getByRole('tab', { name: 'Chat' }).click();

  // assert the message is visible in the thread
  await expect(page.locator('[data-role="user"] [data-status="complete"]', {
    hasText: 'modified msg'
  })).toBeVisible();

  await expect(page.locator('[data-role="assistant"] [data-status="complete"]', {
    hasText: 'modified response'
  })).toBeVisible();

});

test('test - rename chat', async ({ page }) => {
  // assert we start clean
  await expect(page.getByRole('navigation')
    .filter({ hasText: 'This folder is empty' })
    .getByRole('paragraph'))
    .toBeVisible();

  await expect(page.getByLabel('New chat')).toBeVisible();

  await page.getByLabel('New chat').click();

  // New chat appear with name "New chat" by default
  await expect(page.getByTestId('sidebar-explorer')
    .getByRole('button', { name: 'New chat' }))
    .toBeVisible();

  // the actions button
  await expect(page.getByTestId('sidebar-explorer')
    .getByRole('button', { name: 'New chat' })
    .locator('..')
    .getByRole('button', { name: 'More' }))
    .toBeVisible();

  // click "More"
  await page.getByTestId('sidebar-explorer')
    .getByRole('button', { name: 'New chat' })
    .locator('..')
    .getByRole('button', { name: 'More' })
    .click()

  // Rename the chat
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  await page.getByRole('textbox', { name: 'Enter here...' }).fill('New name 1');
  await page.getByRole('button', { name: 'Rename' }).click();

  // Assert the chat was renamed
  await expect(page.getByTestId('sidebar-explorer')
    .getByRole('button', { name: 'New name 1' }))
    .toBeVisible();

  await expect(page.getByTestId('sidebar-explorer')
    .getByRole('button', { name: 'New chat' }))
    .not.toBeVisible();

});

test('test - start', async ({ page }) => {
  await expect(page.getByLabel('New chat')).toBeVisible();

  // assert we start clean
  await expect(page.getByRole('navigation')
    .filter({ hasText: 'This folder is empty' })
    .getByRole('paragraph'))
    .toBeVisible();

});

// 
