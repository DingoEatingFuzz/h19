import * as THREE from "three";
import { SVGRenderer } from "three/examples/jsm/renderers/SVGRenderer";

function Segment(x, y, z) {
  this._prev = [x, y, z];
  this.vertices = [];

  this.lineTo = function(x, y, z) {
    if (x.x) {
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

function lightning() {
  var start = new THREE.Vector3(0, 0, 0);
  var latest = start;
  var bounds = new Segment(start.x, start.y, start.z);

  function d(n, invert = false) {
    return n + (Math.random() * 0.1 - 0.01) * (invert ? -1 : 1);
  }

  while (latest.distanceTo(start) < 2) {
    latest = new THREE.Vector3(d(latest.x), d(latest.y, true), d(latest.z));
    bounds.lineTo(latest);
    if (bounds.vertices.length > 600) break;
  }

  var shape = segmentToThree(bounds);
  return shape;
}

function draw(renderer, seed) {
  const camera = new THREE.PerspectiveCamera(33, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 10;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(255, 255, 255);

  scene.add(bbox());

  var lightningCluster = new THREE.Group();
  lightningCluster.add(lightning());
  lightningCluster.add(lightning());
  lightningCluster.add(lightning());
  lightningCluster.add(lightning());
  lightningCluster.add(lightning());
  lightningCluster.add(lightning());
  lightningCluster.add(lightning());
  lightningCluster.add(lightning());
  lightningCluster.add(lightning());
  lightningCluster.add(lightning());

  lightningCluster.scale.setScalar(2.5);
  lightningCluster.position.x = -2;
  lightningCluster.position.y = 2;

  scene.add(lightningCluster);

  renderer.render(scene, camera);
  return [lightningCluster, scene, camera];
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

document.addEventListener("DOMContentLoaded", function() {
  const renderer = new SVGRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  var [cluster, scene, camera] = draw(renderer);
  requestAnimationFrame(function rotate() {
    cluster.rotateOnAxis(new THREE.Vector3(1, -1, 1).normalize(), 0.01);
    renderer.render(scene, camera);
    requestAnimationFrame(rotate);
  });

  document.body.addEventListener("click", function() {
    console.log(serialize(document.getElementsByTagName("svg")[0]));
  });
});
