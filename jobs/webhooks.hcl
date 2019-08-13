job "webhooks" {
  datacenters = ["dc1"]

  type = "service"

  task "webhooks" {
    driver = "docker"

    config {
      image = "dingoeatingfuzz/h19-webhooks:0.1.0"
      port_map {
        api = 8081
      }
    }

    env {
      CONSUL_HOST = "hashi.plot.technology:8500"
    }

    resources {
      cpu = 500
      memory = 256
      network {
        mbits = 10
        port "api" {}
      }
    }

    service {
      name = "webhooks"
      tags = ["urlprefix-/webhooks strip=/webhooks"]
      port = "api"
      check {
        name = "alive"
        type = "http"
        path = "/"
        interval = "30s"
        timeout = "2s"
      }
    }
  }
}