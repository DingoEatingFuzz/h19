declare namespace Express {
  export interface Response {
    sseSetup?: () => void;
    sseSend?: (data: any) => void;
  }
}

declare module "wake-lock";
declare module "svgdom";
declare module "flatten-svg";
