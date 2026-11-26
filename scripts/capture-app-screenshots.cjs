const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const base = "https://ai-printos.vercel.app/";
const output = path.join(process.cwd(), "docs", "screenshots");
fs.mkdirSync(output, { recursive: true });

async function save(page, name) {
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: path.join(output, name),
    fullPage: true,
    animations: "disabled"
  });
  console.log("Saved", name);
}

async function openSection(page, label) {
  const link = page.getByRole("link", { name: label, exact: true }).first();
  if (await link.count()) {
    await link.click();
  } else {
    const button = page.getByRole("button", { name: label, exact: true }).first();
    if (await button.count()) {
      await button.click();
    } else {
      const text = page.getByText(label, { exact: true }).first();
      if (!(await text.count())) throw new Error("Navigation item not found: " + label);
      await text.click();
    }
  }
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(900);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1
  });

  page.setDefaultTimeout(10000);
  await page.goto(base, { waitUntil: "networkidle", timeout: 60000 });
  await save(page, "01-home.png");

  const sections = [
    ["Templates", "02-templates.png"],
    ["Catalog", "03-catalog.png"],
    ["Projects", "04-projects.png"],
    ["Language Studio", "05-language-studio.png"],
    ["Settings", "06-settings.png"]
  ];

  for (const [label, file] of sections) {
    try {
      await openSection(page, label);
      await save(page, file);
    } catch (error) {
      console.error("Skipped " + label + ": " + error.message);
    }
  }

  try {
    await page.goto(base, { waitUntil: "networkidle", timeout: 60000 });

    // The home screen has two "New design" buttons. Target the primary action
    // inside #main so Playwright never encounters a strict-mode ambiguity.
    const primaryNewDesign = page.locator('#main button[data-act="new"]').first();
    if (await primaryNewDesign.count()) {
      await primaryNewDesign.click();
    } else {
      const labelledNewDesign = page.getByLabel("New design").first();
      if (!(await labelledNewDesign.count())) {
        throw new Error('Could not find the primary "New design" action.');
      }
      await labelledNewDesign.click();
    }

    await page.waitForTimeout(1800);
    await save(page, "07-editor.png");
  } catch (error) {
    console.error("Editor capture skipped:", error.message);
    process.exitCode = 1;
  }

  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
