import log from "./logger";
import { PlotState } from "./plot-state";
import PlotTransition from "./plot-transition";

const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export default class PlotMachine {
  public state: PlotState = PlotState.IDLE;

  public getState(): PlotState {
    return this.state;
  }

  public single(): PlotTransition {
    switch (this.state) {
      case PlotState.IDLE:
      case PlotState.PLOTTING:
        log(`Action "single" has no transition for state "${this.state}"`);
        return new PlotTransition(this.state);

      case PlotState.RAISED:
        log("Lowering pen");
        this.state = PlotState.LOWERED;
        return new PlotTransition(this.state);

      case PlotState.LOWERED:
      case PlotState.FREE:
        log("Raising pen");
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
        log(`Action "double" has no transition for state "${this.state}"`);
        return new PlotTransition(this.state);

      case PlotState.RAISED:
        log("Releasing motors");
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
        log(`Action "long" has no transition for state "${this.state}"`);
        return new PlotTransition(this.state);

      case PlotState.RAISED:
        log("Awaiting new SVG to plot");
        this.state = PlotState.IDLE;
        return new PlotTransition(this.state);
    }
  }

  public transition(newState: PlotState): PlotTransition {
    switch (newState) {
      case PlotState.PLOTTING:
        if (this.state === PlotState.IDLE) {
          log("Plotting an SVG");
          this.state = newState;
          return new PlotTransition(this.state, wait(5000));
        }
      case PlotState.RAISED:
        if (this.state === PlotState.PLOTTING) {
          log("Plot finished, resetting state");
          this.state = newState;
          return new PlotTransition(this.state);
        }
    }

    log(`Could not transition to state "${newState}" from state "${this.state}"`);
    return new PlotTransition(this.state);
  }
}
