# FLUXONM Integration

Detect FLUXONM:

```bash
command -v FLUXONM
```

Copy a project-local reference:

```bash
./scripts/copy-fluxonm.sh
```

The script copies the resolved `FLUXONM` executable into:

```text
tools/FLUXONM/
```

It does not modify the original utility.

Use optional Flux integration:

```bash
./scripts/one-touch-flux.sh --use-fluxonm
```

If FLUXONM is unavailable, the script falls back to native `flux` and `kubectl` commands.

Refresh the copy:

```bash
./scripts/copy-fluxonm.sh
```
