import { flattenSVG } from "flatten-svg";
import { Window } from "svgdom";
import log from "./logger";
import { PaperSize } from "./saxi/paper-size";
import { Plan, PlanOptions } from "./saxi/planning";
import replan from "./saxi/replan";
import { Vec2 } from "./saxi/vec";

const window = new Window();

const planOptions: PlanOptions = {
  fitToPaper: true,
  marginMm: 0,
  paperSize: PaperSize.hashiconf.landscape,
  pathJoinRadius: 0.5,
  penDownHeight: 60,
  penUpHeight: 30,
  pointJoinRadius: 0,

  // Use black strokes, *all* black strokes
  selectedLayers: new Set(["#000000", "#000", "rgb(0,0,0)", "rgb(0, 0, 0)"]),

  penDownAcceleration: 200,
  penDownCorneringFactor: 0.127,
  penDownMaxVelocity: 50,

  penUpAcceleration: 400,
  penUpMaxVelocity: 200,

  penDropDuration: 0.12,
  penLiftDuration: 0.12,

  sortPaths: true,

  minimumPathLength: 0
};

export class SVG {
  public src: string = "";

  constructor(src: string) {
    this.src = src;
  }

  public plan(): Plan {
    const paths = this.readSvg();
    if (paths) {
      return replan(paths, planOptions);
    }
  }

  private readSvg(): Vec2[][] {
    if (!this.src) {
      log("SVG to plot was undefined");
      return null;
    }

    window.document.documentElement.innerHTML = this.src;
    const paths = flattenSVG(window.document.documentElement);
    // Turn geometry into a data structure like
    // [
    //   [ {x: 0, y: 0}, {x: 1, y:0} ],
    //   [ {x: 1, y: 0}, {x: 1, y:1} ],
    // ]
    const coords = paths.map((line: any) => {
      const motion = line.points.map(([x, y]: [number, number]) => ({ x, y }));
      motion.stroke = line.stroke;
      return motion;
    });
    return coords;
  }
}
