import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("http://localhost:5173/?медленно=1");
await page.waitForSelector('[data-testid="composer"]');
const send = async (text) => {
  await page.locator('[data-testid="composer"]').fill(text);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);
};
await send("раз");
await send("два");
await send("три");
await page.waitForTimeout(300);
console.log("chips:", await page.locator('[data-testid="queue-chip"]').allTextContents());
await page.locator('[data-testid="queue-chip"]').nth(1).locator('[data-testid="queue-chip-close"]').click();
await page.waitForTimeout(300);
console.log("chips after remove:", await page.locator('[data-testid="queue-chip"]').allTextContents());
await page.waitForTimeout(6000);
const feed = await page.locator('[data-testid="feed"]').textContent();
for (const word of ["раз", "два", "три"]) {
  console.log(`feed содержит «${word}»:`, (feed ?? "").includes(word));
}
console.log("feed tail:", (feed ?? "").slice(-300));
await browser.close();
