import type { ModelEnrichment } from './model-enrichment-service';

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
  bestFor: string[];
  styleTags: string[];
  qualityRating: number;
  speedRating: number;
  keywords: string[];
  recommendedPreset?: string;
  // New specific ratings from CSV
  artRating?: number;
  promptingRating?: number;
  realismRating?: number;
  typographyRating?: number;
  costLevel?: number; // 1-5 scale based on $
  modelType?: 'Image' | 'Video' | 'Edit';
}

export const PRESET_OPTIONS = [
  'NightCafe', 'Cinematic', 'Realistic Anime', 'Artistic Portrait',
  'Detailed Gouache', 'Neo Impressionist', 'Pop Art', 'Anime',
  'Striking', '2.5D Anime', 'Anime v2', 'Hyperreal',
  'Candy v2', 'Photo', 'B&W Portrait', 'Color Portrait',
  'Vibrant', 'Epic Origami', '3D Game v2', 'Color Painting',
  'Oil Painting', 'Cosmic', 'Sinister', 'Candy',
  'Mecha', 'CGI Character', 'Epic', 'Dark Fantasy',
  'Cubist', '3D Game', 'Fantasy', 'Gouache',
  'Modern Comic', 'Abstract Curves', 'Bon Voyage', 'Cubist v2',
  'Matte', 'Charcoal', 'Horror', 'Surreal',
  'Steampunk', 'Cyberpunk', 'Synthwave', 'Heavenly'
] as const;

export const STYLE_FILTERS = [
  'photorealistic',
  'artistic',
  'anime',
  'abstract',
  'illustration',
  'cinematic',
  'fantasy',
  'painterly',
] as const;

export const CATEGORY_OPTIONS = [
  'landscape',
  'character',
  'portrait',
  'abstract',
  'architecture',
  'concept art',
  'illustration',
  'photography',
  'anime',
  'fantasy',
  'sci-fi',
  'nature',
  'general',
] as const;

