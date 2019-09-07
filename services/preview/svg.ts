import ConsulFrame from "./frames/consul.svg";
import NomadFrame from "./frames/nomad.svg";
import PackerFrame from "./frames/packer.svg";
import TerraformFrame from "./frames/terraform.svg";
import VagrantFrame from "./frames/vagrant.svg";
import VaultFrame from "./frames/vault.svg";

const frames: any = {
  consul: ConsulFrame,
  nomad: NomadFrame,
  packer: PackerFrame,
  terraform: TerraformFrame,
  vagrant: VagrantFrame,
  vault: VaultFrame
};

export default class Svg {
  public static cache: any = {};
  public static async get(product: string): Promise<any> {
    const cachedValue = this.cache[product];
    if (cachedValue) {
      return el(cachedValue);
    }

    const res = await fetch(frames[product]);
    const svgText = await res.text();
    this.cache[product] = svgText;

    return el(svgText);
  }
}

function el(str: string): SVGElement {
  const $el = document.createElement("div");
  $el.innerHTML = str;
  return $el.children[0] as SVGElement;
}
