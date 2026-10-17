// Doimiy loop video fonlar bazasi (9:16 vertikal format)
// Bepul, litsenziyali estetik videolar (Kosmos, Abstrakt, Neon, Tabiat, Tarixiy tekstura va h.k.)

export interface LoopVideoPreset {
  id: string;
  name: string;
  category: "space" | "abstract" | "neon" | "nature" | "gold" | "history" | "nebula" | "smoke" | "cyber" | "fire";
  localPath: string; // public/backgrounds/bg1.mp4 -> /backgrounds/bg1.mp4
  fallbackLocalPath?: string;
  cdnUrl: string;
}

export const PRESET_LOOP_VIDEOS: LoopVideoPreset[] = [
  {
    id: "space-01",
    name: "Koinot va Yulduzlar",
    category: "space",
    localPath: "/backgrounds/bg1.mp4",
    fallbackLocalPath: "/backgrounds/Dark abstract background 5.mp4",
    cdnUrl: "https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-1610-large.mp4",
  },
  {
    id: "abstract-02",
    name: "Qorong'i Abstrakt To'lqinlar",
    category: "abstract",
    localPath: "/backgrounds/bg2.mp4",
    fallbackLocalPath: "/backgrounds/Dark abstract background 6.mp4",
    cdnUrl: "https://assets.mixkit.co/videos/preview/mixkit-abstract-dark-particle-movement-41484-large.mp4",
  },
  {
    id: "neon-03",
    name: "Kiber Neon Tunnel",
    category: "neon",
    localPath: "/backgrounds/bg3.mp4",
    fallbackLocalPath: "/backgrounds/Dark abstract background 7.mp4",
    cdnUrl: "https://assets.mixkit.co/videos/preview/mixkit-futuristic-neon-light-tunnel-loop-42866-large.mp4",
  },
  {
    id: "nature-04",
    name: "Chuqur Tabiat / O'rmon",
    category: "nature",
    localPath: "/backgrounds/bg4.mp4",
    fallbackLocalPath: "/backgrounds/Dark abstract background 8.mp4",
    cdnUrl: "https://assets.mixkit.co/videos/preview/mixkit-waterfall-in-forest-2213-large.mp4",
  },
  {
    id: "gold-05",
    name: "Oltin Zarrachalar (Hashamat)",
    category: "gold",
    localPath: "/backgrounds/bg5.mp4",
    fallbackLocalPath: "/backgrounds/Dark abstract background 9.mp4",
    cdnUrl: "https://assets.mixkit.co/videos/preview/mixkit-golden-dust-particles-flying-in-the-air-42520-large.mp4",
  },
  {
    id: "history-06",
    name: "Tarixiy Vintage / Qadimiy Tekstura",
    category: "history",
    localPath: "/backgrounds/bg6.mp4",
    fallbackLocalPath: "/backgrounds/Dark abstract background 10.mp4",
    cdnUrl: "https://assets.mixkit.co/videos/preview/mixkit-vintage-film-grain-and-dust-loop-42880-large.mp4",
  },
  {
    id: "nebula-07",
    name: "Binafsha Kosmik Tumanlik",
    category: "nebula",
    localPath: "/backgrounds/bg7.mp4",
    fallbackLocalPath: "/backgrounds/Dark abstract background 11.mp4",
    cdnUrl: "https://assets.mixkit.co/videos/preview/mixkit-colorful-neon-light-trails-in-motion-42867-large.mp4",
  },
  {
    id: "smoke-08",
    name: "Qora Baxmal Tutun",
    category: "smoke",
    localPath: "/backgrounds/bg8.mp4",
    fallbackLocalPath: "/backgrounds/Dark abstract background 13.mp4",
    cdnUrl: "https://assets.mixkit.co/videos/preview/mixkit-curving-lines-of-smoke-and-ink-41485-large.mp4",
  },
  {
    id: "cyber-09",
    name: "Raqamli Matritsa / Kiber Tarmoq",
    category: "cyber",
    localPath: "/backgrounds/bg9.mp4",
    fallbackLocalPath: "/backgrounds/16833829_2160_3840_24fps.mp4",
    cdnUrl: "https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-blue-screens-41483-large.mp4",
  },
  {
    id: "fire-10",
    name: "Olov va Energiya Uchqunlari",
    category: "fire",
    localPath: "/backgrounds/bg10.mp4",
    fallbackLocalPath: "/backgrounds/Dark abstract background 12.mp4",
    cdnUrl: "https://assets.mixkit.co/videos/preview/mixkit-burning-fire-embers-flying-up-42521-large.mp4",
  },
];

// 4 ta tilga (UZ, RU, EN, TR) har safar 4 xil chiroyli video berish uchun xaritalash
export const DEFAULT_LANGUAGE_BACKGROUND_INDICES: Record<string, number> = {
  uz: 0, // Koinot va Yulduzlar
  ru: 1, // Qorong'i Abstrakt
  en: 2, // Kiber Neon Tunnel
  tr: 4, // Oltin Zarrachalar
};

const verifiedLocalUrls = new Set<string>();

/**
 * Berilgan index bo'yicha loop video URL qaytaradi.
 * Agar lokalda mavjud bo'lsa lokal yo'lni, aks holda tezkor CDN manzilini beradi.
 */
export async function resolveLoopVideoUrl(index: number): Promise<string> {
  const preset = PRESET_LOOP_VIDEOS[index % PRESET_LOOP_VIDEOS.length];
  const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  if (isLocal) {
    if (verifiedLocalUrls.has(preset.localPath)) {
      return preset.localPath;
    }
    // Lokal faylni tekshiramiz
    try {
      const res = await fetch(preset.localPath, { method: "HEAD" });
      if (res.ok) {
        verifiedLocalUrls.add(preset.localPath);
        return preset.localPath;
      }
    } catch {
      // ignore
    }

    // fallbackLocalPath tekshiramiz
    if (preset.fallbackLocalPath) {
      if (verifiedLocalUrls.has(preset.fallbackLocalPath)) {
        return preset.fallbackLocalPath;
      }
      try {
        const res = await fetch(encodeURI(preset.fallbackLocalPath), { method: "HEAD" });
        if (res.ok) {
          verifiedLocalUrls.add(preset.fallbackLocalPath);
          return preset.fallbackLocalPath;
        }
      } catch {
        // ignore
      }
    }
  }

  // Vercel production yoki lokalda bo'lmasa CDN manzilini beradi
  return preset.cdnUrl;
}

/**
 * 4 ta til uchun bir-biriga o'xshamaydigan 4 xil video fonini bir vaqtning o'zida qaytaradi.
 */
export async function getDistinctBackgroundVideosForLanguages(
  languages: string[],
  userUploadedVideos: string[] = []
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  for (let i = 0; i < languages.length; i++) {
    const lang = languages[i];
    if (userUploadedVideos.length > 0) {
      result[lang] = userUploadedVideos[i % userUploadedVideos.length];
    } else {
      const preferredIdx = DEFAULT_LANGUAGE_BACKGROUND_INDICES[lang] ?? i;
      result[lang] = await resolveLoopVideoUrl(preferredIdx);
    }
  }

  return result;
}
