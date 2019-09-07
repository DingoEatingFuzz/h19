import {
  WebGLRenderer,
  PerspectiveCamera,
  Scene,
  Vector3,
  Color,
  BufferGeometry,
  Float32BufferAttribute,
  LineSegments,
  LineBasicMaterial,
  Group
} from "three";
import { SVGRenderer } from "three/examples/jsm/renderers/SVGRenderer";
import "d3-time";
import "d3-time-format";
import { scaleLinear, scaleTime } from "d3-scale";
import SeedRandom from "seedrandom";
import Consul from "./consul";
import Data from "./data";
import Svg from "./svg";
import Loop from "./loop";

interface PlotConfig {
  ts: number;
  product: string;
}

interface ICommit {
  diff: any;
  author_name: string;
  date: Date;
  hash: string;
  parents: string[];
}

interface IGitHashMap {
  [key: string]: number;
}

interface IGitSource {
  all: ICommit[];
  hashmap: IGitHashMap;
}

interface IPositions {
  [key: string]: IPosition;
}

interface IPosition {
  scale: number;
  x: number;
  y: number;
  r: number;
}

const pos = (scale: number, x: number, y: number, r: number) => ({ scale, x, y, r });
const positions: IPositions = {
  vagrant: pos(2, -1.4, 1.6, -Math.PI / 4),
  packer: pos(1.73, -1.5, 1.5, -Math.PI / 4),
  terraform: pos(1.8, -1.5, 0.8, -0.7),
  vault: pos(1.9, -1.3, 1.5, -1.2),
  consul: pos(2, -1.5, 1.2, -0.85),
  nomad: pos(1.8, -1.3, 1.3, -0.6)
};

const wait = (ms: number): Promise<void> =>
  new Promise((res) => {
    setTimeout(() => {
      res();
    }, ms);
  });

export default class Preview {
  public plotter: string;
  public consul: Consul;
  public rerender: (renderer: WebGLRenderer, svg: SVGElement) => void;
  private animation: Loop;

  constructor(
    plotter: string,
    consulHost: string,
    rerender: (renderer: WebGLRenderer, svg: SVGElement) => void
  ) {
    this.plotter = plotter;
    this.consul = new Consul(consulHost);
    this.rerender = rerender;
  }

  public async start(): Promise<void> {
    for await (let config of this.watch()) {
      if (this.animation) {
        this.animation.stop();
      }
      const [renderer, svg, animation] = await this.createScene(config);
      this.animation = animation;
      this.rerender(renderer, svg);
    }
  }

  private async *watch(): AsyncIterable<PlotConfig> {
    // start consul watch
    // on watch change, rerender
    while (true) {
      const config = await this.consul.watch(`axidraw_${this.plotter}_current`);
      yield JSON.parse(config);
      await wait(5000);
    }
  }

  private async createScene(config: PlotConfig): Promise<[WebGLRenderer, SVGElement, Loop]> {
    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    const size = Math.min(window.innerHeight, window.innerWidth) * 0.9;
    renderer.setSize(size, size);

    const rng = SeedRandom(config.ts.toString());

    // Draw the thing
    const camera = new PerspectiveCamera(33, 1, 0.1, 100);
    camera.position.z = 8.5;

    const scene = new Scene();
    scene.background = new Color(255, 255, 255);

    const data = await Data.get(config.product);
    const [axis, viz] = gitTree(data, new Vector3(2, 2, 2));
    const { scale, x, y, r } = positions[config.product || "vagrant"];

    viz.scale.setScalar(scale);
    viz.position.x = x;
    viz.position.y = y;
    viz.rotation.z = r;
    viz.rotateOnAxis(axis, rng() * Math.PI * 2);

    scene.add(viz);

    renderer.render(scene, camera);
    const animation = new Loop(async () => {
      await wait(5000);
      await new Promise((res) => {
        let cumulativeAngle = 0;
        let angle = (Math.PI * 2) / 120;
        requestAnimationFrame(function rotate() {
          viz.rotateOnAxis(axis, angle);
          renderer.render(scene, camera);

          cumulativeAngle += angle;
          if (cumulativeAngle < Math.PI * 2) {
            requestAnimationFrame(rotate);
          } else {
            res();
          }
        });
      });
    });

    const svg = await Svg.get(config.product);

    return [renderer, svg, animation];
  }
}

