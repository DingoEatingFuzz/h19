import axios from "axios";
import Consul from "consul";
import { debug, default as log } from "./logger";

const CONSUL_HOST = process.env.CONSUL_HOST;
const CONSUL_PORT = process.env.CONSUL_PORT || "8500";
const NOMAD_HOST = process.env.NOMAD_HOST;
const PLOTTER_JOBS: { [s: string]: string } = {
  plot1: "plotter1",
  plot2: "plotter2"
};

const PRODUCT_ORDER = ["vagrant", "packer", "consul", "terraform", "vault", "nomad"];

function plotterJob(id: string): string {
  const jobName: string = PLOTTER_JOBS[id];

  if (!jobName) {
    throw new Error(`No assigned job to ID "${id}"`);
  }

  return jobName;
}

export interface IDispatchResponse {
  DispatchedJobID: string;
  EvalID: string;
  EvalCreateIndex: number;
  JobCreateIndex: number;
  Index: number;
}

if (!CONSUL_HOST) {
  throw new Error("Consul host must be configured! Set the CONSUL_HOST environment variable");
}
if (!NOMAD_HOST) {
  throw new Error("Nomad host must be configured! Set the NOMAD_HOST environment variable");
}
log(`Consul host: "${CONSUL_HOST}:${CONSUL_PORT}"`);
log(`Nomad host: "${NOMAD_HOST}"`);

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

export default class Backend {
  private healthy = true;

  public getHealth(): boolean {
    return this.healthy;
  }

  public async start() {
    try {
      const [data] = await consul.kv.get("axidraw_address");
      return data && data.Value;
    } catch (err) {
      this.healthy = false;
      return null;
    }
  }

  public async getState(plotter: string) {
    try {
      const [data] = await consul.kv.get(`axidraw_${plotter}_state`);
      return data && data.Value;
    } catch (err) {
      this.healthy = false;
      return null;
    }
  }

  public async submitJob(id: string): Promise<IDispatchResponse> {
    const [data] = await consul.kv.get("current_product");
    const currentProduct: string = data && data.Value;
    const payload = {
      product: currentProduct,
      ts: +new Date()
    };
    debug(`Dispatch payload: ${JSON.stringify(payload)}`);

    try {
      const submitResponse = await axios.post(`${NOMAD_HOST}/v1/job/${plotterJob(id)}/dispatch`, {
        Payload: Buffer.from(JSON.stringify(payload)).toString("base64")
      });
      const dispatchResponse: IDispatchResponse = submitResponse.data;
      log(`Dispatched a plotter job for plotter "${id}": ${dispatchResponse.DispatchedJobID}`);
      await this.incrementProduct(currentProduct);
      return dispatchResponse;
    } catch (err) {
      log(`ERROR!! ${err}`);
      throw err;
    }
  }

  private async incrementProduct(product: string) {
    const index = PRODUCT_ORDER.indexOf(product);
    const newProduct = PRODUCT_ORDER[(index + 1) % PRODUCT_ORDER.length];
    try {
      await consul.kv.set("current_product", newProduct);
    } catch (err) {
      log(`ERROR!! Could not set Consul key "current_product" to new value "${newProduct}"`);
    }
  }
}
