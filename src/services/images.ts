// Yuklangan rasmlarni siqish.
//
// Telefon kamerasidan kelgan 4–8MB surat quiz obyekti ichida data: URL bo'lib qoladi va
// u yerdan uch joyga tarqaladi: localStorage avtosaqlashi (5MB limit), JSON eksporti va
// render paytidagi xotira. Render fonlari eng katta 1920px bo'lgani uchun bundan
// kattasini saqlashning umuman ma'nosi yo'q.
const MAX_EDGE_PX = 1920;
const JPEG_QUALITY = 0.82;

export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("FILE_READ_FAILED"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("IMAGE_DECODE_FAILED"));
    image.src = src;
  });
}

// Rasmni 1920px ichiga sig'diradi va JPEG'ga o'tkazadi. Har qanday xatoda asl faylni
// qaytaradi — siqish "yaxshilash", uning yiqilishi yuklashni to'xtatmasligi kerak.
export async function compressImageFile(file: Blob): Promise<string> {
  const original = await readFileAsDataUrl(file);

  try {
    const image = await loadImage(original);
    const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
    if (!longestEdge) return original;

    const scale = Math.min(1, MAX_EDGE_PX / longestEdge);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return original;

    // JPEG shaffoflikni qo'llab-quvvatlamaydi; quyuq fon ilova temasiga mos tushadi.
    context.fillStyle = "#000";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const compressed = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    // Kichik PNG (masalan logotip) JPEG'da kattaroq chiqishi mumkin — aslini qoldiramiz.
    return compressed.length < original.length ? compressed : original;
  } catch (error) {
    console.warn("Rasmni siqib bo'lmadi, asl fayl ishlatiladi:", error);
    return original;
  }
}
