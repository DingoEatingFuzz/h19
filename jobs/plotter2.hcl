job "plotter2" {
  datacenters = ["dc1"]

  type = "batch"

  parameterized {
    payload = "required"
  }

  group "plot" {
    restart {
      attempts = 0
      mode     = "fail"
    }

    reschedule {
      attempts = 0
    }

    task "plot" {
      driver = "docker"

      config {
        image = "dingoeatingfuzz/h19-plot:0.2.0"
      }

      dispatch_payload {
        file = "config.json"
      }

      env {
        CONSUL_HOST = "hashi.plot.technology"
        CONSUL_PORT = "8500"
        PLOTTER_ID  = "plot2"
        DESIGN_URL  = "http://services.hashi.plot.technology/design"
      }

      resources {
        cpu = 200
        memory = 128
      }
    }
  }
}
