# Library of stylized-look techniques

Where the **method** of a `[вид]` item comes from: the theme passport references a technique
by name («У нас: приём: <имя> · <где в коде>»), the variants of choice 1 — different
techniques from here, a technique change — the next technique from the passport line, not
"inventing one"; the «Способ:» line in the executor's summary names the technique. A
technique's description — engine-free; the **"Recipe <engine> <version>"** block — a fragment, not
a paste: verify property and function names against the documentation of the version from
«Окружение» `docs/TESTING.md` (Context7 or `docs/engine-notes.md`); for an
engine without a recipe — no Unity–Unreal recipe, the technique still applies.
What the `reference` agent finds in the project it appends to `docs/refs/TECHNIQUES.md`
(«Свои приёмы»); nothing is merged into here.

Each technique has: **what it gives** in product words · **verify with a variant** on the stand ·
**cost** (frame ms on "recommended" hardware, an estimate before measurement) · **reliability and
source** with a date (`официально` — engine documentation, a studio talk / `разбор кадра` /
`догадка`; a source without an address — verify) · **where it works** (any engine / Godot
`gl_compatibility` / Forward+ only) · **which sheet measure it moves** (`tools/look_sheet.py`:
brightness, contrast, saturation, hue, edge map `--sanity`; "shape — by eye" — numbers will not
show it). For the techniques of light, distance and hue (the sections "Light and atmosphere",
"Distance and haze", "Post-processing") the sheet measure is color: the edge map does not move;
the line «варианты различаются только оттенком» (the variants differ only in hue) is not a defect
for them — capture the sheet and `--sanity` with `--axis <technique>`. The `techniques` audit date —
2026-09-28; links to Godot documentation — the "Sources" section at the end.

## Light and atmosphere

### Warm sun + cool ambient

- Gives: sunlit slopes golden, shadows blue-green instead of gray; two
  thirds of the "like the concept" impression — here.
- Verify with a variant: sun color and strength × sky color and sky share in ambient;
  «свет / тень» crops of one slope.
- Cost: 0. Reliability: `официально` (Environment documentation, 2026-09-28).
- Where it works: any engine; Godot `gl_compatibility` — yes.
- Sheet measure: the hue of the light and shadow crops (example: shadow #243A16, light #ABA34B from
  one Godot 4.7 project), contrast.

Recipe Godot 4.7 (fragment, not a paste):

```gdscript
var env: Environment = world_environment.environment
env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
env.ambient_light_sky_contribution = 0.6   # < 1: part — color below, not sky
env.ambient_light_color = Color(0.60, 0.70, 0.86)  # cool
env.ambient_light_energy = 0.7
sun.light_color = Color(1.0, 0.86, 0.66)   # warm, low
sun.light_energy = 1.4
sun.rotation_degrees.x = -12.0             # 10–15° above the horizon
```

### Ramp by illumination

- Gives: light and shadow fall in broad soft steps as in a drawing, not
  a smooth "plasticine" gradient; crowns and boulders read as masses.
- Verify with a variant: step position and width (`step_edge`, `step_soft`),
  the hue of the shadow side.
- Cost: ~0.1 ms (a material shader). Reliability: `официально` (spatial shader
  `light()`, 2026-09-28) + `разбор кадра` in stylized games.
- Where it works: any engine with a custom lighting model; Godot
  `gl_compatibility` — yes.
- Sheet measure: crop contrast, edge map (a step boundary appears).

Recipe Godot 4.7 (fragment): in `light()` not the `step` step but
`smoothstep` over `ATTENUATION` — otherwise the shadow boundary jitters.

```glsl
uniform float step_edge : hint_range(0.0, 1.0) = 0.35;
uniform float step_soft : hint_range(0.0, 0.5) = 0.08;
uniform vec3 shade_tint : source_color = vec3(0.55, 0.65, 0.78);

void light() {
    float ndl = dot(NORMAL, LIGHT);
    float lit = smoothstep(step_edge - step_soft, step_edge + step_soft,
                           ndl * ATTENUATION);
    DIFFUSE_LIGHT += mix(ALBEDO * shade_tint, ALBEDO * LIGHT_COLOR, lit);
}
```