function gitTree(data: IGitSource, dimensions: Vector3): [Vector3, Group] {
  const marked: ICommit[] = [];
  let merges = data.all.filter((c) => c.parents.length === 2);
  let segments = [];

  // X => Date
  // Y => Insertions v. Deletions
  // Z => Files modified
  var X = scaleTime()
    .domain([data.all[0].date, data.all[data.all.length - 1].date])
    .range([0, dimensions.x])
    .clamp(true);
  var Y = scaleLinear()
    .domain([300, -300])
    .range([-dimensions.y / 50, dimensions.y / 50])
    .clamp(true);
  var YY = scaleLinear()
    .domain([0, 15])
    .range([-dimensions.y / 50, dimensions.y / 50])
    .clamp(true);
  var Z = scaleLinear()
    .domain([0, 30])
    .range([-dimensions.z / 150, dimensions.z / 50])
    .clamp(true);
  var ZZ = scaleLinear()
    .domain([0, 25])
    .range([-dimensions.z / 200, dimensions.z / 200]);

  const commitToCoords = (commit: ICommit, prev = new Vector3(0, 0, 0)) => {
    return new Vector3(
      X(commit.date),
      prev.y +
        (commit.diff
          ? Y(commit.diff.insertions - commit.diff.deletions)
          : YY(parseInt(commit.hash[0], 16))),
      prev.z + (commit.diff ? Z(commit.diff.files.length) : ZZ(authorToNumber(commit.author_name)))
    );
  };

  const walkTree = (d: IGitSource, m: ICommit[], commit: ICommit) => {
    let current = commit;
    const commits = [];
    while (true) {
      if (!current) break;
      if (m.includes(current)) break;
      commits.push(current);
      m.push(current);
      current = d.all[data.hashmap[current.parents[0]]];
    }
    return commits;
  };

  const plotTree = (d: IGitSource, m: ICommit[], p: Vector3, commit: ICommit) => {
    let prev = p;
    const line = new Segment(prev);
    const commits = walkTree(d, m, commit);

    for (let c of sample(50, commits)) {
      const coords = commitToCoords(c, prev);
      line.lineTo(coords);
      prev = coords;
    }

    if (line.vertices.length) return line;
  };

  const main = new Segment(new Vector3(0, 0, 0));
  let prev;
  for (let merge of merges) {
    // marked.push(merge, prev);
    marked.push(merge);
    const coords = commitToCoords(merge, prev);
    main.lineTo(coords);
    const left = plotTree(data, marked, coords, data.all[data.hashmap[merge.parents[0]]]);
    const right = plotTree(data, marked, coords, data.all[data.hashmap[merge.parents[1]]]);
    if (left) segments.push(left);
    if (right) segments.push(right);
    prev = coords;
  }

  // The line of merge commits
  segments.push(main);

  const v1 = new Vector3(...main.vertices.slice(0, 3));
  const v2 = new Vector3(...main.vertices.slice(main.vertices.length - 3));
  const axis = new Vector3().subVectors(v2, v1).normalize();

  const group = new Group();
  segments.forEach((s, i) => {
    group.add(segmentToThree(s));
  });
  return [axis, group];
}

class Segment {
  private prev: Vector3;
  public vertices: number[] = [];
  constructor(coords: Vector3) {
    this.prev = coords;
  }

  public lineTo(coords: Vector3): Segment {
    this.vertices.push(this.prev.x, this.prev.y, this.prev.z);
    this.prev = coords;
    this.vertices.push(coords.x, coords.y, coords.z);
    return this;
  }
}

function segmentToThree(segment: Segment, m?: any) {
  var material = Object.assign({ color: 0, linewidth: 1 }, m);
  var geo = new BufferGeometry();
  geo.addAttribute("position", new Float32BufferAttribute(segment.vertices, 3));

  return new LineSegments(geo, new LineBasicMaterial(material));
}

function authorToNumber(author: string): number {
  // 0-25 based on first letter of name
  var char = author[0];
  if (!/[a-zA-Z]/.test(char)) return 13; // Neutral value
  return parseInt(char, 36) - 10;
}

function sample(count: number, list: any[]): any[] {
  const newList = list.slice();

  if (count > list.length) {
    return newList;
  }

  const toRemove = list.length - count;
  const pace = list.length / toRemove;

  for (let i = 1; i <= newList.length; i += pace) {
    newList.splice(Math.floor(i), 1);
    i -= 1;
  }

  return newList;
}

function bbox() {
  var bbounds = new Segment(new Vector3(-1, 0, -1))
    .lineTo(new Vector3(-1, 0, 1))
    .lineTo(new Vector3(1, 0, 1))
    .lineTo(new Vector3(1, 0, -1))
    .lineTo(new Vector3(-1, 0, -1));

  var box = segmentToThree(bbounds, { color: "red", linewidth: 2 });
  box.scale.setScalar(2.5);
  box.rotation.x = Math.PI / 2;

  return box;
}
