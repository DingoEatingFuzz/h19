job "design" {
  datacenters = ["dc1"]

  type = "service"

  group "design" {
    count = 1

    constraint {
      distinct_hosts = true
    }

    task "design" {
      driver = "docker"

      config {
        image = "dingoetaingfuzz/h19-design:0.1.0"
        port_map {
          site = 8080
        }
      }

      resources {
        cpu = 200
        memory = 128
        network {
          mbits = 10
          port "site" {}
        }
      }

      service {
        name = "design"
        tags = ["urlprefix-/design strip=/design"]
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
