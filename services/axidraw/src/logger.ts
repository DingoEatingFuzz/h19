export default function log(msg: string = "") {
  // tslint:disable-next-line:no-console
  console.log(`[${new Date().toISOString()}] ${msg}`);
}
