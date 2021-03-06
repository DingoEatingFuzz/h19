import Consul from "consul";
import express, { Request, Response } from "express";
import discoverAxidraws from "./axidraw";
import log from "./logger";
import PlotMachine from "./plot-machine";
import { PlotState } from "./plot-state";
import PlotTransition from "./plot-transition";
import sse from "./sse";

const app = express();
const port = 8080;
const MAX_QUEUE_LENGTH = 10;

const CONSUL_HOST = process.env.CONSUL_HOST;
const CONSUL_PORT = process.env.CONSUL_PORT || "8500";

const consul = Consul({
  host: CONSUL_HOST,
  port: CONSUL_PORT,
  promisify: (fn: any) => {
    return new Promise((resolve, reject) => {
      try {
        return fn((err: any, data: any, res: any) => {
          if (err) {
            err.res = res;
            return reject(err);
          }
          return resolve([data, res]);
        });
      } catch (err) {
        return reject(err);
      }
    });
  }
});

app.use(sse);
app.use(express.json({ limit: "50mb" }));

const fsms: { [s: string]: PlotMachine } = {};

const fsmHandler = (handler: (fsm: PlotMachine, req: Request, res: Response) => void) => (
  req: Request,
  res: Response
) => {
  const fsm = fsms[req.params.id];
  if (!fsm) {
    res.status(400);
    res.json({ status: 400, error: `No plotter with ID: ${req.params.id}` });
  } else {
    handler(fsm, req, res);
  }
};

app.get("/", (req, res) => {
  res.json({ healthy: true, message: "I am a plotter server" });
});

app.get(
  "/state/:id",
  fsmHandler((fsm, req, res) => {
    res.json({ state: fsm.getState(), id: fsm.id });
  })
);

app.post(
  "/single/:id",
  fsmHandler((fsm, req, res) => {
    const prev = fsm.getState();
    const transition: PlotTransition = fsm.single();

    res.json({ previousState: prev, state: transition.state, id: fsm.id });
  })
);

app.post(
  "/double/:id",
  fsmHandler((fsm, req, res) => {
    const prev = fsm.getState();
    const transition: PlotTransition = fsm.double();

    res.json({ previousState: prev, state: transition.state, id: fsm.id });
  })
);

app.post(
  "/long/:id",
  fsmHandler((fsm, req, res) => {
    const prev = fsm.getState();
    const transition: PlotTransition = fsm.long();

    res.json({ previousState: prev, state: transition.state, id: fsm.id });
  })
);

app.post(
  "/plot/:id",
  fsmHandler((fsm, req, res) => {
    const prev = fsm.getState();
    const { key, svg } = req.body;

    if (key !== fsm.plotKey) {
      // Key does not match the uuid in the latest proceed event
      res.status(403);
      res.json({
        error: "Unauthorized request: keys do not match",
        id: fsm.id,
        state: prev,
        status: 403,
        success: false
      });
    } else {
      // If the state machine allows it, proceed with plotting
      // Set the svg from the request
      fsm.svg = svg;
      const transition = fsm.transition(PlotState.PLOTTING);
      if (prev !== transition.state) {
        transition.watch.then(() => {
          // When plotting has finished, go back to the RAISED state
          fsm.transition(PlotState.RAISED);
        });
        // Immediately inform the plot job
        res.json({ success: prev !== transition.state, state: transition.state, id: fsm.id });
      } else {
        res.status(400);
        res.json({ success: false, status: 400, state: transition.state, id: fsm.id });
      }
    }
  })
);

app.post(
  "/reset/:id",
  fsmHandler((fsm, req, res) => {
    log("FORCED: resetting plotter state to the RAISED position");
    fsm.transition(PlotState.RAISED);
    res.json({ success: true, status: 200, state: PlotState.RAISED, id: fsm.id });
  })
);

app.get(
  "/queue/:id",
  fsmHandler((fsm, req, res) => {
    const ts = req.query.ts;
    res.sseSetup();
    if (fsm.plotRequests.length >= MAX_QUEUE_LENGTH) {
      log(`Plot job denied due to max queue length: ${ts}`);
      res.sseSend({ connected: false, reason: `Queue full (${MAX_QUEUE_LENGTH} entries)` });
    } else {
      log(`New plot job in queue: ${ts}`);
      res.sseSend({ connected: true });
      fsm.plotRequests.push({ res, ts });
    }
  })
);

app.post("/*", (req, res) => {
  res.status(404);
  res.json({ status: 404, error: "Endpoint not found" });
});

log(`Looking for axidraws...`);
discoverAxidraws().then((axidraws) => {
  axidraws.forEach((axidraw, index) => {
    const id = `plot${index + 1}`;
    log(`Registering PlotMachine: ${id}`);
    fsms[id] = new PlotMachine(id, axidraw, consul);
  });

  app.listen(port, () => {
    log(`Server started at http://localhost:${port}`);
  });
});
