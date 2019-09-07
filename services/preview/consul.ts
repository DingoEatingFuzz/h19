interface IKVResponse {
  Key: string;
  Value: string;
  CreateIndex: number;
  ModifyIndex: number;
}

interface IConfigMap {
  [key: string]: number;
}

export default class Consul {
  public host: string;
  public lastConfigs: IConfigMap = {};

  constructor(host: string) {
    this.host = host;
  }

  public async watch(key: string): Promise<string> {
    let watchIndex;
    if (this.lastConfigs[key] == null) {
      this.lastConfigs[key] = watchIndex = 1;
    } else {
      watchIndex = this.lastConfigs[key];
    }

    let json: IKVResponse;

    while (watchIndex === this.lastConfigs[key]) {
      const res = await fetch(`${this.host}/v1/kv/${key}?index=${watchIndex}&wait=30s`);
      json = (await res.json())[0];
      watchIndex = json.ModifyIndex;
    }

    this.lastConfigs[key] = watchIndex;
    return atob(json.Value);
  }
}