### Rim only in light

- Gives: a bright rim along the crown and boulder edge on the sun side — the object
  separates from the background; in shadow there is no rim, or everything "glows".
- Verify with a variant: rim strength and width; without it.
- Cost: ~0. Reliability: `разбор кадра` (verify).
- Where it works: any; Godot — in the same `light()`.
- Sheet measure: edge map, brightness along the crop edge.

Recipe Godot 4.7 (fragment, a continuation of `light()`):

```glsl
uniform float rim_power = 3.0;
uniform float rim_strength = 0.25;
// after lit:
float rim = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), rim_power);
DIFFUSE_LIGHT += LIGHT_COLOR * rim * rim_strength * lit;  // only where lit
```

## Distance and haze

### Depth-fog to the distant color

- Gives: behind the forest not a white wall but hills sinking into a blue-gray haze the
  color of the reference's distance; four planes "meadow → forest → blue hills → mountains"
  visible from the ground.
- Verify with a variant: the haze color (the reference's distance color, not the sky's), the
  start and end by distance, the curve.
- Cost: 0. Reliability: `официально` (Environment, Depth mode — 4.3+;
  verify on 4.7).
- Where it works: any; Godot `gl_compatibility` — yes.
- Sheet measure: saturation and brightness of the far plane (an example from one project:
  0.25 / 0.61), hue; the edge map does not move — "only in hue" is not a defect.

Recipe Godot 4.7 (fragment):

```gdscript
env.fog_enabled = true
env.fog_mode = Environment.FOG_MODE_DEPTH
env.fog_depth_begin = 60.0
env.fog_depth_end = 420.0          # farther than the loaded world's edge — a mask hides the seam
env.fog_depth_curve = 1.6
env.fog_light_color = Color(0.42, 0.51, 0.62)  # the reference's distance color
env.fog_light_energy = 1.0
env.fog_sky_affect = 0.0           # the sky does not turn milky
```

### Height-fog (haze by altitude)

- Gives: lowlands sink into haze, peaks and crowns above it clean; together with
  depth-fog — air "in layers".
- Verify with a variant: the layer's height and density; without the layer.
- Cost: 0. Reliability: `официально` (Environment `fog_height*`).
- Where it works: any; Godot `gl_compatibility` — yes (volumetric fog —
  Forward+ only).
