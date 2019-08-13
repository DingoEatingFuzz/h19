job "webhooks" {
  datacenters = ["dc1"]

  type = "service"

  task "webhooks" {
    driver = "docker"

    config {
      image = "https://gcr.io/hashiconf19/webhooks:0.0.1"
      auth {
        server_address = "https://gcr.io"
      }
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
      tags = ["webhooks", "urlprefix-/"]
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