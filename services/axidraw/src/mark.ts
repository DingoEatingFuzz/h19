import { PlotState } from "./plot-state";

export default class Mark {
  public changed: boolean;
  public state: PlotState;

  constructor(state: PlotState) {
    this.changed = false;
    this.state = state;
  }
}
