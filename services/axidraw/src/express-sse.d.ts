declare namespace Express {
  export interface Response {
    sseSetup?: () => void;
    sseSend?: (data: any) => void;
  }
}
