import { Storage } from "@google-cloud/storage";
import axios from "axios";
import Consul from "consul";
import EventSource from "eventsource";
import fs, { exists } from "fs";
import Puppeteer from "puppeteer";
import SeedRandom from "seedrandom";
import log from "./logger";

const CONSUL_HOST = process.env.CONSUL_HOST;
const CONSUL_PORT = process.env.CONSUL_PORT || "8500";
const PLOTTER_ID = process.env.PLOTTER_ID || "plot1";
const DESIGN_URL = process.env.DESIGN_URL || "http://localhost:8090";
const BUCKET = process.env.BUCKET || "h19-plotter-svgs";

const storage = new Storage();

const consul = Consul({
  host: CONSUL_HOST,
  port: CONSUL_PORT,
  promisify: (fn: any) => {
    return new Promise((resolve, reject) => {
      try {
        return fn((err: any, data: any, res: any) => {
          if (err) {
            err.res = res;
            return reject(err);
          }
          return resolve([data, res]);
        });
      } catch (err) {
        return reject(err);
      }
    });
  }
});

const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const configPath = `${process.env.NOMAD_TASK_DIR || "."}/config.json`;
const configFile = fs.readFileSync(configPath, { encoding: "utf8" });

let config = {
  product: "",
  ts: 0
};

try {
  config = JSON.parse(configFile);
} catch (err) {
  log(`ERROR!! Could not parse configuration file. Syntax error?`);
  log(configFile);
  process.exit(1);
}

const rng = SeedRandom(config.ts.toString());

consul.kv.get("axidraw_address").then(
  (res: any[]) => {
    const [data] = res;
    const axidrawAddress = data && data.Value;
    log(`Axidraw Address: ${axidrawAddress}`);
    log(`Making plot for product "${config.product}" at timestamp "${config.ts}"`);

    const es = new EventSource(`${axidrawAddress}/queue/${PLOTTER_ID}?ts=${config.ts}`);
    es.onmessage = (event) => {
      log(`Data Frame: ${event.data}`);
      const msg = JSON.parse(event.data);

      if (msg.connected === false) {
        log(`Could not connect: ${msg.reason}`);
        process.exit(1);
        return;
      }

      if (msg.done === true) {
        log(`Plot finished! Time to plot: ${msg.duration}`);
        process.exit(0);
      }

      if (msg.connected === true) {
        log("Connection established. Waiting to plot.");
      }

      if (msg.heartbeat) {
        log(`Still in queue: Heartbeat (${msg.heartbeat})`);
      }

      if (msg.proceed) {
        log(`Plot requested!`);
        sendPlot(axidrawAddress, msg.proceed);
      }
    };

    es.onerror = (err) => {
      log(`EventSource Error: ${err.data}`);
      process.exit(1);
    };
  },
  (err) => {
    log(`Could not connect to Axidraw: ${err}`);
    log(`Making plot for product "${config.product}" at timestamp "${config.ts}"`);
    process.exit();
  }
);

async function sendPlot(address: string, key: string) {
  // generate an svg
  log("Generating SVG...");

  const browser = await Puppeteer.launch({
    // Docker related chrome flags
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });
  const page = await browser.newPage();
  page.setViewport({ width: 1000, height: 1000, deviceScaleFactor: 2 });
  let svg = "";

  try {
    await page.goto(`${DESIGN_URL}?product=${config.product.toLowerCase()}&seed=${rng()}`);
    await wait(2000);
    svg = await page.evaluate(() => window.extractSVG());
  } catch (err) {
    log(`ERROR: Could not capture the SVG ${err}`);
    process.exit(1);
  }

  const filename = `./${PLOTTER_ID}_${config.product}_${config.ts}.svg`;
  fs.writeFileSync(filename, Buffer.from(svg));

  // log("Uploading SVG to Google Cloud Storage...");
  // storage
  //   .bucket(BUCKET)
  //   .upload(filename, {
  //     gzip: true
  //   })
  //   .then(
  //     ([file, meta]) => {
  //       log("SVG uploaded to Google Cloud Storage");
  //       log("baseUrl: " + file.baseUrl);
  //       log("name: " + file.name);
  //       log("bucket: " + file.bucket);
  //       log("id: " + file.id);
  //       log(meta);
  //     },
  //     (err) => {
  //       log(`Failed to upload SVG to Google Cloud Storage: ${err}`);
  //     }
  //   );

  log("Updating Consul KV with new SVG address...");

  log("Submitting SVG to the Plotter...");
  axios.post(`${address}/plot/${PLOTTER_ID}`, { key, svg }).then(
    (res) => {
      log("SVG submitted");
    },
    (err) => {
      log(`Failed to submit SVG: ${err}`);
      process.exit(1);
    }
  );
}
