import Consul from "consul";
import fs from "fs";
import log from "./logger";

const CONSUL_HOST = process.env.CONSUL_HOST;
const CONSUL_PORT = process.env.CONSUL_PORT || "8500";

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
const file = fs.readFileSync(configPath, { encoding: "utf8" });

let config = {
  product: "",
  ts: 0
};

try {
  config = JSON.parse(file);
} catch (err) {
  log(`ERROR!! Could not parse configuration file. Syntax error?`);
  log(file);
  process.exit(1);
}

consul.kv.get("axidraw_address").then(
  (res: any[]) => {
    const [data] = res;
    const axidrawAddress = data && data.Value;
    log(`Axidraw Address: ${axidrawAddress}`);
    log(`Making plot for product "${config.product}" at timestamp "${config.ts}"`);

    setTimeout(() => {
      process.exit();
    }, 120000);

    // long-poll to the plot endpoint with timestamp
    // response will either be wait (poll again)
    // or continue (submit an svg)
    // when continuing...
    // generate an svg
    // upload the svg to GCS
    // update the consul kv for the plot1 preview svg
    // POST the svg to the axidraw service
    // response to the POST request will be an eventsource
    // subscribe to the event source
    // when the event source sends the "done" request, terminate
    // as the event source send coordinates, forward to the preview service? update kv?
  },
  (err) => {
    log(`Could not connect to Axidraw: ${err}`);
    log(`Making plot for product "${config.product}" at timestamp "${config.ts}"`);
    process.exit();
  }
);
