ui = true

backend "consul" {
  path = "vault/"
  address = "127.0.0.1:8500"
  cluster_addr = "https://127.0.0.1:8201"
  redirect_addr = "http://127.0.0.1:8200"
}

listener "tcp" {
  address = "0.0.0.0:8200"
  cluster_address = "0.0.0.0:8201"
  tls_disable = 1
}
