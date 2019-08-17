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
        image = "dingoeatingfuzz/h19-plot:0.0.3"
      }

      dispatch_payload {
        file = "config.json"
      }

      env {
        CONSUL_HOST = "hashi.plot.technology"
        CONSUL_PORT = "8500"
      }

      resources {
        cpu = 200
        memory = 128
      }
    }
  }
}
