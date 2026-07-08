/**
 * Upload client d'une vidéo de preuve C2C vers Cellar (S3) via URL présignée.
 *
 * 1. Demande une URL présignée PUT au serveur (`/api/c2c/upload-proof`), qui
 *    vérifie l'authentification et la possession de l'expédition.
 * 2. PUT direct navigateur → Cellar (le corps ne transite jamais par le serveur),
 *    avec suivi de progression via XHR.
 * 3. Renvoie l'URL publique de l'objet stocké.
 */
export async function uploadProofToCellar(
  file: Blob,
  opts: { shipmentId: string; onProgress?: (pct: number) => void },
): Promise<string> {
  // Normalise le type MIME : MediaRecorder produit p.ex. "video/webm;codecs=vp8".
  const contentType = (file.type.split(";")[0] || "video/webm").toLowerCase();

  const presignRes = await fetch("/api/c2c/upload-proof", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ shipmentId: opts.shipmentId, contentType }),
  });
  if (!presignRes.ok) {
    const data = (await presignRes.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "UPLOAD_FAILED");
  }
  const { uploadUrl, publicUrl } = (await presignRes.json()) as {
    uploadUrl: string;
    publicUrl: string;
  };

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    // Le Content-Type doit correspondre à celui signé côté serveur.
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("UPLOAD_FAILED"));
    xhr.onerror = () => reject(new Error("UPLOAD_FAILED"));
    xhr.onabort = () => reject(new Error("UPLOAD_ABORTED"));
    xhr.send(file);
  });

  return publicUrl;
}
