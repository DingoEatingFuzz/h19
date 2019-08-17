import axios from "axios";
import express from "express";
import { default as Backend, IDispatchResponse } from "./backend";
import { debug, default as log } from "./logger";

const backend = new Backend();
const DEBUG = !!process.env.DEBUG;

const app = express();
const port = 8081;

let axidrawAddress: string;

app.get("/", (req, res) => {
  debug(`Request made to ${req.url}`);
  res.json({ healthy: true });
});

app.post("/single/:id", async (req, res) => {
  debug(`Request made to ${req.url}`);

  const state = await backend.getState(req.params.id);
  log(`What is it? ${req.params.id} ${state}`);

  if (state) {
    if (state === "idle" || state === "plotting") {
      // Queue a job when idle or plotting
      log(`State is "${state}", queuing new plot job`);
      try {
        const dispatched: IDispatchResponse = await backend.submitJob(req.params.id);
        res.send({
          id: req.params.id,
          jobId: dispatched.DispatchedJobID,
          message: "Queued new plot job",
          status: 200
        });
      } catch (err) {
        res.status(500);
        res.send({
          error: `Could not queue job for plotter "${req.params.id}": ${err}`,
          status: 500
        });
      }
    } else {
      // Proxy the request to the local axidraw service otherwise
      try {
        const proxyResponse = await axios.get(`${axidrawAddress}/single/${req.params.id}`);
        res.status(307);
        res.send(proxyResponse);
      } catch (err) {
        res.status(500);
        res.send({
          error: `Could not proxy request to axidraw service at ${axidrawAddress}`,
          status: 500
        });
      }
    }
  } else {
    log(`ERROR: Could not read state for plotter "${req.params.id}" from Consul.`);
    res.status(500);
    res.send({
      error: `Could not read state for plotter "${req.params.id}" from Consul.`,
      status: 500
    });
  }
});

app.get("/*", (req, res) => {
  debug(`Request made to nonexistent path ${req.url}`);
  res.status(404);
  res.json({ status: 404, error: "Not found" });
});

app.post("/*", async (req, res) => {
  debug(`Request made to ${req.url}`);
  try {
    const proxyResponse = await axios.post(`${axidrawAddress}${req.url}`, req.body);
    res.status(200);
    res.json(proxyResponse);
  } catch (err) {
    res.status(500);
    res.send({
      error: `Could not proxy request to axidraw service at ${axidrawAddress}`,
      status: 500
    });
  }
});

log("Connecting to Consul...");
backend.start().then(
  (address) => {
    axidrawAddress = address as string;
    log(`Captured axidraw address as ${axidrawAddress}`);
    app.listen(port, () => {
      log(`Server started at http://localhost:${port}`);
    });
  },
  () => {
    log("Could not connect to Consul. Process terminating");
    process.exit(1);
  }
);
