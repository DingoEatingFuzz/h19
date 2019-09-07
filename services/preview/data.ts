export default class Data {
  public static cache: any = {};
  public static async get(product: string): Promise<any> {
    const cachedValue = this.cache[product];
    if (cachedValue) {
      return cachedValue;
    }

    const res = await fetch(`/preview/${product}.json`);
    const json = await res.json();
    normalizeData(json);
    this.cache[product] = json;

    return json;
  }
}

function normalizeData(data: any) {
  data.all.forEach((commit: any) => {
    commit.date = new Date(commit.date);
  });
}
