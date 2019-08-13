variable "name" {}
variable "region" {}
variable "zone" {}
variable "image" {}
variable "server_machine_type" {}
variable "client_machine_type" {}
variable "server_count" {}
variable "client_count" {}
variable "nomad_binary" {}
variable "root_block_device_size" {}
variable "client_block_size" {}
variable "whitelist_ip" {}
variable "service_port" {
  default = 80
}

variable "retry_join" {
  type = "map"

  default = {
    provider  = "gce"
    tag_value = "auto-join"
  }
}

//
// Security
//

resource "google_compute_network" "default" {
  name = "${var.name}-network"
}

resource "google_compute_firewall" "server_lb" {
  name = "${var.name}-server-lb"
  network = "${google_compute_network.default.name}"
  source_ranges = ["${var.whitelist_ip}"]

  allow {
    protocol = "tcp"
    ports = ["4646", "8500", "8200", "9998", "9999"]
  }
}

resource "google_compute_firewall" "primary" {
  name   = "${var.name}"
  network = "${google_compute_network.default.name}"
  source_ranges = ["${var.whitelist_ip}"]

  allow {
    protocol = "tcp"
    ports = ["22", "4646", "4647", "4648", "8200", "8300-8302", "8500-8502", "8600", "9998", "21000-21255"]
  }
}

//
// Server nodes
//

data "template_file" "user_data_server" {
  template = "${file("${path.root}/user-data-server.sh")}"

  vars = {
    server_count = "${var.server_count}"
    retry_join   = "${chomp(join(" ", formatlist("%s=%s", keys(var.retry_join), values(var.retry_join))))}"
    nomad_binary = "${var.nomad_binary}"
  }
}

resource "google_compute_instance_template" "server_template" {
  name = "${var.name}-server-template"
  tags = [ "allow-ssh", "server-template", "${lookup(var.retry_join, "tag_value")}" ]

  labels = {
    environment = "prod"
  }

  instance_description = "Server node"
  machine_type = "${var.server_machine_type}"
  can_ip_forward = false

  scheduling  {
    automatic_restart = true
    on_host_maintenance = "MIGRATE"
  }

  disk {
    source_image = "${var.image}"
    auto_delete = true
    boot = true
  }

  network_interface {
    network = "${google_compute_network.default.name}"
    access_config {}
  }

  metadata_startup_script = "${data.template_file.user_data_server.rendered}"

  service_account {
    scopes = ["compute-rw", "storage-ro"]
  }
}

resource "google_compute_address" "public" {
  name = "${var.name}-public-address"
}

resource "google_compute_instance_group_manager" "server_group" {
  name = "${var.name}-server-igm"

  base_instance_name = "${var.name}"
  instance_template = "${google_compute_instance_template.server_template.self_link}"
  update_strategy = "NONE"
  zone = "${var.zone}"

  target_size = "${var.server_count}"
  target_pools = [google_compute_target_pool.default.self_link]

  named_port {
    name = "http"
    port = "${var.service_port}"
  }
}

resource "google_compute_forwarding_rule" "default" {
  name                  = "${var.name}-lb"
  target                = google_compute_target_pool.default.self_link
  load_balancing_scheme = "EXTERNAL"
  port_range            = "80-21255"
  region                = var.region
  ip_address            = google_compute_address.public.address
}

resource "google_dns_record_set" "prod" {
  name    = "hashi.plot.technology."
  type    = "A"
  ttl     = 300
  rrdatas = [google_compute_address.public.address]

  // The managed zone (google_dns_managed_zone) is manually provisioned
  // to avoid nameservers changing on destroy/apply.
  managed_zone = "art-plotter-zone"
}

resource "google_compute_target_pool" "default" {
  name             = "${var.name}-lb"
  region           = var.region
  session_affinity = "NONE"

  health_checks = [
    google_compute_http_health_check.default.name,
  ]
}

resource "google_compute_http_health_check" "default" {
  name         = "${var.name}-lb-hc"
  request_path = "/"
  port         = 4646
}

resource "google_compute_firewall" "default-lb-fw" {
  name    = "${var.name}-lb-vm-service"
  network = google_compute_network.default.name

  allow {
    protocol = "tcp"
    ports    = ["80-21255"]
  }

  source_ranges = ["0.0.0.0/0"]
  source_tags   = ["server-template"]
}

//
// Client nodes
//

data "template_file" "user_data_client" {
  template = "${file("${path.root}/user-data-client.sh")}"

  vars = {
    retry_join   = "${chomp(join(" ", formatlist("%s=%s ", keys(var.retry_join), values(var.retry_join))))}"
    nomad_binary = "${var.nomad_binary}"
  }
}

resource "google_compute_instance" "client" {
  name         = "${var.name}-client-${count.index}"
  machine_type = "${var.client_machine_type}"
  count        = "${var.client_count}"

  metadata_startup_script = "${data.template_file.user_data_client.rendered}"
  allow_stopping_for_update = true

  tags = [ "${var.name}-client-${count.index}", "${lookup(var.retry_join, "tag_value")}" ]

  depends_on             = ["google_compute_instance_group_manager.server_group"]

  boot_disk {
    initialize_params {
      image = "${var.image}"
      size = "${var.client_block_size}"
    }
  }

  network_interface {
    network = "${google_compute_network.default.name}"
    access_config {}
  }

  service_account {
    scopes = ["compute-rw", "storage-ro"]
  }
}

# output "server_public_ips" {
#   value = "${google_compute_instance.server.*.network_interface.0.network_ip}"
# }

output "client_public_ips" {
  value = google_compute_instance.client.*.network_interface.0.network_ip
}

output "server_lb_ip" {
  value = google_compute_forwarding_rule.default.ip_address
}