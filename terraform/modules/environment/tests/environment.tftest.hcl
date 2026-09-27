mock_provider "cloudflare" {}

variables {
  account_id       = "0123456789abcdef0123456789abcdef"
  d1_database_name = "commandsnippets-test"
}

run "creates_the_database_without_read_replicas" {
  command = plan

  assert {
    condition     = cloudflare_d1_database.this.name == "commandsnippets-test"
    error_message = "The database must use the given name."
  }

  assert {
    condition     = cloudflare_d1_database.this.read_replication.mode == "disabled"
    error_message = "backend-v2 reads its own writes: read replicas must stay off."
  }
}
