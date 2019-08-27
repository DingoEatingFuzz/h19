import { Storage } from "@google-cloud/storage";
import axios from "axios";
import Consul from "consul";
import EventSource from "eventsource";
import fs, { exists } from "fs";
import log from "./logger";

const CONSUL_HOST = process.env.CONSUL_HOST;
const CONSUL_PORT = process.env.CONSUL_PORT || "8500";
const PLOTTER_ID = process.env.PLOTTER_ID || "plot1";
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

function sendPlot(address: string, key: string) {
  // generate an svg
  log("Generating SVG...");

  // tslint:disable-next-line
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 816 1056"><path fill="#fff" d="M227.24 580.95l124.06-99.53 24.16 157.2z"/><path d="M350.93 482.36l23.9 155.49-146.6-57.05 122.7-98.44m.73-1.87L226.25 581.1l149.83 58.3-24.42-158.91z"/><path d="M240.5 583.5c.03-8.3 3.31-11.96 4-12 1.14-.07 2.63 15.07 4 15 1.56-.08.89-19.79 3-20 2.41-.24 6.21 25.21 8 25 1.98-.23-.8-31.78 1-32 1.94-.24 7.45 36.2 9 36 1.63-.21-2.99-40.71-1-41 2.07-.3 9.7 43.21 11 43 1.36-.22-6.03-47.62-4-48 2.15-.4 12.99 52.37 15 52 2.13-.4-7.71-59.69-6-60 1.78-.32 13.95 63.35 16 63 2.12-.36-8.26-68.8-7-69 1.31-.21 13.4 73.24 15 73 1.66-.25-9.15-78.84-8-79 1.18-.17 13.75 83.18 15 83 1.29-.18-10.81-88.73-9-89 1.84-.27 16.52 91.23 18 91 1.51-.23-12.38-95.79-11-96 1.42-.22 17.63 101.21 19 101 1.4-.21-14-106.85-13-107 1.02-.15 17.65 109.19 19 109 1.37-.2-14.3-113.81-13-114 1.32-.19 18.73 116.18 20 116 1.29-.19-15.59-120.76-14-121 1.62-.24 21.09 124.14 22 124 .92-.14-18.3-126.79-17-127 1.31-.21 22.39 129.25 24 129 1.64-.26-18.53-134.76-17-135 1.55-.24 23.83 138.18 25 138 .52-.08-3.11-27.83-20-141" fill="#fff" stroke="#000" stroke-miterlimit="10"/></svg>`;
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
    }
  );
}
