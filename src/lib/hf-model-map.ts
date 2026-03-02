/**
 * Maps NightCafe model IDs (from models-data.ts) to their HuggingFace model IDs.
 * Models not available on HuggingFace (closed-source APIs, proprietary models) are set to null.
 */
export const HF_MODEL_MAP: Record<string, string | null> = {
  // ── HiDream family ──────────────────────────────────────────────────────
  "hidream-i1-dev": "HiDream-ai/HiDream-I1-Dev",       // HiDream I1 Dev
  "hidream-i1-fast": "HiDream-ai/HiDream-I1-Fast",     // HiDream I1 Fast
  "hidream-i1-full": "HiDream-ai/HiDream-I1-Full",     // HiDream I1 Full

  // ── FLUX family ─────────────────────────────────────────────────────────
  "flux": "black-forest-labs/FLUX.1-schnell",           // Flux
  "flux-schnell": "black-forest-labs/FLUX.1-schnell",   // Flux Schnell
  "flux-2-dev": "black-forest-labs/FLUX.1-dev",         // Flux 2 Dev
  "flux-2-pro": null,                                   // Flux 2 Pro (API only)
  "flux-2-flex": null,                                  // Flux 2 Flex (API only)
  "flux-2-max": null,                                   // Flux 2 Max (API only)
  "flux-krea": null,                                    // Flux Krea (API only)
  "flux-pro-v11": null,                                 // Flux PRO v1.1 (API only)
  "flux-pro-v11-ultra": "black-forest-labs/FLUX.1-pro", // Flux PRO v1.1 Ultra
  "flux-kontext-dev": "black-forest-labs/FLUX.1-Kontext-dev", // Flux Kontext Dev
  "flux-kontext-pro": null,                             // Flux Kontext Pro (API only)
  "flux-kontext-max": null,                             // Flux Kontext Max (API only)
  "flux-2-klein-9b-fast": null,                         // Flux 2 Klein 9B Fast
  "flux-2-klein-9b": null,                              // Flux 2 Klein 9B
  "flux-2-klein-4b-fast": null,                         // Flux 2 Klein 4B Fast
  "flux-2-klein-4b": null,                              // Flux 2 Klein 4B

  // ── Juggernaut Flux family ───────────────────────────────────────────────
  "juggernaut-flux-base": "RunDiffusion/Juggernaut-X-Flux", // Juggernaut Flux Base
  "juggernaut-flux-pro": "RunDiffusion/Juggernaut-X-Flux-Pro", // Juggernaut Flux Pro
  "juggernaut-flux-lightning": "RunDiffusion/Juggernaut-X-Flux-Lightning", // Juggernaut Flux Lightning

  // ── Juggernaut XL family ─────────────────────────────────────────────────
  "juggernaut-xi": "RunDiffusion/Juggernaut-XI-v11",              // Juggernaut XI
  "juggernaut-xi-lightning": "RunDiffusion/Juggernaut-XI-Lightning", // Juggernaut XI Lightning
  "juggernaut-xl-v8": "RunDiffusion/Juggernaut-XL-v8",  // Juggernaut XL v8
  "juggernaut-xl-v7": "RunDiffusion/Juggernaut-XL-v7",  // Juggernaut XL v7
  "juggernaut-xl-v6": "RunDiffusion/Juggernaut-XL-v6",  // Juggernaut XL v6
  "juggernaut-xl-v5": "RunDiffusion/Juggernaut-XL-v5",  // Juggernaut XL v5
  "juggernaut-v9": "RunDiffusion/Juggernaut-XL-v9",              // Juggernaut v9
  "juggernaut-v9-lightning": "RunDiffusion/Juggernaut-XL-Lightning", // Juggernaut v9 Lightning
  "juggernaut-reborn": "RunDiffusion/Juggernaut-Reborn", // Juggernaut Reborn

  // ── RealVisXL family ─────────────────────────────────────────────────────
  "realvisxl-v5": "SG161222/RealVisXL_V5.0",                     // RealVisXL v5
  "realvisxl-v5-lightning": "SG161222/RealVisXL_V5.0_Lightning",  // RealVisXL v5 Lightning
  "realvisxl-v4": "SG161222/RealVisXL_V4.0",                     // RealVisXL v4
  "realvisxl-v4-lightning": "SG161222/RealVisXL_V4.0_Lightning",  // RealVisXL v4 Lightning
  "realvisxl-v3": "SG161222/RealVisXL_V3.0",            // RealVisXL v3

  // ── DreamShaper family ───────────────────────────────────────────────────
  "dreamshaper-xl-lightning": "Lykon/dreamshaper-xl-lightning", // Dreamshaper XL Lightning
  "dreamshaper-xl-alpha2": "Lykon/dreamshaper-xl-v2-turbo",     // DreamShaper XL alpha2
  "dreamshaper-v8": "Lykon/dreamshaper-8",              // DreamShaper v8

  // ── SDXL / Stable Core family ────────────────────────────────────────────
  "sdxl-10": "stabilityai/stable-diffusion-xl-base-1.0", // SDXL 1.0
  "sdxl-lcm": "latent-consistency/lcm-sdxl",             // SDXL LCM
  "sdxl-dpo": null,                                      // SDXL DPO
  "stable-core": null,                                   // Stable Core (Stability API)

  // ── Clarity / Upscaler ───────────────────────────────────────────────────
  "clarity-upscaler": null,                             // Clarity Upscaler (API only)

  // ── Other SDXL checkpoints ───────────────────────────────────────────────
  "crystal-clear-xl": "danbochman/ccxl",                           // Crystal Clear XL
  "crystal-clear-xl-lightning": "fal-collab-models/CrystalClearXL_Lightning", // Crystal Clear XL Lightning
  "boltning-xl-v1-lightning": null,                     // Boltning XL v1 Lightning
  "atomix-xl-v4-lightning": null,                       // Atomix XL v4 Lightning
  "moxie-diffusion-xl-v16-lightning": null,             // Moxie Diffusion XL v1.6 Lightning
  "fluently-xl": null,                                  // Fluently XL
  "fluently-xl-lightning": null,                        // Fluently XL Lightning
  "real-cartoon-xl-v4": null,                           // Real Cartoon XL v4
  "starlight-xl": null,                                 // Starlight XL
  "mysterious-xl-v4": null,                             // Mysterious XL v4
  "blue-pencil-xl": null,                               // Blue Pencil XL
  "animagine-xl-v3": "cagliostrolab/animagine-xl-3.0",  // Animagine XL v3
  "aam-xl-anime-mix-v1": null,                          // AAM XL Anime Mix v1
  "virtual-utopia-xl": null,                            // Virtual Utopia XL
  "cherry-picker-xl-v27": null,                         // Cherry Picker XL v2.7

  // ── SD 1.5 / SD 1.4 family ───────────────────────────────────────────────
  "stable-diffusion-15": "runwayml/stable-diffusion-v1-5", // Stable Diffusion 1.5
  "stable-diffusion-14": "CompVis/stable-diffusion-v1-4",  // Stable Diffusion 1.4
  "sd15-dpo": null,                                        // SD1.5 DPO
  "realistic-vision-v51": "SG161222/Realistic_Vision_V5.1", // Realistic Vision V5.1
  "absolutereality-v181": "Lykon/AbsoluteReality_v1.8.1",  // AbsoluteReality v1.8.1
  "neverending-dream-v122": "Lykon/NeverEnding-Dream",     // NeverEnding Dream v1.2.2
  "3d-animation-diffusion-v10": null,                      // 3D Animation Diffusion v10
  "rpg-v5": null,                                          // RPG v5
  "blue-pencil-v10": null,                                 // Blue Pencil v10
  "arthemy-comics-v50": null,                              // Arthemy Comics v5.0
  "rabbit-v7": null,                                       // Rabbit v7
  "nightmare-shaper-v3": null,                             // Nightmare Shaper v3
  "wildlifex-animals": null,                               // WildlifeX Animals
  "realcartoon-pixar-v8": null,                            // RealCartoon Pixar v8
  "ghost-mix-v2": null,                                    // Ghost Mix v2

  // ── Qwen Image family ────────────────────────────────────────────────────
  "qwen-image": null,                                   // Qwen Image
  "qwen-image-sd": null,                                // Qwen Image SD
  "qwen-image-2512": null,                              // Qwen Image 2512
  "qwen-image-edit": null,                              // Qwen Image Edit
  "qwen-image-edit-plus": null,                         // Qwen Image Edit Plus
  "qwen-image-edit-2511": null,                         // Qwen Image Edit 2511

  // ── Seedream / Nano Banana ───────────────────────────────────────────────
  "seedream-45": null,                                  // Seedream 4.5
  "seedream-40": null,                                  // Seedream 4.0
  "seedream-30": null,                                  // Seedream 3.0
  "nano-banana": null,                                  // Nano Banana
  "nano-banana-pro": null,                              // Nano Banana Pro
  "z-image-turbo": null,                                // Z-Image Turbo

  // ── Google Imagen family ─────────────────────────────────────────────────
  "google-imagen-40-fast": null,                        // Google Imagen 4.0 Fast
  "google-imagen-40": null,                             // Google Imagen 4.0
  "google-imagen-40-ultra": null,                       // Google Imagen 4.0 Ultra
  "google-imagen-30-fast": null,                        // Google Imagen 3.0 Fast
  "google-imagen-30": null,                             // Google Imagen 3.0

  // ── Ideogram family ──────────────────────────────────────────────────────
  "ideogram-v3-turbo": null,                            // Ideogram V3 Turbo
  "ideogram-v3-quality": null,                          // Ideogram V3 Quality
  "ideogram-v3": null,                                  // Ideogram V3
  "ideogram-2a": null,                                  // Ideogram 2a
  "ideogram-2a-turbo": null,                            // Ideogram 2a Turbo
  "ideogram-20": null,                                  // Ideogram 2.0
  "ideogram-20-turbo": null,                            // Ideogram 2.0 Turbo
  "ideogram-10": null,                                  // Ideogram 1.0
  "ideogram-10-turbo": null,                            // Ideogram 1.0 Turbo

  // ── DALL-E / GPT-Image family ────────────────────────────────────────────
  "dall-e-3": null,                                     // DALL-E 3
  "dall-e-2": null,                                     // DALL-E 2
  "gpt15-high": null,                                   // GPT1.5 High
  "gpt15-medium": null,                                 // GPT1.5 Medium
  "gpt15-low": null,                                    // GPT1.5 Low
  "gpt1-high": null,                                    // GPT1 High
  "gpt1-medium": null,                                  // GPT1 Medium
  "gpt1-low": null,                                     // GPT1 Low

  // ── Recraft ──────────────────────────────────────────────────────────────
  "recraft-v3": null,                                   // Recraft v3 (API only)

  // ── Video models ─────────────────────────────────────────────────────────
  "seedance-15-pro": null,                              // Seedance 1.5 Pro
  "seedance-10-pro-fast": null,                         // Seedance 1.0 Pro Fast
  "seedance-10-pro": null,                              // Seedance 1.0 Pro
  "seedance-10-lite": null,                             // Seedance 1.0 Lite
  "pixverse-v5": null,                                  // PixVerse V5
  "kling-25-turbo-standard": null,                      // Kling 2.5 Turbo Standard
  "kling-25-turbo-pro": null,                           // Kling 2.5 Turbo Pro
  "kling-21-standard": null,                            // Kling 2.1 Standard
  "kling-16-standard": null,                            // Kling 1.6 Standard
  "veo-31": null,                                       // Veo 3.1
  "veo-31-fast": null,                                  // Veo 3.1 Fast
  "google-veo-30-fast": null,                           // Google Veo 3.0 Fast
  "runway-gen-4-turbo": null,                           // Runway Gen-4 Turbo

  // ── Legacy / NightCafe-native ────────────────────────────────────────────
  "coherent": null,                                     // Coherent
  "artistic": null,                                     // Artistic
  "style-transfer": null,                               // Style Transfer
};

/**
 * Returns the HuggingFace model ID for a given NightCafe model ID.
 * Returns null if the model is not available on HuggingFace (e.g. closed-source APIs).
 * Returns null if the model ID is not recognized.
 */
export function getHFModelId(nightcafeModelId: string): string | null {
  return HF_MODEL_MAP[nightcafeModelId] ?? null;
}
