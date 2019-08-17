import Consul from "consul";
import fs from "fs";
import log from "./logger";

const CONSUL_HOST = process.env.CONSUL_HOST;

const consul = Consul({
  host: CONSUL_HOST,
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
  (axidrawAddress: string) => {
    log(`Axidraw Address: ${axidrawAddress}`);
    log(`Making plot for product "${config.product}" at timestamp "${config.ts}"`);

    setTimeout(() => {
      process.exit();
    }, 120000);
  },
  (err) => {
    log(`Could not connect to Axidraw: ${err}`);
    log(`Making plot for product "${config.product}" at timestamp "${config.ts}"`);
    process.exit();
  }
);
