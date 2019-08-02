variable "name" {}
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
    ports = ["4646", "8500"]
  }
}

resource "google_compute_firewall" "primary" {
  name   = "${var.name}"
  network = "${google_compute_network.default.name}"
  source_ranges = ["${var.whitelist_ip}"]

  allow {
    protocol = "tcp"
    ports = ["22", "4646", "4647", "4648", "8300-8302", "8500-8502", "8600", "9998", "21000-21255"]
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

resource "google_compute_instance" "server" {
  name         = "${var.name}-server-${count.index}"
  machine_type = "${var.server_machine_type}"
  count        = "${var.server_count}"

  metadata_startup_script = "${data.template_file.user_data_server.rendered}"
  allow_stopping_for_update = true

  tags = [ "${var.name}-server-${count.index}", "${lookup(var.retry_join, "tag_value")}" ]

  boot_disk {
    initialize_params {
      image = "${var.image}"
      size = "${var.root_block_device_size}"
      type = "pd-ssd"
    }
  }

  network_interface {
    network = "${google_compute_network.default.name}"
    access_config {}
  }

  service_account {
    scopes = ["compute-rw"]
  }
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

  depends_on             = ["google_compute_instance.server"]

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
    scopes = ["compute-rw"]
  }
}

// resource "aws_elb" "server_lb" {
//   name               = "${var.name}-server-lb"
//   availability_zones = ["${distinct(aws_instance.server.*.availability_zone)}"]
//   internal           = false
//   instances = ["${aws_instance.server.*.id}"]
//   listener {
//     instance_port     = 4646
//     instance_protocol = "http"
//     lb_port           = 4646
//     lb_protocol       = "http"
//   }
//   listener {
//     instance_port     = 8500
//     instance_protocol = "http"
//     lb_port           = 8500
//     lb_protocol       = "http"
//   }
//   security_groups = ["${aws_security_group.server_lb.id}"]
// }

output "server_public_ips" {
  value = "${google_compute_instance.server.*.network_interface.0.network_ip}"
}

output "client_public_ips" {
  value = "${google_compute_instance.client.*.network_interface.0.network_ip}"
}

// output "server_lb_ip" {
//   value = "${aws_elb.server_lb.dns_name}"
// }