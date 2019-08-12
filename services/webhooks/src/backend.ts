import Consul from "consul";

const consul = Consul({
  host: "hashi.plot.technology",
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
