import { Response } from "express";
import uuid from "uuid/v4";
import { Axidraw } from "./axidraw";
import { default as _log } from "./logger";
import Mark from "./mark";
import { PlotState } from "./plot-state";
import PlotTransition from "./plot-transition";
import { formatDuration } from "./saxi/util";

interface IPlotRequest {
  ts: number;
  res: Response;
}

const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export default class PlotMachine {
  public readonly id: string;
  public plotRequests: IPlotRequest[] = [];
  public activeRequest: IPlotRequest;
  public svg: string;
  private internalState: PlotState = PlotState.IDLE;
  private axidraw: Axidraw;
  private clearHeartbeatToken: any;
  private internalPlotKey: string;
  private consul: any;
  private prevDuration: number = 0;
  private marks: Mark[] = [];
  private isPolling: boolean = false;

  private set state(newState: PlotState) {
    this.consul.kv.set(`axidraw_${this.id}_state`, newState.toString());
    this.marks.forEach((mark) => {
      if (mark.state !== newState) {
        mark.changed = true;
      }
    });
    this.internalState = newState;
  }

  private get state() {
    return this.internalState;
  }

  public get plotKey() {
    return this.internalPlotKey;
  }

  constructor(id: string, axidraw: Axidraw, consul: any) {
    this.id = id;
    this.axidraw = axidraw;
    this.consul = consul;
    this.state = PlotState.RAISED;

    this.clearHeartbeatToken = this.heartbeat();
  }

  public getState(): PlotState {
    return this.internalState;
  }

  public single(): PlotTransition {
    switch (this.state) {
      case PlotState.IDLE:
      case PlotState.PLOTTING:
        this.log(`Action "single" has no transition for state "${this.state}"`);
        return new PlotTransition(this.state);

      case PlotState.RAISED:
        this.log("Lowering pen");
        this.axidraw.lowerPen();
        this.state = PlotState.LOWERED;
        return new PlotTransition(this.state);

      case PlotState.LOWERED:
      case PlotState.FREE:
        this.log("Raising pen");
        this.axidraw.raisePen();
        this.state = PlotState.RAISED;
        return new PlotTransition(this.state);
    }
  }

  public double(): PlotTransition {
    switch (this.state) {
      case PlotState.PLOTTING:
      case PlotState.LOWERED:
      case PlotState.FREE:
        this.log(`Action "double" has no transition for state "${this.state}"`);
        return new PlotTransition(this.state);

      case PlotState.IDLE:
      case PlotState.RAISED:
        this.log("Awaiting new SVG to plot");
        this.state = PlotState.IDLE;
        if (!this.isPolling) {
          const plotPollingPromise = this.pollForPlot();
          const mark = this.mark();
          plotPollingPromise.then(async () => {
            // If the plot machine doesn't transition to Plotting within
            // 15 seconds, start the polling loop again.
            await wait(15000);
            if (!mark.changed) {
              this.log(
                `Never heard back from accepted plot job ${this.activeRequest.ts}, canceling job.`
              );
              this.plotRequests.splice(this.plotRequests.indexOf(this.activeRequest), 1);
              this.double();
            }
            this.clearMark(mark);
          });
          return new PlotTransition(this.state, plotPollingPromise);
        }
        return new PlotTransition(this.state);
    }
  }

  public long(): PlotTransition {
    switch (this.state) {
      case PlotState.PLOTTING:
      case PlotState.LOWERED:
      case PlotState.FREE:
      case PlotState.IDLE:
        this.log(`Action "long" has no transition for state "${this.state}"`);
        return new PlotTransition(this.state);

      case PlotState.RAISED:
        this.log("Releasing motors");
        this.axidraw.disableMotors();
        this.state = PlotState.FREE;
        return new PlotTransition(this.state);
    }
  }

  public mark(): Mark {
    const mark = new Mark(this.state);
    this.marks.push(mark);
    return mark;
  }

  public transition(newState: PlotState): PlotTransition {
    switch (newState) {
      case PlotState.PLOTTING:
        if (this.state === PlotState.IDLE) {
          const plotPromise = this.axidraw.plot(this.svg);
          this.log(`Plotting an SVG (estimate: ${formatDuration(this.axidraw.estimate)})`);
          plotPromise.then((duration) => {
            this.prevDuration = duration;
          });
          this.state = newState;
          return new PlotTransition(this.state, plotPromise);
        }
      case PlotState.RAISED:
        if (this.state === PlotState.PLOTTING) {
          if (this.activeRequest) {
            // Remove the request from the queue
            this.plotRequests.splice(this.plotRequests.indexOf(this.activeRequest), 1);
            this.activeRequest.res.sseSend({ done: true, duration: this.prevDuration });
          }
          this.log(
            `Plot finished, resetting state (duration: ${formatDuration(this.prevDuration / 1000)})`
          );
          this.state = newState;
          return new PlotTransition(this.state);
        }

        // Best attempt at resetting the plotter
        this.axidraw.raisePen();
        this.state = newState;
        return new PlotTransition(this.state);
    }

    this.log(`Could not transition to state "${newState}" from state "${this.state}"`);
    return new PlotTransition(this.state);
  }

  private async pollForPlot(): Promise<IPlotRequest> {
    this.isPolling = true;
    while (true) {
      if (this.plotRequests.length) {
        // Grab the request with the earliest timestamp
        const nextRequest = this.plotRequests.sort((a, b) => a.ts - b.ts)[0];
        // Tell that request/connection/dispatch job to proceed
        this.internalPlotKey = uuid();
        this.log(`Queued plot job accepted: ${nextRequest.ts} (key: ${this.internalPlotKey})`);
        nextRequest.res.sseSend({ proceed: this.internalPlotKey });
        this.activeRequest = nextRequest;
        this.isPolling = false;
        return nextRequest;
      } else {
        await wait(1000);
      }
    }
  }

  private heartbeat() {
    return setInterval(() => {
      this.plotRequests.forEach((conn) => {
        conn.res.sseSend({ heartbeat: Date.now() });
      });
    }, 5000);
  }

  private stopHeartbeating(): void {
    if (this.clearHeartbeatToken) {
      clearInterval(this.clearHeartbeatToken);
    }
  }

  private clearMark(mark: Mark): void {
    const index = this.marks.indexOf(mark);
    if (index !== -1) {
      this.marks.splice(index, 1);
    }
  }

  private log(msg: string): void {
    _log(`(id:${this.id}) ${msg}`);
  }
}
