import { default as _log } from "./logger";
import { PlotState } from "./plot-state";
import PlotTransition from "./plot-transition";

const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export default class PlotMachine {
  public readonly id: string;
  private state: PlotState = PlotState.IDLE;

  constructor(id: string) {
    this.id = id;
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
        this.state = PlotState.LOWERED;
        return new PlotTransition(this.state);

      case PlotState.LOWERED:
      case PlotState.FREE:
        this.log("Raising pen");
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
        return new PlotTransition(this.state);
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
          this.log("Plot finished, resetting state");
          this.state = newState;
          return new PlotTransition(this.state);
        }
    }

    this.log(`Could not transition to state "${newState}" from state "${this.state}"`);
    return new PlotTransition(this.state);
  }

  private log(msg: string): void {
    _log(`(id:${this.id}) ${msg}`);
  }
}
