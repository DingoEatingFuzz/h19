import express from "express";
import log from "./logger";
import PlotMachine from "./plot-machine";
import { PlotState } from "./plot-state";
import PlotTransition from "./plot-transition";

const app = express();
const port = 8080;

const fsm = new PlotMachine();

app.get("/", (req, res) => {
  res.send("Hello world");
});

app.get("/state", (req, res) => {
  res.json({ state: fsm.getState() });
});

app.post("/single", (req, res) => {
  const prev = fsm.getState();
  const transition: PlotTransition = fsm.single();

  res.json({ previousState: prev, state: transition.state });
});

app.post("/double", (req, res) => {
  const prev = fsm.getState();
  const transition: PlotTransition = fsm.double();

  res.json({ previousState: prev, state: transition.state });
});

app.post("/long", (req, res) => {
  const prev = fsm.getState();
  const transition: PlotTransition = fsm.long();

  res.json({ previousState: prev, state: transition.state });
});

app.post("/plot", (req, res) => {
  const prev = fsm.getState();
  const transition = fsm.transition(PlotState.PLOTTING);

  transition.watch.then(() => {
    fsm.transition(PlotState.RAISED);
  });

  res.json({ success: prev !== transition.state, state: transition.state });
});

app.post("/*", (req, res) => {
  res.status(404);
  res.json({ status: 404, error: "Endpoint not found" });
});

app.listen(port, () => {
  log(`Server started at http://localhost:${port}`);
});
