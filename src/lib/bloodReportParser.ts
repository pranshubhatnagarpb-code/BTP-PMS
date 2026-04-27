// Blood report parser — calls the local Express server endpoint `/api/extract-blood-report`
// which uses OpenAI Vision API server-side to extract real values from the uploaded report.
//
// This file no longer does any client-side PDF/text parsing or guessing.
// Missing values come back as null and are NEVER substituted with defaults.
import { BLOOD_MARKERS, BloodMarkerKey } from './bloodMarkers';

export type ExtractedValues = Partial<Record<BloodMarkerKey, number>>;

export interface ExtractedMarker {
  value: number | null;
  unit: string | null;
  reference_range: string | null;
  status: 'low' | 'normal' | 'high' | null;
}

export interface ExtractionResult {
  values: ExtractedValues;
  markers: Partial<Record<BloodMarkerKey, ExtractedMarker>>;
  reportDate: string | null;
  labName: string | null;
  notes: string | null;
  warnings: string[];
}

const emptyResult = (warnings: string[]): ExtractionResult => ({
  values: {},
  markers: {},
  reportDate: null,
  labName: null, 
  notes: null,
  warnings,
});

export const extractFromFile = async (file: File): Promise<ExtractionResult> => {
  return extractFromFiles([file]);
};

export const extractFromFiles = async (files: File[]): Promise<ExtractionResult> => {
  // Validate all files
  for (const file of files) {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');
    if (!isPdf && !isImage) {
      return emptyResult([`Unsupported file type: ${file.name}. Please upload only images (JPG, PNG, etc).`]);
    }
  }

  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });

  const response = await fetch('/api/extract-blood-report', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (parseError) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }
    throw new Error(errorData.error || 'Extraction request failed');
  }

  const data = await response.json();
  
  if (!data) {
    return emptyResult(['Empty response from extraction service.']);
  }
  if ((data as any).error) {
    throw new Error((data as any).error);
  }

  const markersRaw = ((data as any).markers || {}) as Record<string, ExtractedMarker>;
  const values: ExtractedValues = {};
  const markers: Partial<Record<BloodMarkerKey, ExtractedMarker>> = {};

  for (const m of BLOOD_MARKERS) {
    const entry = markersRaw[m.key];
    if (!entry) continue;
    markers[m.key] = entry;
    if (typeof entry.value === 'number' && Number.isFinite(entry.value)) {
      values[m.key] = entry.value;
    }
  }

  const warnings: string[] = Array.isArray((data as any).warnings) ? (data as any).warnings : [];
  if (Object.keys(values).length === 0 && warnings.length === 0) {
    warnings.push('No biomarker values were detected in these reports. Please review and enter them manually.');
  }

  return {
    values,
    markers,
    reportDate: (data as any).reportDate ?? null,
    labName: (data as any).labName ?? null,
    notes: (data as any).notes ?? null,
    warnings,
  };
};
