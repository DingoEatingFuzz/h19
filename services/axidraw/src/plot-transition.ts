import { PlotState } from "./plot-state";

export default class PlotTransition {
  public state: PlotState;
  public watch: Promise<any>;

  constructor(state: PlotState, watch?: Promise<any>) {
    this.state = state;
    this.watch = watch || Promise.resolve();
  }
}
