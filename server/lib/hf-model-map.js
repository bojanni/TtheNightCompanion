'use strict';

/**
 * Maps NightCafe model IDs to their HuggingFace model IDs.
 * Models not available on HuggingFace (closed-source APIs) are set to null.
 *
 * Keep in sync with src/lib/hf-model-map.ts.
 */
const HF_MODEL_MAP = {
  // ── HiDream family ──────────────────────────────────────────────────────
  "hidream-i1-dev": "HiDream-ai/HiDream-I1-Dev",
  "hidream-i1-fast": "HiDream-ai/HiDream-I1-Fast",
  "hidream-i1-full": "HiDream-ai/HiDream-I1-Full",

  // ── FLUX family ─────────────────────────────────────────────────────────
  "flux": "black-forest-labs/FLUX.1-schnell",
  "flux-schnell": "black-forest-labs/FLUX.1-schnell",
  "flux-2-dev": "black-forest-labs/FLUX.1-dev",
  "flux-2-pro": null,
  "flux-2-flex": null,
  "flux-2-max": null,
  "flux-krea": null,
  "flux-pro-v11": null,
  "flux-pro-v11-ultra": "black-forest-labs/FLUX.1-pro",
  "flux-kontext-dev": "black-forest-labs/FLUX.1-Kontext-dev",
  "flux-kontext-pro": null,
  "flux-kontext-max": null,
  "flux-2-klein-9b-fast": null,
  "flux-2-klein-9b": null,
  "flux-2-klein-4b-fast": null,
  "flux-2-klein-4b": null,

  // ── Juggernaut Flux family ───────────────────────────────────────────────
  "juggernaut-flux-base": "RunDiffusion/Juggernaut-X-Flux",
  "juggernaut-flux-pro": "RunDiffusion/Juggernaut-X-Flux-Pro",
  "juggernaut-flux-lightning": "RunDiffusion/Juggernaut-X-Flux-Lightning",

  // ── Juggernaut XL family ─────────────────────────────────────────────────
  "juggernaut-xi": "RunDiffusion/Juggernaut-XI-v11",
  "juggernaut-xi-lightning": "RunDiffusion/Juggernaut-XI-Lightning",
  "juggernaut-xl-v8": "RunDiffusion/Juggernaut-XL-v8",
  "juggernaut-xl-v7": "RunDiffusion/Juggernaut-XL-v7",
  "juggernaut-xl-v6": "RunDiffusion/Juggernaut-XL-v6",
  "juggernaut-xl-v5": "RunDiffusion/Juggernaut-XL-v5",
  "juggernaut-v9": "RunDiffusion/Juggernaut-XL-v9",
  "juggernaut-v9-lightning": "RunDiffusion/Juggernaut-XL-Lightning",
  "juggernaut-reborn": "RunDiffusion/Juggernaut-Reborn",

  // ── RealVisXL family ─────────────────────────────────────────────────────
  "realvisxl-v5": "SG161222/RealVisXL_V5.0",
  "realvisxl-v5-lightning": "SG161222/RealVisXL_V5.0_Lightning",
  "realvisxl-v4": "SG161222/RealVisXL_V4.0",
  "realvisxl-v4-lightning": "SG161222/RealVisXL_V4.0_Lightning",
  "realvisxl-v3": "SG161222/RealVisXL_V3.0",

  // ── DreamShaper family ───────────────────────────────────────────────────
  "dreamshaper-xl-lightning": "Lykon/dreamshaper-xl-lightning",
  "dreamshaper-xl-alpha2": "Lykon/dreamshaper-xl-v2-turbo",
  "dreamshaper-v8": "Lykon/dreamshaper-8",

  // ── SDXL / Stable Core family ────────────────────────────────────────────
  "sdxl-10": "stabilityai/stable-diffusion-xl-base-1.0",
  "sdxl-lcm": "latent-consistency/lcm-sdxl",
  "sdxl-dpo": null,
  "stable-core": null,

  // ── Clarity / Upscaler ───────────────────────────────────────────────────
  "clarity-upscaler": null,

  // ── Other SDXL checkpoints ───────────────────────────────────────────────
  "crystal-clear-xl": "danbochman/ccxl",
  "crystal-clear-xl-lightning": "fal-collab-models/CrystalClearXL_Lightning",
  "boltning-xl-v1-lightning": null,
  "atomix-xl-v4-lightning": null,
  "moxie-diffusion-xl-v16-lightning": null,
  "fluently-xl": null,
  "fluently-xl-lightning": null,
  "real-cartoon-xl-v4": null,
  "starlight-xl": null,
  "mysterious-xl-v4": null,
  "blue-pencil-xl": null,
  "animagine-xl-v3": "cagliostrolab/animagine-xl-3.0",
  "aam-xl-anime-mix-v1": null,
  "virtual-utopia-xl": null,
  "cherry-picker-xl-v27": null,

  // ── SD 1.5 / SD 1.4 family ───────────────────────────────────────────────
  "stable-diffusion-15": "runwayml/stable-diffusion-v1-5",
  "stable-diffusion-14": "CompVis/stable-diffusion-v1-4",
  "sd15-dpo": null,
  "realistic-vision-v51": "SG161222/Realistic_Vision_V5.1",
  "absolutereality-v181": "Lykon/AbsoluteReality_v1.8.1",
  "neverending-dream-v122": "Lykon/NeverEnding-Dream",
  "3d-animation-diffusion-v10": null,
  "rpg-v5": null,
  "blue-pencil-v10": null,
  "arthemy-comics-v50": null,
  "rabbit-v7": null,
  "nightmare-shaper-v3": null,
  "wildlifex-animals": null,
  "realcartoon-pixar-v8": null,
  "ghost-mix-v2": null,

  // ── Qwen Image family ────────────────────────────────────────────────────
  "qwen-image": null,
  "qwen-image-sd": null,
  "qwen-image-2512": null,
  "qwen-image-edit": null,
  "qwen-image-edit-plus": null,
  "qwen-image-edit-2511": null,

  // ── Seedream / Nano Banana ───────────────────────────────────────────────
  "seedream-45": null,
  "seedream-40": null,
  "seedream-30": null,
  "nano-banana": null,
  "nano-banana-pro": null,
  "z-image-turbo": null,

  // ── Google Imagen family ─────────────────────────────────────────────────
  "google-imagen-40-fast": null,
  "google-imagen-40": null,
  "google-imagen-40-ultra": null,
  "google-imagen-30-fast": null,
  "google-imagen-30": null,

  // ── Ideogram family ──────────────────────────────────────────────────────
  "ideogram-v3-turbo": null,
  "ideogram-v3-quality": null,
  "ideogram-v3": null,
  "ideogram-2a": null,
  "ideogram-2a-turbo": null,
  "ideogram-20": null,
  "ideogram-20-turbo": null,
  "ideogram-10": null,
  "ideogram-10-turbo": null,

  // ── DALL-E / GPT-Image family ────────────────────────────────────────────
  "dall-e-3": null,
  "dall-e-2": null,
  "gpt15-high": null,
  "gpt15-medium": null,
  "gpt15-low": null,
  "gpt1-high": null,
  "gpt1-medium": null,
  "gpt1-low": null,

  // ── Recraft ──────────────────────────────────────────────────────────────
  "recraft-v3": null,

  // ── Video models ─────────────────────────────────────────────────────────
  "seedance-15-pro": null,
  "seedance-10-pro-fast": null,
  "seedance-10-pro": null,
  "seedance-10-lite": null,
  "pixverse-v5": null,
  "kling-25-turbo-standard": null,
  "kling-25-turbo-pro": null,
  "kling-21-standard": null,
  "kling-16-standard": null,
  "veo-31": null,
  "veo-31-fast": null,
  "google-veo-30-fast": null,
  "runway-gen-4-turbo": null,

  // ── Legacy / NightCafe-native ────────────────────────────────────────────
  "coherent": null,
  "artistic": null,
  "style-transfer": null,
};

module.exports = { HF_MODEL_MAP };
