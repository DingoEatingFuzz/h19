import Consul from "consul";
import log from "./logger";

const CONSUL_HOST = process.env.CONSUL_HOST;
if (!CONSUL_HOST) {
  throw new Error("Consul host must be configured! Set the CONSUL_HOST environment variable");
}
log(`Consul host: "${CONSUL_HOST}"`);

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
}
