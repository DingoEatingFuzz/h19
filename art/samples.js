// A Puppeteer script for generating a bunch of sample outputs from the generative art piece
const puppeteer = require("puppeteer");
const fs = require("fs");

const HOST = "http://localhost:1234";
const PRODUCTS = ["vagrant", "packer", "consul", "terraform", "vault", "nomad"];

const urlFor = (product, seed) => `${HOST}?product=${product}&seed=${seed}`;

(async function() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.setViewport({ width: 1000, height: 1000, deviceScaleFactor: 2 });

  for (product of PRODUCTS) {
    for (let i = 0; i <= 1; i += 1 / 30) {
      const name = `${product}-${i.toFixed(3)}`;
      await page.goto(urlFor(product, i));
      await capture(page, name);
      const svg = await page.evaluate(() => window.extractSVG());
      fs.writeFileSync(`exports/${name}.svg`, Buffer.from(svg));
    }
  }

  console.log("All done!");
  process.exit();
})();

async function capture(page, name, options = {}) {
  console.log(`Capturing ${name}`);
  const dir = process.env.SCREENSHOTS_DIR || "screenshots";
  await page.screenshot(Object.assign({ path: `${dir}/${name}.png`, fullPage: true }, options));
}