- Sheet measure: brightness of the lower third of the distance frame (for a light theme — the passport's second frame).

Recipe Godot 4.7 (fragment): `env.fog_height = -10.0`,
`env.fog_height_density = 0.02` (a negative height — the layer below the camera).

### Aerial perspective + sun scatter

- Gives: the far plane not only dims but turns blue; near the sun the haze
  warms — a path of light in the air.
- Verify with a variant: the `aerial_perspective` share, the `sun_scatter` strength.
- Cost: 0. Reliability: `официально` (Environment).
- Where it works: Godot 4 (both renderers); in other engines — fog color by
  angle to the sun in a sky shader or post-processing.
- Sheet measure: far-plane hue, brightness near the sun.

Recipe Godot 4.7 (fragment): `env.fog_aerial_perspective = 0.35`,
`env.fog_sun_scatter = 0.15`.

### Seam mask "play area ↔ distant view"

- Gives: edge fog hides only the seam of the loaded world and the distant
  view (impostors, a far heightmap), not the whole distance.
- Verify with a variant: mask width, distance from the edge; «даль видна с земли»
  (the distance visible from the ground) — a picture decision («Решил сам [видно]» in `/studio/start`).
- Cost: ~0. Reliability: `догадка` — the project's own technique.
- Where it works: any.
- Sheet measure: shape — by eye; brightness of the last third of the frame.

## Sky and clouds

### Sky shader: layered 2D noise with sun lighting

- Gives: clouds as brush strokes, bright on the sun side, gray-blue in the shade;
  cloud color — from the time of day, because it is taken from the sun and sky colors,
  not set by a number.
- Verify with a variant: coverage, noise scale, lighting strength; against
  "layers with an RGB texture" below.
- Cost: ~0.2–0.5 ms (a fullscreen sky). Reliability: `официально` (sky
  shader, `LIGHT0_*`) + `разбор кадра` (verify).
- Where it works: any engine with a sky shader; Godot `gl_compatibility` — yes.
- Sheet measure: brightness and hue of the sky crop, edge map (cloud silhouette).

Recipe Godot 4.7 (fragment):

```glsl
shader_type sky;
uniform sampler2D noise : filter_linear, repeat_enable; // NoiseTexture2D, 2 octaves
uniform float cover : hint_range(0.0, 1.0) = 0.55;
uniform vec3 cloud_shade : source_color = vec3(0.55, 0.62, 0.75);

void sky() {
    vec2 uv = EYEDIR.xz / (abs(EYEDIR.y) + 0.15);
    float n = texture(noise, uv * 0.35 + TIME * 0.01).r * 0.6
            + texture(noise, uv * 1.4 - TIME * 0.007).r * 0.4;
    float cloud = smoothstep(cover, cover + 0.25, n) * smoothstep(0.02, 0.15, EYEDIR.y);
    float toward_sun = pow(max(dot(EYEDIR, LIGHT0_DIRECTION), 0.0), 8.0);
    vec3 lit = LIGHT0_COLOR * LIGHT0_ENERGY;           // color from the time of day — from here
    vec3 col = mix(cloud_shade, lit, clamp(0.35 + toward_sun, 0.0, 1.0));
    COLOR = mix(COLOR, col, cloud);                    // COLOR — the sky before clouds
}
```

### Cloud layers with a hand-drawn RGB texture

- Gives: silhouettes drawn to match the concept (three layers in the R, G, B channels at
  different altitudes), lighting — the same, from the sun.
- Verify with a variant: next to the noise; layer speed.
- Cost: ~0.2 ms. Reliability: `догадка` (a stylized-games technique —
  verify). Where it works: any.
- Sheet measure: edge map (silhouette), hue.

### Sun halo

- Gives: a soft bright circle around the sun and lit haze at the horizon.
- Verify with a variant: size and strength; together with glow (below).
- Cost: 0 (sky) or glow. Reliability: `официально` (ProceduralSkyMaterial
  `sun_angle_max`, `sun_curve`). Where it works: any.
- Sheet measure: brightness near the sun (near-white ≤ 3% of the frame — an assertion
  of one project's light passport).

## Crowns and foliage

### Crown normals toward the center of mass

- Gives: a crown tier lit as one soft ball — a bright top, a dark bottom,
  without "volume cubes" and edges on every card.
- Verify with a variant: the center — the whole tier / the whole tree; the share of
  blending with the true normal.
- Cost: 0 (normals in the mesh). Reliability: `разбор кадра` — a
  stylized-trees technique (Blender Data Transfer "normals from a sphere" —
  verify). Where it works: any (normals — in the mesher or the editor).
- Sheet measure: crown-crop contrast (drops), edge map (fewer edges).

Recipe Godot 4.7 (fragment, SurfaceTool; ArrayMesh — likewise via
`ARRAY_NORMAL`):

```gdscript
var centre := Vector3.ZERO           # the tier's center of mass: the vertex average
for v in tier_vertices: centre += v
centre /= tier_vertices.size()
for v in tier_vertices:
    var n := (v - centre).normalized()
    st.set_normal(n.lerp(true_normal_of(v), 0.2).normalized())  # 0.2 — the variant
    st.add_vertex(v)
```

### Needle cards with flat light

- Gives: a card texture without baked highlights and shadows — the engine lays
  the light, the card does not argue with the sun.
- Verify with a variant: a trial screenshot on the mesh (`/studio/add` accepts a picture
  only after it).
- Cost: 0. Reliability: `официально` — the order rule
  `orders/art.md` (the card frame). Where it works: any.
- Sheet measure: card brightness in shade versus lit.

### Gap in the crown

- Gives: thin light through the needles on the sun side — the crown is not a "lump".
- Verify with a variant: the gap's strength; without it.
- Cost: ~0.1 ms. Reliability: `официально` (`BACKLIGHT` in a spatial shader).
- Where it works: Godot (both renderers); the analog — "transmission" elsewhere.
- Sheet measure: brightness of the crown's shadow side.

Recipe Godot 4.7 (fragment): `BACKLIGHT = vec3(0.35, 0.4, 0.2);` in
the needle material's `fragment()`; on cards — with `cull_disabled`.

### Impostors of distant trees

- Gives: forest to the horizon at the same cost; near ones — alive, far ones —
  "postcards".
- Verify with a variant: the swap distance; the impostor color under the haze.
- Cost: −N ms (saves). Reliability: `официально` (Mesh LOD, 2026-09-28,
  documentation in "Sources").
- Where it works: any. Sheet measure: edge map at the swap boundary.

## Grass

### Grass normals up

- Gives: the grass carpet lit like the ground under it — an even tone, without the
  "bristle" of dark and light blades and acid green in the sun.
- Verify with a variant: pure "up" / a 0.8 blend with the ground normal.
- Cost: 0. Reliability: `разбор кадра` — the standard grass technique
  of stylized games (GDC talks on grass — verify).
- Where it works: any. Sheet measure: grass saturation (≤ 0.65 —
  an assertion of one project's light passport), carpet contrast.

Recipe Godot 4.7 (fragment): in the grass material's `vertex()`
`NORMAL = normalize(mix(NORMAL, vec3(0.0, 1.0, 0.0), up_mix));` (model
space, a blade stands vertical) — or "up" normals right in the
tuft mesher.

### Tufts over the cover, palette from the cleanup

- Gives: the cover — ground color with light noise, the tufts — sparse and noticeable; the
  color — from the concept palette (the light passport), not from the old reference.
- Verify with a variant: tuft density, height; palette A/B.
- Cost: by the tuft measurement. Reliability: `догадка` — the project's own technique.
- Where it works: any. Sheet measure: hue and saturation of the meadow crop.

## Terrain and mountains

### Color bands by altitude and slope

- Gives: beyond ~30 blocks a mountain reads in layers — meadow, rock on the steep,
  bright peaks; the way real mountains are built (articles — `reference` input).
- Verify with a variant: the altitude and slope thresholds, the softness of the transition.
- Cost: ~0.1 ms (a shader). Reliability: `разбор кадра` (verify).
- Where it works: any. Sheet measure: hue across the «низ / склон / вершина» crops.

Recipe Godot 4.7 (fragment, the terrain material's `fragment()`):

```glsl
float h = world_pos.y;                       // varying from vertex()
float slope = 1.0 - clamp(world_normal.y, 0.0, 1.0);
vec3 band = mix(low_col, high_col, smoothstep(h0, h1, h));
band = mix(band, rock_col, smoothstep(0.55, 0.75, slope));
ALBEDO = mix(ALBEDO, band, smoothstep(30.0, 60.0, dist_to_camera));
```

### Terraces with a sharp edge and a soft brow

- Gives: a mountain — ledges: the ledge's edge sharp, the slope between them slumped;
  a stepped silhouette as in the concept, without "crumpled paper".
- Verify with a variant: the terrace step, the edge width (shape — by eye).
- Cost: 0 (a generator). Reliability: `догадка` — the project's own "slumped world" technique.
- Where it works: any heightmap generator. Sheet measure: edge map.

### Vertex AO in the mesher

- Gives: shading in the corners, under crowns and boulders without SSAO — goes into
  vertex color at mesh assembly, 0 ms in frame.
- Verify with a variant: strength and radius; with SSAO / without.
- Cost: 0 in frame. Reliability: `официально` (`AO`, `AO_LIGHT_AFFECT` in
  a spatial shader) + `разбор кадра` in voxel games.
- Where it works: any. Sheet measure: contrast of the crop under a crown.

Recipe Godot 4.7 (fragment): in the mesher — `st.set_color(Color(ao, ao, ao))`
(ao 0–1 by the count of block neighbors at a vertex); in the material —

```glsl
void fragment() {
    AO = COLOR.r;
    AO_LIGHT_AFFECT = 0.4;   // how much AO dims direct light
}
```

## Water

### Broad highlight by fresnel

- Gives: the sun on water — a broad path, not a speck; near the shore the water
  clearer, in the distance — the sky.
- Verify with a variant: `ROUGHNESS` 0.3–0.4 (a speck — at 0.05), the
  fresnel strength.
- Cost: 0. Reliability: `официально` (a spatial shader). Where it works: any.
- Sheet measure: highlight-crop brightness, edge map (the speck disappears).

Recipe Godot 4.7 (fragment):

```glsl
void fragment() {
    float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 5.0);
    ALBEDO = mix(shallow_col, deep_col, depth_fade);
    ROUGHNESS = 0.35;            // a broad highlight
    SPECULAR = 0.5;
    METALLIC = 0.0;
    EMISSION = sky_col * fres * 0.15;   // the sky at the edge
}
```

### Color by depth

- Gives: the shallows warm and clear, the depth blue, the transition by depth, not
  by distance.
- Verify with a variant: the depth of full color; the palette from the water passport.
- Cost: 0 (`DEPTH_TEXTURE` — Forward+; in `gl_compatibility` — from the bottom
  height in the world data). Reliability: `официально`.
- Where it works: any. Sheet measure: hue of the «берег / глубина» crops.

## Shadows and AO

### Shadow map: distance, splits, size, normal bias

- Gives: soft shadows without "roughness" and stair-stepping on the crowns; the shadow
  visible over the whole frame distance.
- Verify with a variant: distance 120 / 250, 2 or 4 splits, size
  4096 / 2048 (weak PCs), normal bias.
- Cost: 0.5–2 ms by measurement. Reliability: `официально` (Lights and shadows,
  2026-09-28).
- Where it works: any; Godot `gl_compatibility` — yes (PCSS — Forward+ only).
- Sheet measure: shadow contrast, edge map (stair-stepping).

Recipe Godot 4.7 (fragment):

```gdscript
sun.shadow_enabled = true
sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS
sun.directional_shadow_max_distance = 250.0
sun.directional_shadow_split_1 = 0.08
sun.directional_shadow_split_2 = 0.25
sun.directional_shadow_split_3 = 0.55
sun.directional_shadow_blend_splits = true
sun.shadow_normal_bias = 1.5
sun.shadow_bias = 0.05
# map size — the project setting rendering/lights_and_shadows/directional_shadow/size
# (4096; weak PCs — 2048), softness — soft_shadow_filter_quality
```

### Simple SSAO

- Gives: shading in the block seams, under boulders and in the crowns on top of
  vertex AO.
- Verify with a variant: radius, strength; without SSAO (vertex only).
- Cost: ~0.6 ms at 1080p (a measurement in one Godot 4.7 project). Reliability:
  `официально` (Environment: SSAO — Forward+ and Compatibility, not Mobile —
  the 4.7 documentation, 2026-09-28).
- Where it works: Godot Forward+ and `gl_compatibility` (4.6+), any engine with SSAO.
- Sheet measure: contrast of the crop under a crown.

Recipe Godot 4.7 (fragment): `env.ssao_enabled = true`,
`env.ssao_radius = 1.0`, `env.ssao_intensity = 2.0`, `env.ssao_power = 1.5`,
`env.ssao_light_affect = 0.0`.

## Post-processing

### AgX with a white point and contrast

- Gives: the brights not bleached (the sky near the sun #F7DBA9, not white), the
  colors juicy but not acid — against ACES 2.5, which burns the sky out.
- Verify with a variant: AgX / ACES / Filmic, the white point, the contrast.
- Cost: 0. Reliability: `официально` (AgX — 4.3+; the AgX white point and contrast —
  4.6+, the `tonemap_agx_white`, `tonemap_agx_contrast` properties —
  the 4.7 documentation, 2026-09-28).
- Where it works: Godot, both renderers; elsewhere — a custom tonemapper.
- Sheet measure: the near-white share (≤ 3%), contrast (≥ 0.18), saturation.

Recipe Godot 4.7 (fragment): `env.tonemap_mode = Environment.TONE_MAPPER_AGX`,
`env.tonemap_agx_white = 16.29`, `env.tonemap_agx_contrast = 1.25` (the defaults —
variants start from them); `exposure` — via `CameraAttributes`.

### LUT from a concept frame

- Gives: our frame brought to the concept's palette by one color table — a quick
  "C = A + LUT" variant for comparison with the haze settings.
- Verify with a variant: with LUT / without; the blend strength.
- Cost: ~0.1 ms. Reliability: `официально` (`adjustment_color_correction`) —
  a script builds the table (verify: histogram matching with Pillow over
  the channels of our frame and the target frame of the same angle).
- Where it works: any engine with color grading; Godot `gl_compatibility` — verify.
- Sheet measure: hue, saturation, brightness of the whole frame; the edge map does not
  move — "only in hue" is not a defect.

Recipe Godot 4.7 (fragment): 1) capture our frame and the target frame of the same angle;
2) with a script fit the curves per channel → a 256×1 PNG strip (a 1D LUT; 3D — if
1D is not enough); 3) `env.adjustment_enabled = true`,
`env.adjustment_color_correction = load("res://…/lut_concept.png")`. LUT — a
variant, not acceptance: the sheet numbers — the anchor.

### Glow Screen ~0.1

- Gives: a soft halo around the sun and the water highlights; at `intensity` above ~0.2
  the frame "turns milky".
- Verify with a variant: 0.08 / 0.12 / without.
- Cost: ~0.2 ms. Reliability: `официально` (Environment glow; in
  `gl_compatibility` — since 4.3, verify).
- Where it works: Godot, both renderers; any engine with bloom.
- Sheet measure: brightness near the sun, contrast.

Recipe Godot 4.7 (fragment): `env.glow_enabled = true`,
`env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SCREEN`,
`env.glow_intensity = 0.1`, `env.glow_bloom = 0.0`,
`env.glow_hdr_threshold = 1.0`.

## Why the rules are as they are (model vision)

Models do not see fine differences (DiffSpot: the best finds 40.7% of single
edits; VDiff-Bench: 8.7–33% on noise and texture), do not read numbers from a
picture (MeasureBench), overestimate from brightness, overlays and presentation
order (EMNLP 2025) — the sources per contract 0.10, verify the addresses. Therefore:
numbers and "did it change" — by script (`look_sheet.py`, `--sanity`, the edge
map); questions to a model — closed-ended, against passport criteria; a pair's verdict —
in two presentation orders (no match — "don't know"); frames — without rulers and captions,
no more than 6 images per call.

## Sources

- Godot 4 documentation (the version in the path — from «Окружение»,
  `docs.godotengine.org/en/<x.y>/`): `tutorials/3d/environment_and_post_processing.html`
  (ambient, fog, glow, SSAO, tonemapping, adjustment), `tutorials/3d/lights_and_shadows.html`
  (the shadow map, splits, bias), `tutorials/shaders/shader_reference/spatial_shader.html`
  (`light()`, `BACKLIGHT`, `AO`), `tutorials/shaders/shader_reference/sky_shader.html`
  (`EYEDIR`, `LIGHT0_*`), `tutorials/3d/mesh_lod.html` (impostors, LOD —
  from the `3d-tools.md` analysis of 2026-09-28).
- The `techniques` audit of contract 0.10 (2026-09-28): the facts about `gl_compatibility`
  4.6+ (SSAO, AgX white/contrast) confirmed by the 4.7 documentation
  (`class_environment.html`, 2026-09-28).
- Studio talks on stylized grass, foliage and clouds (GDC, CEDEC) —
  search by "<game> GDC foliage / grass / clouds"; verify the addresses; into the passport —
  with a date and reliability.