export const MODELS: ModelInfo[] = [
  {
    "id": "hidream-i1-dev",
    "name": "HiDream I1 Dev",
    "provider": "NightCafe",
    "description": "Maakt verbluffende artistieke afbeeldingen met uitzonderlijke helderheid en detail.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 3,
    "realismRating": 4,
    "typographyRating": 2,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "flux",
    "name": "Flux",
    "provider": "NightCafe",
    "description": "Een geweldig algemeen model voor lage kosten.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 3,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "clarity-upscaler",
    "name": "Clarity Upscaler",
    "provider": "NightCafe",
    "description": "Een creatieve upscaler die detail toevoegt en opschaalt tot 4x.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic"
    ],
    "qualityRating": 3,
    "speedRating": 3,
    "keywords": [],
    "artRating": 3,
    "promptingRating": 3,
    "realismRating": 4,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "flux-2-klein-9b-fast",
    "name": "Flux 2 Klein 9B Fast",
    "provider": "NightCafe",
    "description": "Flux 2 Klein 9B is een 4-stap gedistilleerd beeldgeneratie en bewerkingsmodel.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [],
    "styleTags": [],
    "qualityRating": 2,
    "speedRating": 3,
    "keywords": [],
    "artRating": 2,
    "promptingRating": 2,
    "realismRating": 3,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "nano-banana-pro",
    "name": "Nano Banana Pro",
    "provider": "NightCafe",
    "description": "De volgende versie van Nano Banana met verbeterde mogelijkheden en prestaties.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [],
    "styleTags": [],
    "qualityRating": 3,
    "speedRating": 3,
    "keywords": [],
    "artRating": 3,
    "promptingRating": 4,
    "realismRating": 2,
    "typographyRating": 2,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "seedream-40",
    "name": "Seedream 4.0",
    "provider": "NightCafe",
    "description": "Next-gen multimodaal AI model voor ultra-snelle hoge resolutie generatie (2K-4K).",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 3,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "z-image-turbo",
    "name": "Z-Image Turbo",
    "provider": "NightCafe",
    "description": "Een betaalbaar model met geweldige kwaliteit voor lage kosten.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 3,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "nano-banana",
    "name": "Nano Banana",
    "provider": "NightCafe",
    "description": "AKA Gemini Flash 2.5 - Google's nieuwste model met first-class startafbeelding ondersteuning.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [],
    "styleTags": [],
    "qualityRating": 3,
    "speedRating": 3,
    "keywords": [],
    "artRating": 3,
    "promptingRating": 4,
    "realismRating": 3,
    "typographyRating": 2,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "seedream-45",
    "name": "Seedream 4.5",
    "provider": "NightCafe",
    "description": "Een verbeterde versie van Seedream 4.0.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 5,
    "typographyRating": 3,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "hidream-i1-fast",
    "name": "HiDream I1 Fast",
    "provider": "NightCafe",
    "description": "Snellere en goedkopere versie van HiDream, geweldig voor artistieke afbeeldingen.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 3,
    "realismRating": 4,
    "typographyRating": 2,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "seedream-30",
    "name": "Seedream 3.0",
    "provider": "NightCafe",
    "description": "Een model van ByteDance met focus op realisme en detail.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 5,
    "typographyRating": 3,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "qwen-image-2512",
    "name": "Qwen Image 2512",
    "provider": "NightCafe",
    "description": "Qwen's nieuwste update met grote verbeteringen in realisme. Fotorealistische mensen.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic",
      "typography"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 5,
    "typographyRating": 4,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "qwen-image-edit-2511",
    "name": "Qwen Image Edit 2511",
    "provider": "NightCafe",
    "description": "Behoudt mensen en texturen goed, ongeacht aanpassingen.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 5,
    "typographyRating": 3,
    "costLevel": 4,
    "modelType": "Edit"
  },
  {
    "id": "flux-2-klein-4b-fast",
    "name": "Flux 2 Klein 4B Fast",
    "provider": "NightCafe",
    "description": "De snelste variant in de Klein familie. Gebouwd voor interactieve toepassingen en realtime gebruik.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [],
    "styleTags": [],
    "qualityRating": 3,
    "speedRating": 3,
    "keywords": [],
    "artRating": 3,
    "promptingRating": 4,
    "realismRating": 3,
    "typographyRating": 2,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "flux-2-klein-4b",
    "name": "Flux 2 Klein 4B",
    "provider": "NightCafe",
    "description": "Een kleiner basismodel met uitzonderlijke kwaliteit-grootte verhouding. Ideaal voor effici\u00ebnt gebruik.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic"
    ],
    "qualityRating": 3,
    "speedRating": 3,
    "keywords": [],
    "artRating": 3,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "flux-2-klein-9b",
    "name": "Flux 2 Klein 9B",
    "provider": "NightCafe",
    "description": "Uitstekende kwaliteit bij sub-seconde snelheid. Geweldig voor realtime generatie.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic"
    ],
    "qualityRating": 3,
    "speedRating": 3,
    "keywords": [],
    "artRating": 3,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "qwen-image",
    "name": "Qwen Image",
    "provider": "NightCafe",
    "description": "Een model van Alibaba dat uitblinkt in typografie.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "typography"
    ],
    "styleTags": [
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 3,
    "typographyRating": 5,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "qwen-image-sd",
    "name": "Qwen Image SD",
    "provider": "NightCafe",
    "description": "Een goedkopere lagere resolutie versie van Qwen Image.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "typography"
    ],
    "styleTags": [],
    "qualityRating": 3,
    "speedRating": 3,
    "keywords": [],
    "artRating": 3,
    "promptingRating": 4,
    "realismRating": 3,
    "typographyRating": 4,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "flux-2-dev",
    "name": "Flux 2 Dev",
    "provider": "NightCafe",
    "description": "Baseline Flux 2, goed in alles en voor redelijke kosten.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 3,
    "costLevel": 3,
    "modelType": "Image"
  },
  {
    "id": "flux-2-pro",
    "name": "Flux 2 Pro",
    "provider": "NightCafe",
    "description": "Flux 2 met verbeterde beeldkwaliteit en goed voor fotorealisme.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 5,
    "realismRating": 5,
    "typographyRating": 3,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "flux-2-flex",
    "name": "Flux 2 Flex",
    "provider": "NightCafe",
    "description": "Flux 2, beter voor typografie en designs.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic",
      "typography"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 5,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "flux-2-max",
    "name": "Flux 2 Max",
    "provider": "NightCafe",
    "description": "Gegronding generatie met echte context. Maximum kwaliteit voor complexe workflows.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic",
      "typography"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 5,
    "realismRating": 5,
    "typographyRating": 5,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "flux-krea",
    "name": "Flux Krea",
    "provider": "NightCafe",
    "description": "Maakt realistische afbeeldingen met focus op correcte menselijke anatomie.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 5,
    "typographyRating": 3,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "flux-schnell",
    "name": "Flux Schnell",
    "provider": "NightCafe",
    "description": "Een goedkopere, snellere maar iets minder krachtige versie van Flux.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 3,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "google-imagen-40-fast",
    "name": "Google Imagen 4.0 Fast",
    "provider": "NightCafe",
    "description": "Een snellere goedkopere versie van Imagen v4, Google's beeldmodel.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic",
      "typography"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 4,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "google-imagen-40",
    "name": "Google Imagen 4.0",
    "provider": "NightCafe",
    "description": "Google's beeldmodel. Geweldig voor prompt-naleving en typografie.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic",
      "typography"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 5,
    "realismRating": 5,
    "typographyRating": 5,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "qwen-image-edit-plus",
    "name": "Qwen Image Edit Plus",
    "provider": "NightCafe",
    "description": "AKA Qwen Image Edit 2509 - Verbeterde versie van Qwen-Image-Edit met multi-image ondersteuning.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 5,
    "typographyRating": 3,
    "costLevel": 4,
    "modelType": "Edit"
  },
  {
    "id": "qwen-image-edit",
    "name": "Qwen Image Edit",
    "provider": "NightCafe",
    "description": "Geavanceerde beeldbewerkingsmogelijkheden met Qwen AI.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 3,
    "costLevel": 4,
    "modelType": "Edit"
  },
  {
    "id": "flux-kontext-dev",
    "name": "Flux Kontext Dev",
    "provider": "NightCafe",
    "description": "Goedkopere en snellere versie van Kontext, goed in het bewerken via prompts.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic"
    ],
    "qualityRating": 3,
    "speedRating": 3,
    "keywords": [],
    "artRating": 3,
    "promptingRating": 5,
    "realismRating": 4,
    "typographyRating": 3,
    "costLevel": 5,
    "modelType": "Edit"
  },
  {
    "id": "flux-pro-v11",
    "name": "Flux PRO v1.1",
    "provider": "NightCafe",
    "description": "De volledige krachtige versie van Flux door Black Forest Labs.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 5,
    "realismRating": 5,
    "typographyRating": 3,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "hidream-i1-full",
    "name": "HiDream I1 Full",
    "provider": "NightCafe",
    "description": "De volledige kracht van HiDream I1, een geavanceerd beeldgeneratiemodel.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 3,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "ideogram-v3-turbo",
    "name": "Ideogram V3 Turbo",
    "provider": "NightCafe",
    "description": "Het nieuwste turbo model van Ideogram.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic",
      "typography"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 5,
    "realismRating": 4,
    "typographyRating": 5,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "dreamshaper-xl-lightning",
    "name": "Dreamshaper XL Lightning",
    "provider": "NightCafe",
    "description": "Een snel goedkoop model dat goed is in kunst en realisme.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 3,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "google-imagen-40-ultra",
    "name": "Google Imagen 4.0 Ultra",
    "provider": "NightCafe",
    "description": "Een grotere versie van Imagen v4, Google's nieuwste beeldmodel.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic",
      "typography"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 5,
    "realismRating": 5,
    "typographyRating": 5,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "flux-pro-v11-ultra",
    "name": "Flux PRO v1.1 Ultra",
    "provider": "NightCafe",
    "description": "Ultra hoge resolutie versie van Flux door Black Forest Labs.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic",
      "typography"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 5,
    "realismRating": 5,
    "typographyRating": 4,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "flux-kontext-pro",
    "name": "Flux Kontext Pro",
    "provider": "NightCafe",
    "description": "Uitstekend in het bewerken van afbeeldingen via natuurlijke taal prompts.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic"
    ],
    "qualityRating": 3,
    "speedRating": 3,
    "keywords": [],
    "artRating": 3,
    "promptingRating": 5,
    "realismRating": 4,
    "typographyRating": 3,
    "costLevel": 5,
    "modelType": "Edit"
  },
  {
    "id": "flux-kontext-max",
    "name": "Flux Kontext Max",
    "provider": "NightCafe",
    "description": "Een krachtigere versie van Flux Kontext voor beeldbewerking via tekstprompts.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic"
    ],
    "qualityRating": 3,
    "speedRating": 3,
    "keywords": [],
    "artRating": 3,
    "promptingRating": 5,
    "realismRating": 4,
    "typographyRating": 3,
    "costLevel": 4,
    "modelType": "Edit"
  },
  {
    "id": "ideogram-v3-quality",
    "name": "Ideogram V3 Quality",
    "provider": "NightCafe",
    "description": "Het nieuwste en beste model van Ideogram.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic",
      "typography"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 5,
    "realismRating": 4,
    "typographyRating": 5,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "dall-e-3",
    "name": "DALL-E 3",
    "provider": "NightCafe",
    "description": "Beeldmodel van OpenAI. Geweldig voor creatieve artistieke prompts.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 5,
    "realismRating": 4,
    "typographyRating": 3,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "gpt15-medium",
    "name": "GPT1.5 Medium",
    "provider": "NightCafe",
    "description": "Het nieuwste model van OpenAI op gemiddelde kwaliteitsinstelling. Ondersteunt prompt-to-edit.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic",
      "typography"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 5,
    "realismRating": 5,
    "typographyRating": 4,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "gpt15-high",
    "name": "GPT1.5 High",
    "provider": "NightCafe",
    "description": "Het nieuwste model van OpenAI op hoge kwaliteitsinstelling. Ondersteunt prompt-to-edit.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic",
      "typography"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 5,
    "realismRating": 5,
    "typographyRating": 5,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "gpt1-medium",
    "name": "GPT1 Medium",
    "provider": "NightCafe",
    "description": "Het nieuwste flagship beeldmodel van OpenAI op gemiddelde kwaliteitsinstelling.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic",
      "typography"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 5,
    "realismRating": 5,
    "typographyRating": 4,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "gpt1-high",
    "name": "GPT1 High",
    "provider": "NightCafe",
    "description": "Het nieuwste flagship beeldmodel van OpenAI op hoge kwaliteitsinstelling.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic",
      "typography"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 5,
    "realismRating": 5,
    "typographyRating": 5,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "ideogram-v3",
    "name": "Ideogram V3",
    "provider": "NightCafe",
    "description": "Het nieuwste model van Ideogram.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic",
      "typography"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 5,
    "realismRating": 4,
    "typographyRating": 5,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "google-imagen-30-fast",
    "name": "Google Imagen 3.0 Fast",
    "provider": "NightCafe",
    "description": "Een snellere goedkopere versie van Imagen v3, Google's beeldmodel.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic",
      "typography"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 4,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "google-imagen-30",
    "name": "Google Imagen 3.0",
    "provider": "NightCafe",
    "description": "Google's beeldmodel. Geweldig voor prompt-naleving en typografie.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic",
      "typography"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 5,
    "realismRating": 5,
    "typographyRating": 5,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "ideogram-2a",
    "name": "Ideogram 2a",
    "provider": "NightCafe",
    "description": "Gemaakt door ex-Googlers. Betaalbare prompt-naleving en typografie.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic",
      "typography"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 5,
    "realismRating": 4,
    "typographyRating": 5,
    "costLevel": 3,
    "modelType": "Image"
  },
  {
    "id": "ideogram-2a-turbo",
    "name": "Ideogram 2a Turbo",
    "provider": "NightCafe",
    "description": "Een snellere goedkopere versie van Ideogram 2a.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic",
      "typography"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 5,
    "costLevel": 3,
    "modelType": "Image"
  },
  {
    "id": "gpt15-low",
    "name": "GPT1.5 Low",
    "provider": "NightCafe",
    "description": "GPT Image 1.5 van OpenAI op lage kwaliteitsinstelling. Snel en goedkoop voor prototypes.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [],
    "styleTags": [],
    "qualityRating": 3,
    "speedRating": 3,
    "keywords": [],
    "artRating": 3,
    "promptingRating": 4,
    "realismRating": 3,
    "typographyRating": 3,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "gpt1-low",
    "name": "GPT1 Low",
    "provider": "NightCafe",
    "description": "GPT Image 1 van OpenAI op lage kwaliteitsinstelling. Snel en goedkoop voor prototypes.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [],
    "styleTags": [],
    "qualityRating": 3,
    "speedRating": 3,
    "keywords": [],
    "artRating": 3,
    "promptingRating": 4,
    "realismRating": 3,
    "typographyRating": 3,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "recraft-v3",
    "name": "Recraft v3",
    "provider": "NightCafe",
    "description": "Model door Recraft. Uitstekend voor spelling en typografie. Kan vectoren genereren.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "typography"
    ],
    "styleTags": [],
    "qualityRating": 3,
    "speedRating": 3,
    "keywords": [],
    "artRating": 3,
    "promptingRating": 5,
    "realismRating": 3,
    "typographyRating": 5,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "ideogram-20",
    "name": "Ideogram 2.0",
    "provider": "NightCafe",
    "description": "Gemaakt door ex-Googlers. Geweldig voor prompt-naleving en tekst in afbeeldingen.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic",
      "typography"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 5,
    "realismRating": 4,
    "typographyRating": 5,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "ideogram-20-turbo",
    "name": "Ideogram 2.0 Turbo",
    "provider": "NightCafe",
    "description": "Een snellere goedkopere versie van Ideogram 2.0. Geweldig voor typografie.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "typography"
    ],
    "styleTags": [
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 5,
    "realismRating": 3,
    "typographyRating": 5,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "ideogram-10",
    "name": "Ideogram 1.0",
    "provider": "NightCafe",
    "description": "Het eerste model van Ideogram. Goed voor typografie.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "typography"
    ],
    "styleTags": [
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 3,
    "typographyRating": 4,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "ideogram-10-turbo",
    "name": "Ideogram 1.0 Turbo",
    "provider": "NightCafe",
    "description": "Een snellere en goedkopere versie van Ideogram 1.0.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "typography"
    ],
    "styleTags": [
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 3,
    "typographyRating": 4,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "seedance-15-pro",
    "name": "Seedance 1.5 Pro",
    "provider": "NightCafe",
    "description": "De volgende generatie AI videogeneratie met gesynchroniseerde audio mogelijkheden.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 5,
    "realismRating": 5,
    "typographyRating": 2,
    "costLevel": 5,
    "modelType": "Video"
  },
  {
    "id": "seedance-10-pro-fast",
    "name": "Seedance 1.0 Pro Fast",
    "provider": "NightCafe",
    "description": "Snellere videogeneratie. Lagere prijs. Cinematografische resultaten.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Video"
  },
  {
    "id": "pixverse-v5",
    "name": "PixVerse V5",
    "provider": "NightCafe",
    "description": "PixVerse's v5 model met de nieuwste ontwikkelingen in AI videogeneratie.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 5,
    "realismRating": 5,
    "typographyRating": 2,
    "costLevel": 5,
    "modelType": "Video"
  },
  {
    "id": "kling-25-turbo-standard",
    "name": "Kling 2.5 Turbo Standard",
    "provider": "NightCafe",
    "description": "Ontworpen voor vloeiende cinematografische beeld-naar-video generatie door Kling A.I.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 2,
    "costLevel": 5,
    "modelType": "Video"
  },
  {
    "id": "veo-31",
    "name": "Veo 3.1",
    "provider": "NightCafe",
    "description": "Levensechte beweging met contextbewuste gesynchroniseerde audio. Ondersteunt eerste en laatste frame.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 5,
    "realismRating": 5,
    "typographyRating": 2,
    "costLevel": 5,
    "modelType": "Video"
  },
  {
    "id": "veo-31-fast",
    "name": "Veo 3.1 Fast",
    "provider": "NightCafe",
    "description": "Maakt dynamische cinematografische video's van \u00e9\u00e9n afbeelding met levensechte beweging en gesynchroniseerde audio.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 5,
    "realismRating": 5,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Video"
  },
  {
    "id": "google-veo-30-fast",
    "name": "Google Veo 3.0 Fast",
    "provider": "NightCafe",
    "description": "Een tekst-naar-video en beeld-naar-video model door Google.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 5,
    "realismRating": 4,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Video"
  },
  {
    "id": "seedance-10-pro",
    "name": "Seedance 1.0 Pro",
    "provider": "NightCafe",
    "description": "Een tekst-naar-video en beeld-naar-video model door ByteDance AI.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 2,
    "costLevel": 5,
    "modelType": "Video"
  },
  {
    "id": "seedance-10-lite",
    "name": "Seedance 1.0 Lite",
    "provider": "NightCafe",
    "description": "Een tekst-naar-video en beeld-naar-video model door ByteDance AI.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic"
    ],
    "qualityRating": 3,
    "speedRating": 3,
    "keywords": [],
    "artRating": 3,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Video"
  },
  {
    "id": "kling-25-turbo-pro",
    "name": "Kling 2.5 Turbo Pro",
    "provider": "NightCafe",
    "description": "Een tekst-naar-video en beeld-naar-video model door Kling A.I. met turbo beweging.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 5,
    "realismRating": 5,
    "typographyRating": 2,
    "costLevel": 5,
    "modelType": "Video"
  },
  {
    "id": "kling-21-standard",
    "name": "Kling 2.1 Standard",
    "provider": "NightCafe",
    "description": "Een beeld-naar-video model door Kling A.I.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 2,
    "costLevel": 5,
    "modelType": "Video"
  },
  {
    "id": "kling-16-standard",
    "name": "Kling 1.6 Standard",
    "provider": "NightCafe",
    "description": "Een tekst-naar-video en beeld-naar-video model door Kling A.I.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic"
    ],
    "qualityRating": 3,
    "speedRating": 3,
    "keywords": [],
    "artRating": 3,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Video"
  },
  {
    "id": "runway-gen-4-turbo",
    "name": "Runway Gen-4 Turbo",
    "provider": "NightCafe",
    "description": "Het nieuwste beeld-naar-video model door Runway.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 5,
    "realismRating": 5,
    "typographyRating": 2,
    "costLevel": 5,
    "modelType": "Video"
  },
  {
    "id": "juggernaut-flux-base",
    "name": "Juggernaut Flux Base",
    "provider": "NightCafe",
    "description": "Een versie van Flux getraind op hoogwaardige afbeeldingen. Door RunDiffusion.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 4,
    "realismRating": 5,
    "typographyRating": 3,
    "costLevel": 3,
    "modelType": "Image"
  },
  {
    "id": "juggernaut-flux-pro",
    "name": "Juggernaut Flux Pro",
    "provider": "NightCafe",
    "description": "Flux maar beter (vooral voor realisme). Door RunDiffusion.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 5,
    "realismRating": 5,
    "typographyRating": 3,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "juggernaut-flux-lightning",
    "name": "Juggernaut Flux Lightning",
    "provider": "NightCafe",
    "description": "Een goedkopere snellere maar iets minder krachtige versie van Juggernaut Flux.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 5,
    "typographyRating": 3,
    "costLevel": 3,
    "modelType": "Image"
  },
  {
    "id": "juggernaut-xi",
    "name": "Juggernaut XI",
    "provider": "NightCafe",
    "description": "Juggernaut opnieuw getraind voor betere prompt-naleving. Door RunDiffusion.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 5,
    "realismRating": 5,
    "typographyRating": 3,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "juggernaut-xi-lightning",
    "name": "Juggernaut XI Lightning",
    "provider": "NightCafe",
    "description": "Juggernaut opnieuw getraind voor betere prompt-naleving. Door RunDiffusion.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 5,
    "realismRating": 5,
    "typographyRating": 3,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "realvisxl-v5",
    "name": "RealVisXL v5",
    "provider": "NightCafe",
    "description": "Een SDXL model voor fotorealisme. Geweldig voor gezichten. Door SG_161222.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 5,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "realvisxl-v5-lightning",
    "name": "RealVisXL v5 Lightning",
    "provider": "NightCafe",
    "description": "Een SDXL lightning model voor fotorealisme. Geweldig voor gezichten. Door SG_161222.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 5,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "crystal-clear-xl",
    "name": "Crystal Clear XL",
    "provider": "NightCafe",
    "description": "Een SDXL model voor fotorealisme, 3D, semi-realistisch of cartoonachtig. Door Team Crystal.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 5,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "crystal-clear-xl-lightning",
    "name": "Crystal Clear XL Lightning",
    "provider": "NightCafe",
    "description": "Een SDXL model voor fotorealisme, 3D, semi-realistisch of cartoonachtig. Door Team Crystal.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "boltning-xl-v1-lightning",
    "name": "Boltning XL v1 Lightning",
    "provider": "NightCafe",
    "description": "Een lightning model voor zeer gedetailleerde esthetische afbeeldingen. Door georgebanjog.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 2,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "atomix-xl-v4-lightning",
    "name": "Atomix XL v4 Lightning",
    "provider": "NightCafe",
    "description": "Een lightning model dat realisme en CG balanceert. Door AlexLai.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "moxie-diffusion-xl-v16-lightning",
    "name": "Moxie Diffusion XL v1.6 Lightning",
    "provider": "NightCafe",
    "description": "Een mashup van populaire SDXL modellen. Door moxie1776.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "realvisxl-v4",
    "name": "RealVisXL v4",
    "provider": "NightCafe",
    "description": "Een SDXL model voor fotorealisme. Geweldig voor gezichten. Door SG_161222.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 5,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "stable-core",
    "name": "Stable Core",
    "provider": "NightCafe",
    "description": "Mooie hoge resolutie afbeeldingen zonder complexe prompts.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 5,
    "realismRating": 4,
    "typographyRating": 3,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "sdxl-10",
    "name": "SDXL 1.0",
    "provider": "NightCafe",
    "description": "Stabiel Diffusie XL. Een ouder model dat nog steeds goed presteert.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 3,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "realvisxl-v4-lightning",
    "name": "RealVisXL v4 Lightning",
    "provider": "NightCafe",
    "description": "Een SDXL model voor fotorealisme. Geweldig voor gezichten. Door SG_161222.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 5,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "fluently-xl",
    "name": "Fluently XL",
    "provider": "NightCafe",
    "description": "Een SDXL model voor het maken van realistische afbeeldingen. Door Fluently.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 5,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "fluently-xl-lightning",
    "name": "Fluently XL Lightning",
    "provider": "NightCafe",
    "description": "Een SDXL lightning model voor realistische afbeeldingen. Door Fluently.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 5,
    "typographyRating": 2,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "real-cartoon-xl-v4",
    "name": "Real Cartoon XL v4",
    "provider": "NightCafe",
    "description": "Een SDXL model goed voor realistisch ogende cartoons. Door 7whitefire7.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [],
    "styleTags": [
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 3,
    "realismRating": 3,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "starlight-xl",
    "name": "Starlight XL",
    "provider": "NightCafe",
    "description": "Een SDXL model voor concept art en illustraties. Door chillpixel.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [],
    "styleTags": [
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 4,
    "realismRating": 3,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "mysterious-xl-v4",
    "name": "Mysterious XL v4",
    "provider": "NightCafe",
    "description": "Een SDXL model voor fantasy kunst en Aziatische cultuur. Door LahInTheFutureland.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [],
    "styleTags": [
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 3,
    "realismRating": 3,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "juggernaut-xl-v8",
    "name": "Juggernaut XL v8",
    "provider": "NightCafe",
    "description": "Een SDXL model voor perfecte realisme en cinematografische stijlen. Door KandooAI.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 4,
    "realismRating": 5,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "dreamshaper-xl-alpha2",
    "name": "DreamShaper XL alpha2",
    "provider": "NightCafe",
    "description": "Een veelzijdig SDXL model getraind door Lykon.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 3,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "juggernaut-xl-v5",
    "name": "Juggernaut XL v5",
    "provider": "NightCafe",
    "description": "Een SDXL model voor perfecte realisme en cinematografische stijlen. Door KandooAI.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 4,
    "realismRating": 5,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "juggernaut-xl-v6",
    "name": "Juggernaut XL v6",
    "provider": "NightCafe",
    "description": "Een SDXL model voor perfecte realisme en cinematografische stijlen. Door KandooAI.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 4,
    "realismRating": 5,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "juggernaut-xl-v7",
    "name": "Juggernaut XL v7",
    "provider": "NightCafe",
    "description": "Een SDXL model voor perfecte realisme en cinematografische stijlen. Door KandooAI.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 4,
    "realismRating": 5,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "juggernaut-v9-lightning",
    "name": "Juggernaut v9 Lightning",
    "provider": "NightCafe",
    "description": "Een lightning model voor perfecte realisme en cinematografische stijlen. Door RunDiffusion.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 5,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "juggernaut-v9",
    "name": "Juggernaut v9",
    "provider": "NightCafe",
    "description": "Een SDXL model voor perfecte realisme en cinematografische stijlen. Door RunDiffusion.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 5,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "blue-pencil-xl",
    "name": "Blue Pencil XL",
    "provider": "NightCafe",
    "description": "Een SDXL Anime model door blue_pen5805.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [],
    "styleTags": [
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 3,
    "realismRating": 3,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "animagine-xl-v3",
    "name": "Animagine XL v3",
    "provider": "NightCafe",
    "description": "Een model voor het genereren van hoogwaardige anime. Door CagliostroLab.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [],
    "styleTags": [
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 4,
    "realismRating": 3,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "realvisxl-v3",
    "name": "RealVisXL v3",
    "provider": "NightCafe",
    "description": "Een SDXL model voor fotorealisme. Geweldig voor gezichten. Door SG_161222.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 5,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "aam-xl-anime-mix-v1",
    "name": "AAM XL Anime Mix v1",
    "provider": "NightCafe",
    "description": "Een model voor anime en gestileerde kunst. Door Lykon.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "anime"
    ],
    "styleTags": [
      "artistic",
      "anime"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 3,
    "realismRating": 3,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "virtual-utopia-xl",
    "name": "Virtual Utopia XL",
    "provider": "NightCafe",
    "description": "Geschikt voor zowel authentieke als anime afbeeldingen. Door CyberBlacat.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "cherry-picker-xl-v27",
    "name": "Cherry Picker XL v2.7",
    "provider": "NightCafe",
    "description": "Een fotorealistisch model dat zorgvuldig geselecteerde modellen combineert. Door tkvier.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 4,
    "realismRating": 5,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "sdxl-lcm",
    "name": "SDXL LCM",
    "provider": "NightCafe",
    "description": "SDXL versneld door LCM LoRA. Hoge kwaliteit snel en goedkoop.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 3,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "sdxl-dpo",
    "name": "SDXL DPO",
    "provider": "NightCafe",
    "description": "Een Direct Preference Optimization (DPO) versie van SDXL 1.0.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 3,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "dreamshaper-v8",
    "name": "DreamShaper v8",
    "provider": "NightCafe",
    "description": "Een doet-het-allemaal model door Lykon. Bijzonder goed in kunst.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 3,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "realistic-vision-v51",
    "name": "Realistic Vision V5.1",
    "provider": "NightCafe",
    "description": "Een model voor fotorealisme. Geweldig voor gezichten. Door SG_161222.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 5,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "absolutereality-v181",
    "name": "AbsoluteReality v1.8.1",
    "provider": "NightCafe",
    "description": "Een model gericht op realisme door Lykon.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 5,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "neverending-dream-v122",
    "name": "NeverEnding Dream v1.2.2",
    "provider": "NightCafe",
    "description": "Een DreamShaper alternatief dat beter is in anime. Door Lykon.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [],
    "styleTags": [
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 3,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "3d-animation-diffusion-v10",
    "name": "3D Animation Diffusion v10",
    "provider": "NightCafe",
    "description": "Geweldig voor het maken van 3D cartoon karakters. Door Lykon.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [],
    "styleTags": [
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 4,
    "realismRating": 3,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "rpg-v5",
    "name": "RPG v5",
    "provider": "NightCafe",
    "description": "Gericht op het maken van RPG karakter portretten. Door Anashel.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [],
    "styleTags": [
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 4,
    "realismRating": 3,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "blue-pencil-v10",
    "name": "Blue Pencil v10",
    "provider": "NightCafe",
    "description": "Gericht op anime en fantasy kunst. Door blue_pen5805.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [],
    "styleTags": [
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 3,
    "realismRating": 3,
    "typographyRating": 2,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "arthemy-comics-v50",
    "name": "Arthemy Comics v5.0",
    "provider": "NightCafe",
    "description": "Gericht op het maken van stripverhaal stijl karakters. Door Arthemy.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [],
    "styleTags": [
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 4,
    "realismRating": 3,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "rabbit-v7",
    "name": "Rabbit v7",
    "provider": "NightCafe",
    "description": "Dit model is geboren om schattige kleine dingen te tekenen. Door Rabbit_YourMajesty.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [],
    "styleTags": [
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 3,
    "realismRating": 2,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "nightmare-shaper-v3",
    "name": "Nightmare Shaper v3",
    "provider": "NightCafe",
    "description": "Ontworpen om de donkerste verbeeldingen los te laten. Door Yamer.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [],
    "styleTags": [
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 4,
    "realismRating": 3,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "wildlifex-animals",
    "name": "WildlifeX Animals",
    "provider": "NightCafe",
    "description": "Model gericht op dieren, huisdieren en verschillende rassen. Door Mr_fries1111.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 4,
    "realismRating": 4,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "realcartoon-pixar-v8",
    "name": "RealCartoon Pixar v8",
    "provider": "NightCafe",
    "description": "Een SD1.5 model goed voor Pixar stijl cartoons. Door 7whitefire7.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [],
    "styleTags": [
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 3,
    "realismRating": 3,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "ghost-mix-v2",
    "name": "Ghost Mix v2",
    "provider": "NightCafe",
    "description": "Een SD1.5 model goed voor 2.5D kunst. Door _GhostInShell_.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [],
    "styleTags": [
      "artistic"
    ],
    "qualityRating": 5,
    "speedRating": 3,
    "keywords": [],
    "artRating": 5,
    "promptingRating": 3,
    "realismRating": 3,
    "typographyRating": 2,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "juggernaut-reborn",
    "name": "Juggernaut Reborn",
    "provider": "NightCafe",
    "description": "Een SD 1.5 model voor perfecte realisme en cinematografische stijlen. Door KandooAI.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic",
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 5,
    "typographyRating": 2,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "sd15-dpo",
    "name": "SD1.5 DPO",
    "provider": "NightCafe",
    "description": "Een Direct Preference Optimization (DPO) versie van SD1.5.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [
      "photorealistic"
    ],
    "styleTags": [
      "photorealistic"
    ],
    "qualityRating": 3,
    "speedRating": 3,
    "keywords": [],
    "artRating": 3,
    "promptingRating": 3,
    "realismRating": 4,
    "typographyRating": 2,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "dall-e-2",
    "name": "DALL-E 2",
    "provider": "NightCafe",
    "description": "De originele beeldgenerator van OpenAI.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [],
    "styleTags": [
      "artistic"
    ],
    "qualityRating": 4,
    "speedRating": 3,
    "keywords": [],
    "artRating": 4,
    "promptingRating": 4,
    "realismRating": 3,
    "typographyRating": 2,
    "costLevel": 3,
    "modelType": "Image"
  },
  {
    "id": "stable-diffusion-15",
    "name": "Stable Diffusion 1.5",
    "provider": "NightCafe",
    "description": "Het meest populaire eerste generatie Stabiel Diffusie model.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [],
    "styleTags": [],
    "qualityRating": 2,
    "speedRating": 3,
    "keywords": [],
    "artRating": 2,
    "promptingRating": 2,
    "realismRating": 3,
    "typographyRating": 2,
    "costLevel": 5,
    "modelType": "Image"
  },
  {
    "id": "stable-diffusion-14",
    "name": "Stable Diffusion 1.4",
    "provider": "NightCafe",
    "description": "Het originele Stabiel Diffusie model.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [],
    "styleTags": [],
    "qualityRating": 2,
    "speedRating": 3,
    "keywords": [],
    "artRating": 2,
    "promptingRating": 2,
    "realismRating": 3,
    "typographyRating": 2,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "coherent",
    "name": "Coherent",
    "provider": "NightCafe",
    "description": "CLIP-Guided Diffusion.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [],
    "styleTags": [],
    "qualityRating": 2,
    "speedRating": 3,
    "keywords": [],
    "artRating": 2,
    "promptingRating": 2,
    "realismRating": 2,
    "typographyRating": 1,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "artistic",
    "name": "Artistic",
    "provider": "NightCafe",
    "description": "VQGAN+CLIP - het originele tekst-naar-afbeelding algoritme.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [],
    "styleTags": [],
    "qualityRating": 2,
    "speedRating": 3,
    "keywords": [],
    "artRating": 2,
    "promptingRating": 1,
    "realismRating": 1,
    "typographyRating": 1,
    "costLevel": 4,
    "modelType": "Image"
  },
  {
    "id": "style-transfer",
    "name": "Style Transfer",
    "provider": "NightCafe",
    "description": "Het originele AI Art algoritme.",
    "strengths": [],
    "weaknesses": [],
    "bestFor": [],
    "styleTags": [],
    "qualityRating": 2,
    "speedRating": 3,
    "keywords": [],
    "artRating": 2,
    "promptingRating": 1,
    "realismRating": 1,
    "typographyRating": 1,
    "costLevel": 4,
    "modelType": "Image"
  }
];

export function analyzePrompt(prompt: string): { model: ModelInfo; score: number; reasons: string[] }[] {
  const lower = prompt.toLowerCase();
  const words = lower.split(/\s+/);

  return MODELS.map((model) => {
    let score = 0;
    const reasons: string[] = [];

    const keywordMatches = model.keywords.filter((kw) => lower.includes(kw));
    if (keywordMatches.length > 0) {
      score += keywordMatches.length * 10;
      reasons.push(`Matches keywords: ${keywordMatches.slice(0, 4).join(', ')}`);
    }

    if (lower.includes('photo') || lower.includes('realistic') || lower.includes('real')) {
      if (model.styleTags.includes('photorealistic') || (model.realismRating && model.realismRating >= 4)) {
        score += 25;
        reasons.push('Strong photorealistic capabilities');
      }
    }

    if (lower.includes('anime') || lower.includes('manga')) {
      if (model.styleTags.includes('anime') || model.keywords.includes('anime') || model.name.toLowerCase().includes('anime')) {
        score += 25;
        reasons.push('Trained for anime/manga styles');
      }
    }

    if (lower.includes('art') || lower.includes('painting') || lower.includes('artistic')) {
      if (model.artRating && model.artRating >= 4) {
        score += 20;
        reasons.push('High artistic quality');
      }
    }

    if (lower.includes('text') || lower.includes('sign') || lower.includes('typography')) {
      if (model.id.startsWith('ideogram') || model.id === 'dalle3' || model.id === 'recraft-v3' || (model.typographyRating && model.typographyRating >= 4)) {
        score += 35;
        reasons.push('Excellent typography support');
      }
    }

    // Use general quality rating
    score += (model.qualityRating || 0) * 2;

    // Boost newer/pro models slightly if prompt is complex
    if (words.length > 20 && (model.id.includes('pro') || model.id.includes('flux-2'))) {
      score += 10;
      reasons.push('Handles complex prompts well');
    }

    // Default to the standard Flux model when no prompt is provided to avoid suggesting expensive max models
    if (prompt.trim().length === 0 && model.id === 'flux') {
      score += 100;
      reasons.push('Great balanced default model');
    } else if (prompt.trim().length === 0 && model.id === 'flux-schnell') {
      score += 50;
      reasons.push('Fast default model');
    }

    return { model, score, reasons: reasons.length > 0 ? reasons : ['General-purpose model'] };
  })
    .sort((a, b) => b.score - a.score);
}

export function getTopCandidates(prompt: string, n: number = 5): { id: string; name: string; score: number }[] {
  const results = analyzePrompt(prompt);
  return results.slice(0, n).map(r => ({
    id: r.model.id,
    name: r.model.name,
    score: r.score
  }));
}

export function supportsNegativePrompt(modelId: string): boolean {
  if (!modelId) return true;
  if (modelId.includes('dalle3')) return false;
  if (modelId.startsWith('gpt')) return false;
  if (modelId.includes('flux')) return true;
  return true;
}

/**
 * Returns a ModelInfo for the given model ID, optionally merged with live
 * HuggingFace enrichment data.  Enrichment strengths/weaknesses/keywords
 * override the (often empty) static arrays when the enrichment is present
 * and the model has been successfully enriched.
 */
export function getModelInfo(modelId: string, enrichment?: ModelEnrichment | null): ModelInfo | undefined {
  const base = MODELS.find(m => m.id === modelId);
  if (!base) return undefined;
  if (!enrichment || enrichment.enrichment_status !== 'enriched') return base;

  return {
    ...base,
    strengths: enrichment.strengths ?? base.strengths,
    weaknesses: enrichment.weaknesses ?? base.weaknesses,
    bestFor: enrichment.best_for ?? base.bestFor,
    keywords: enrichment.keywords ?? base.keywords,
  };
}
