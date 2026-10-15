# Demo deploy (krao.net)

The web app of the public demo at https://krao.net, built by `Dockerfile.web`
and served by Caddy. Deployed with the shared VPS tooling:

```bash
bash C:/PROJECTS/claude-config/platform/deploy-remote.sh <this repo> kraonet
```

It ships `git archive` of the checked-out branch. Deploy the backend
(krao-atproto `deploy/`) first.
