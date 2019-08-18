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
        image = "dingoeatingfuzz/h19-webhooks:0.3.9"
        port_map {
          api = 8081
        }
      }

      env {
        CONSUL_HOST = "hashi.plot.technology"
        CONSUL_PORT = "8500"
        NOMAD_HOST  = "http://hashi.plot.technology:4646"
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
}
