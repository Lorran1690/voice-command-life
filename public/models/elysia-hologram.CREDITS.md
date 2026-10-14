# E.L.Y.S.I.A hologram geometry

The rigged base geometry in `elysia-hologram.glb` was created with MPFB / the
MakeHuman ecosystem and distributed as the `mpfb.glb` example avatar in the
TalkingHead project.

- Base avatar: CC0 1.0 (public domain)
- Source: https://github.com/met4citizen/TalkingHead
- TalkingHead project: Copyright Mika Suominen, MIT License

The build step in `scripts/build-elysia-hologram-model.mjs` removes every
embedded texture and replaces the source materials. The application renders
the remaining mesh, skeleton and facial morph targets exclusively with its own
procedural violet hologram materials. Meshopt compression is applied with
high-precision positions to reduce transfer size without changing the design.
