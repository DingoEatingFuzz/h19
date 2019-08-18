import { Request, Response } from "express";

export default function(req: Request, res: Response, next: () => void) {
  res.sseSetup = () => {
    res.writeHead(200, {
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream"
    });
  };

  res.sseSend = (data) => {
    res.write("data: " + JSON.stringify(data) + "\n\n");
  };

  next();
}
