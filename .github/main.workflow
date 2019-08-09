workflow "Build and Test" {
  resolves = ["Test"]
  on = "push"
}

action "Install" {
  uses = "nuxt/actions-yarn@node-8"
  args = "bootstrap"
}

action "Build" {
  needs = "Install"
  uses = "nuxt/actions-yarn@node-8"
  args = "build"
}

action "Test" {
  needs = "Install"
  uses = "nuxt/actions-yarn@node-8"
  args = "test"
}
