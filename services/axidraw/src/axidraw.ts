import SerialPort from "serialport";
import WakeLock from "wake-lock";
import log from "./logger";
import { EBB } from "./saxi/ebb";
import { Device } from "./saxi/planning";
import { SVG } from "./svg";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

enum AxidrawStatus {
  UP = "up",
  DOWN = "down",
  CONNECTING = "connecting",
  PLOTTING = "plotting"
}

export class Axidraw {
  public com: string;
  public estimate: number = 0;
  private privateStatus: AxidrawStatus;
  private ebb: EBB;

  public get status(): AxidrawStatus {
    return this.privateStatus;
  }

  public get isUp(): boolean {
    return this.privateStatus === AxidrawStatus.UP || this.privateStatus === AxidrawStatus.PLOTTING;
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

  public async enableMotors(): Promise<boolean> {
    if (this.isUp) {
      await this.ebb.enableMotors(2);
      return true;
    }
    return false;
  }

  public async disableMotors(): Promise<boolean> {
    if (this.isUp) {
      await this.ebb.disableMotors();
      return true;
    }
    return false;
  }

  public async raisePen(): Promise<boolean> {
    if (this.isUp) {
      await this.enableMotors();
      await this.ebb.setPenHeight(Device.Axidraw.penPctToPos(30), 1000);
      return true;
    }
    return false;
  }

  public async lowerPen(): Promise<boolean> {
    if (this.isUp) {
      await this.enableMotors();
      await this.ebb.setPenHeight(Device.Axidraw.penPctToPos(60), 1000);
      return true;
    }
    return false;
  }

  public async plot(svg: string): Promise<number> {
    if (this.isUp) {
      const plan = new SVG(svg).plan();
      this.estimate = plan.duration();
      this.privateStatus = AxidrawStatus.PLOTTING;

      const lock = this.lock();
      const begin = Date.now();

      try {
        await this.raisePen();
        for (const motion of plan.motions) {
          await this.ebb.executeMotion(motion);
        }
        log(`Plot finished, waiting for motors to be idle...`);
        await this.ebb.waitUntilMotorsIdle();

        const end = Date.now();
        return end - begin;
      } finally {
        if (lock) {
          lock.release();
        }
      }
    }
    return null;
  }

  private lock() {
    try {
      return new WakeLock("plotting");
    } catch (err) {
      log(`WARNING: Could not acquire wake lock.`);
    }
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
      return axidraws.sort();
    }
    await wait(1000);
  }
}
