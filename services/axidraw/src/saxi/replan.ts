import * as Optimization from "./optimization";
import { Device, PlanOptions, Plan } from "./planning";
import * as Planning from "./planning";
import { dedupPoints, scaleToPaper } from "./util";
import { Vec2, vmul } from "./vec";

export default function replan(inPaths: Vec2[][], planOptions: PlanOptions): Plan {
  let paths = inPaths;

  if (planOptions.fitToPaper) {
    // Compute scaling using _all_ the paths, so it's the same no matter what
    // layers are selected.
    paths = scaleToPaper(paths, planOptions.paperSize, planOptions.marginMm);
  }

  // Rescaling loses the stroke info, so refer back to the original paths to
  // filter based on the stroke. Rescaling doesn't change the number or order
  // of the paths.
  // paths = paths.filter((path, i) => planOptions.selectedLayers.has((inPaths[i] as any).stroke));

  if (planOptions.pointJoinRadius > 0) {
    paths = paths.map((p) => dedupPoints(p, planOptions.pointJoinRadius));
  }

  if (planOptions.sortPaths) {
    paths = Optimization.optimize(paths);
  }

  if (planOptions.minimumPathLength > 0) {
    paths = Optimization.elideShortPaths(paths, planOptions.minimumPathLength);
  }

  if (planOptions.pathJoinRadius > 0) {
    paths = Optimization.joinNearby(paths, planOptions.pathJoinRadius);
  }

  // Convert the paths to units of "steps".
  paths = paths.map((ps) => ps.map((p) => vmul(p, Device.Axidraw.stepsPerMm)));

  // And finally, motion planning.
  const plan = Planning.plan(paths, {
    penDownPos: Device.Axidraw.penPctToPos(planOptions.penDownHeight),
    penDownProfile: {
      acceleration: planOptions.penDownAcceleration * Device.Axidraw.stepsPerMm,
      corneringFactor: planOptions.penDownCorneringFactor * Device.Axidraw.stepsPerMm,
      maximumVelocity: planOptions.penDownMaxVelocity * Device.Axidraw.stepsPerMm
    },
    penDropDuration: planOptions.penDropDuration,
    penLiftDuration: planOptions.penLiftDuration,
    penUpPos: Device.Axidraw.penPctToPos(planOptions.penUpHeight),
    penUpProfile: {
      acceleration: planOptions.penUpAcceleration * Device.Axidraw.stepsPerMm,
      corneringFactor: 0,
      maximumVelocity: planOptions.penUpMaxVelocity * Device.Axidraw.stepsPerMm
    }
  });

  return plan;
}
