import * as THREE from "three";
import Preview from "./preview";

// const CONSUL_HOST = "http://hashi.plot.technology:8500";
const CONSUL_HOST = "http://localhost:8500";

window.onload = () => {
  const params = new URLSearchParams(location.search);
  const plotterID = params.get("plotter") || "plot1";
  let lastCanvas: HTMLCanvasElement;
  let lastSVG: SVGElement;

  const preview = new Preview(
    plotterID,
    CONSUL_HOST,
    (renderer: THREE.WebGLRenderer, svg: SVGElement) => {
      if (lastCanvas) {
        document.body.removeChild(lastCanvas);
      }
      if (lastSVG) {
        document.body.removeChild(lastSVG);
      }
      document.body.appendChild(renderer.domElement);
      document.body.appendChild(svg);
      lastCanvas = renderer.domElement;
      lastSVG = svg;
    }
  );

  preview.start();
};
