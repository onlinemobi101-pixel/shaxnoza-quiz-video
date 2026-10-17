// Lokal muhitda (localhost / 127.0.0.1) videolarni brauzer dialogisiz
// to'g'ridan-to'g'ri kompyuterning ./output/day_{XX}/{lang}/ papkasiga saqlash xizmati.

export interface SaveLocalParams {
  day: number | string;
  lang: string;
  fileName: string;
  videoBlob: Blob;
  smmText?: string;
}

export async function saveVideoLocally(params: SaveLocalParams): Promise<{ ok: boolean; path?: string }> {
  try {
    const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    if (!isLocal) {
      return { ok: false };
    }

    const dayStr = String(params.day).padStart(2, "0");
    const smmBase64 = params.smmText ? btoa(unescape(encodeURIComponent(params.smmText))) : "";

    const res = await fetch("/api/save-local", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "x-day": dayStr,
        "x-lang": params.lang,
        "x-filename": encodeURIComponent(params.fileName),
        "x-smm-base64": smmBase64,
      },
      body: params.videoBlob,
    });

    if (!res.ok) {
      throw new Error(`HTTP_${res.status}`);
    }

    const data = await res.json();
    return { ok: true, path: data.path };
  } catch (err) {
    console.warn("Lokal papkaga saqlashda xatolik:", err);
    return { ok: false };
  }
}
