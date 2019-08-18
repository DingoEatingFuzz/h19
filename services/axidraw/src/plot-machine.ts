import { Response } from "express";
import uuid from "uuid/v4";
import { Axidraw } from "./axidraw";
import { default as _log } from "./logger";
import { PlotState } from "./plot-state";
import PlotTransition from "./plot-transition";

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
  private state: PlotState = PlotState.IDLE;
  private axidraw: Axidraw;
  private clearHeartbeatToken: any;
  private internalPlotKey: string;

  public get plotKey() {
    return this.internalPlotKey;
  }

  constructor(id: string, axidraw: Axidraw) {
    this.id = id;
    this.axidraw = axidraw;
    this.clearHeartbeatToken = this.heartbeat();
  }

  public getState(): PlotState {
    return this.state;
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
      case PlotState.IDLE:
      case PlotState.PLOTTING:
      case PlotState.LOWERED:
      case PlotState.FREE:
        this.log(`Action "double" has no transition for state "${this.state}"`);
        return new PlotTransition(this.state);

      case PlotState.RAISED:
        this.log("Releasing motors");
        this.axidraw.disableMotors();
        this.state = PlotState.FREE;
        return new PlotTransition(this.state);
    }
  }

  public long(): PlotTransition {
    switch (this.state) {
      case PlotState.IDLE:
      case PlotState.PLOTTING:
      case PlotState.LOWERED:
      case PlotState.FREE:
        this.log(`Action "long" has no transition for state "${this.state}"`);
        return new PlotTransition(this.state);

      case PlotState.RAISED:
        this.log("Awaiting new SVG to plot");
        this.state = PlotState.IDLE;
        return new PlotTransition(this.state, this.pollForPlot());
    }
  }

  public transition(newState: PlotState): PlotTransition {
    switch (newState) {
      case PlotState.PLOTTING:
        if (this.state === PlotState.IDLE) {
          this.log("Plotting an SVG");
          this.state = newState;
          return new PlotTransition(this.state, wait(5000));
        }
      case PlotState.RAISED:
        if (this.state === PlotState.PLOTTING) {
          if (this.activeRequest) {
            this.activeRequest.res.sseSend({ done: true });
          }
          this.log("Plot finished, resetting state");
          this.state = newState;
          return new PlotTransition(this.state);
        }
    }

    this.log(`Could not transition to state "${newState}" from state "${this.state}"`);
    return new PlotTransition(this.state);
  }

  private async pollForPlot(): Promise<IPlotRequest> {
    while (true) {
      if (this.plotRequests.length) {
        // Grab the request with the earliest timestamp
        const nextRequest = this.plotRequests.sort((a, b) => a.ts - b.ts)[0];
        // Tell that request/connection/dispatch job to proceed
        this.internalPlotKey = uuid();
        nextRequest.res.sseSend({ proceed: this.internalPlotKey });
        // Remove the request from the queue
        this.plotRequests.splice(this.plotRequests.indexOf(nextRequest), 1);
        this.activeRequest = nextRequest;
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

  private log(msg: string): void {
    _log(`(id:${this.id}) ${msg}`);
  }
}
