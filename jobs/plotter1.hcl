job "plotter1" {
  datacenters = ["dc1"]

  type = "batch"

  parameterized {
    payload = "required"
  }

  group "plot" {
    task "plot" {
      driver = "docker"

      config {
        image = "dingoeatingfuzz/h19-plot:0.0.1"
      }

      dispatch_payload {
        file = "config.json"
      }

      env {
        CONSUL_HOST = "hashi.plot.technology:8500"
      }

      resources {
        cpu = 200
        memory = 128
      }
    }
  }
}
