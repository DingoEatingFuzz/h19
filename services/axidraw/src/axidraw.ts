import SerialPort from "serialport";
import log from "./logger";
import { EBB } from "./saxi/ebb";
import { Device } from "./saxi/planning";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

enum AxidrawStatus {
  UP = "up",
  DOWN = "down",
  CONNECTING = "connecting"
}

export class Axidraw {
  public com: string;
  private privateStatus: AxidrawStatus;
  private ebb: EBB;

  public get status(): AxidrawStatus {
    return this.privateStatus;
  }

  public get isUp(): boolean {
    return this.privateStatus === AxidrawStatus.UP;
  }

  constructor(com: string) {
    this.com = com;
    this.privateStatus = AxidrawStatus.DOWN;
  }

  public async connect(): Promise<void> {
    this.privateStatus = AxidrawStatus.CONNECTING;

    try {
      const port = await this.tryOpen(this.com);
      this.ebb = new EBB(port);
      this.privateStatus = AxidrawStatus.UP;
      log(`Established connection to AxiDraw [${this.com}]`);

      port.once("close", () => {
        log(`Lost connection to AxiDraw [${this.com}]`);
        this.reconnect();
      });
      port.once("error", (err) => {
        log(`Errored connection to AxiDraw [${this.com}]: ${err.message}`);
        this.reconnect();
      });
    } catch (err) {
      log(`Failed to connect to AxiDraw [${this.com}]: ${err.message}`);
      this.reconnect();
    }
  }

  public enableMotors(): boolean {
    if (this.isUp) {
      this.ebb.enableMotors(2);
      return true;
    }
    return false;
  }

  public disableMotors(): boolean {
    if (this.isUp) {
      this.ebb.disableMotors();
      return true;
    }
    return false;
  }

  public raisePen(): boolean {
    if (this.isUp) {
      this.enableMotors();
      this.ebb.setPenHeight(Device.Axidraw.penPctToPos(50), 1000);
      return true;
    }
    return false;
  }

  public lowerPen(): boolean {
    if (this.isUp) {
      this.enableMotors();
      this.ebb.setPenHeight(Device.Axidraw.penPctToPos(70), 1000);
      return true;
    }
    return false;
  }

  private async reconnect(): Promise<void> {
    this.privateStatus = AxidrawStatus.DOWN;
    log(`Attempting to reconnect to AxiDraw [${this.com}] in 5000ms...`);
    await wait(5000);
    await this.connect();
  }

  private async tryOpen(path: string): Promise<SerialPort> {
    return new Promise((resolve, reject) => {
      const port = new SerialPort(path);
      port.on("open", () => {
        port.removeAllListeners();
        resolve(port);
      });
      port.on("error", (err) => {
        port.removeAllListeners();
        reject(err);
      });
    });
  }
}

export default async function discoverAxidraws(): Promise<Axidraw[]> {
  const axidrawIDs = await waitForAxidraws();
  log(`Found axidraws: [${axidrawIDs.join(", ")}]`);
  const axidraws = axidrawIDs.map((id) => new Axidraw(id));

  log("Attempting to connect to all AxiDraws...");
  await Promise.all(axidraws.map((axidraw) => axidraw.connect()));
  return axidraws;
}

async function waitForAxidraws(timeout: number = 30000): Promise<string[]> {
  let eject = false;
  const clearEject = setTimeout(() => {
    eject = true;
    log(`Could not find any axidraws after waiting ${timeout}ms`);
  }, timeout);

  while (true) {
    if (eject) {
      return [];
    }
    const axidraws = await EBB.list();
    if (axidraws.length) {
      clearTimeout(clearEject);
      return axidraws;
    }
    await wait(1000);
  }
}
