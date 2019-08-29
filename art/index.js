import * as THREE from "three";
import { SVGRenderer } from "three/examples/jsm/renderers/SVGRenderer";
import "d3-time";
import "d3-time-format";
import { scaleLinear, scaleTime } from "d3-scale";
import NomadData from "./data/nomad.json";

console.log("Did it work?");
console.log(NomadData);

window.nd = NomadData;

function Segment(x, y, z) {
  this._prev = [x, y, z];
  this.vertices = [];

  this.lineTo = function(x, y, z) {
    if (x.x != null) {
      z = x.z;
      y = x.y;
      x = x.x;
    }
    this.vertices.push(...this._prev);
    this._prev = [x, y, z];
    this.vertices.push(x, y, z);

    return this;
  };
}

function segmentToThree(segment, m) {
  var material = Object.assign({ color: 0, linewidth: 1 }, m);
  var geo = new THREE.BufferGeometry();
  geo.addAttribute("position", new THREE.Float32BufferAttribute(segment.vertices, 3));

  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial(material));
}

function bbox() {
  var bbounds = new Segment(-1, 0, -1)
    .lineTo(-1, 0, 1)
    .lineTo(1, 0, 1)
    .lineTo(1, 0, -1)
    .lineTo(-1, 0, -1);

  var box = segmentToThree(bbounds, { color: "red", linewidth: 2 });
  box.scale.setScalar(2.5);
  box.rotation.x = Math.PI / 2;

  return box;
}

function gitTree(data, dimensions) {
  const marked = [];
  const merges = data.all.filter((c) => c.parents.length === 2);
  const segments = [];
  const tags = [];

  // X => Date
  // Y => Insertions v. Deletions
  // Z => Files modified
  var X = scaleTime()
    .domain([data.all[0].date, data.all[data.all.length - 1].date])
    .range([0, dimensions.x]);
  var Y = scaleLinear()
    .domain([300, -300])
    .range([-dimensions.y / 50, dimensions.y / 50])
    .clamp(true);
  var Z = scaleLinear()
    .domain([0, 30])
    .range([-dimensions.z / 150, dimensions.z / 50])
    .clamp(true);

  const commitToCoords = (commit, prev = new THREE.Vector3(0, 0, 0)) => {
    return new THREE.Vector3(
      X(commit.date),
      prev.y + Y(commit.diff ? commit.diff.insertions - commit.diff.deletions : 0),
      prev.z + (commit.diff ? Z(commit.diff.files.length) : 0)
    );
  };

  const walkTree = (d, m, p, commit) => {
    let current = commit;
    let prev = p;
    const line = new Segment(prev.x, prev.y, prev.z);
    while (true) {
      if (!current) break;
      if (m.includes(current)) break;
      const coords = commitToCoords(current, prev);
      line.lineTo(coords);
      prev = coords;
      m.push(current);
      current = d.all[data.hashmap[current.parents[0]]];
    }
    if (line.vertices.length) return line;
  };

  const main = new Segment(0, 0, 0);
  let prev;
  for (let merge of merges) {
    marked.push(merge, prev);
    const coords = commitToCoords(merge, prev);
    main.lineTo(coords);
    const left = walkTree(data, marked, coords, data.all[data.hashmap[merge.parents[0]]]);
    const right = walkTree(data, marked, coords, data.all[data.hashmap[merge.parents[1]]]);
    if (left) segments.push(left);
    if (right) segments.push(right);
    prev = coords;
  }

  // The line of merge commits, is it necessary?
  // segments.push(main);

  const v1 = new THREE.Vector3(...main.vertices.slice(0, 3));
  const v2 = new THREE.Vector3(...main.vertices.slice(main.vertices.length - 3));
  const axis = new THREE.Vector3().subVectors(v2, v1).normalize();

  const group = new THREE.Group();
  segments.forEach((s, i) => {
    group.add(segmentToThree(s));
  });
  return [axis, group];
}

function draw(renderer, seed) {
  const camera = new THREE.PerspectiveCamera(33, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 10;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(255, 255, 255);

  scene.add(bbox());

  normalizeData(NomadData);
  const [axis, viz] = gitTree(NomadData, new THREE.Vector3(2, 2, 2));

  viz.scale.setScalar(2);
  viz.position.x = -1;
  viz.position.y = 1;
  viz.rotation.z = -Math.PI / 4;

  scene.add(viz);

  renderer.render(scene, camera);
  return [axis, viz, scene, camera];
}

function serialize(svg) {
  inlineStroke(svg);
  return svg.outerHTML;
}

function inlineStroke(el) {
  const presentationTags = ["path", "rect", "circle", "ellipse", "line", "polygon", "polyline"];
  if (presentationTags.includes(el.tagName) && el.style.stroke) {
    el.setAttribute("stroke", el.style.stroke);
  }
  el.children && Array.from(el.children).forEach(inlineStroke);
}

function normalizeData(data) {
  data.all.forEach((commit) => {
    commit.date = new Date(commit.date);
  });
}

document.addEventListener("DOMContentLoaded", function() {
  const renderer = new SVGRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  var [axis, cluster, scene, camera] = draw(renderer);
  requestAnimationFrame(function rotate() {
    cluster.rotateOnAxis(axis, 0.01);
    renderer.render(scene, camera);
    requestAnimationFrame(rotate);
  });

  document.body.addEventListener("click", function() {
    console.log(serialize(document.getElementsByTagName("svg")[0]));
  });
});
