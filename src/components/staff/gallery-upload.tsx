"use client";

import { useActionState, useRef, useState } from "react";
import { uploadGalleryImage } from "@/app/staff/actions";
import { SubmitButton } from "@/components/staff/form-bits";
import { GALLERY_CATEGORIES, STAFF_GALLERY_LABELS } from "@/lib/gallery";

const MAX_EDGE = 1800;

async function shrink(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  return blob ?? file;
}

export function GalleryUpload() {
  const [state, action] = useActionState(uploadGalleryImage, null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  // Counts selections so a slow resize of an earlier file cannot overwrite a newer one.
  const selection = useRef(0);

  async function onFile(file: File | undefined) {
    const id = ++selection.current;
    if (preview) URL.revokeObjectURL(preview);
    setPrepared(null);
    setPreview(null);
    if (!file) return;
    setBusy(true);
    try {
      const blob = await shrink(file);
      if (id !== selection.current) return;
      setPrepared(blob);
      setPreview(URL.createObjectURL(blob));
    } finally {
      if (id === selection.current) setBusy(false);
    }
  }

  return (
    <form
      ref={form}
      className="grid gap-3 sm:grid-cols-2"
      action={(fd) => {
        if (!prepared) return;
        fd.set("file", new File([prepared], "photo.jpg", { type: prepared.type || "image/jpeg" }));
        action(fd);
        form.current?.reset();
        selection.current++;
        setPrepared(null);
        setPreview(null);
      }}
    >
      <div className="sm:col-span-2">
        <label htmlFor="g-file">Foto (JPG, PNG o WebP)</label>
        <input
          id="g-file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        {busy && <p className="mt-1 text-xs text-muted">Preparando la foto …</p>}
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview, nothing to optimise
          <img src={preview} alt="Vista previa" className="mt-2 max-h-48 rounded-md" />
        )}
      </div>
      <div>
        <label htmlFor="g-category">Categoría</label>
        <select id="g-category" name="category" defaultValue="food">
          {GALLERY_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {STAFF_GALLERY_LABELS[c.value]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="g-caption">Texto de la foto</label>
        <input id="g-caption" name="caption" maxLength={160} placeholder="Recién salido del horno" />
      </div>
      <div className="sm:col-span-2">
        <SubmitButton pendingText="Subiendo …">Subir foto</SubmitButton>
      </div>
      {state && !state.ok && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && <p className="text-sm text-emerald-700 sm:col-span-2">Foto publicada.</p>}
    </form>
  );
}
