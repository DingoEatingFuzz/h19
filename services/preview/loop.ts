export default class Loop {
  private isStopped: boolean = false;
  private looper: () => Promise<void>;

  constructor(looper: () => Promise<void>) {
    this.looper = looper;
    this.start();
  }

  public stop(): void {
    this.isStopped = true;
  }

  private async start(): Promise<void> {
    while (!this.isStopped) {
      await this.looper();
    }
  }
}
