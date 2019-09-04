import * as THREE from "three";
import { SVGRenderer } from "three/examples/jsm/renderers/SVGRenderer";
import "d3-time";
import "d3-time-format";
import { scaleLinear, scaleTime } from "d3-scale";
import VagrantData from "./data/vagrant.json";
import PackerData from "./data/packer.json";
import TerraformData from "./data/terraform.json";
import VaultData from "./data/vault.json";
import ConsulData from "./data/consul.json";
import NomadData from "./data/nomad.json";

import VagrantFrame from "./frames/vagrant.svg";
import PackerFrame from "./frames/packer.svg";
import TerraformFrame from "./frames/terraform.svg";
import VaultFrame from "./frames/vault.svg";
import ConsulFrame from "./frames/consul.svg";
import NomadFrame from "./frames/nomad.svg";

normalizeData(VagrantData);
normalizeData(PackerData);
normalizeData(TerraformData);
normalizeData(VaultData);
normalizeData(ConsulData);
normalizeData(NomadData);

const dataMap = {
  vagrant: VagrantData,
  packer: PackerData,
  terraform: TerraformData,
  vault: VaultData,
  consul: ConsulData,
  nomad: NomadData
};

const pos = (scale, x, y, r) => ({ scale, x, y, r });
const positions = {
  vagrant: pos(2, -1.4, 1.6, -Math.PI / 4),
  packer: pos(1.33, -1.5, 1.5, -Math.PI / 4),
  terraform: pos(1.8, -1.5, 0.8, -0.7),
  vault: pos(1.9, -1.3, 1.5, -1.2),
  consul: pos(2, -1.5, 1.2, -0.85),
  nomad: pos(1.8, -1.3, 1.3, -0.6)
};

const frames = {
  vagrant: VagrantFrame,
  packer: PackerFrame,
  terraform: TerraformFrame,
  vault: VaultFrame,
  consul: ConsulFrame,
  nomad: NomadFrame
};

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

function authorToNumber(author) {
  // 0-25 based on first letter of name
  var char = author[0];
  if (!/[a-zA-Z]/.test(char)) return 13; // Neutral value
  return parseInt(char, 36) - 10;
}

function sample(count, list) {
  const toRemove = list.length - count;
  const pace = list.length / toRemove;
  const newList = list.slice();

  for (let i = 1; i <= newList.length; i += pace) {
    newList.splice(Math.floor(i), 1);
    i -= 1;
  }

  return newList;
}

function gitTree(data, dimensions, len) {
  const marked = [];
  let merges = data.all.filter((c) => c.parents.length === 2);
  if (len) {
    merges = sample(len, merges);
  }
  let segments = [];
  const tags = [];

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

  const commitToCoords = (commit, prev = new THREE.Vector3(0, 0, 0)) => {
    return new THREE.Vector3(
      X(commit.date),
      prev.y +
        (commit.diff
          ? Y(commit.diff.insertions - commit.diff.deletions)
          : YY(parseInt(commit.hash[0], 16))),
      prev.z + (commit.diff ? Z(commit.diff.files.length) : ZZ(authorToNumber(commit.author_name)))
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

  // The line of merge commits
  segments.push(main);

  const v1 = new THREE.Vector3(...main.vertices.slice(0, 3));
  const v2 = new THREE.Vector3(...main.vertices.slice(main.vertices.length - 3));
  const axis = new THREE.Vector3().subVectors(v2, v1).normalize();

  const group = new THREE.Group();
  segments.forEach((s, i) => {
    group.add(segmentToThree(s));
  });
  return [axis, group];
}

function draw(renderer, product = "vagrant", rotation = 0, len) {
  const camera = new THREE.PerspectiveCamera(
    33,
    document.body.clientWidth / document.body.clientHeight,
    0.1,
    100
  );
  camera.position.z = 10;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(255, 255, 255);

  scene.add(bbox());

  const data = dataMap[product] || VagrantData;
  const [axis, viz] = gitTree(data, new THREE.Vector3(2, 2, 2), len);
  const { scale, x, y, r } = positions[product || "vagrant"];

  viz.scale.setScalar(scale);
  viz.position.x = x;
  viz.position.y = y;
  viz.rotation.z = r;
  viz.rotateOnAxis(axis, rotation);

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

window.onload = () => {
  console.log(document.readyState);
  const renderer = new SVGRenderer();
  renderer.setSize(document.body.clientWidth, document.body.clientHeight);
  console.log(`W: ${document.body.clientWidth}, H: ${document.body.clientHeight}`);

  document.body.appendChild(renderer.domElement);

  const params = new URLSearchParams(location.search);
  const angle = parseFloat(params.get("seed") || 0, 10) * Math.PI * 2;
  const product = params.get("product");
  const maxLength = params.get("len");
  var [axis, cluster, scene, camera] = draw(renderer, product, angle, maxLength);

  fetch(frames[product] || NomadFrame)
    .then((res) => res.text())
    .then((svg) => {
      const bbox = document.getElementsByTagName("svg")[0].children[1].getBBox();
      const el = document.createElement("div");
      el.setAttribute(
        "style",
        [
          `width:${bbox.width.toFixed(2)}px`,
          `height:${bbox.height.toFixed(2)}px`,
          `position:fixed`,
          `top:50%`,
          `left:50%`,
          `transform:translate(-50%,-50%)`
        ].join(";")
      );
      el.innerHTML = svg;
      document.body.appendChild(el);
    });

  renderer.render(scene, camera);

  const shouldAnimate = params.has("animate");
  if (shouldAnimate) {
    requestAnimationFrame(function rotate() {
      cluster.rotateOnAxis(axis, 0.03);
      renderer.render(scene, camera);
      requestAnimationFrame(rotate);
    });
  }

  document.body.addEventListener("click", function() {
    console.log(extractSVG());
  });
};

// Provide a hook for puppeteer to call to easily get the SVG
window.extractSVG = function() {
  return serialize(document.getElementsByTagName("svg")[0]);
};
