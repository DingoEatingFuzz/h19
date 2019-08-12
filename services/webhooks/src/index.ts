import axios from "axios";
import express from "express";
import Backend from "./backend";
import log from "./logger";

const backend = new Backend();

const app = express();
const port = 8081;

let axidrawAddress: string;

app.get("/", (req, res) => {
  res.json({ healthy: true });
});

app.post("/single/:id", async (req, res) => {
  // Get state of axidraw
  const state = await backend.getState(req.params.id);
  log(`What is it? ${req.params.id} ${state}`);
  if (state) {
    if (state === "idle" || state === "plotting") {
      log(`State is "${state}", queuing new plot job`);
      res.send({ status: 200, message: "Queued new plot job", id: req.params.id });
    } else {
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
  // If currently idle or plotting, dispatch job
  // otherwise, proxy request
});

app.post("/*", async (req, res) => {
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
