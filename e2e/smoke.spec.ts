import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const SAMPLE_PDF = join(__dirname, "fixtures", "sample.pdf");

/**
 * The one path that has to work: sign up, put a document somewhere, share it,
 * and take the sharing back.
 *
 * A fresh account per run keeps this independent of whatever the database
 * already holds, and the shared link is opened in a second browser context so
 * it is genuinely tested as an outsider would see it - no session, no cache.
 */
test("a new user can organise, share and unshare a document", async ({
  page,
  browser,
}) => {
  const email = `smoke-${Date.now()}@example.com`;

  await test.step("register and land in the data room", async () => {
    await page.goto("/register");
    await page.getByLabel("Name", { exact: true }).fill("Smoke Test");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("SmokeTest1234!");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/room\//);
    await expect(page.getByText("This folder is empty")).toBeVisible();
  });

  await test.step("create a folder and open it", async () => {
    await page.getByRole("button", { name: "New folder" }).first().click();
    await page.getByLabel("Name", { exact: true }).fill("Due Diligence");
    await page.getByRole("button", { name: "Create folder" }).click();

    await expect(row(page, "Due Diligence")).toBeVisible();
    await row(page, "Due Diligence").click();
    await expect(page.getByText("This folder is empty")).toBeVisible();
  });

  await test.step("upload a PDF", async () => {
    await page.locator('input[type="file"]').first().setInputFiles(SAMPLE_PDF);

    await expect(row(page, "sample.pdf")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Uploaded 1 file/)).toBeVisible();
  });

  await test.step("rename the uploaded file", async () => {
    await openRowAction(page, "sample.pdf", "Rename");
    await page.getByLabel("Name", { exact: true }).fill("Cap Table.pdf");
    await page.getByRole("button", { name: "Rename", exact: true }).click();

    await expect(row(page, "Cap Table.pdf")).toBeVisible();
  });

  const shareUrl = await test.step("create a public link", async () => {
    await page.goBack();
    await openRowAction(page, "Due Diligence", "Share");
    await page.getByRole("button", { name: "Create link" }).click();

    const link = page.getByRole("textbox").first();
    await expect(link).toHaveValue(/\/s\//);
    const url = await link.inputValue();

    await page.keyboard.press("Escape");
    return url;
  });

  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();

  await test.step("a stranger with the link sees a read-only view", async () => {
    await visitorPage.goto(shareUrl);

    await expect(visitorPage.getByText("Cap Table.pdf")).toBeVisible();
    // Read-only means the mutation controls are absent, not disabled.
    await expect(
      visitorPage.getByRole("button", { name: /^Actions for/ }),
    ).toHaveCount(0);
    await expect(
      visitorPage.getByRole("button", { name: "New folder" }),
    ).toHaveCount(0);
  });

  await test.step("revoking the link closes it off", async () => {
    await openRowAction(page, "Due Diligence", "Share");
    await page.getByRole("button", { name: "Disable link" }).click();
    await expect(page.getByText("Link disabled")).toBeVisible();

    await visitorPage.reload();
    await expect(
      visitorPage.getByText("This item is no longer available"),
    ).toBeVisible();
  });

  await visitor.close();
});

/**
 * A row's own name button. Exact matching keeps it apart from the row's
 * "Actions for <name>" menu trigger, which contains the same name.
 */
function row(page: Page, name: string) {
  return page.getByRole("button", { name, exact: true });
}

/** Opens a row's action menu and picks one entry. */
async function openRowAction(
  page: Page,
  rowName: string,
  action: string,
): Promise<void> {
  await page.getByRole("button", { name: `Actions for ${rowName}` }).click();
  await page.getByRole("menuitem", { name: action }).click();
}
