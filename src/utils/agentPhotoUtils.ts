/**
 * Utilitaires de traitement des photos d'identité des agents (import appareil & capture caméra).
 * Recadre automatiquement au format portrait 3:4 (420 x 560 px) et compresse en JPEG
 * pour garantir un rendu net sur carte PVC CR80 tout en limitant le poids de stockage.
 */

const TARGET_WIDTH = 420;
const TARGET_HEIGHT = 560; // Ratio portrait 3:4 officiel photo d'identité
const MAX_RAW_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8 Mo avant compression
const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

function drawCoverPortraitToCanvas(
  source: HTMLImageElement | HTMLVideoElement,
  sourceWidth: number,
  sourceHeight: number
): string {
  if (!sourceWidth || !sourceHeight) {
    throw new Error('Image source invalide ou dimensions indisponibles.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = TARGET_WIDTH;
  canvas.height = TARGET_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Contexte graphique indisponible pour traiter la photo.');
  }

  // Fond neutre clair si transparence PNG
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);

  const targetRatio = TARGET_WIDTH / TARGET_HEIGHT;
  const sourceRatio = sourceWidth / sourceHeight;

  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;

  if (sourceRatio > targetRatio) {
    // Source plus large que 3:4 -> recadrage horizontal centré
    sw = sourceHeight * targetRatio;
    sx = (sourceWidth - sw) / 2;
  } else {
    // Source plus haute que 3:4 -> recadrage vertical légèrement centré vers le haut (visage)
    sh = sourceWidth / targetRatio;
    sy = Math.max(0, (sourceHeight - sh) * 0.35);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);

  return canvas.toDataURL('image/jpeg', 0.86);
}

/**
 * Valide, recadre en portrait 3:4 et compresse une image importée depuis l'appareil.
 */
export async function processAgentPhotoFile(file: File): Promise<string> {
  if (!file) {
    throw new Error('Aucun fichier sélectionné.');
  }

  const mime = (file.type || '').toLowerCase();
  const hasValidExt = /\.(jpe?g|png|webp)$/i.test(file.name || '');
  if (!ACCEPTED_MIME_TYPES.includes(mime) && !hasValidExt) {
    throw new Error('Format non pris en charge. Utilisez une image JPG, PNG ou WebP.');
  }

  if (file.size > MAX_RAW_FILE_SIZE_BYTES) {
    throw new Error('Fichier trop volumineux (maximum 8 Mo avant compression).');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Impossible de lire le fichier image.'));
      }
    };
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier image.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Le fichier sélectionné ne semble pas être une image valide.'));
    el.src = rawDataUrl;
  });

  return drawCoverPortraitToCanvas(img, img.naturalWidth || img.width, img.naturalHeight || img.height);
}

/**
 * Capture l'image courante d'un flux vidéo caméra et la recadre en portrait 3:4.
 */
export function captureVideoFrameToPortraitDataUrl(video: HTMLVideoElement): string {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) {
    throw new Error('Le flux caméra n’est pas encore prêt. Patientez un instant puis réessayez.');
  }
  return drawCoverPortraitToCanvas(video, width, height);
}
