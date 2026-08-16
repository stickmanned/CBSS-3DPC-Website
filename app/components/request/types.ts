export type MaterialSlug = "pla" | "petg" | "asa";

export type BoundingBoxMm = {
  x: number;
  y: number;
  z: number;
};

export type PreviewMetadata = {
  bboxMm: BoundingBoxMm;
  thumbnail: string | null;
  webglAvailable: boolean;
};

export type VerifiedUpload = {
  verifiedFileToken: string;
  file: {
    name: string;
    size: number;
    format: string;
    bboxMm?: BoundingBoxMm;
    thumbnail?: string | null;
  };
  bboxMm: BoundingBoxMm;
  thumbnail: string | null;
  uploadedForEmail: string;
};

export type RequestFieldErrors = Record<string, string[]>;


/** One paintable region of an uploaded model: a mesh, or a material slot
    within a mesh when a 3MF assigns several colours to one object. */
export type ModelPart = {
  id: string;
  name: string;
};
