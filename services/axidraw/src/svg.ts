import { flattenSVG } from "flatten-svg";
import { Window } from "svgdom";
import { PaperSize } from "./saxi/paper-size";
import { Plan, PlanOptions } from "./saxi/planning";
import replan from "./saxi/replan";
import { Vec2 } from "./saxi/vec";

const window = new Window();

const planOptions: PlanOptions = {
  fitToPaper: false,
  marginMm: 20,
  paperSize: PaperSize.standard.USLetter.portrait,
  pathJoinRadius: 0.5,
  penDownHeight: 60,
  penUpHeight: 50,
  pointJoinRadius: 0,
  selectedLayers: new Set(),

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
    return replan(paths, planOptions);
  }

  private readSvg(): Vec2[][] {
    window.document.documentElement.innerHTML = this.src;
    const paths = flattenSVG(window.document.documentElement);
    // Turn geometry into a data structure like
    // [
    //   [ {x: 0, y: 0}, {x: 1, y:0} ],
    //   [ {x: 1, y: 0}, {x: 1, y:1} ],
    // ]
    return paths.map((line: any) => {
      return line.points.map(([x, y]: [number, number]) => ({ x, y }));
    });
  }
}
