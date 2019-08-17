const DEBUG = !!process.env.DEBUG;

export default function log(msg: string = "") {
  // tslint:disable-next-line:no-console
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

export function debug(msg: string = "") {
  if (DEBUG) {
    log(msg);
  }
}
