job "webhooks" {
  datacenters = ["dc1"]

  type = "service"

  group "webhooks" {
    count = 1

    constraint {
      distinct_hosts = true
    }

    task "webhooks" {
      driver = "docker"

      config {
        image = "dingoeatingfuzz/h19-preview:0.1.0"
        port_map {
          site = 8080
        }
      }

      resources {
        cpu = 500
        memory = 256
        network {
          mbits = 10
          port "site" {}
        }
      }

      service {
        name = "webhooks"
        tags = ["urlprefix-/preview strip=/preview"]
        port = "site"
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
}
